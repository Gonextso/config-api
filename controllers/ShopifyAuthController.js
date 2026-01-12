import CoreController from "../core/CoreControler.js";
import Tenant from "../models/db/postgres/Tenant.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import CryptoHelper from "../helpers/CryptoHelper.js"
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ShopifyStoreBusiness from "../business/shopify/StoreBusiness.js";
import SystemHelper from "../helpers/SystemHelper.js";
import { isAxiosError } from "axios";
import SuccessOrder from "../models/db/postgres/SuccessOrder.js";
import FailedOrder from "../models/db/postgres/FailedOrder.js";
import RequestLog from "../models/db/postgres/RequestLog.js";
import OrderSyncBatch from "../models/db/postgres/OrderSyncBatch.js";
import NebimCache from "../cache/NebimCache.js";
import ShopifyCache from "../cache/ShopifyCache.js";
import SystemCodes from "../enums/SystemCodes.js";
import ShopifyBillingBusiness from "../business/shopify/BillingBusiness.js";
import LogHelper from "../helpers/LogHelper.js";

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
                const logger = new LogHelper();

                newTenant.shopify = {}
                newTenant.shopify.decryptedApiKey = accessToken;

                const shopifyAccessService = new ShopifyStoreBusiness(newTenant);

                try {
                    shop = await shopifyAccessService.getShop(newTenant.name, accessToken);
                } catch (error) {
                    logger.error(`[initializeTenant] Error getting shop info: ${error.message}`);
                    if (isAxiosError(error) && [HttpStatusCodes.UNAUTHORIZED, HttpStatusCodes.NOT_AUTHENTICATED].some(x => x.code === error.status)) {
                        result = { ...result, status: { code: error.status, message: error.message }, info: `Shopify API Error: ${error.response.data.errors}. Error occured while authenticating via Shopify.` };

                        return result;
                    }

                    return { ...result, status: HttpStatusCodes.SERVER_ERROR, info: error.message };
                }

                if (!shop) {
                    logger.warn(`[initializeTenant] Shop not found for: ${newTenant.name}`);
                    result = { ...result, status: HttpStatusCodes.BAD_REQUEST, info: `Shop with name ${newTenant.shopify.name} does not exist or is not accessible. Please check the shop name and API key.` };

                    return result;
                }

                const domain = shop.domain ?? `${newTenant.name}.myshopify.com`;

                // Önce apiKey hash ile kontrol et
                let tenant = await Tenant.findOne({
                    'shopify.apiKey.hash': apiKey
                });

                // Eğer apiKey ile bulunamazsa, domain ile kontrol et (duplicate domain kontrolü için)
                if (!tenant) {
                    const existingTenantByDomain = await Tenant.findOne({
                        'shopify.domain': domain
                    });
                    
                    logger.info2(`[initializeTenant] Tenant lookup by domain: ${existingTenantByDomain ? 'Found' : 'Not found'}`);
                    if (existingTenantByDomain) {
                        // Shop domain'i ile existing tenant domain'ini karşılaştır (doğrulama)
                        const existingDomain = existingTenantByDomain.shopify?.domain;
                        if (existingDomain === domain) {
                            // Mevcut apiKey hash'i ile yeni apiKey hash'ini karşılaştır
                            const existingApiKeyHash = existingTenantByDomain.shopify?.apiKey?.hash;
                            if (existingApiKeyHash === apiKey) {
                                // apiKey zaten aynı, güncelleme yapmaya gerek yok
                                logger.info2(`[initializeTenant] Domain match confirmed (${domain}). ApiKey hash already matches, skipping update.`);
                                tenant = existingTenantByDomain;
                            } else {
                                // Doğrulama başarılı ama apiKey farklı - apiKey'i güncelle
                                logger.info2(`[initializeTenant] Domain match confirmed (${domain}). ApiKey hash differs. Updating apiKey for tenant: ${existingTenantByDomain.name} (ID: ${existingTenantByDomain.id || existingTenantByDomain._id})`);
                                logger.info2(`[initializeTenant] Existing apiKey hash: ${existingApiKeyHash?.substring(0, 16) || 'N/A'}..., New apiKey hash: ${apiKey.substring(0, 16)}...`);
                                
                                try {
                                    await Tenant.updateOne(
                                        { id: existingTenantByDomain.id || existingTenantByDomain._id },
                                        { 
                                            'shopify.apiKey': { ...CryptoHelper.encrypt(accessToken) }
                                        }
                                    );
                                    
                                    // Güncellenmiş tenant'ı yükle
                                    tenant = await Tenant.findOne({
                                        id: existingTenantByDomain.id || existingTenantByDomain._id
                                    });
                                    
                                    logger.info2(`[initializeTenant] Tenant apiKey updated successfully`);
                                } catch (updateError) {
                                    logger.error(`[initializeTenant] Error updating tenant apiKey: ${updateError.message}`);
                                    return { ...result, status: HttpStatusCodes.SERVER_ERROR, info: `Failed to update tenant apiKey: ${updateError.message}` };
                                }
                            }
                        } else {
                            // Domain eşleşmiyor - conflict hatası
                            logger.error(`[initializeTenant] Duplicate domain detected but domain mismatch. Requested: ${domain}, Existing: ${existingDomain}. Tenant ID: ${existingTenantByDomain.id || existingTenantByDomain._id}`);
                            return { 
                                ...result, 
                                status: HttpStatusCodes.CONFLICT, 
                                info: `Bu mağaza için zaten bir kayıt mevcut. Lütfen Shopify uygulamasını silip tekrar yükleyin. Sorununuz devam ediyorsa support@gonextso.com mail adresi ile iletişime geçiniz.` 
                            };
                        }
                    }
                }
                
                // Load encrypted fields if tenant exists
                if (tenant && tenant.shopify?.apiKey) {
                    // Encrypted fields are already loaded by wrapper
                }

                if (tenant) {
                    result = {
                        ...result,
                        status: HttpStatusCodes.SUCCESS,
                        info: "Tenant already exists",
                        content: tenant
                    }

                    return result;
                }

                const billingBusiness = new ShopifyBillingBusiness({ shopify: { name: newTenant.name, decryptedApiKey: accessToken } });
                const activeSubscription = await billingBusiness.getActiveSubscription();

                const planKey = activeSubscription 
                    ? (SystemCodes.BILLING_PLANS[activeSubscription.name.toUpperCase()]?.KEY ?? SystemCodes.BILLING_PLANS.BASIC.KEY)
                    : SystemCodes.BILLING_PLANS.BASIC.KEY;
                const planConfig = SystemCodes.BILLING_PLANS[planKey];

                const tenantDto = {
                    name: newTenant.name,
                    shopify: {
                        name: newTenant.name,
                        domain: domain,
                        shopId: shop.id,
                        customerEmail: shop.customer_email,
                        apiKey: { ...CryptoHelper.encrypt(accessToken) },
                        billing: activeSubscription ? {
                            planKey: planKey,
                            subscription: {
                                id: activeSubscription.id ?? ""
                            },
                            tokenLimit: planConfig?.TOKEN_LIMIT ?? SystemCodes.BILLING_PLANS.BASIC.TOKEN_LIMIT,
                            tokenUsed: 0,
                            limits: {
                                order: {
                                    limit: planConfig?.LIMITS?.ORDER ?? SystemCodes.BILLING_PLANS.BASIC.LIMITS.ORDER,
                                    used: 0
                                },
                                product_details: {
                                    limit: planConfig?.LIMITS?.PRODUCT_DETAILS ?? SystemCodes.BILLING_PLANS.BASIC.LIMITS.PRODUCT_DETAILS,
                                    used: 0
                                }
                            },
                            periodStart: activeSubscription.createdAt,
                            periodEnd: activeSubscription.currentPeriodEnd,
                            isBlocked: activeSubscription.status !== "ACTIVE",
                            pendingNonce: "",
                            pendingPlanKey: ""
                        } : {}
                    }
                }

                logger.info2(`[initializeTenant] Creating new tenant: ${newTenant.name}, domain: ${domain}`);
                
                try {
                tenant = await Tenant.create(tenantDto);
                    logger.info2(`[initializeTenant] Tenant created successfully: ${tenant.name} (ID: ${tenant.id || tenant._id})`);
                    return { isSuccess: true, status: HttpStatusCodes.CREATED, info: "Tenant initialized successfully", content: tenant };
                } catch (error) {
                    // Duplicate domain hatasını yakala ve doğrula
                    if (error.message && error.message.includes('Unique constraint failed') && error.message.includes('domain')) {
                        logger.warn(`[initializeTenant] Duplicate domain error: ${domain}. Attempting to verify and update existing tenant.`);
                        
                        // Domain ile mevcut tenant'ı bul
                        const existingTenant = await Tenant.findOne({
                            'shopify.domain': domain
                        });
                        
                        if (existingTenant) {
                            // Shop domain'i ile existing tenant domain'ini karşılaştır (doğrulama)
                            const existingDomain = existingTenant.shopify?.domain;
                            if (existingDomain === domain) {
                                // Mevcut apiKey hash'i ile yeni apiKey hash'ini karşılaştır
                                const existingApiKeyHash = existingTenant.shopify?.apiKey?.hash;
                                if (existingApiKeyHash === apiKey) {
                                    // apiKey zaten aynı, güncelleme yapmaya gerek yok
                                    logger.info2(`[initializeTenant] Domain match confirmed (${domain}). ApiKey hash already matches, skipping update.`);
                                    return { 
                                        isSuccess: true, 
                                        status: HttpStatusCodes.SUCCESS, 
                                        info: "Tenant already exists", 
                                        content: existingTenant 
                                    };
                                } else {
                                    // Doğrulama başarılı ama apiKey farklı - apiKey'i güncelle
                                    logger.info2(`[initializeTenant] Domain match confirmed (${domain}). ApiKey hash differs. Updating apiKey for tenant: ${existingTenant.name} (ID: ${existingTenant.id || existingTenant._id})`);
                                    logger.info2(`[initializeTenant] Existing apiKey hash: ${existingApiKeyHash?.substring(0, 16) || 'N/A'}..., New apiKey hash: ${apiKey.substring(0, 16)}...`);
                                    
                                    try {
                                        await Tenant.updateOne(
                                            { id: existingTenant.id || existingTenant._id },
                                            { 
                                                'shopify.apiKey': { ...CryptoHelper.encrypt(accessToken) }
                                            }
                                        );
                                        
                                        // Güncellenmiş tenant'ı yükle
                                        tenant = await Tenant.findOne({
                                            id: existingTenant.id || existingTenant._id
                                        });
                                        
                                        logger.info2(`[initializeTenant] Tenant apiKey updated successfully`);
                                        return { 
                                            isSuccess: true, 
                                            status: HttpStatusCodes.SUCCESS, 
                                            info: "Tenant apiKey updated successfully", 
                                            content: tenant 
                                        };
                                    } catch (updateError) {
                                        logger.error(`[initializeTenant] Error updating tenant apiKey: ${updateError.message}`);
                                        return { 
                                            isSuccess: false, 
                                            status: HttpStatusCodes.SERVER_ERROR, 
                                            info: `Failed to update tenant apiKey: ${updateError.message}` 
                                        };
                                    }
                                }
                            } else {
                                // Domain eşleşmiyor - conflict hatası
                                logger.error(`[initializeTenant] Duplicate domain error but domain mismatch. Requested: ${domain}, Existing: ${existingDomain}`);
                                return { 
                                    isSuccess: false, 
                                    status: HttpStatusCodes.CONFLICT, 
                                    info: `Bu mağaza için zaten bir kayıt mevcut. Lütfen Shopify uygulamasını silip tekrar yükleyin. Sorununuz devam ediyorsa support@gonextso.com mail adresi ile iletişime geçiniz.` 
                                };
                            }
                        } else {
                            // Tenant bulunamadı ama unique constraint hatası var
                            logger.error(`[initializeTenant] Duplicate domain error but tenant not found: ${domain}`);
                            return { 
                                isSuccess: false, 
                                status: HttpStatusCodes.CONFLICT, 
                                info: `Bu mağaza için zaten bir kayıt mevcut. Lütfen Shopify uygulamasını silip tekrar yükleyin. Sorununuz devam ediyorsa support@gonextso.com mail adresi ile iletişime geçiniz.` 
                            };
                        }
                    }
                    
                    // Diğer hatalar için
                    logger.error(`[initializeTenant] Error creating tenant: ${error.message}`);
                    return { isSuccess: false, status: HttpStatusCodes.SERVER_ERROR, info: error.message };
                }
            } catch (error) {
                const logger = new LogHelper();
                logger.error(`[initializeTenant] Unexpected error: ${error.message}`);
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

    handleUninstalled = async (req, res) => {
        this.logger.info(`Shopify uninstalled webhook received: ${JSON.stringify(req.body)}`);

        const { id } = req.body;

        if (!id) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing shopId or shopDomain in request body"
            });
        }

        const tenant = await Tenant.findOne({
            'shopify.shopId': id
        });

        if (!tenant) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Tenant not found"
            });
        }

        this.logger.info(`Uninstalling tenant: ${tenant.name} - ${tenant.shopify.shopId}`);

        const nebimCache = new NebimCache(tenant);
        const shopifyCache = new ShopifyCache(tenant);

        nebimCache.deleteAll();
        shopifyCache.deleteAll();

        await SuccessOrder.deleteMany({
            tenant: tenant.id
        });

        await FailedOrder.deleteMany({
            tenant: tenant.id
        });

        await OrderSyncBatch.deleteMany({
            tenant: tenant.id
        });

        await RequestLog.deleteMany({
            tenant: tenant.id
        });

        await Tenant.deleteOne({
            id: tenant.id
        });

        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "Uninstalled webhook received",
            content: req.body
        });
    }

    handleGdprDataRequest = async (req, res) => {
        this.logger.info('GDPR customers/data_request webhook received:', req.body);


        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "GDPR customers/data_request webhook received",
            content: req.body
        });
    }

    handleGdprCustomersRedact = async (req, res) => {
        this.logger.info('GDPR customers/redact webhook received:', req.body);

        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "GDPR customers/data_request webhook received",
            content: req.body
        });
    }

    handleGdprShopRedact = async (req, res) => {
        this.logger.info('GDPR shop/redact webhook received:', req.body);

        const { shop_id, shop_domain } = req.body;

        if (!shop_id || !shop_domain) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing shopId or shopDomain in request body"
            });
        }

        const tenant = await Tenant.findOne({
            'shopify.shopId': shop_id,
            'shopify.domain': shop_domain
        });

        if (!tenant) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.SUCCESS,
                info: "Tenant not found or already deleted"
            });
        }

        const nebimCache = new NebimCache(tenant);
        const shopifyCache = new ShopifyCache(tenant);

        nebimCache.deleteAll();
        shopifyCache.deleteAll();

        await SuccessOrder.deleteMany({
            tenant: tenant.id
        });

        await FailedOrder.deleteMany({
            tenant: tenant.id
        });

        await OrderSyncBatch.deleteMany({
            tenant: tenant.id
        });

        await RequestLog.deleteMany({
            tenant: tenant.id
        });

        await Tenant.deleteOne({
            id: tenant.id
        });

        return this.response(res, {
            isSuccess: true,
            status: HttpStatusCodes.SUCCESS,
            info: "GDPR shop/redact webhook received",
            content: req.body
        });
    }
}