import mongoose from "mongoose";
import moment from "moment";
import SystemCodes from "../../enums/SystemCodes.js";

export default mongoose.model('Tenant', new mongoose.Schema({
    name: { type: String, required: true },
    shopify: {
        apiKey: {
            hash: { type: String, select: false },
            encryptedData: { type: String, select: false },
            iv: { type: String, select: false },
            authTag: { type: String, select: false }
        },
        name: String,
        decryptedApiKey: String, //? This field using for data transfer. Db does not contain decryptedApiKey.
        domain: { type: String, unique: true },
        shopId: { type: String, unique: true },
        customerEmail: String,
        billing: {
            planKey: { type: String, enum: Object.keys(SystemCodes.BILLING_PLANS), default: SystemCodes.BILLING_PLANS.BASIC.KEY },
            subscription: {
                id: String,
                lineId: String //? It can be used in feature for mixed sub models or shopify quota usage. we are using our own token mechanism
            },
            limits: {
                order: {
                    limit: { type: Number, default: 10 },
                    used: { type: Number, default: 0 }
                },
                product_details: {
                    limit: { type: Number, default: 1000 },
                    used: { type: Number, default: 0 }
                }
            },
            tokenLimit: { type: Number, default: 5 },
            tokenUsed: { type: Number, default: 0 },
            periodStart: {
                type: String,
                default: function () {
                    return moment().toISOString();
                }
            },
            periodEnd: {
                type: String,
                default: function () {
                    const interval = moment.duration(1, "months");
                    return moment().add(interval).toISOString();
                }
            },
            isBlocked: { type: Boolean, default: false },
            pendingNonce: String,
            pendingPlanKey: String
        },
        isInventoryTracking: { type: Boolean, default: true },
        schedules: {
            nebim: {
                product: {
                    inventory: {
                        interval: { type: String, default: "0 * * * *" },
                        startDate: {
                            type: String,
                            default: function () {
                                const interval = moment.duration(1, "hours")
                                return moment().subtract(interval).toISOString();
                            }
                        },
                        isActive: { type: Boolean, default: false }
                    },
                    details: {
                        interval: { type: String, default: "0 0 * * *" },
                        startDate: {
                            type: String,
                            default: function () {
                                const interval = moment.duration(1, "days");
                                return moment().subtract(interval).toISOString();
                            }
                        },
                        isActive: { type: Boolean, default: false }
                    }
                },
                order: {
                    create_and_cancel: {
                        interval: { type: String, default: "*/30 * * * *" },
                        startDate: {
                            type: String,
                            default: function () {
                                const interval = moment.duration(30, "minutes");
                                return moment().subtract(interval).toISOString();
                            }
                        },
                        isActive: { type: Boolean, default: false }
                    },
                    status: {
                        interval: { type: String, default: "0 0 * * *" },
                        startDate: {
                            type: String,
                            default: function () {
                                const interval = moment.duration(1, "days");
                                return moment().subtract(interval).toISOString();
                            }
                        },
                        isActive: { type: Boolean, default: false }
                    }
                },
            },
            redention: {
                logs: {
                    interval: { type: String, default: "0 0 * * *" },
                    startDate: {
                        type: String,
                        default: function () {
                            const interval = moment.duration(1, "days");
                            return moment().subtract(interval).toISOString();
                        }
                    },
                    isActive: { type: Boolean, default: true, readOnly: true }
                }
            }
        },
        skuFields: {
            nebim: {
                fields: { type: [String], default: [SystemCodes.NEBIM_SKU_FIELDS.ITEM_CODE, SystemCodes.NEBIM_SKU_FIELDS.COLOR_CODE, SystemCodes.NEBIM_SKU_FIELDS.ITEM_DIM1_CODE], enum: Object.values(SystemCodes.NEBIM_SKU_FIELDS) },
                separator: { type: String, default: SystemCodes.SEPARATORS.DASH, enum: Object.values(SystemCodes.SEPARATORS) }
            }
        },
        isColorOptionFirst: { type: Boolean, default: true },
        isEnterprise: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true }
    },
    nebim: {
        host: String,
        user: String,
        userGroup: String,
        salesUrl: String, //TODO: check if this is needed, or if it can be derived from shopify.domain
        password: {
            hash: { type: String, select: false },
            encryptedData: { type: String, select: false },
            iv: { type: String, select: false },
            authTag: { type: String, select: false }
        },
        product: {
            categoryKeysFrom: { type: [String], default: [] }
        },
        customer: {
            phoneType: { type: String, default: "7" },
            addressType: { type: String, default: "1" },
            confirmationFormTypeCode: { type: String, default: "" },
            confirmationFormStatusCode: { type: String, default: "" },
            consentSource: { type: String, default: "HS_WEB" },
            inactivationReasonCode: { type: String, default: "" }
        },
        order: {
            deliveryCompany: String,
            posTerminalId: { type: Number, default: 1 },
            creditCardType: String,
            office: String,
            store: String,
            company: String,
            warehouse: String,
            cancelReason: String
        },
        procNames: {
            product: {
                details: { type: String, default: "sp_INV_GetProductDetails" },
                inventory: { type: String, default: "sp_INV_GetProductInventory" },
                price: { type: String, default: "sp_INV_GetProductPrice" },
            },
            customer: {
                check: { type: String, default: "qry_B2C_GetCustomer" },
            },
            order: {
                status: { type: String, default: "sp_INV_OrderStatus" },
            },
            defaults: {
                addressCodes: { type: String, default: "sp_INV_GetAddressList" },
            }
        },
        isActive: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    isTestStore: { type: Boolean, default: false }
}));

//TODO: makesure startdate validation is done in the business logic