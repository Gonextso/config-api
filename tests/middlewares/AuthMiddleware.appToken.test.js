import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';

// Covers isShopifyAuthenticated with the app-minted bearer token and the legacy x-api-key fallback.
const SECRET = 'test-app-secret';
process.env.SHOPIFY_CLIENT_SECRET = SECRET;

const tenant = () => ({
    id: 'c1f1c3a4-0000-4000-8000-000000000001',
    name: 'demo-store',
    shopify: { apiKey: { encryptedData: 'enc', iv: 'iv', authTag: 'tag', hash: 'legacy-hash' } },
});

const mockTenantModel = { findOne: jest.fn(), findById: jest.fn() };
const mockCryptoHelper = { hashKey: jest.fn(), decrypt: jest.fn().mockReturnValue('shpat_decrypted') };
const mockResponse = jest.fn();
const mockWarn = jest.fn();

await jest.unstable_mockModule('../../models/db/postgres/Tenant.js', () => ({ default: mockTenantModel }));
await jest.unstable_mockModule('../../helpers/CryptoHelper.js', () => ({ default: mockCryptoHelper }));
await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
    default: jest.fn().mockImplementation(() => ({ warn: mockWarn })),
}));
await jest.unstable_mockModule('../../apis/ShopifyGqlAPI.js', () => ({ default: jest.fn() }));
await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
    default: class { response = mockResponse; throws = (m) => { throw new Error(m); }; },
}));

const { default: AuthMiddleware } = await import('../../middlewares/AuthMiddleware.js');
const { default: AppTokenHelper } = await import('../../helpers/AppTokenHelper.js');

describe('AuthMiddleware.isShopifyAuthenticated', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { headers: {}, method: 'GET', originalUrl: '/tenant' };
        res = {};
        next = jest.fn();
    });

    it('resolves the tenant by shop name from a valid bearer token', async () => {
        mockTenantModel.findOne.mockResolvedValue(tenant());
        req.headers.authorization = `Bearer ${AppTokenHelper.mint('demo-store.myshopify.com', { secret: SECRET })}`;

        await AuthMiddleware.isShopifyAuthenticated(req, res, next);

        expect(mockTenantModel.findOne).toHaveBeenCalledWith({ name: 'demo-store' });
        expect(mockCryptoHelper.hashKey).not.toHaveBeenCalled();
        expect(req.tenant.shopify.decryptedApiKey).toBe('shpat_decrypted');
        expect(next).toHaveBeenCalled();
    });

    it('rejects an invalid bearer token without falling back to x-api-key', async () => {
        req.headers.authorization = `Bearer ${AppTokenHelper.mint('demo-store.myshopify.com', { secret: 'wrong' })}`;
        req.headers['x-api-key'] = 'shpat_legacy';

        await AuthMiddleware.isShopifyAuthenticated(req, res, next);

        expect(mockTenantModel.findOne).not.toHaveBeenCalled();
        expect(mockResponse).toHaveBeenCalledWith(res, {
            status: HttpStatusCodes.UNAUTHORIZED,
            info: 'Unauthorized access: Invalid token signature',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('returns UNAUTHORIZED when the bearer shop has no tenant', async () => {
        mockTenantModel.findOne.mockResolvedValue(null);
        req.headers.authorization = `Bearer ${AppTokenHelper.mint('unknown.myshopify.com', { secret: SECRET })}`;

        await AuthMiddleware.isShopifyAuthenticated(req, res, next);

        expect(mockResponse).toHaveBeenCalledWith(res, { status: HttpStatusCodes.UNAUTHORIZED, info: 'Unauthorized access' });
        expect(next).not.toHaveBeenCalled();
    });

    it('still accepts the legacy x-api-key hash and logs a warning', async () => {
        mockCryptoHelper.hashKey.mockReturnValue('legacy-hash');
        mockTenantModel.findOne.mockResolvedValue(tenant());
        req.headers['x-api-key'] = 'shpat_legacy';

        await AuthMiddleware.isShopifyAuthenticated(req, res, next);

        expect(mockTenantModel.findOne).toHaveBeenCalledWith({ 'shopify.apiKey.hash': 'legacy-hash' });
        expect(mockWarn).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('returns UNAUTHORIZED without querying when no credentials are sent', async () => {
        await AuthMiddleware.isShopifyAuthenticated(req, res, next);

        expect(mockTenantModel.findOne).not.toHaveBeenCalled();
        expect(mockResponse).toHaveBeenCalledWith(res, { status: HttpStatusCodes.UNAUTHORIZED, info: 'Unauthorized access' });
        expect(next).not.toHaveBeenCalled();
    });
});
