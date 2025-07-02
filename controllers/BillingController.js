import CoreController from '../core/CoreControler.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import SystemCodes from '../enums/SystemCodes.js';

export default new class BillingController extends CoreController {
    constructor() {
        super();
    }

    getPlans = async (_, res) => { 
        return this.response(res, {
            content: SystemCodes.BILLING_PLANS,
            status: HttpStatusCodes.SUCCESS
        });
    }

    subscribeToPlan = async (_, res) => { 
        return this.response(res, {
            content: SystemCodes.BILLING_PLANS,
            status: HttpStatusCodes.SUCCESS
        });
    }
}