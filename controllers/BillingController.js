import SubscriptionBusiness from '../business/shopify/SubscriptionBusiness.js';
import CoreController from '../core/CoreControler.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import SystemCodes from '../enums/SystemCodes.js';
import CryptoHelper from '../helpers/CryptoHelper.js';
import Tenant from '../models/db/Tenant.js';

export default new class BillingController extends CoreController {
    constructor() {
        super();
    }

    getPlans = async (_, res) => {
        return this.response(res, {
            content: SystemCodes.BILLING_PLANS,
            status: HttpStatusCodes.SUCCESS
        });
    }

    subscribeToPlan = async (req, res) => {
        const { planKey, returnPath = "/billing/confirm" } = req.body;
        const subscriptionBusiness = new SubscriptionBusiness(req.tenant);

        if (planKey === SystemCodes.BILLING_PLANS.BASIC.KEY) {
            await tenant.updateOne({
                "shopify.billing.planKey": planKey,
                "shopify.billing.tokenLimit": SystemCodes.BILLING_PLANS.BASIC.TOKEN_LIMIT,
                "shopify.billing.tokenUsed": 0
            });

            return this.response(res, {
                status: HttpStatusCodes.SUCCESS
            });
        }

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: (await subscriptionBusiness.createSubscription(planKey, returnPath)).data
        });
    }

    confirmCallback = async (req, res) => {
        if (!CryptoHelper.validateShopifyHmac(req.query)) return this.response(res, { status: HttpStatusCodes.NOT_AUTHENTICATED });

        const { tenant: tenantId, nonce, shop, host } = req.query;
        const tenant = await Tenant
            .findById(tenantId)
            .select("+shopify.billing.pendingNonce +shopify.billing.pendingPlanKey");

        if (!tenant || nonce !== tenant.shopify.billing.pendingNonce)
            return this.response(res, { status: HttpStatusCodes.UNAUTHORIZED })

        const subscriptionBusiness = new SubscriptionBusiness(req.tenant);
        const activeSubscriptionId = subscriptionBusiness.getActiveSubscriptionId()

        if (!activeSubscriptionId)
            return this.response(res, { status: HttpStatusCodes.PAYMENT_REQUIRED })

        const planKey = tenant.shopify.billing.pendingPlanKey

        await tenant.updateOne({
            "shopify.billing.planKey": planKey,
            "shopify.billing.subscription.id": activeSubscriptionId,
            "shopify.billing.tokenLimit": SystemCodes.BILLING_PLANS[planKey].TOKEN_LIMIT,
            "shopify.billing.tokenUsed": 0,
            "shopify.billing.periodStart": new Date().toISOString(),
            "shopify.billing.periodEnd": new Date(Date.now() + 30 * 864e5).toISOString(),
            $unset: { 
                "shopify.billing.pendingNonce": 1,
                "shopify.billing.pendingPlanKey":  1 
            }
        });

        return this.response(res, { status: HttpStatusCodes.CREATED }); //TODO: redirect to app
    }
}