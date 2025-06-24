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
        let shop = null;

        if (!newTenant || !newTenant.name) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing tenant info in request body"
            });
        }

        newTenant.shopify = {}
        newTenant.shopify.decryptedApiKey = saltApiKey;

        const shopifyAccessService = new ShopifyStoreBusiness(newTenant);

        try {
            shop = await shopifyAccessService.getShop(newTenant.name, saltApiKey);
        } catch (error) {
            if (isAxiosError(error) && [HttpStatusCodes.UNAUTHORIZED, HttpStatusCodes.NOT_AUTHENTICATED].some(x => x.code === error.status)) return this.response(res, {
                status: { code: error.status, message: error.message },
                info: `Shopify API Error: ${error.response.data.errors}. Error occured while authenticating via Shopify.`
            });
        }

        if (!shop) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: `Shop with name ${newTenant.shopify.name} does not exist or is not accessible. Please check the shop name and API key.`
            });
        }

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
            name: newTenant.name,
            shopify: {
                name: newTenant.name,
                domain: shop.domain ?? `${newTenant.name}.myshopify.com`, //TODO: replace with actual domain
                shopId: shop.id,
                customerEmail: shop.customer_email,
                apiKey: {...CryptoHelper.encrypt(saltApiKey)}
            },
            apiKey: "UNUSED",
        }

        tenant = new Tenant(tenantDto);

        await tenant.save();

        return this.response(res, {
            status: HttpStatusCodes.CREATED,
            info: "Tenant initialized successfully",
            data: tenant
        });
    }

    deleteTenant = async (req, res) => { //TODO: remove it on prod
        const apiKey = CryptoHelper.hashKey(req.headers['x-api-key'] ?? "");

        let tenant = await Tenant.deleteOne({
            'shopify.apiKey.hash': apiKey
        })

        return this.response(res, {
            status: HttpStatusCodes.CREATED,
            info: "Tenant removed successfully"
        });
    }
}