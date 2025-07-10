import mongoose from "mongoose";
import SystemCodes from "../../enums/SystemCodes.js"

export default mongoose.model('FailedOrder', new mongoose.Schema({
    ecommerceId: { type: String, required: true },
    orderData: Object,
    reason: String,
    process: { type: String, required: true, enum: Object.keys(SystemCodes.PROCESS)  },
    isCancelled: { type: Boolean, default: false },
    erp: { type: String, required: true, enum: Object.keys(SystemCodes.ERP)  },
    ecommerce: { type: String, required: true, enum: Object.keys(SystemCodes.ECOMMERCE) },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    syncBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderSyncLog', required: true },
    traceId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}));