export default class {
    static ERP = {
        V3_INTEGRATOR: 'V3_INTEGRATOR'
    }
    static ECOMMERCE = {
        SHOPIFY: 'SHOPIFY'
    }
    static PROCESS = {
        SYNC_CUSTOMER: 'SYNC_CUSTOMER',
        SYNC_ORDERS: 'SYNC_ORDERS',
        SYNC_CANCEL_ORDERS: 'SYNC_CANCEL_ORDERS',
        SYNC_FAILED_ORDERS: 'SYNC_FAILED_ORDERS',
        TOKEN_CHECK: 'TOKEN_CHECK'
    }
    static LIMIT_TYPE = {
        ORDER: 'order',
        PRODUCT_DETAILS: 'product_details'
    }
    static BILLING_PLANS = {
        BASIC: {
            KEY: 'BASIC',
            TOKEN_LIMIT: 5,
            LIMITS: {
                ORDER: 10,
                PRODUCT_DETAILS: 1000
            }
        },
        COMMUNITY: {
            KEY: 'COMMUNITY',
            TOKEN_LIMIT: 500,
            LIMITS: {
                ORDER: 500,
                PRODUCT_DETAILS: 5000
            }
        },
        ENTERPRISE: {
            KEY: 'ENTERPRISE',
            TOKEN_LIMIT: 0,
            LIMITS: {
                ORDER: 0,
                PRODUCT_DETAILS: 0
            }
        }
    }
}