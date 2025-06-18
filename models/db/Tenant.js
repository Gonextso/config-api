import mongoose from "mongoose";

export default mongoose.model('Tenant', new mongoose.Schema({
    name: { type: String, required: true },
    apiKey: { type: String, unique: true, required: true, select: false  },
    salesUrl: String,
    shopify: {
        apiKey: {
            hash: { type: String, select: false  },
            encryptedData: { type: String, select: false  },
            iv: { type: String, select: false  },
            authTag: { type: String, select: false  }
        },
        name: String,
        decyrptedApiKey: String, //* This field using for data transfer. Db does not contain decryptedApiKey.
        domain: { type: String, unique: true, index: true },
        shopifyShopId: { type: String, unique: true, index: true },
        shopOwnerEmail: String,
        plan: String,
        isInventoryTracking: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true }
    },
    nebim: {
        host: String,
        user: String,
        userGroup: String,
        password: String, //TODO: make encyrption
        product: {
            categoryKeysFrom: { type: [String], default: [] }
        },
        customer: {
            phoneType: String,
            addressType: String
        },
        order: {
            deliveryCompany: String,
            posTerminalId: Number,
            creditCardType: String,
            office: String,
            store: String,
            warehouse: String,
            cancelReason: String
        },
        procNames: {
            product: {
                details: String,
                inventory: String,
                price: String
            },
            customer: {
                check: String
            },
            defaults: {
                addressCodes: String
            }
        },
        isActive: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    isTestStore: { type: Boolean, default: false }
}));