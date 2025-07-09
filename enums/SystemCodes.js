export default class {
    static ERP = {
        V3_INTEGRATOR: 'v3_integrator'
    }
    static ECOMMERCE = {
        SHOPIFY: 'shopify'
    }
    static BILLING_PLAN_KEYS = {
        BASIC: 'basic',
        COMMUNITY: 'community',
        ENTERPRISE: 'enterprise'
    }
    static PROCESS = {
        SYNC_CUSTOMER: 'SYNC_CUSTOMER',
        SYNC_ORDERS: 'SYNC_ORDERS',
        SYNC_CANCEL_ORDERS: 'SYNC_CANCEL_ORDERS',
        SYNC_FAILED_ORDERS: 'SYNC_FAILED_ORDERS',
        TOKEN_CHECK: 'TOKEN_CHECK'
    }
    static BILLING_PLANS = {
        BASIC: {
            KEY: 'basic',
            DESCRIPTION: 'Başlangıç ve uygulamanın test edilmesi için ideal bir plan',
            DETAILS: [
                "7 günlük log kaydı",
                "5 sipariş aktarımı",
                "Limitsiz iptal sipariş aktarımı"
            ],
            PRICE: 0,
            DISCOUNTED_PRICE_FROM: 0,
            CURRENCY: 'USD',
            TOKEN_LIMIT: 5
        },
        COMMUNITY: {
            KEY: 'community',
            DESCRIPTION: 'Orta ölçekli işletmeler için tavsiye edilen plan',
            DETAILS: [
                "7 günlük log kaydı",
                "500 sipariş aktarımı",
                "Limitsiz iptal sipariş aktarımı"
            ],
            PRICE: 99.99,
            DISCOUNTED_PRICE_FROM: 129.99,
            CURRENCY: 'USD',
            TOKEN_LIMIT: 500
        },
        ENTERPRISE: {
            KEY: 'enterprise',
            DESCRIPTION: 'Kesintisiz destek alabileceğiniz destek portalı ile birlikte uygulamayı limitsiz kullanabileceğiniz plan',
            DETAILS: [
                "30 günlük log kaydı",
                "Sınırsız sipariş aktarımı",
                "Limitsiz iptal sipariş aktarımı",
                "Uygulama içi destek/talep portalı",
                "Aktarım sıklıkları ayarlanabilir"
            ],
            PRICE: 199.99,
            DISCOUNTED_PRICE_FROM: 219.99,
            CURRENCY: 'USD',
            TOKEN_LIMIT: 0
        }
    }
}