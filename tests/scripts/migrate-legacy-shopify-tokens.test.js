import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const { parseArgs, run, shopDomainOf } = await import('../../scripts/migrate-legacy-shopify-tokens.mjs');

const row = (tenantId, shopName, isActive = true) => ({
    tenantId,
    tenant: { name: shopName, isActive, shopify: { name: shopName } },
});

const okShop = domain => ({ ok: true, status: 200, json: async () => ({ data: { shop: { myshopifyDomain: domain } } }) });

describe('migrate-legacy-shopify-tokens', () => {
    let prisma;
    let service;
    let fetchImpl;
    let lines;
    const log = line => lines.push(line);
    const sleep = jest.fn(async () => {});

    beforeEach(() => {
        lines = [];
        sleep.mockClear();
        prisma = { authShopify: { findMany: jest.fn(async () => [row('t-1', 'shop-a'), row('t-2', 'shop-b')]) } };
        service = { migrateLegacyToken: jest.fn() };
        fetchImpl = jest.fn();
    });

    describe('parseArgs', () => {
        it('defaults to a dry run', () => {
            expect(parseArgs([])).toEqual({ apply: false, tenantId: null, limit: null, includeInactive: false });
        });

        it('parses apply, tenant, limit and include-inactive', () => {
            expect(parseArgs(['--apply', '--tenant', 't-1', '--limit', '3', '--include-inactive']))
                .toEqual({ apply: true, tenantId: 't-1', limit: 3, includeInactive: true });
        });

        it('rejects unknown arguments and invalid values', () => {
            expect(() => parseArgs(['--aply'])).toThrow('Unknown argument');
            expect(() => parseArgs(['--tenant'])).toThrow('--tenant');
            expect(() => parseArgs(['--limit', '0'])).toThrow('--limit');
        });
    });

    it('builds the myshopify domain from the Shopify shop name', () => {
        expect(shopDomainOf({ tenant: { name: 'tenant', shopify: { name: 'shop-x' } } })).toBe('shop-x.myshopify.com');
        expect(shopDomainOf({ tenant: { name: 'tenant', shopify: null } })).toBe('tenant.myshopify.com');
        expect(shopDomainOf({ tenant: null })).toBeNull();
    });

    it('selects only active legacy rows by default', async () => {
        await run({ args: parseArgs([]), prisma, service, fetchImpl, log, sleep });

        expect(prisma.authShopify.findMany.mock.calls[0][0].where).toEqual({
            accessTokenExpiresAt: null,
            apiKeyEncryptedData: { not: null },
            tenant: { isActive: true },
        });
    });

    it('passes tenant and limit filters through', async () => {
        await run({ args: parseArgs(['--tenant', 't-9', '--limit', '2', '--include-inactive']), prisma, service, fetchImpl, log, sleep });

        const query = prisma.authShopify.findMany.mock.calls[0][0];
        expect(query.where).toEqual({ accessTokenExpiresAt: null, apiKeyEncryptedData: { not: null }, tenantId: 't-9' });
        expect(query.take).toBe(2);
    });

    it('dry run lists rows without calling Shopify or changing anything', async () => {
        const summary = await run({ args: parseArgs([]), prisma, service, fetchImpl, log, sleep });

        expect(service.migrateLegacyToken).not.toHaveBeenCalled();
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(summary.results.map(r => r.outcome)).toEqual(['dry_run', 'dry_run']);
        expect(lines[0]).toContain('dry run');
    });

    it('migrates sequentially, verifies each new token and never logs it', async () => {
        service.migrateLegacyToken
            .mockResolvedValueOnce({ migrated: true, token: 'shpat_secret_a' })
            .mockResolvedValueOnce({ migrated: false, reason: 'exchange_failed', status: 400, error: 'invalid_subject_token' });
        fetchImpl.mockResolvedValue(okShop('shop-a.myshopify.com'));

        const summary = await run({ args: parseArgs(['--apply']), prisma, service, fetchImpl, log, sleep });

        expect(service.migrateLegacyToken.mock.calls).toEqual([['t-1', 'shop-a.myshopify.com'], ['t-2', 'shop-b.myshopify.com']]);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][1].headers['X-Shopify-Access-Token']).toBe('shpat_secret_a');
        expect(summary).toMatchObject({ total: 2, migrated: 1, skipped: 0, failed: 1 });
        expect(summary.results[0]).toMatchObject({ outcome: 'migrated', check: 'ok' });
        expect(summary.results[1]).toMatchObject({ outcome: 'exchange_failed', status: 400, error: 'invalid_subject_token' });
        expect(sleep).toHaveBeenCalledTimes(1);
        expect(lines.join('\n')).not.toContain('shpat_secret_a');
    });

    it('counts rows migrated meanwhile as skipped and keeps going after thrown errors', async () => {
        service.migrateLegacyToken
            .mockResolvedValueOnce({ migrated: false, reason: 'already_expiring' })
            .mockRejectedValueOnce(new Error('db down'));

        const summary = await run({ args: parseArgs(['--apply']), prisma, service, fetchImpl, log, sleep });

        expect(summary).toMatchObject({ migrated: 0, skipped: 1, failed: 1 });
        expect(summary.results[1]).toMatchObject({ outcome: 'error', error: 'db down' });
    });

    it('reports a failed admin api check without hiding the migration', async () => {
        service.migrateLegacyToken.mockResolvedValue({ migrated: true, token: 'shpat_x' });
        prisma.authShopify.findMany.mockResolvedValue([row('t-1', 'shop-a')]);
        fetchImpl.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

        const summary = await run({ args: parseArgs(['--apply']), prisma, service, fetchImpl, log, sleep });

        expect(summary.results[0]).toMatchObject({ outcome: 'migrated', check: 'failed_http_403' });
    });
});
