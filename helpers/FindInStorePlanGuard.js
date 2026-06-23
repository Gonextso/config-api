import SystemCodes from '../enums/SystemCodes.js';

export const isFindInStorePlanAllowed = planKey =>
    planKey === SystemCodes.BILLING_PLANS.ENTERPRISE.KEY;

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
