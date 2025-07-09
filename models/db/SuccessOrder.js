import mongoose from "mongoose";
import SystemCodes from "../../enums/SystemCodes.js";

export default mongoose.model('SuccessOrder', new mongoose.Schema({
    erpId: String,
    ecommerceId: { type: String, index: true },
    lines: [{
        erpLineId: String,
        quantity: Number,
        barcode: String,
        amount: Number,
        remeaningQuantity: Number
    }],
    partiallyCancelledLines: [{
        barcode: String,
        quantity: Number
    }],
    isCancelled: { type: Boolean, default: false, index: true },
    isPartiallyCancelled: { type: Boolean, default: false, index: true },
    erp: { type: String, required: true, enum: Object.keys(SystemCodes.ERP) },
    ecommerce: { type: String, required: true, enum: Object.keys(SystemCodes.ECOMMERCE) },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    syncBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderSyncLog', required: true },
    traceId: { type: String, index: true, required: true },
    createdAt: { type: Date, default: Date.now },
    cleared: { type: Boolean, default: false }
}));