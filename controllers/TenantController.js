import CoreController from '../core/CoreControler.js';
import Tenant from '../models/db/Tenant.js';
import CryptoHelper from '../helpers/CryptoHelper.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import ObjectHelper from '../helpers/ObjectHelper.js';

export default new class TenantController extends CoreController {
    constructor() {
        super();
    }

    getTenant = async (req, res) => { 
        const tenant = await Tenant.findById(req.tenant._id);

        if (!tenant) {
            return this.response(res, {
                info: "Tenant not found",
                status: HttpStatusCodes.NOT_FOUND
            });
        }

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
    }

    patchTenant = async (req, res) => {
        const updateData = req.body;
        const tenant = await Tenant.findById(req.tenant._id);

        if (!tenant) {
            return this.response(res, {
                info: "Tenant not found",
                status: HttpStatusCodes.NOT_FOUND
            });
        }

        ObjectHelper.deepMerge(tenant, updateData);

        await tenant.save();

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
    }
}