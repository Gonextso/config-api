import CoreClass from "../../core/CoreClass.js";
import SystemCodes from "../../enums/SystemCodes.js";
import billingMutations from "../../models/shopify/mutations/billing.js";
import billingQueries from "../../models/shopify/queries/billing.js"
import ShopifyGqlAPI from "../../apis/ShopifyGqlAPI.js"
import Tenant from "../../models/db/Tenant.js";
import CryptoHelper from "../../helpers/CryptoHelper.js";

export default class SubscriptionBusiness extends CoreClass {
    constructor(tenant) {
        super(tenant);
        this.shopifyGqlAPI = new ShopifyGqlAPI(tenant)
    }

    createSubscription = async (planKey, returnPath) => {
        const tenant = await Tenant.findById(this.tenant._id);
        const shop = tenant.shopify.domain;

        tenant.shopify.billing.pendingNonce = CryptoHelper.generateToken();
        await tenant.save();

        const returnUrl = `https://api.gonextso.com/api/config${returnPath}?tenant=${tenant._id}&shop=${shop}&nonce=${tenant.shopify.billing.pendingNonce}`;
        const response = await this.shopifyGqlAPI.query(billingMutations.createSub, {
            name: `${planKey} Plan`,
            returnUrl,
            price: SystemCodes.BILLING_PLANS[planKey.toUpperCase()].PRICE,
            test: process.env.ENV === "dev"
        })

        if (response.userErrors && response.userErrors.length) {
            this.throws("Shopify billing error: " + JSON.stringify(userErrors), true);
        }

        return response;
    };

    getActiveSubscriptionId = async () => {
        const { data, errors } = await this.shopifyGqlAPI.query(billingQueries.activeSub, {});

        if (errors) {
            this.logger.error(new Error(errors.map(x => x.message).join(', ')));

            return ""
        }

        const activeSub = data.currentAppInstallation.activeSubscriptions[0];
        if (!activeSub || activeSub.status !== "ACTIVE")
            return ""

        return activeSub.id
    }

    /* placeholders for future logic */
    blockSubscription = async () => { };
    updateSubscriptionAndLimits = async () => { };
}