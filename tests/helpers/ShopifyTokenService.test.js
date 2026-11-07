import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.HASH_SECRET = 'hash-secret';
process.env.SHOPIFY_CLIENT_ID = 'client-id';
process.env.SHOPIFY_CLIENT_SECRET = 'client-secret';

// In-memory stand-in for auths.shopify, keyed by tenantId.
const rows = new Map();
const lockCalls = [];
const authShopify = {
    findUnique: jest.fn(async ({ where }) => (rows.has(where.tenantId) ? { ...rows.get(where.tenantId) } : null)),
    update: jest.fn(async ({ where, data }) => {
        const updated = { ...rows.get(where.tenantId), ...data };
        rows.set(where.tenantId, updated);
        return { ...updated };
    }),
    create: jest.fn(async ({ data }) => {
        rows.set(data.tenantId, { ...data });
        return { ...data };
    }),
};
const tx = {
    authShopify,
    $queryRaw: jest.fn(async (strings, ...values) => {
        lockCalls.push({ sql: strings.join('?'), values });
        return [];
    }),
};
const mockPrisma = {
    authShopify,
    $transaction: jest.fn(async (fn) => fn(tx)),
};

await jest.unstable_mockModule('../../builders/database/prismaBuilder.js', () => ({ default: mockPrisma }));
await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
    default: jest.fn().mockImplementation(() => ({ error: jest.fn(), warn: jest.fn(), info2: jest.fn() })),
}));

const { default: CryptoHelper } = await import('../../helpers/CryptoHelper.js');
const { default: ShopifyTokenService, ShopifyReauthRequiredError } = await import('../../helpers/ShopifyTokenService.js');

const TENANT = 'tenant-1';
const SHOP = 'demo-store.myshopify.com';
const MINUTE = 60 * 1000;

const accessColumns = (token, expiresAt = null) => {
    const enc = CryptoHelper.encrypt(token);
    return {
        tenantId: TENANT,
        apiKeyHash: enc.hash,
        apiKeyEncryptedData: enc.encryptedData,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        accessTokenExpiresAt: expiresAt,
    };
};
const refreshColumns = (token, expiresAt = new Date(Date.now() + 90 * 24 * 60 * MINUTE)) => {
    const enc = CryptoHelper.encrypt(token);
    return {
        refreshTokenEncryptedData: enc.encryptedData,
        refreshTokenIv: enc.iv,
        refreshTokenAuthTag: enc.authTag,
        refreshTokenExpiresAt: expiresAt,
    };
};
const decrypt = (row, prefix) => CryptoHelper.decrypt({
    encryptedData: row[`${prefix}EncryptedData`],
    iv: row[`${prefix}Iv`],
    authTag: row[`${prefix}AuthTag`],
});

const refreshResponse = (n) => ({
    ok: true,
    status: 200,
    json: async () => ({
        access_token: `shpat_new_${n}`,
        expires_in: 3600,
        refresh_token: `shprt_new_${n}`,
        refresh_token_expires_in: 7776000,
        scope: 'read_products',
    }),
});

