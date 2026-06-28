import SystemCodes from '../enums/SystemCodes.js';

// Effective ENTERPRISE rule: real billing plan OR the synced/override isEnterprise flag.
export const isEnterpriseEffective = (planKey, isEnterprise) =>
    planKey === SystemCodes.BILLING_PLANS.ENTERPRISE.KEY || isEnterprise === true;

export const isFindInStorePlanAllowed = (planKey, isEnterprise) =>
    isEnterpriseEffective(planKey, isEnterprise);

export const findInStoreScheduleDisableUpdate = () => ({
    shopify: {
        schedules: {
            nebim: {
                product: {
                    find_in_store: { isActive: false },
                },
            },
        },
    },
});

// Multi-market sync requires both an ENTERPRISE plan (or isEnterprise override) and a Shopify Plus store.
export const isMarketSyncAllowed = (planKey, isShopifyPlus, isEnterprise) =>
    isEnterpriseEffective(planKey, isEnterprise) && isShopifyPlus === true;

export const marketSyncScheduleDisableUpdate = () => ({
    shopify: {
        schedules: {
            nebim: {
                product: {
                    market_sync: { isActive: false },
                },
            },
        },
    },
});
