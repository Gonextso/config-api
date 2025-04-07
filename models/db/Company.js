import mongoose from "mongoose";

export default mongoose.model('Company', new mongoose.Schema({
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
        isActive: { type: Boolean, default: true }
    },
    nebim: {
        host: String,
        user: String,
        userGroup: String,
        password: String,
        product: {
            categoryKeysFrom: { type: [String], default: [] }
        },
        customer: {
            phoneType: Number,
            addressType: Number
        },
        order: {
            deliveryCompany: String,
            posTerminalId: Number,
            creditCardType: String,
            office: String,
            store: String,
            warehouse: String
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
}));