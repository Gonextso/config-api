import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import AppTokenHelper from '../../helpers/AppTokenHelper.js';

const secret = 'test-app-secret';
const now = 1_800_000_000;

const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const signed = (header, payload, key = secret) => {
    const h = encode(header);
    const p = encode(payload);
    const s = crypto.createHmac('sha256', key).update(`${h}.${p}`).digest('base64url');
    return `${h}.${p}.${s}`;
};
const validPayload = (overrides = {}) => ({
    iss: 'gonextso-shopify-app',
    aud: 'gonextso-config-api',
    sub: 'demo-store.myshopify.com',
    iat: now,
    exp: now + 60,
    ...overrides,
});

describe('AppTokenHelper', () => {
    describe('verify', () => {
        it('accepts a minted token and resolves the tenant name from the shop domain', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret, now });

            expect(AppTokenHelper.verify(token, { secret, now: now + 30 })).toEqual({
                shop: 'demo-store.myshopify.com',
                tenantName: 'demo-store',
            });
        });

        it('rejects a token signed with another secret', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret: 'other', now });

            expect(() => AppTokenHelper.verify(token, { secret, now })).toThrow('Invalid token signature');
        });

        it('rejects a tampered payload', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret, now });
            const [h, , s] = token.split('.');
            const forged = `${h}.${encode(validPayload({ sub: 'victim.myshopify.com' }))}.${s}`;

            expect(() => AppTokenHelper.verify(forged, { secret, now })).toThrow('Invalid token signature');
        });

        it('rejects expired tokens beyond the clock tolerance', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret, now });

            expect(() => AppTokenHelper.verify(token, { secret, now: now + 60 + 11 })).toThrow('Token expired');
            expect(() => AppTokenHelper.verify(token, { secret, now: now + 60 + 9 })).not.toThrow();
        });

        it('rejects tokens issued in the future', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret, now: now + 100 });

            expect(() => AppTokenHelper.verify(token, { secret, now })).toThrow('Token issued in the future');
        });

        it('rejects long-lived tokens', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret, now, ttl: 3600 });

            expect(() => AppTokenHelper.verify(token, { secret, now })).toThrow('Token lifetime too long');
        });

        it('rejects Shopify session tokens signed with the same app secret (wrong iss/aud)', () => {
            const shopifySessionToken = signed({ alg: 'HS256', typ: 'JWT' }, {
                iss: 'https://demo-store.myshopify.com/admin',
                dest: 'https://demo-store.myshopify.com',
                aud: 'client-id',
                sub: '42',
                iat: now,
                exp: now + 60,
            });

            expect(() => AppTokenHelper.verify(shopifySessionToken, { secret, now })).toThrow('Invalid token issuer');
        });

        it('rejects non-HS256 algorithms', () => {
            const token = signed({ alg: 'none', typ: 'JWT' }, validPayload());

            expect(() => AppTokenHelper.verify(token, { secret, now })).toThrow('Unsupported token algorithm');
        });

        it('rejects malformed tokens and invalid subjects', () => {
            expect(() => AppTokenHelper.verify('abc', { secret, now })).toThrow('Malformed token');
            expect(() => AppTokenHelper.verify('a.b.c', { secret, now })).toThrow('Malformed token');
            expect(() => AppTokenHelper.verify(signed({ alg: 'HS256' }, validPayload({ sub: '../etc' })), { secret, now }))
                .toThrow('Invalid token subject');
        });

        it('fails closed when no secret is configured', () => {
            const token = AppTokenHelper.mint('demo-store.myshopify.com', { secret, now });

            expect(() => AppTokenHelper.verify(token, { secret: '', now })).toThrow('App token secret is not configured');
        });
    });

    describe('getBearerToken', () => {
        it('extracts bearer tokens case-insensitively', () => {
            expect(AppTokenHelper.getBearerToken({ headers: { authorization: 'Bearer abc' } })).toBe('abc');
            expect(AppTokenHelper.getBearerToken({ headers: { authorization: 'bearer abc' } })).toBe('abc');
        });

        it('returns null for missing or non-bearer headers', () => {
            expect(AppTokenHelper.getBearerToken({ headers: {} })).toBeNull();
            expect(AppTokenHelper.getBearerToken({ headers: { authorization: 'Basic abc' } })).toBeNull();
        });
    });
});
