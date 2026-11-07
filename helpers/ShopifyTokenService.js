import LogHelper from './LogHelper.js';

// Prisma and CryptoHelper are loaded lazily: both have import-time side effects (DB connection,
// ENCRYPTION_KEY read), and this module is imported by ShopifyGqlAPI, which is imported widely.
let CryptoHelper;
let prisma;
const db = async () => {
    CryptoHelper ??= (await import('./CryptoHelper.js')).default;
    prisma ??= (await import('../builders/database/prismaBuilder.js')).default;

    return prisma;
};

// Single place that hands out a usable Shopify Admin API token for a tenant.
//
// Shopify's expiring offline tokens live ~1 hour and come with a rotating refresh token
// (~90 days). Every refresh returns a new pair and retires the old one, so refreshes must
// be serialized across all processes and services that share auths.shopify: the row is
// locked (SELECT ... FOR UPDATE) for the duration of a refresh, and whoever gets the lock
// second re-reads the row and reuses the pair the first one stored.
//
// Rows with access_token_expires_at = NULL hold a legacy non-expiring token; they are used
// as-is until the one-time migration replaces them.
//
// Keep this file identical in config-api and integration-api.

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const LEGACY_CACHE_MS = 5 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 15000;

export class ShopifyReauthRequiredError extends Error {
    constructor(tenantId, reason) {
        super(`Shopify access for tenant ${tenantId} needs re-authorization: ${reason}. The merchant must reopen the app.`);
        this.name = 'ShopifyReauthRequiredError';
        this.tenantId = tenantId;
        this.reason = reason;
    }
}

const cache = new Map();    // tenantId -> { token, cacheUntil }
const inflight = new Map(); // tenantId -> Promise<string|null>

const logger = () => new LogHelper();

const decryptApiKey = row => CryptoHelper.decrypt({
    encryptedData: row.apiKeyEncryptedData,
    iv: row.apiKeyIv,
    authTag: row.apiKeyAuthTag,
});

const decryptRefreshToken = row => CryptoHelper.decrypt({
    encryptedData: row.refreshTokenEncryptedData,
    iv: row.refreshTokenIv,
    authTag: row.refreshTokenAuthTag,
});

const isFresh = (row, now) => row.accessTokenExpiresAt && row.accessTokenExpiresAt.getTime() - now > REFRESH_MARGIN_MS;

const remember = (tenantId, token, row, now) => {
    const cacheUntil = row.accessTokenExpiresAt
        ? row.accessTokenExpiresAt.getTime() - REFRESH_MARGIN_MS
        : now + LEGACY_CACHE_MS;
    cache.set(tenantId, { token, cacheUntil });

    return token;
};

const toDate = value => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
};

// Columns for an access token (+ optional refresh token). A legacy token clears the expiring columns.
const tokenColumns = ({ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }) => {
    const access = CryptoHelper.encrypt(accessToken);
    const refresh = refreshToken ? CryptoHelper.encrypt(refreshToken) : null;

    return {
        apiKeyHash: access.hash,
        apiKeyEncryptedData: access.encryptedData,
        apiKeyIv: access.iv,
        apiKeyAuthTag: access.authTag,
        accessTokenExpiresAt: accessTokenExpiresAt ?? null,
        refreshTokenEncryptedData: refresh?.encryptedData ?? null,
        refreshTokenIv: refresh?.iv ?? null,
        refreshTokenAuthTag: refresh?.authTag ?? null,
        refreshTokenExpiresAt: refresh ? (refreshTokenExpiresAt ?? null) : null,
        reauthRequiredAt: null,
    };
};

const lockRow = (tx, tenantId) => tx.$queryRaw`SELECT "id" FROM "auths"."shopify" WHERE "tenant_id" = ${tenantId} FOR UPDATE`;

export default class ShopifyTokenService {
    static REFRESH_MARGIN_MS = REFRESH_MARGIN_MS;

