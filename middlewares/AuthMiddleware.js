import CoreController from "../core/CoreControler.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import Tenant from "../models/db/postgres/Tenant.js";
import { isAxiosError } from "axios";
import UuidHelper from "../helpers/UuidHelper.js";
import AppTokenHelper from "../helpers/AppTokenHelper.js";
import LogHelper from "../helpers/LogHelper.js";

export default new class AuthMiddleware extends CoreController {
    constructor() {
        super();
    }

    isAdmin = async (req, res, next) => {
        const providedApiKey = req.headers['x-api-key'] ?? req.headers['x-admin-api-key'] ?? "";
        const integrationSecret = process.env.ADMIN_UI_SECRET;

        // Admin UI flow: UI sends x-api-key with raw ADMIN_UI_SECRET value
        if (integrationSecret && providedApiKey === integrationSecret) return next();

        // Backward compatibility for existing admin key flow (hashed comparison)
        const hashedApiKey = CryptoHelper.hashKey(providedApiKey);
        if (hashedApiKey !== process.env.ADMIN_API_KEY) return this.response(res, { status: HttpStatusCodes.UNAUTHORIZED });

        return next();
    }

    // Resolves the calling shop from the app-minted bearer token (see AppTokenHelper).
    // Falls back to the legacy flow (hash of the raw Shopify token in x-api-key) so the
    // app and config-api can be deployed independently; remove the fallback once every
    // app deployment sends bearer tokens.
    resolveShopifyTenant = async (req) => {
        const bearer = AppTokenHelper.getBearerToken(req);

        if (bearer) {
            let claims;
            try {
                claims = AppTokenHelper.verify(bearer);
            } catch (error) {
                return { error: error.message };
            }

            const tenant = await Tenant.findOne({ name: claims.tenantName });
            return { tenant, claims };
        }

        const rawApiKey = req.headers['x-api-key'] ?? "";
        if (!rawApiKey) return { tenant: null };

        const tenant = await Tenant.findOne({
            'shopify.apiKey.hash': CryptoHelper.hashKey(rawApiKey)
        });
        if (tenant) new LogHelper(tenant).warn(`[AuthMiddleware] Legacy x-api-key auth used for ${req.method} ${req.originalUrl}`);

        return { tenant, legacy: true };
    }

    isShopifyAuthenticated = async (req, res, next) => {
        const { tenant, error } = await this.resolveShopifyTenant(req);

        if (error) {
            return this.response(res, {
                status: HttpStatusCodes.UNAUTHORIZED,
                info: `Unauthorized access: ${error}`
            });
        }

        if (!tenant) {
            return this.response(res, {
                status: HttpStatusCodes.UNAUTHORIZED,
                info: "Unauthorized access"
            })
        }

        if (!tenant.shopify?.apiKey) {
            return this.response(res, {
                status: HttpStatusCodes.UNAUTHORIZED,
                info: "Shopify API key is not configured for this tenant."
            });
        }

        req.tenant = tenant;
        req.tenant.shopify.decryptedApiKey = CryptoHelper.decrypt(tenant.shopify.apiKey);
        req.tenant.shopify.decyrptedApiKey = req.tenant.shopify.decryptedApiKey;

        return next();
    }

    validateIdToken = async (req, res, next) => {
        const idToken = req.headers['x-api-key'] ?? "";
        const tenantId = req.headers["x-tenant-id"] || req.get("x-tenant-id");

        if (!tenantId) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "'x-tenant-id' header is required.",
            });
        }

        if (!UuidHelper.isValidUuid(tenantId)) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Invalid UUID format.",
            });
        }

        if (!idToken) return this.response(res, {
            status: HttpStatusCodes.UNAUTHORIZED
        })

        const tenant = await Tenant.findById(tenantId);

        if (!tenant) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_FOUND,
                info: "Tenant not found.",
            });
        }

        const api = new ShopifyGqlAPI(tenant);
        let callError = null;

        const access_token = await api.getAccessToken(tenant.name, idToken)
            .catch(error => (callError =  error));

        if (callError) {
            if (isAxiosError(callError)) return this.response(res, {
                status: { code: callError.status, message: callError.message },
            });

            this.throws(callError.message);
        }

        if (!tenant.shopify?.apiKey) {
            return this.response(res, {
                status: HttpStatusCodes.UNAUTHORIZED,
                info: "Shopify API key is not configured for this tenant."
            });
        }

        req.tenant = tenant;
        req.shopify = {};
        req.shopify.access_token = access_token;
        req.tenant.shopify.decryptedApiKey = CryptoHelper.decrypt(tenant.shopify.apiKey);
        req.tenant.shopify.decyrptedApiKey = req.tenant.shopify.decryptedApiKey;

        next();
    }

    isShopifyHmacValid = (req, res, next) => {
        const hmacHeader = req.get('x-shopify-hmac-sha256');
        if (!hmacHeader) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_AUTHENTICATED,
                info: 'Missing HMAC header.'
            });
        }

        const bodyString = req.rawBody;
        if (!bodyString) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_AUTHENTICATED,
                info: 'Raw body not available for HMAC validation.'
            });
        }

        const generatedHmac = CryptoHelper.createShopifyWebhookHmac(bodyString);
        if (generatedHmac !== hmacHeader) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_AUTHENTICATED,
                info: 'Invalid HMAC.'
            });
        }
        next();
    }
}