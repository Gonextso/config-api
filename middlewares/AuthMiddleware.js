import CoreController from "../core/CoreControler.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import Tenant from "../models/db/Tenant.js";
import ShopifyStoreBusiness from "../business/shopify/StoreBusiness.js";

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
            if(isAxiosError(error) && [HttpStatusCodes.UNAUTHORIZED, HttpStatusCodes.NOT_AUTHENTICATED].some(x => x === error.status)) return this.response(res, {
                status: error.status,
                info: `Shopify API Error: ${error.response.data.errors}. Error occured while authenticating via Shopify.`
            })
        }

        return next();
    }
}