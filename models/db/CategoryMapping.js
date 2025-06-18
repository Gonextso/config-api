import mongoose from "mongoose";

export default mongoose.model('CategoryMapping', new mongoose.Schema({
    companyId: { type: String, required: true, ref: 'Company' },
    erpId: { type: String, required: true },
    ecommerceId: { type: String, required: true },
    erpKey: { type: String, required: true },
    ecommerceKey: { type: String, required: true },
}));