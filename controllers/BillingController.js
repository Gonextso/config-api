import CoreController from '../core/CoreControler.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import SystemCodes from '../enums/SystemCodes.js';
import Tenant from '../models/db/postgres/Tenant.js';
import { resolveSubscriptionPlan, computePeriodEndIso, planBillingLimits } from '../helpers/SubscriptionPlanMap.js';
import { isFindInStorePlanAllowed, findInStoreScheduleDisableUpdate } from '../helpers/FindInStorePlanGuard.js';

/** Normalize Shopify AppSubscription GIDs for comparison (handles escaped slashes in payloads). */
function normalizeAppSubscriptionGid(id) {
    if (id == null) return '';
    return String(id).replace(/\\\//g, '/').trim();
}

export default new class BillingController extends CoreController {
    constructor() {
        super();
    }

    handleSubscriptionUpdate = async (req, res) => {
        this.logger.info2(`[BillingController] Received billing webhook: ${JSON.stringify(req.body)}`);
        
        if (!req.body?.app_subscription) {
            this.logger.error(`[BillingController] Missing app_subscription in request body`);
            return this.response(res, { status: HttpStatusCodes.BAD_REQUEST, info: "Missing app_subscription in request body" });
        }

        const appSubscription = req.body.app_subscription;
        const { status, name, admin_graphql_api_shop_id, admin_graphql_api_id, created_at } = appSubscription;
        
        this.logger.info2(`[BillingController] Parsing subscription data: status=${status}, name=${name}, admin_graphql_api_shop_id=${admin_graphql_api_shop_id}, admin_graphql_api_id=${admin_graphql_api_id}, created_at=${created_at}`);
        
        if (!admin_graphql_api_shop_id) {
            this.logger.error(`[BillingController] Missing admin_graphql_api_shop_id in app_subscription`);
            return this.response(res, { status: HttpStatusCodes.BAD_REQUEST, info: "Missing admin_graphql_api_shop_id" });
        }

        const parsedShopId = admin_graphql_api_shop_id.replace("gid://shopify/Shop/", "").replace("gid:\\/\\/shopify\\/Shop\\/", "");
        this.logger.info2(`[BillingController] Parsed shopId: ${parsedShopId} (from: ${admin_graphql_api_shop_id})`);
        
        const tenant = await Tenant.findOne({ "shopify.shopId": parsedShopId });
        this.logger.info2(`[BillingController] Tenant lookup result: ${tenant ? `Found tenant ${tenant.name} (ID: ${tenant.id})` : 'Not found'}`);

        if (!tenant) {
            this.logger.error(`[BillingController] Tenant not found for shopId: ${parsedShopId} (from admin_graphql_api_shop_id: ${admin_graphql_api_shop_id})`);
            return this.response(res, { status: HttpStatusCodes.BAD_REQUEST, info: "Tenant not found" });
        }

        this.logger.info2(`[BillingController] Billing changed for ${tenant.name} with status ${status} and plan ${name}`);

        if (status === "ACTIVE" || status === "TRIALING") {
            this.logger.info2(`[BillingController] Billing activated for ${tenant.name} with status ${status} and plan name: ${name}`);
            
            if (!name) {
                this.logger.error(`[BillingController] Missing plan name in subscription data`);
                return this.response(res, { 
                    status: HttpStatusCodes.BAD_REQUEST,
                    info: "Missing plan name in subscription data"
                });
            }

            const resolved = resolveSubscriptionPlan(name);
            this.logger.info2(`[BillingController] Resolved subscription name "${name}": ${JSON.stringify(resolved)}`);

            if (!resolved) {
                this.logger.error(`[BillingController] Unknown subscription plan name: ${name}`);
                return this.response(res, {
                    status: HttpStatusCodes.BAD_REQUEST,
                    info: `Unknown subscription plan name: ${name}`,
                });
            }

            const planConfig = SystemCodes.BILLING_PLANS[resolved.planKey];
            const availablePlans = Object.keys(SystemCodes.BILLING_PLANS);
            this.logger.info2(`[BillingController] Available plan tiers: ${availablePlans.join(', ')}`);

            if (!planConfig) {
                this.logger.error(`[BillingController] Invalid plan tier: ${resolved.planKey}`);
                return this.response(res, {
                    status: HttpStatusCodes.BAD_REQUEST,
                    info: `Invalid plan tier: ${resolved.planKey}`,
                });
            }

            this.logger.info2(`[BillingController] Plan config found: KEY=${planConfig.KEY}, LIMITS=${JSON.stringify(planConfig.LIMITS)}`);

            const { orderLimit, productDetailsLimit } = planBillingLimits(planConfig, resolved.billingInterval);
            this.logger.info2(
                `[BillingController] Applied limits for ${resolved.billingInterval}: order=${orderLimit}, product_details=${productDetailsLimit}`
            );

            const periodStartIso = created_at ? new Date(created_at).toISOString() : new Date().toISOString();
            const periodEndIso = computePeriodEndIso({
                billingInterval: resolved.billingInterval,
                periodStart: created_at,
                appSubscription,
            });

            const updateData = {
                "shopify.billing.planKey": planConfig.KEY,
                "shopify.billing.billingInterval": resolved.billingInterval,
                "shopify.billing.subscription.id": admin_graphql_api_id,
                "shopify.billing.limits.order.limit": orderLimit,
                "shopify.billing.limits.product_details.limit": productDetailsLimit,
                "shopify.billing.periodStart": periodStartIso,
                "shopify.billing.periodEnd": periodEndIso,
                $unset: {
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey": 1,
                },
            };

            this.logger.info2(`[BillingController] Updating tenant ${tenant.name} with active billing data: ${JSON.stringify(updateData)}`);
            
            await Tenant.updateOne(
                { id: tenant.id },
                updateData
            );

            if (!isFindInStorePlanAllowed(planConfig.KEY)) {
                await Tenant.updateOne({ id: tenant.id }, findInStoreScheduleDisableUpdate());
                this.logger.info2(`[BillingController] Mağazada Bul schedule disabled for ${tenant.name} (plan: ${planConfig.KEY})`);
            }
            
            this.logger.info2(`[BillingController] Tenant ${tenant.name} billing activated successfully`);
        } else if (
            status === "EXPIRED" ||
            status === "DECLINED" ||
            status === "PENDING" ||
            status === "TRIAL_WILL_END" ||
            status === "TRIAL_ENDED" ||
            status === "UNPAID" ||
            status === "PAUSED" ||
            status === "SUSPENDED") {
            this.logger.info2(`[BillingController] Billing changed for ${tenant.name} with status ${status} (blocking)`);

            // Plan değişiminde eski abonelik EXPIRED/DECLINED gelebilir; güncel subscription ID ile
            // eşleşmiyorsa bu tenant'ı engelleme — sadece pending alanları temizle.
            const storedSubId = tenant.shopify?.billing?.subscription?.id;
            const incomingSubId = admin_graphql_api_id;
            const ns = normalizeAppSubscriptionGid(storedSubId);
            const nw = normalizeAppSubscriptionGid(incomingSubId);

            if (ns && nw && ns !== nw) {
                this.logger.info2(
                    `[BillingController] Skipping block for ${tenant.name}: expired subscription (${nw}) is not current tenant subscription (${ns})`
                );
                await Tenant.updateOne(
                    { id: tenant.id },
                    { $unset: { "shopify.billing.pendingNonce": 1, "shopify.billing.pendingPlanKey": 1 } }
                );
                return this.response(res, { status: HttpStatusCodes.SUCCESS, info: "Skipped: expired subscription is not current" });
            }

            const updateData = {
                "shopify.billing.isBlocked": true,
                "shopify.billing.periodStart": new Date().toISOString(),
                "shopify.billing.periodEnd": new Date(Date.now() + 30 * 864e5).toISOString(),
                "shopify.billing.billingInterval": "MONTHLY",
                $unset: { 
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey":  1 
                }
            };

            this.logger.info2(`[BillingController] Updating tenant ${tenant.name} with blocked billing data: ${JSON.stringify(updateData)}`);
            
            await Tenant.updateOne(
                { id: tenant.id },
                updateData
            );

            await Tenant.updateOne({ id: tenant.id }, findInStoreScheduleDisableUpdate());
            
            this.logger.info2(`[BillingController] Tenant ${tenant.name} billing blocked successfully`);
        } else if (status === "CANCELLED") {
            this.logger.info2(`[BillingController] Billing cancelled for ${tenant.name}`);

            const storedSubId = tenant.shopify?.billing?.subscription?.id;
            const cancelledSubId = admin_graphql_api_id;
            const ns = normalizeAppSubscriptionGid(storedSubId);
            const nw = normalizeAppSubscriptionGid(cancelledSubId);

            // Plan değişiminde (ör. yıllık → aylık) yeni abonelik ACTIVE olduktan sonra eski abonelik
            // CANCELLED gelebilir; o webhook tenant'taki güncel subscription id ile eşleşmez — BASIC'e düşürme.
            if (ns && nw && ns !== nw) {
                this.logger.info2(
                    `[BillingController] Skipping full cancel reset for ${tenant.name}: cancelled subscription (${nw}) is not current tenant subscription (${ns})`
                );
                await Tenant.updateOne(
                    { id: tenant.id },
                    {
                        $unset: {
                            "shopify.billing.pendingNonce": 1,
                            "shopify.billing.pendingPlanKey": 1,
                        },
                    }
                );
            } else {
                const updateData = {
                    "shopify.billing.isBlocked": false,
                    "shopify.billing.planKey": SystemCodes.BILLING_PLANS.BASIC.KEY,
                    "shopify.billing.billingInterval": "MONTHLY",
                    "shopify.billing.subscription.id": null,
                    "shopify.billing.limits.order.limit": SystemCodes.BILLING_PLANS.BASIC.LIMITS.ORDER,
                    "shopify.billing.limits.product_details.limit": SystemCodes.BILLING_PLANS.BASIC.LIMITS.PRODUCT_DETAILS,
                    "shopify.billing.periodStart": new Date().toISOString(),
                    "shopify.billing.periodEnd": new Date(Date.now() + 30 * 864e5).toISOString(),
                    $unset: {
                        "shopify.billing.pendingNonce": 1,
                        "shopify.billing.pendingPlanKey": 1,
                    },
                };

                this.logger.info2(`[BillingController] Updating tenant ${tenant.name} with cancelled billing data: ${JSON.stringify(updateData)}`);

                await Tenant.updateOne(
                    { id: tenant.id },
                    updateData
                );

                await Tenant.updateOne({ id: tenant.id }, findInStoreScheduleDisableUpdate());

                this.logger.info2(`[BillingController] Tenant ${tenant.name} billing cancelled successfully`);
            }
        } else {
            this.logger.info2(`[BillingController] Billing got no action for ${tenant.name} with status ${status}`);
        }

        this.logger.info2(`[BillingController] Billing webhook processed successfully for tenant ${tenant.name}`);
        return this.response(res, { status: HttpStatusCodes.SUCCESS });
    }
}