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
import { resolveSubscriptionPlan, planBillingLimits } from "../helpers/SubscriptionPlanMap.js";

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

                // Install-only Shopify Plus detection. Sets the initial value of isShopifyPlus.
                // After install this flag is admin-editable and never auto-overwritten.
                let isShopifyPlus = false;
                try {
                    const plan = await shopifyAccessService.getShopPlan(newTenant.name, accessToken);
                    isShopifyPlus = plan?.shopifyPlus === true;
                    logger.info2(`[initializeTenant] Shopify plan detected: ${plan?.displayName ?? "unknown"} (shopifyPlus=${isShopifyPlus})`);
                } catch (error) {
                    logger.warn(`[initializeTenant] Could not determine Shopify Plus status: ${error.message}`);
                }

                // Tenant'ı sırasıyla apiKey hash → shopId → domain ile ara.
                // Token rotasyonunda (scope güncellemesi vb.) hash değişir; shopId mağaza için sabittir.
                const findExistingTenant = async _ => {
                    let existing = await Tenant.findOne({
                        'shopify.apiKey.hash': apiKey
                    });
                    if (existing) return existing;

                    if (shop.id) {
                        existing = await Tenant.findOne({
                            'shopify.shopId': String(shop.id)
                        });
                        logger.info2(`[initializeTenant] Tenant lookup by shopId (${shop.id}): ${existing ? 'Found' : 'Not found'}`);
                        if (existing) return existing;
                    }

                    existing = await Tenant.findOne({
                        'shopify.domain': domain
                    });
                    logger.info2(`[initializeTenant] Tenant lookup by domain (${domain}): ${existing ? 'Found' : 'Not found'}`);

                    return existing;
                };

                // Var olan tenant'ı güncel token ile eşitle, eksik shopId/domain alanlarını doldur.
                const reconcileTenant = async existing => {
                    const tenantId = existing.id || existing._id;
                    const patch = {};

                    const existingApiKeyHash = existing.shopify?.apiKey?.hash;
                    if (existingApiKeyHash !== apiKey) {
                        logger.info2(`[initializeTenant] ApiKey hash differs for tenant ${existing.name} (ID: ${tenantId}). Existing: ${existingApiKeyHash?.substring(0, 16) || 'N/A'}..., New: ${apiKey.substring(0, 16)}...`);
                        patch['shopify.apiKey'] = { ...CryptoHelper.encrypt(accessToken) };
                    }
                    if (!existing.shopify?.shopId && shop.id) patch['shopify.shopId'] = String(shop.id);
                    if (!existing.shopify?.domain && domain) patch['shopify.domain'] = domain;

                    if (Object.keys(patch).length === 0) {
                        logger.info2(`[initializeTenant] Tenant ${existing.name} is up to date, skipping update.`);
                        return existing;
                    }

                    await Tenant.updateOne({ id: tenantId }, patch);
                    logger.info2(`[initializeTenant] Tenant ${existing.name} reconciled (${Object.keys(patch).join(', ')})`);

                    return await Tenant.findOne({ id: tenantId });
                };

                let tenant = await findExistingTenant();

                if (tenant) {
                    try {
                        tenant = await reconcileTenant(tenant);
                    } catch (updateError) {
                        logger.error(`[initializeTenant] Error reconciling tenant: ${updateError.message}`);
                        return { ...result, status: HttpStatusCodes.SERVER_ERROR, info: `Failed to update tenant apiKey: ${updateError.message}` };
                    }

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

                const resolvedPlan = activeSubscription
                    ? resolveSubscriptionPlan(activeSubscription.name)
                    : null;
                const planKey = resolvedPlan
                    ? resolvedPlan.planKey
                    : SystemCodes.BILLING_PLANS.BASIC.KEY;
                const billingInterval = resolvedPlan?.billingInterval ?? "MONTHLY";
                const planConfig =
                    SystemCodes.BILLING_PLANS[planKey] ?? SystemCodes.BILLING_PLANS.BASIC;
                const { orderLimit, productDetailsLimit } = planBillingLimits(planConfig, billingInterval);

                const tenantDto = {
                    name: newTenant.name,
                    shopify: {
                        name: newTenant.name,
                        domain: domain,
                        shopId: shop.id,
                        customerEmail: shop.customer_email,
                        isShopifyPlus: isShopifyPlus,
                        currencyCode: shop.currency ?? null,
                        countryCode: shop.country_code ?? null,
                        apiKey: { ...CryptoHelper.encrypt(accessToken) },
                        billing: activeSubscription ? {
                            planKey: planKey,
                            billingInterval,
                            subscription: {
                                id: activeSubscription.id ?? ""
                            },
                            limits: {
                                order: {
                                    limit: orderLimit,
                                    used: 0
                                },
                                product_details: {
                                    limit: productDetailsLimit,
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
                    // Duplicate domain/shopId hatasını yakala; mevcut tenant'ı bulup eşitle
                    const isUniqueConflict = error.message
                        && error.message.includes('Unique constraint failed')
                        && (error.message.includes('domain') || error.message.includes('shop_id'));

                    if (isUniqueConflict) {
                        logger.warn(`[initializeTenant] Unique constraint on create (domain: ${domain}, shopId: ${shop.id}). Attempting to reconcile existing tenant.`);

                        const existingTenant = await findExistingTenant();

                        if (existingTenant) {
                            try {
                                tenant = await reconcileTenant(existingTenant);
                                return {
                                    isSuccess: true,
                                    status: HttpStatusCodes.SUCCESS,
                                    info: "Tenant already exists",
                                    content: tenant
                                };
                            } catch (updateError) {
                                logger.error(`[initializeTenant] Error reconciling tenant after create conflict: ${updateError.message}`);
                                return {
                                    isSuccess: false,
                                    status: HttpStatusCodes.SERVER_ERROR,
                                    info: `Failed to update tenant apiKey: ${updateError.message}`
                                };
                            }
                        }

                        // Tenant bulunamadı ama unique constraint hatası var
                        logger.error(`[initializeTenant] Unique constraint on create but tenant not found. Domain: ${domain}, shopId: ${shop.id}`);
                        return {
                            isSuccess: false,
                            status: HttpStatusCodes.CONFLICT,
                            info: `Bu mağaza için zaten bir kayıt mevcut. Lütfen Shopify uygulamasını silip tekrar yükleyin. Sorununuz devam ediyorsa support@gonextso.com mail adresi ile iletişime geçiniz.`
                        };
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

    handleEmailConsent = async (req, res) => {
        this.logger.info(`Shopify email consent webhook received: ${JSON.stringify(req.body)}`);

        const shopDomain = req.get("x-shopify-shop-domain");
        if (!shopDomain) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing x-shopify-shop-domain"
            });
        }

        const tenant = await Tenant.findOne({ "shopify.domain": shopDomain });
        if (!tenant) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.SUCCESS,
                info: "Tenant not found"
            });
        }

        const emailAddress = req.body?.email_address;
        const consent = req.body?.email_marketing_consent;
        if (!emailAddress) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing email_address"
            });
        }

        if (!consent?.consent_updated_at) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing consent_updated_at"
            });
        }

        try {
            const response = await this.httpRequest.post(
                `${process.env.INTEGRATION_API_HOST}/shopify/nebim/customer/consent/email`,
                {
                    email: emailAddress,
                    phone: req.body?.phone,
                    consents: {
                        email: {
                            date: consent?.consent_updated_at,
                            is_opt_in: String(consent?.state || "").toLowerCase() === "subscribed",
                        },
                    },
                    audit: {
                        sourceEventId: req.get("x-shopify-webhook-id") || null,
                        sourcePayload: req.body,
                    },
                },
                {
                    headers: {
                        "x-tenant-id": tenant.id,
                    },
                },
            );

            return this.response(res, {
                isSuccess: true,
                status: HttpStatusCodes.SUCCESS,
                content: response.data?.content
            });
        } catch (error) {
            if (error.response?.status === 404) {
                return this.response(res, {
                    isSuccess: true,
                    status: HttpStatusCodes.SUCCESS,
                    info: "Customer not found in Nebim"
                });
            }

            throw error;
        }
    }

    handleGsmConsent = async (req, res) => {
        this.logger.info(`Shopify gsm consent webhook received: ${JSON.stringify(req.body)}`);

        const shopDomain = req.get("x-shopify-shop-domain");
        if (!shopDomain) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing x-shopify-shop-domain"
            });
        }

        const tenant = await Tenant.findOne({ "shopify.domain": shopDomain });
        if (!tenant) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.SUCCESS,
                info: "Tenant not found"
            });
        }

        const phone = req.body?.phone;
        const consent = req.body?.sms_marketing_consent;
        if (!phone) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing phone"
            });
        }

        if (!consent?.consent_updated_at) {
            return this.response(res, {
                isSuccess: false,
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Missing consent_updated_at"
            });
        }

        try {
            const response = await this.httpRequest.post(
                `${process.env.INTEGRATION_API_HOST}/shopify/nebim/customer/consent/gsm`,
                {
                    email: req.body?.email,
                    phone,
                    consents: {
                        gsm: {
                            date: consent?.consent_updated_at,
                            is_opt_in: String(consent?.state || "").toLowerCase() === "subscribed",
                        },
                    },
                    audit: {
                        sourceEventId: req.get("x-shopify-webhook-id") || null,
                        sourcePayload: req.body,
                    },
                },
                {
                    headers: {
                        "x-tenant-id": tenant.id,
                    },
                },
            );

            return this.response(res, {
                isSuccess: true,
                status: HttpStatusCodes.SUCCESS,
                content: response.data?.content
            });
        } catch (error) {
            if (error.response?.status === 404) {
                return this.response(res, {
                    isSuccess: true,
                    status: HttpStatusCodes.SUCCESS,
                    info: "Customer not found in Nebim"
                });
            }

            throw error;
        }
    }
}
