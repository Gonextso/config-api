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
        let result = { isSuccess: true, info: "", status: HttpStatusCodes.SUCCESS, content: null };
        let accessToken = req.headers['x-api-key'] ?? "";
        
        const work = async _ => {
            try {
                const newTenant = req.body;
        
                if (!newTenant?.name) {
                    result = { ...result, status: HttpStatusCodes.BAD_REQUEST, info: "Missing tenant info in request body" };
                    
                    return result;
                }
                let shop = null;
        
                if (!accessToken) {
                    result = { ...result, status: HttpStatusCodes.UNAUTHORIZED };
    
                    return result;
                }
        
                const apiKey = CryptoHelper.hashKey(accessToken);
        
                newTenant.shopify = {}
                newTenant.shopify.decryptedApiKey = accessToken;
        
                const shopifyAccessService = new ShopifyStoreBusiness(newTenant);
        
                try {
                    shop = await shopifyAccessService.getShop(newTenant.name, accessToken);
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
        
                if (tenant) {
                    result = {
                        ...result,
                        status: HttpStatusCodes.SUCCESS,
                        info: "Tenant already exists",
                        content: tenant
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
                        apiKey: {...CryptoHelper.encrypt(accessToken)}
                    },
                    apiKey: "UNUSED",
                }
        
                tenant = new Tenant(tenantDto);
        
                await tenant.save();
    
                return { isSuccess: true, status: HttpStatusCodes.CREATED, info: "Tenant initialized successfully", content: tenant };
            } catch (error) {
                return { isSuccess: false, status: HttpStatusCodes.SERVER_ERROR, info: error.message };
            }
        }

        result = await SystemHelper.createTransaction({ name: "tenant_initialization" }, CryptoHelper.hashKey(accessToken), work);

        if (result?.isSuccess) return this.response(res, {
                ...result
        });

        return this.response(res, {
            ...result,
        })
    }

    handleGdprDataRequest = async (req, res) => {
        console.log('GDPR customers/data_request webhook received:', req.body);
        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "GDPR customers/data_request webhook received",
            content: req.body
        });
    }

    handleGdprCustomersRedact = async (req, res) => {
        console.log('GDPR customers/redact webhook received:', req.body);
        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "GDPR customers/data_request webhook received",
            content: req.body
        });
    }

    handleGdprShopRedact = async (req, res) => {
        console.log('GDPR shop/redact webhook received:', req.body);
        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "GDPR shop/redact webhook received",
            content: req.body
        });
    }
}