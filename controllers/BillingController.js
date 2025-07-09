import CoreController from '../core/CoreControler.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import SystemCodes from '../enums/SystemCodes.js';
import Tenant from '../models/db/Tenant.js';

export default new class BillingController extends CoreController {
    constructor() {
        super();
    }

    handleSubscriptionUpdate = async (req, res) => {
        const { status, plan_handle, admin_graphql_api_shop_id } = req.body.app_subscription;
        const tenant = await Tenant.findOne({ "shopify.shopId": admin_graphql_api_shop_id.replace("gid://shopify/Shop/", "") });

        if (!tenant) return this.response(res, { status: HttpStatusCodes.NOT_FOUND });

        if (status.toLowerCase() === "active" || status.toLowerCase() === "trialing") {
            tenant.updateOne({ 
                "shopify.billing.planKey": plan_handle,
                "shopify.billing.tokenLimit": SystemCodes.BILLING_PLANS[plan_handle].TOKEN_LIMIT,
                "shopify.billing.tokenUsed": 0,
                "shopify.billing.periodStart": new Date().toISOString(),
                "shopify.billing.periodEnd": new Date(Date.now() + 30 * 864e5).toISOString(),
                $unset: { 
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey":  1 
                }
             });
        } else if (
            status.toLowerCase() === "cancelled" || 
            status.toLowerCase() === "expired" || 
            status.toLowerCase() === "declined" || 
            status.toLowerCase() === "pending" || 
            status.toLowerCase() === "trial_will_end" || 
            status.toLowerCase() === "trial_ended" || 
            status.toLowerCase() === "unpaid" || 
            status.toLowerCase() === "paused" || 
            status.toLowerCase() === "suspended") {

            tenant.updateOne({
                "shopify.billing.isActive": false,
                "shopify.billing.periodEnd": new Date().toISOString(),
                $unset: { 
                    "shopify.billing.pendingNonce": 1,
                    "shopify.billing.pendingPlanKey":  1 
                }
            });
        }

        return this.response(res, { status: HttpStatusCodes.SUCCESS });
    }
}