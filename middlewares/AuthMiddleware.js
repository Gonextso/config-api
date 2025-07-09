import CoreController from "../core/CoreControler.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import Tenant from "../models/db/Tenant.js";
import ShopifyStoreBusiness from "../business/shopify/StoreBusiness.js";
import { isAxiosError } from "axios";
import mongoose from "mongoose";

export default new class AuthMiddleware extends CoreController {
    constructor() {
        super();
    }

    isAdmin = async (req, res, next) => {
        const apiKey = CryptoHelper.hashKey(req.headers['x-admin-api-key'] ?? "");

        if (apiKey !== process.env.ADMIN_API_KEY) return this.response(res, { status: HttpStatusCodes.UNAUTHORIZED });

        return next();
    }

    isShopifyAuthenticated = async (req, res, next) => {
        const apiKey = CryptoHelper.hashKey(req.headers['x-api-key'] ?? "");
        const tenant = await Tenant.findOne({
            'shopify.apiKey.hash': apiKey
        })
            .select('+shopify.apiKey.encryptedData')
            .select('+shopify.apiKey.iv')
            .select('+shopify.apiKey.authTag');

        if (!tenant) {
            return this.response(res, {
                status: HttpStatusCodes.UNAUTHORIZED,
                info: "Unauthorized access"
            })
        }

        req.tenant = tenant;
        req.tenant.shopify.decryptedApiKey = CryptoHelper.decrypt(tenant.shopify.apiKey);

        const shopifyAccessService = new ShopifyStoreBusiness(new ShopifyGqlAPI(req.tenant));

        try {
            await shopifyAccessService.checkStore();
        } catch (error) {
            if (isAxiosError(error) && [HttpStatusCodes.UNAUTHORIZED, HttpStatusCodes.NOT_AUTHENTICATED].some(x => x.code === error.status)) return this.response(res, {
                status: { code: error.status, message: error.message },
                info: `Shopify API Error: ${error.response.data.errors}. Error occured while authenticating via Shopify.`
            })
        }

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

        if (!mongoose.isValidObjectId(tenantId)) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Invalid mongo object id format.",
            });
        }

        if (!idToken) return this.response(res, {
            status: HttpStatusCodes.UNAUTHORIZED
        })

        const tenant = await Tenant.findById(tenantId)
            .select('+shopify.apiKey.encryptedData')
            .select('+shopify.apiKey.iv')
            .select('+shopify.apiKey.authTag')
            .lean();

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

        if (callError && isAxiosError(callError)) return this.response(res, {
            status: { code: callError.status, message: callError.message },
        })
        else this.throws(error.message)

        req.tenant = tenant;
        req.shopify = {};
        req.shopify.access_token = access_token;
        req.tenant.shopify.decyrptedApiKey = CryptoHelper.decrypt(tenant.shopify.apiKey);

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