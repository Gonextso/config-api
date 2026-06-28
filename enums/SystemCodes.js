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
    static NEBIM_ORDER_STATUS = {
        ON_CARGO: 'ON-CARGO',
        CANCELLED: 'CANCELLED',
        INVOICED: 'INVOICED',
        SHIPPED: 'SHIPPED',
        INVOICE_RETURNED: 'INVOICE-RETURNED'
    }
    static NEBIM_SKU_FIELDS = {
        ITEM_CODE: 'ItemCode',
        COLOR_CODE: 'ColorCode',
        ITEM_DIM1_CODE: 'ItemDim1Code',
        ITEM_DIM2_CODE: 'ItemDim2Code',
        ITEM_DIM3_CODE: 'ItemDim3Code'
    }
    static SEPARATORS = {
        NONE: '',
        DASH: '-',
        UNDERSCORE: '_',
        COLON: ':',
        DOT: '.',
        SEMICOLON: ';',
        COMMA: ',',
    }
    static DEFINITIONS = {
        NO_TRACKING_NUMBER: 'NO_TRACKING_NUMBER'
    }
    static PREFIXES = {
        SHOPIFY_FULFILLMENT_ORDER_IDS: 'shopify_fulfillment_order_ids'
    }
    static LIMIT_TYPE = {
        ORDER: 'order',
        PRODUCT_DETAILS: 'product_details'
    }
    static BILLING_PLANS = {
        BASIC: {
            KEY: 'BASIC',
            LIMITS: {
                ORDER: 5,
                PRODUCT_DETAILS: 100
            },
            REDENTION: {
                LOG: 1
            }
        },
        COMMUNITY: {
            KEY: 'COMMUNITY',
            LIMITS: {
                ORDER: 50,
                PRODUCT_DETAILS: 5000
            },
            REDENTION: {
                LOG: 5
            }
        },
        ENTERPRISE: {
            KEY: 'ENTERPRISE',
            LIMITS: {
                ORDER: 0,
                PRODUCT_DETAILS: 0
            },
            REDENTION: {
                LOG: 15
            }
        }
    }
}