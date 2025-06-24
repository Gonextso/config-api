import CoreController from "../core/CoreControler.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

export default new class SupportController extends CoreController {
    constructor() {
        super();
    }
    
    createTicket = async (req, res) => {
        
        return this.response(res, { status: HttpStatusCodes.SUCCESS });
    }
}