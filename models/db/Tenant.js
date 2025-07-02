import mongoose from "mongoose";
import moment from "moment";
import SystemCodes from "../../enums/SystemCodes.js";

export default mongoose.model('Tenant', new mongoose.Schema({
    name: { type: String, required: true },
    apiKey: { type: String, unique: true, required: true, select: false },
    salesUrl: String, //TODO: check if this is needed, or if it can be derived from shopify.domain
    shopify: {
        apiKey: {
            hash: { type: String, select: false },
            encryptedData: { type: String, select: false },
            iv: { type: String, select: false },
            authTag: { type: String, select: false }
        },
        name: String,
        decryptedApiKey: String, //* This field using for data transfer. Db does not contain decryptedApiKey.
        domain: { type: String, unique: true },
        shopId: { type: String, unique: true },
        customerEmail: String,
        billing: {
            planKey: { type: String, enum: Object.keys(SystemCodes.BILLING_PLAN_KEYS).map(x => x.toLowerCase()), default: SystemCodes.BILLING_PLAN_KEYS.BASIC },
            subscriptionId: String,
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
            isBlocked: { type: Boolean, default: false }
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
                },
            },
            redention: {
                logs: {
                    interval: { type: String, default: "0 0 * * 7" },
                    startDate: {
                        type: String,
                        default: function () {
                            const interval = moment.duration(7, "days");
                            return moment().subtract(interval).toISOString();
                        }
                    },
                    isActive: { type: Boolean, default: true, readOnly: true }
                }
            }
        },
        isEnterprise: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true }
    },
    nebim: {
        host: String,
        user: String,
        userGroup: String,
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
            addressType: { type: String, default: "1" }
        },
        order: {
            deliveryCompany: String,
            posTerminalId: { type: Number, default: 1 },
            creditCardType: String,
            office: String,
            store: String,
            warehouse: String,
            cancelReason: String
        },
        procNames: {
            product: {
                details: { type: String, default: "sp_INV_GetProductDetails" },
                inventory: { type: String, default: "sp_INV_GetProductPrice" },
                price: { type: String, default: "sp_INV_GetProductInventory" },
            },
            customer: {
                check: { type: String, default: "qry_B2C_GetCustomer" },
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