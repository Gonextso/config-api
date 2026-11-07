// One-time migration of stored legacy (non-expiring) Shopify offline tokens to expiring pairs.
//
// Shopify stops accepting non-expiring offline tokens for public apps (delisting 2027-01-01,
// Admin API rejections 2027-04-01). Shops whose merchants reopen the app are migrated by the app
// itself; this script covers the rest.
//
// Run it INSIDE the config-api service (e.g. `railway ssh`): the Shopify app's Admin API IP
// allowlist only admits the services' static egress IPs, and the database, encryption key and
// client credentials must all belong to the same environment / Shopify app.
//
//   node scripts/migrate-legacy-shopify-tokens.mjs                      # dry run: lists, calls nothing
//   node scripts/migrate-legacy-shopify-tokens.mjs --apply --tenant <id>
//   node scripts/migrate-legacy-shopify-tokens.mjs --apply [--limit N] [--include-inactive]
//
// Only run --apply once the app (expiringOfflineAccessTokens) and the services that hold the
// token owner logic are deployed in the same environment: an older app would push its legacy
// token back over the new pair.
//
// Never prints token values.
import { pathToFileURL } from 'node:url';

const DELAY_MS = 500;

export const parseArgs = argv => {
    const args = { apply: false, tenantId: null, limit: null, includeInactive: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--apply') args.apply = true;
        else if (arg === '--include-inactive') args.includeInactive = true;
        else if (arg === '--tenant') args.tenantId = argv[++i];
        else if (arg === '--limit') args.limit = Number(argv[++i]);
        else throw new Error(`Unknown argument: ${arg}`);
    }
    if (args.tenantId === undefined) throw new Error('--tenant needs a tenant id');
    if (args.limit !== null && !(Number.isInteger(args.limit) && args.limit > 0)) throw new Error('--limit needs a positive integer');

    return args;
};

export const shopDomainOf = row => {
    const name = row.tenant?.shopify?.name || row.tenant?.name;

    return name ? `${name}.myshopify.com` : null;
};

const verify = async (fetchImpl, shopDomain, token) => {
    try {
        const response = await fetchImpl(`https://${shopDomain}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
            body: JSON.stringify({ query: '{ shop { myshopifyDomain } }' }),
        });
        const body = await response.json().catch(() => ({}));

        return response.ok && body?.data?.shop?.myshopifyDomain === shopDomain ? 'ok' : `failed_http_${response.status}`;
    } catch (error) {
        return `failed_${error.message}`;
    }
};

export const run = async ({ args, prisma, service, fetchImpl = fetch, log = console.log, sleep = ms => new Promise(r => setTimeout(r, ms)) }) => {
    const rows = await prisma.authShopify.findMany({
        where: {
            accessTokenExpiresAt: null,
            apiKeyEncryptedData: { not: null },
            ...(args.tenantId ? { tenantId: args.tenantId } : {}),
            ...(args.includeInactive ? {} : { tenant: { isActive: true } }),
        },
        select: {
            tenantId: true,
            tenant: { select: { name: true, isActive: true, shopify: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        ...(args.limit ? { take: args.limit } : {}),
    });

    log(`[migrate-legacy-tokens] ${rows.length} legacy token(s)${args.apply ? '' : ' (dry run, nothing will be changed)'}`);

    const summary = { total: rows.length, migrated: 0, skipped: 0, failed: 0, results: [] };

    for (const [index, row] of rows.entries()) {
        const shopDomain = shopDomainOf(row);
        const label = `${row.tenantId} ${shopDomain ?? '<no shop name>'} active=${row.tenant?.isActive}`;

        if (!args.apply) {
            log(`  - ${label}`);
            summary.results.push({ tenantId: row.tenantId, shopDomain, outcome: 'dry_run' });
            continue;
        }
        if (!shopDomain) {
            summary.skipped++;
            log(`  ! ${label}: skipped (no shop name)`);
            summary.results.push({ tenantId: row.tenantId, shopDomain, outcome: 'no_shop_name' });
            continue;
        }

        let result;
        try {
            result = await service.migrateLegacyToken(row.tenantId, shopDomain);
        } catch (error) {
            result = { migrated: false, reason: 'error', error: error.message };
        }

        if (result.migrated) {
            const check = await verify(fetchImpl, shopDomain, result.token);
            summary.migrated++;
            log(`  ✓ ${label}: migrated, admin api check ${check}`);
            summary.results.push({ tenantId: row.tenantId, shopDomain, outcome: 'migrated', check });
        } else if (result.reason === 'already_expiring' || result.reason === 'no_token') {
            summary.skipped++;
            log(`  - ${label}: skipped (${result.reason})`);
            summary.results.push({ tenantId: row.tenantId, shopDomain, outcome: result.reason });
        } else {
            summary.failed++;
            log(`  ✗ ${label}: ${result.reason}${result.status ? ` HTTP ${result.status}` : ''}${result.error ? ` ${result.error}` : ''}`);
            summary.results.push({ tenantId: row.tenantId, shopDomain, outcome: result.reason, status: result.status, error: result.error });
        }

        if (index < rows.length - 1) await sleep(DELAY_MS);
    }

    if (args.apply) log(`[migrate-legacy-tokens] migrated=${summary.migrated} skipped=${summary.skipped} failed=${summary.failed}`);

    return summary;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const args = parseArgs(process.argv.slice(2));
    const { default: prisma } = await import('../builders/database/prismaBuilder.js');
    const { default: ShopifyTokenService } = await import('../helpers/ShopifyTokenService.js');

    let exitCode = 0;
    try {
        const summary = await run({ args, prisma, service: ShopifyTokenService });
        if (summary.failed > 0) exitCode = 2;
    } catch (error) {
        console.error(`[migrate-legacy-tokens] ${error.message}`);
        exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
    process.exit(exitCode);
}