    /**
     * Returns a usable access token for the tenant, refreshing it when it is about to expire.
     * Returns null when the tenant has no stored token (callers may fall back to what they have).
     *
     * @param {string} tenantId
     * @param {string} shopDomain e.g. "demo-store.myshopify.com"
     * @param {{ rejectedToken?: string }} options pass the token Shopify just rejected with 401
     *        to force a refresh unless another process already replaced it.
     */
    static getAccessToken = async (tenantId, shopDomain, { rejectedToken } = {}) => {
        const cached = cache.get(tenantId);
        if (!rejectedToken && cached && cached.cacheUntil > Date.now()) return cached.token;
        if (rejectedToken) cache.delete(tenantId);

        if (inflight.has(tenantId)) return inflight.get(tenantId);

        const pending = this.#resolve(tenantId, shopDomain, rejectedToken)
            .finally(() => inflight.delete(tenantId));
        inflight.set(tenantId, pending);

        return pending;
    }

    /**
     * Stores a token pair handed over by the app (install / reopen). Never replaces a newer
     * expiring pair with an older one, and never downgrades an expiring pair to a legacy token.
     *
     * @returns {Promise<{ stored: boolean, reason?: string }>}
     */
    static storeTokens = async (tenantId, { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }) => {
        if (!accessToken) return { stored: false, reason: 'no_access_token' };

        const incoming = {
            accessToken,
            accessTokenExpiresAt: toDate(accessTokenExpiresAt),
            refreshToken: refreshToken || null,
            refreshTokenExpiresAt: toDate(refreshTokenExpiresAt),
        };
        if (incoming.refreshToken && !incoming.accessTokenExpiresAt) {
            return { stored: false, reason: 'refresh_token_without_expiry' };
        }

        const result = await (await db()).$transaction(async tx => {
            await lockRow(tx, tenantId);
            const row = await tx.authShopify.findUnique({ where: { tenantId } });

            const sameToken = row?.apiKeyHash === CryptoHelper.hashKey(accessToken);

            // An expiring token is only useful here with its refresh token: storing it alone would
            // drop the refresh token we hold and strand the tenant within the hour. The app strips
            // refresh tokens from its local sessions, so it legitimately re-sends known tokens without one.
            if (incoming.accessTokenExpiresAt && !incoming.refreshToken) {
                return { stored: false, reason: sameToken ? 'unchanged' : 'missing_refresh_token' };
            }

            if (!row) {
                await tx.authShopify.create({ data: { tenantId, ...tokenColumns(incoming) } });
                return { stored: true };
            }

            if (row.accessTokenExpiresAt && !incoming.accessTokenExpiresAt) {
                return { stored: false, reason: 'would_downgrade_to_non_expiring' };
            }
            if (row.accessTokenExpiresAt && incoming.accessTokenExpiresAt <= row.accessTokenExpiresAt && !(sameToken && row.reauthRequiredAt)) {
                return { stored: false, reason: sameToken ? 'unchanged' : 'older_than_stored' };
            }
            if (!row.accessTokenExpiresAt && !incoming.accessTokenExpiresAt && sameToken) {
                return { stored: false, reason: 'unchanged' };
            }

            await tx.authShopify.update({ where: { tenantId }, data: tokenColumns(incoming) });
            return { stored: true };
        }, { timeout: 15000, maxWait: 10000 });

        if (result.stored) cache.delete(tenantId);

        return result;
    }

    static invalidate = tenantId => cache.delete(tenantId);

    static #resolve = async (tenantId, shopDomain, rejectedToken) => {
        const now = Date.now();
        const row = await (await db()).authShopify.findUnique({ where: { tenantId } });

        if (!row?.apiKeyEncryptedData) return null;

        const token = decryptApiKey(row);

        // Legacy tokens cannot be refreshed; re-reading the row is all we can do.
        if (!row.accessTokenExpiresAt) return remember(tenantId, token, row, now);

