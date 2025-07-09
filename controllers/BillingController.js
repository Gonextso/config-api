import CoreController from '../core/CoreControler.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import SystemCodes from '../enums/SystemCodes.js';
import Tenant from '../models/db/Tenant.js';

export default new class BillingController extends CoreController {
    constructor() {
        super();
    }

    handleSubscriptionUpdate = async (req, res) => {
        const { status, name, admin_graphql_api_shop_id, admin_graphql_api_id, created_at } = req.body.app_subscription;
        const tenant = await Tenant.findOne({ "shopify.shopId": admin_graphql_api_shop_id.replace("gid://shopify/Shop/", "") });

        if (!tenant) return this.response(res, { status: HttpStatusCodes.BAD_REQUEST });

        if ( created_at < tenant.shopify.billing.periodStart ) {
            return this.response(res, { status: HttpStatusCodes.SUCCESS });
        }

        if (status === "ACTIVE" || status === "TRIALING") {
            await tenant.updateOne({ 
                "shopify.billing.planKey": name.toUpperCase(),
                "shopify.billing.subscription.id": admin_graphql_api_id,
                "shopify.billing.tokenLimit": SystemCodes.BILLING_PLANS[name.toUpperCase()].TOKEN_LIMIT,
                "shopify.billing.tokenUsed": 0,
                "shopify.billing.periodStart": created_at,
                "shopify.billing.periodEnd": new Date(Date.now() + 30 * 864e5).toISOString(),
                $unset: { 
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey":  1 
                }
             });
        } else if (
            status === "EXPIRED" || 
            status === "DECLINED" || 
            status === "PENDING" || 
            status === "TRIAL_WILL_END" || 
            status === "TRIAL_ENDED" || 
            status === "UNPAID" || 
            status === "PAUSED" || 
            status === "SUSPENDED") {

            await tenant.updateOne({
                "shopify.billing.isActive": false,
                "shopify.billing.periodEnd": new Date().toISOString(),
                $unset: { 
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey":  1 
                }
            });
        } else if (status === "CANCELLED") {
            await tenant.updateOne({
                "shopify.billing.isActive": true,
                "shopify.billing.planKey": SystemCodes.BILLING_PLANS.BASIC.KEY,
                "shopify.billing.subscription.id": null,
                "shopify.billing.tokenLimit": SystemCodes.BILLING_PLANS.BASIC.TOKEN_LIMIT,
                "shopify.billing.tokenUsed": 0,
                "shopify.billing.periodStart": new Date().toISOString(),
                "shopify.billing.periodEnd": new Date(Date.now() + 30 * 864e5).toISOString(),
                $unset: { 
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey":  1 
                }
            });
        }

        return this.response(res, { status: HttpStatusCodes.SUCCESS });
    }
}