/**
 * Shopify app subscription `name` must match billing keys in nebim-integration-app shopify.server.
 * Resolves to canonical planKey (SystemCodes.BILLING_PLANS) and billings.pricing billing_interval.
 */
export const SUBSCRIPTION_PLAN_MAP = Object.freeze({
    BASIC: { planKey: 'BASIC', billingInterval: 'MONTHLY' },
    COMMUNITY: { planKey: 'COMMUNITY', billingInterval: 'MONTHLY' },
    COMMUNITY_ANNUAL: { planKey: 'COMMUNITY', billingInterval: 'ANNUAL' },
    ENTERPRISE: { planKey: 'ENTERPRISE', billingInterval: 'MONTHLY' },
    ENTERPRISE_ANNUAL: { planKey: 'ENTERPRISE', billingInterval: 'ANNUAL' },
});

export function resolveSubscriptionPlan(name) {
    if (!name || typeof name !== 'string') return null;
    const key = name.trim().toUpperCase();
    return SUBSCRIPTION_PLAN_MAP[key] ?? null;
}

/**
 * BILLING_PLANS order / product_details değerleri aylık kotadır.
 * ANNUAL faturalamada Shopify aylık yenileme webhook’u göndermediği için aynı dönemde ×12 uygulanır.
 */
export function planBillingLimits(planConfig, billingInterval) {
    if (!planConfig?.LIMITS) {
        return { orderLimit: 0, productDetailsLimit: 0 };
    }
    const mult = billingInterval === 'ANNUAL' ? 12 : 1;
    return {
        orderLimit: planConfig.LIMITS.ORDER * mult,
        productDetailsLimit: planConfig.LIMITS.PRODUCT_DETAILS * mult,
    };
}

/**
 * Prefer Shopify-provided current period end when present on the webhook body.
 */
export function computePeriodEndIso({ billingInterval, periodStart, appSubscription }) {
    const cpe =
        appSubscription?.current_period_end ??
        appSubscription?.currentPeriodEnd;
    if (cpe) {
        const d = new Date(cpe);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const start = periodStart ? new Date(periodStart) : new Date();
    const ms = billingInterval === 'ANNUAL' ? 365 * 864e5 : 30 * 864e5;
    return new Date(start.getTime() + ms).toISOString();
}
