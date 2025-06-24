import CoreController from "../core/CoreControler.js";
import Tenant from "../models/db/Tenant.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import CryptoHelper from "../helpers/CryptoHelper.js"
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ShopifyStoreBusiness from "../business/shopify/StoreBusiness.js";
import SystemHelper from "../helpers/SystemHelper.js";
import { isAxiosError } from "axios";

export default new class ShopifyAuthController extends CoreController {
    constructor() {
        super();
        this.api = new ShopifyGqlAPI();
    }

    initializeTenant = async (req, res) => {
        let result = { isSuccess: true, info: "", status: HttpStatusCodes.CREATED, tenant: null };
        const idToken = req.headers['x-api-key'] ?? "";
        
        const work = async _ => {
            const newTenant = req.body;

            if (!idToken) {
                result = { ...result, status: HttpStatusCodes.UNAUTHORIZED };

                return result;
            }
    
            if (!newTenant || !newTenant.name) {
                result = { ...result, status: HttpStatusCodes.BAD_REQUEST, info: "Missing tenant info in request body" };
                
                return result;
            }
    
            let saltApiKey = null;
            let shop = null;
    
            try {
                saltApiKey = await this.api.getAccessToken(newTenant.name, idToken);
            } catch (error) {
                result = { ...result, status: HttpStatusCodes.UNAUTHORIZED };

                return result;
            }
    
            if (!saltApiKey) {
                result = { ...result, status: HttpStatusCodes.UNAUTHORIZED };

                return result;
            }
    
            const apiKey = CryptoHelper.hashKey(saltApiKey);
    
            newTenant.shopify = {}
            newTenant.shopify.decryptedApiKey = saltApiKey;
    
            const shopifyAccessService = new ShopifyStoreBusiness(newTenant);
    
            try {
                shop = await shopifyAccessService.getShop(newTenant.name, saltApiKey);
            } catch (error) {
                if (isAxiosError(error) && [HttpStatusCodes.UNAUTHORIZED, HttpStatusCodes.NOT_AUTHENTICATED].some(x => x.code === error.status)) {
                    result = { ...result, status: { code: error.status, message: error.message }, info: `Shopify API Error: ${error.response.data.errors}. Error occured while authenticating via Shopify.` };

                    return result;
                }
            }
    
            if (!shop) {
                result = { ...result, status: HttpStatusCodes.BAD_REQUEST, info: `Shop with name ${newTenant.shopify.name} does not exist or is not accessible. Please check the shop name and API key.` };

                return result;
            }
    
            let tenant = await Tenant.findOne({
                'shopify.apiKey.hash': apiKey
            })
                .select('+shopify.apiKey.encryptedData')
                .select('+shopify.apiKey.iv')
                .select('+shopify.apiKey.authTag');
    
            if (tenant) {
                result = {
                    ...result,
                    status: HttpStatusCodes.BAD_REQUEST,
                    info: "Tenant already exists",
                }

                return result;
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

            return { ...result, info: "Tenant initialized successfully", tenant: tenant };
        }

        result = await SystemHelper.createTransaction({ name: "tenant_initialization" }, CryptoHelper.generateHashedKey(idToken).hash, work);

        if (result.isSuccess) return this.response(res, {
                ...result
        });

        return this.response(res, {
            ...result,
            info: "Tenant already exists",
        })
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