describe('ShopifyTokenService', () => {
    beforeEach(() => {
        rows.clear();
        lockCalls.length = 0;
        jest.clearAllMocks();
        ShopifyTokenService._resetForTests();
        global.fetch = jest.fn();
    });

    describe('getAccessToken', () => {
        it('returns null when the tenant has no stored token', async () => {
            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBeNull();
        });

        it('returns legacy non-expiring tokens as-is without refreshing', async () => {
            rows.set(TENANT, accessColumns('shpat_legacy'));

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_legacy');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('returns a fresh expiring token and serves repeats from cache', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_fresh', new Date(Date.now() + 50 * MINUTE)), ...refreshColumns('shprt_1') });

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_fresh');
            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_fresh');
            expect(authShopify.findUnique).toHaveBeenCalledTimes(1);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('refreshes a token close to expiry under a row lock and stores the rotated pair', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_old', new Date(Date.now() + 2 * MINUTE)), ...refreshColumns('shprt_old') });
            global.fetch.mockResolvedValue(refreshResponse(1));

            const token = await ShopifyTokenService.getAccessToken(TENANT, SHOP);

            expect(token).toBe('shpat_new_1');
            expect(lockCalls[0].sql).toContain('FOR UPDATE');
            expect(lockCalls[0].values).toEqual([TENANT]);

            const [url, init] = global.fetch.mock.calls[0];
            expect(url).toBe(`https://${SHOP}/admin/oauth/access_token`);
            expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(Object.fromEntries(init.body)).toEqual({
                client_id: 'client-id',
                client_secret: 'client-secret',
                grant_type: 'refresh_token',
                refresh_token: 'shprt_old',
            });

            const row = rows.get(TENANT);
            expect(decrypt(row, 'apiKey')).toBe('shpat_new_1');
            expect(decrypt(row, 'refreshToken')).toBe('shprt_new_1');
            expect(row.apiKeyHash).toBe(CryptoHelper.hashKey('shpat_new_1'));
            expect(row.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 55 * MINUTE);
            expect(row.tokenRefreshedAt).toBeInstanceOf(Date);
            expect(row.reauthRequiredAt).toBeNull();
        });

        it('deduplicates concurrent refreshes for the same tenant in one process', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_old', new Date(Date.now() - MINUTE)), ...refreshColumns('shprt_old') });
            global.fetch.mockResolvedValue(refreshResponse(1));

            const tokens = await Promise.all([1, 2, 3].map(() => ShopifyTokenService.getAccessToken(TENANT, SHOP)));

            expect(tokens).toEqual(['shpat_new_1', 'shpat_new_1', 'shpat_new_1']);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('reuses a pair another process stored while waiting for the lock', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_old', new Date(Date.now() - MINUTE)), ...refreshColumns('shprt_old') });
            // Simulate another process finishing its refresh right before we get the lock.
            tx.$queryRaw.mockImplementationOnce(async () => {
                rows.set(TENANT, { ...rows.get(TENANT), ...accessColumns('shpat_other', new Date(Date.now() + 59 * MINUTE)), ...refreshColumns('shprt_other') });
                return [];
            });

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_other');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('forces a refresh when Shopify rejected the current (unexpired) token', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_current', new Date(Date.now() + 50 * MINUTE)), ...refreshColumns('shprt_1') });
            global.fetch.mockResolvedValue(refreshResponse(2));

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP, { rejectedToken: 'shpat_current' })).toBe('shpat_new_2');
        });

        it('does not refresh when the rejected token was already replaced', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_current', new Date(Date.now() + 50 * MINUTE)), ...refreshColumns('shprt_1') });

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP, { rejectedToken: 'shpat_stale' })).toBe('shpat_current');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('flags the tenant for re-authorization when Shopify rejects the refresh token', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_old', new Date(Date.now() - MINUTE)), ...refreshColumns('shprt_dead') });
            global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'invalid_request' }) });

            await expect(ShopifyTokenService.getAccessToken(TENANT, SHOP)).rejects.toBeInstanceOf(ShopifyReauthRequiredError);
            expect(rows.get(TENANT).reauthRequiredAt).toBeInstanceOf(Date);
        });

        it('flags re-authorization when an expired token has no refresh token', async () => {
            rows.set(TENANT, accessColumns('shpat_old', new Date(Date.now() - MINUTE)));

            await expect(ShopifyTokenService.getAccessToken(TENANT, SHOP)).rejects.toThrow('no_refresh_token');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('surfaces transient refresh failures without flagging re-authorization', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_old', new Date(Date.now() - MINUTE)), ...refreshColumns('shprt_1') });
            global.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

            await expect(ShopifyTokenService.getAccessToken(TENANT, SHOP)).rejects.toThrow('HTTP 503');
            expect(rows.get(TENANT).reauthRequiredAt).toBeUndefined();
        });
    });

    describe('storeTokens', () => {
        const inOneHour = () => new Date(Date.now() + 60 * MINUTE).toISOString();

        it('creates the auth row when none exists', async () => {
            const result = await ShopifyTokenService.storeTokens(TENANT, {
                accessToken: 'shpat_a', accessTokenExpiresAt: inOneHour(), refreshToken: 'shprt_a', refreshTokenExpiresAt: inOneHour(),
            });

            expect(result).toEqual({ stored: true });
            expect(decrypt(rows.get(TENANT), 'refreshToken')).toBe('shprt_a');
        });

        it('upgrades a legacy token to an expiring pair', async () => {
            rows.set(TENANT, accessColumns('shpat_legacy'));

            const result = await ShopifyTokenService.storeTokens(TENANT, {
                accessToken: 'shpat_a', accessTokenExpiresAt: inOneHour(), refreshToken: 'shprt_a',
            });

            expect(result).toEqual({ stored: true });
            expect(decrypt(rows.get(TENANT), 'apiKey')).toBe('shpat_a');
            expect(lockCalls).toHaveLength(1);
        });

        it('refuses to downgrade an expiring pair to a legacy token', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_a', new Date(Date.now() + 30 * MINUTE)), ...refreshColumns('shprt_a') });

            const result = await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_legacy' });

            expect(result).toEqual({ stored: false, reason: 'would_downgrade_to_non_expiring' });
            expect(decrypt(rows.get(TENANT), 'apiKey')).toBe('shpat_a');
        });

        it('keeps a newer stored pair over an older one from the app', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_newer', new Date(Date.now() + 50 * MINUTE)), ...refreshColumns('shprt_newer') });

            const result = await ShopifyTokenService.storeTokens(TENANT, {
                accessToken: 'shpat_older', accessTokenExpiresAt: new Date(Date.now() + 10 * MINUTE), refreshToken: 'shprt_older',
            });

            expect(result).toEqual({ stored: false, reason: 'older_than_stored' });
            expect(decrypt(rows.get(TENANT), 'apiKey')).toBe('shpat_newer');
        });

        it('replaces the stored pair with a newer one and clears the re-auth flag', async () => {
            rows.set(TENANT, {
                ...accessColumns('shpat_old', new Date(Date.now() - MINUTE)), ...refreshColumns('shprt_old'), reauthRequiredAt: new Date(),
            });

            const result = await ShopifyTokenService.storeTokens(TENANT, {
                accessToken: 'shpat_new', accessTokenExpiresAt: inOneHour(), refreshToken: 'shprt_new',
            });

            expect(result).toEqual({ stored: true });
            expect(rows.get(TENANT).reauthRequiredAt).toBeNull();
        });

        it('replaces a legacy token with a different legacy token and skips identical ones', async () => {
            rows.set(TENANT, accessColumns('shpat_legacy_1'));

            expect(await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_legacy_1' })).toEqual({ stored: false, reason: 'unchanged' });
            expect(await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_legacy_2' })).toEqual({ stored: true });
            expect(decrypt(rows.get(TENANT), 'apiKey')).toBe('shpat_legacy_2');
        });

        it('rejects a refresh token without an access token expiry', async () => {
            expect(await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_a', refreshToken: 'shprt_a' }))
                .toEqual({ stored: false, reason: 'refresh_token_without_expiry' });
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('refuses a new expiring token that arrives without its refresh token', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_a', new Date(Date.now() + 10 * MINUTE)), ...refreshColumns('shprt_a') });

            expect(await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_b', accessTokenExpiresAt: inOneHour() }))
                .toEqual({ stored: false, reason: 'missing_refresh_token' });
            expect(decrypt(rows.get(TENANT), 'refreshToken')).toBe('shprt_a');
        });

        it('treats a known expiring token re-sent without refresh token as unchanged', async () => {
            const expiresAt = new Date(Date.now() + 40 * MINUTE);
            rows.set(TENANT, { ...accessColumns('shpat_a', expiresAt), ...refreshColumns('shprt_a') });

            expect(await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_a', accessTokenExpiresAt: expiresAt.toISOString() }))
                .toEqual({ stored: false, reason: 'unchanged' });
        });

        it('invalidates the cached token after storing', async () => {
            rows.set(TENANT, { ...accessColumns('shpat_cached', new Date(Date.now() + 30 * MINUTE)), ...refreshColumns('shprt_a') });
            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_cached');

            await ShopifyTokenService.storeTokens(TENANT, { accessToken: 'shpat_new', accessTokenExpiresAt: inOneHour(), refreshToken: 'shprt_new' });

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_new');
        });
    });

    describe('migrateLegacyToken', () => {
        const failure = (status, error) => ({ ok: false, status, json: async () => ({ error }) });

        it('exchanges a legacy token for an expiring pair under a row lock', async () => {
            rows.set(TENANT, accessColumns('shpat_legacy'));
            global.fetch.mockResolvedValue(refreshResponse(1));

            const result = await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP);

            expect(result).toEqual({ migrated: true, token: 'shpat_new_1' });
            expect(lockCalls[0].sql).toContain('FOR UPDATE');

            const [url, init] = global.fetch.mock.calls[0];
            expect(url).toBe(`https://${SHOP}/admin/oauth/access_token`);
            expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(Object.fromEntries(init.body)).toEqual({
                client_id: 'client-id',
                client_secret: 'client-secret',
                grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                subject_token: 'shpat_legacy',
                subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
                requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
                expiring: '1',
            });

            const row = rows.get(TENANT);
            expect(decrypt(row, 'apiKey')).toBe('shpat_new_1');
            expect(decrypt(row, 'refreshToken')).toBe('shprt_new_1');
            expect(row.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 55 * MINUTE);
            expect(row.refreshTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * MINUTE);
            expect(row.tokenRefreshedAt).toBeInstanceOf(Date);
            expect(row.reauthRequiredAt).toBeNull();
        });

        it('serves the migrated token instead of a cached legacy one', async () => {
            rows.set(TENANT, accessColumns('shpat_legacy'));
            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_legacy');
            global.fetch.mockResolvedValue(refreshResponse(2));

            await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP);

            expect(await ShopifyTokenService.getAccessToken(TENANT, SHOP)).toBe('shpat_new_2');
        });

        it('skips rows that became expiring while waiting for the lock', async () => {
            const expiring = { ...accessColumns('shpat_app', new Date(Date.now() + 50 * MINUTE)), ...refreshColumns('shprt_app') };
            rows.set(TENANT, expiring);

            expect(await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP)).toEqual({ migrated: false, reason: 'already_expiring' });
            expect(global.fetch).not.toHaveBeenCalled();
            expect(rows.get(TENANT)).toEqual(expiring);
        });

        it('skips tenants without a stored token', async () => {
            expect(await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP)).toEqual({ migrated: false, reason: 'no_token' });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it.each([
            ['an invalid subject token', () => failure(400, 'invalid_subject_token'), 400, 'invalid_subject_token'],
            ['an uninstalled shop', () => failure(401, 'invalid_request'), 401, 'invalid_request'],
            ['a response without a refresh token', () => ({ ok: true, status: 200, json: async () => ({ access_token: 'shpat_x', expires_in: 3600 }) }), 200, undefined],
        ])('leaves the row untouched and does not flag re-auth on %s', async (_label, response, status, error) => {
            const legacy = accessColumns('shpat_legacy');
            rows.set(TENANT, legacy);
            global.fetch.mockResolvedValue(response());

            const result = await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP);

            expect(result).toMatchObject({ migrated: false, reason: 'exchange_failed', status });
            if (error) expect(result.error).toBe(error);
            expect(rows.get(TENANT)).toEqual(legacy);
            expect(authShopify.update).not.toHaveBeenCalled();
        });

        it('leaves the row untouched on network errors', async () => {
            const legacy = accessColumns('shpat_legacy');
            rows.set(TENANT, legacy);
            global.fetch.mockRejectedValue(new Error('socket hang up'));

            const result = await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP);

            expect(result).toMatchObject({ migrated: false, reason: 'exchange_failed', error: 'socket hang up' });
            expect(rows.get(TENANT)).toEqual(legacy);
        });

        it('never puts token values in failure reasons', async () => {
            rows.set(TENANT, accessColumns('shpat_legacy'));
            global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ access_token: 'shpat_leak', refresh_token: 'shprt_leak' }) });

            const result = await ShopifyTokenService.migrateLegacyToken(TENANT, SHOP);

            expect(JSON.stringify(result)).not.toMatch(/shpat_|shprt_/);
        });
    });
});
