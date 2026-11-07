import crypto from 'crypto';

// Short-lived HS256 JWT minted by the Shopify app server (Remix) for each call to config-api.
// It replaces the raw Shopify offline access token that used to travel in `x-api-key`:
// expiring offline tokens rotate, so their hash can no longer identify a tenant, and the
// Shopify token should not leave the app server just to authenticate our own services.
//
// Claims: iss/aud are fixed strings (so a Shopify-issued session token signed with the same
// app secret is never accepted here), sub is the shop domain, exp is a few seconds after iat.
export const APP_TOKEN_ISSUER = 'gonextso-shopify-app';
export const APP_TOKEN_AUDIENCE = 'gonextso-config-api';

const CLOCK_TOLERANCE_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 300;
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/;

const base64UrlDecode = (segment) => Buffer.from(segment, 'base64url').toString('utf8');

const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

const fail = (reason) => {
    const error = new Error(reason);
    error.name = 'AppTokenError';
    throw error;
};

export default class AppTokenHelper {
    static getBearerToken = (req) => {
        const header = req.headers?.authorization ?? '';
        const [scheme, token] = header.split(' ');

        return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
    }

    // Exposed for tests and tooling; production tokens are minted by the Remix app.
    static mint = (shop, { secret = process.env.SHOPIFY_CLIENT_SECRET, now = Math.floor(Date.now() / 1000), ttl = 60 } = {}) => {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            iss: APP_TOKEN_ISSUER,
            aud: APP_TOKEN_AUDIENCE,
            sub: shop,
            iat: now,
            exp: now + ttl,
            jti: crypto.randomUUID(),
        })).toString('base64url');

        return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
    }

    // Returns { shop, tenantName } or throws an AppTokenError with a short reason.
    static verify = (token, { secret = process.env.SHOPIFY_CLIENT_SECRET, now = Math.floor(Date.now() / 1000) } = {}) => {
        if (!secret) fail('App token secret is not configured');
        if (typeof token !== 'string') fail('Token missing');

        const parts = token.split('.');
        if (parts.length !== 3) fail('Malformed token');

        const [headerSegment, payloadSegment, signatureSegment] = parts;

        let header;
        let payload;
        try {
            header = JSON.parse(base64UrlDecode(headerSegment));
            payload = JSON.parse(base64UrlDecode(payloadSegment));
        } catch {
            fail('Malformed token');
        }

        if (header?.alg !== 'HS256') fail('Unsupported token algorithm');

        const expected = Buffer.from(sign(`${headerSegment}.${payloadSegment}`, secret));
        const provided = Buffer.from(signatureSegment);
        if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
            fail('Invalid token signature');
        }

        if (payload.iss !== APP_TOKEN_ISSUER) fail('Invalid token issuer');
        if (payload.aud !== APP_TOKEN_AUDIENCE) fail('Invalid token audience');
        if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) fail('Token is missing iat/exp');
        if (payload.exp - payload.iat > MAX_LIFETIME_SECONDS) fail('Token lifetime too long');
        if (payload.iat > now + CLOCK_TOLERANCE_SECONDS) fail('Token issued in the future');
        if (payload.exp < now - CLOCK_TOLERANCE_SECONDS) fail('Token expired');

        const shop = typeof payload.sub === 'string' ? payload.sub.toLowerCase() : '';
        if (!SHOP_DOMAIN_PATTERN.test(shop)) fail('Invalid token subject');

        // Tenant names are the first label of the shop domain (see CreateOrGetTenant in the app).
        return { shop, tenantName: shop.split('.')[0] };
    }
}
