import ShopifyGqlAPI from "../../apis/ShopifyGqlAPI.js";
import CoreClass from "../../core/CoreClass.js";
import billingQueries from "../../models/shopify/queries/billing.js";

export default class ShopifyBillingBusiness extends CoreClass {
    constructor(tenant) {
        super(tenant);
        this.shopifyGqlAPI = new ShopifyGqlAPI(tenant)
    }

    getActiveSubscription = async () => {
        const { data, errors } = await this.shopifyGqlAPI.query(billingQueries.activeSub, {});

        if (errors) {
            this.logger.error(new Error(errors.map(x => x.message).join(', ')));

            return ""
        }

        const activeSub = data.currentAppInstallation.activeSubscriptions[0];
        if (!activeSub || activeSub.status !== "ACTIVE")
            return ""

        return activeSub
    }
}