        if (isFresh(row, now) && token !== rejectedToken) return remember(tenantId, token, row, now);

        return this.#refreshLocked(tenantId, shopDomain, rejectedToken);
    }

    static #refreshLocked = async (tenantId, shopDomain, rejectedToken) => {
        const outcome = await (await db()).$transaction(async tx => {
            await lockRow(tx, tenantId);
            const row = await tx.authShopify.findUnique({ where: { tenantId } });
            const now = Date.now();

            if (!row?.apiKeyEncryptedData) return { token: null };

            const current = decryptApiKey(row);

            // Another process refreshed (or the app stored a new pair) while we waited.
            if (!row.accessTokenExpiresAt || (isFresh(row, now) && current !== rejectedToken)) {
                return { token: current, row };
            }

            if (!row.refreshTokenEncryptedData) return { reauth: 'no_refresh_token' };
            if (row.refreshTokenExpiresAt && row.refreshTokenExpiresAt.getTime() <= now) return { reauth: 'refresh_token_expired' };

            let refreshed;
            try {
                refreshed = await this.requestRefresh(shopDomain, decryptRefreshToken(row));
            } catch (error) {
                if (error.isInvalidRefreshToken) return { reauth: `refresh_rejected_${error.status}` };
                throw error;
            }

            const columns = tokenColumns({
                accessToken: refreshed.accessToken,
                accessTokenExpiresAt: new Date(now + refreshed.expiresIn * 1000),
                refreshToken: refreshed.refreshToken,
                refreshTokenExpiresAt: refreshed.refreshTokenExpiresIn ? new Date(now + refreshed.refreshTokenExpiresIn * 1000) : null,
            });
            const updated = await tx.authShopify.update({
                where: { tenantId },
                data: { ...columns, tokenRefreshedAt: new Date(now) },
            });

            return { token: refreshed.accessToken, row: updated };
        }, { timeout: REFRESH_TIMEOUT_MS + 15000, maxWait: 15000 });

        if (outcome.reauth) {
            // Recorded outside the transaction above so the flag survives the error we throw.
            await (await db()).authShopify.update({ where: { tenantId }, data: { reauthRequiredAt: new Date() } })
                .catch(error => logger().error(`[ShopifyTokenService] Could not flag reauth for ${tenantId}: ${error.message}`));
            cache.delete(tenantId);
            logger().error(`[ShopifyTokenService] Tenant ${tenantId} needs re-authorization (${outcome.reauth})`);
            throw new ShopifyReauthRequiredError(tenantId, outcome.reauth);
        }

        if (!outcome.token) return null;

        return remember(tenantId, outcome.token, outcome.row, Date.now());
    }

    // POST /admin/oauth/access_token with grant_type=refresh_token. Uses fetch on purpose:
    // the shared HTTP helpers log response bodies, which would leak the new tokens.
    static requestRefresh = async (shopDomain, refreshToken) => {
        const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({
                client_id: process.env.SHOPIFY_CLIENT_ID ?? '',
                client_secret: process.env.SHOPIFY_CLIENT_SECRET ?? '',
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
            signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok || !body.access_token || !body.expires_in) {
            const error = new Error(`Shopify token refresh failed for ${shopDomain}: HTTP ${response.status} ${body.error ?? ''}`.trim());
            error.status = response.status;
            error.isInvalidRefreshToken = response.status === 401 || body.error === 'invalid_request' || body.error === 'invalid_grant';
            throw error;
        }

        return {
            accessToken: body.access_token,
            expiresIn: Number(body.expires_in),
            refreshToken: body.refresh_token,
            refreshTokenExpiresIn: body.refresh_token_expires_in ? Number(body.refresh_token_expires_in) : null,
        };
    }

    // Test hook.
    static _resetForTests = () => {
        cache.clear();
        inflight.clear();
    }
}
