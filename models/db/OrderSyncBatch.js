import mongoose from "mongoose";
import SystemCodes from "../../enums/SystemCodes.js";

export default mongoose.model('OrderSyncBatch', new mongoose.Schema({
    request: {
        startDate: String,
        endDate: String,
        orderNumberList: [String]
    },
    numbers: {
        total: Number,
        createOrderTotal: Number,
        createOrderSuccess: Number,
        createOrderError: Number,
        createOrderSkippedTotal: Number,
        createOrderSkippedAlreadySynced: Number,
        createOrderSkippedFailed: Number,
        cancelOrderTotal: Number,
        cancelOrderSuccess: Number,
        cancelOrderError: Number,
        cancelOrderSkippedTotal: Number,
        cancelOrderSkippedAlreadySynced: Number,
        cancelOrderSkippedFailed: Number,
        cancelOrderSkippedNotFound: Number,
    },
    isErrorLogExistsForThisBatch: Boolean,
    process: { type: String, required: true, enum: Object.keys(SystemCodes.PROCESS)  },
    erp: { type: String, required: true, enum: Object.keys(SystemCodes.ERP)  },
    ecommerce: { type: String, required: true, enum: Object.keys(SystemCodes.ECOMMERCE) },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    traceId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
}));