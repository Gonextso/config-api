import mongoose from "mongoose";

export default mongoose.model('SupportTicket', new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    ecommerceId: { type: String, required: true },
    subject: { type: String, required: true },
    isError: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    messages: [
        {
            text: { type: String, required: true },
            date: { type: Date, default: Date.now },
            fromCustomer: { type: Boolean, default: false },
        }
    ]
}));