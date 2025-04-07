import mongoose from "mongoose";
import CronNames from "../../enums/CronNames.js";
import SystemCodes from "../../enums/SystemCodes.js";

export default mongoose.model('CronOptions', new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        enum: Object.keys(CronNames) 
    },
    isActive: { type: Boolean, default: false },
    cronTime: { type: String, required: true },
    erp: { type: String, required: true, enum: Object.keys(SystemCodes.ERP)  },
    ecommerce: { type: String, required: true, enum: Object.keys(SystemCodes.ECOMMERCE) },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}));