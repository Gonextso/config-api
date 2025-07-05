import mongoose from "mongoose";
import CoreController from "../core/CoreControler.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import SystemCodes from "../enums/SystemCodes.js";
import SupportTicket from "../models/db/SupportTicket.js";

export default new class SupportController extends CoreController {
    constructor() {
        super();
    }
    
    createTicket = async (req, res) => {
        if(!req.body) return this.response(res, { status: HttpStatusCodes.BAD_REQUEST })
        const { message, subject } = req.body;
        const type = req.params.type;
        const ecommerceId = req.ecommerceId;

        if (!type || (type && !['bug', 'feature'].some(x => x === type.toLowerCase()))) 
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: `Validation failed for ticket type : ${ecommerceId}`
            });

        if (!ecommerceId || (ecommerceId && !Object.keys(SystemCodes.ECOMMERCE).some(x => x === ecommerceId.toUpperCase()))) 
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: `Validation failed for ecommerce id : ${ecommerceId}`
            });

        const ticket = new SupportTicket({
            isError: type === "bug" ? true : false,
            tenant: req.tenant._id,
            subject: subject,
            ecommerceId: ecommerceId,
            messages: [{
                text: message,
                fromCustomer: true
            }]
        });

        await ticket.save()

        return this.response(res, { status: HttpStatusCodes.CREATED, content: ticket });
    }

    getTickets = async (req, res) => {
        const tickets = await SupportTicket.find({ tenant: req.tenant._id });

        return this.response(res, { status: HttpStatusCodes.SUCCESS, content: tickets });
    }

    addCommentToTicket = async (req, res) => {
        const ticketId = req.params.ticketId;

        if (!ticketId || (ticketId && !mongoose.isValidObjectId(ticketId))) return this.response(res, { status: HttpStatusCodes.BAD_REQUEST, info: 'ticket id validation failed' });
        if (!req.body) return this.response(res, { status: HttpStatusCodes.BAD_REQUEST });
        const fromCustomer = true; //TODO: fix this by using admin api key
        const ticket = await SupportTicket.findById(ticketId);

        ticket.messages.push({ text: req.body.message, fromCustomer: fromCustomer });

        await ticket.save();

        return this.response(res, { status: HttpStatusCodes.CREATED, content: ticket })
    }
}