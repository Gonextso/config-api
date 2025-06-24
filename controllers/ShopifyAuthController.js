import CoreController from "../core/CoreControler.js";
import Tenant from "../models/db/Tenant.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import CryptoHelper from "../helpers/CryptoHelper.js"
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ShopifyStoreBusiness from "../business/shopify/StoreBusiness.js";
import { isAxiosError } from "axios";

export default new class ShopifyAuthController extends CoreController {
    constructor() {
        super();
        this.api = new ShopifyGqlAPI();
    }

    initializeTenant = async (req, res) => {
        const saltApiKey = req.headers['x-api-key'] ?? "";

        if (!saltApiKey) {
            return this.response(res, {
                status: HttpStatusCodes.UNAUTHORIZED,
                info: "Missing API key in request headers"
            });
        }

        const apiKey = CryptoHelper.hashKey(saltApiKey);
        const newTenant = req.body;

        if (!newTenant || !newTenant.shopify || !newTenant.shopify.name) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing tenant info in request body"
            });
        }

        newTenant.shopify.decryptedApiKey = saltApiKey;

        const shopifyAccessService = new ShopifyStoreBusiness(newTenant);

        try {
            await shopifyAccessService.checkStore();
        } catch (error) {
            if (isAxiosError(error) && [HttpStatusCodes.UNAUTHORIZED, HttpStatusCodes.NOT_AUTHENTICATED].some(x => x.code === error.status)) return this.response(res, {
                status: { code: error.status, message: error.message },
                info: `Shopify API Error: ${error.response.data.errors}. Error occured while authenticating via Shopify.`
            })

            console.error("Error while checking Shopify store:", error);
        }

        console.log("Shopify API is accessible");

        let tenant = await Tenant.findOne({
            'shopify.apiKey.hash': apiKey
        })
            .select('+shopify.apiKey.encryptedData')
            .select('+shopify.apiKey.iv')
            .select('+shopify.apiKey.authTag');

        if (tenant) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Tenant already exists",
            })
        }

        const tenantDto = {
            name: newTenant.shopify.name,
            shopify: {
                name: newTenant.shopify.name,
                domain: newTenant.shopify.domain ?? `https://${newTenant.shopify.name}.myshopify.com`, //TODO: replace with actual domain
                shopId: newTenant.shopify.shopId || null,
                shopifyShopId: newTenant.shopify.shopId || null,
                apiKey: {...CryptoHelper.encrypt(saltApiKey)}
            },
            apiKey: "UN_USED",
        }

        tenant = new Tenant(tenantDto);

        await tenant.save();

        return this.response(res, {
            status: HttpStatusCodes.CREATED,
            info: "Tenant initialized successfully",
            data: tenant
        });
    }

    callback = async (req, res) => {
        const { code, shop } = req.query;

        if (!code || !shop) return this.response(res,
            {
                info: "Missing parameters on callback request",
                status: HttpStatusCodes.BAD_REQUEST
            });

        const shopifyAccessToken = await this.api.getAccessToken(shop, code);
        const shopifyShopInfo = await this.api.getShopInfo(shop, shopifyAccessToken);

        let tenant = Tenant.findOne({ 'shopify.domain': shopifyShopInfo.domain });

        if (tenant) {
            this.logger.info2(`${tenant.name} will be updated`);
            //TODO: implement update logic
        } else {
            this.logger.info2(`${shopifyShopInfo.name} will be created`);

            tenant = new Tenant({
                name: shopifyShopInfo.name,
                salesUrl: shopifyShopInfo.myshopifyDomain,
                shopify: {
                    name: shopifyShopInfo.name,
                    domain: shopifyShopInfo.domain,
                    shopifyShopId: shopifyShopInfo.id,
                    shopOwnerEmail: shopifyShopInfo.owner.email,
                    plan: shopifyShopInfo.plan.name,
                    apiKey: CryptoHelper.encrypt(shopifyAccessToken)
                }
            });

            const { hash, key } = CryptoHelper.generateHashedKey();

            tenant.apiKey = hash;

            await tenant.save();

            res.cookie("api_key", key, {
                httpOnly: true,
                secure: true,
                sameSite: "Lax",
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10 //! 10 year
            }); //TODO: make rotation
        }

        return res.redirect(`https://@appurl_placeholder/dashboard?shop=${shop}`);  //TODO: make redirect proper
    }
}