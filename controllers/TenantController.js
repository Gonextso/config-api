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

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
    }

    patchTenant = async (req, res) => {
        const updateData = req.body;
        const tenant = await Tenant.findById(req.tenant._id);

        if (updateData.shopify && updateData.shopify.apiKey) delete updateData.shopify.apiKey;
        if (updateData.nebim && updateData.nebim.password) {
            tenant.nebim.password = CryptoHelper.encrypt(updateData.nebim.password);
        }

        if ((updateData.shopify && updateData.shopify.schedules) && tenant.shopify.billing.isBlocked) 
            return this.response(res, {
                content: tenant,
                info: "Schedules cannot be patched when there is no active plan on store",
                status: HttpStatusCodes.BAD_REQUEST
            });

        ObjectHelper.deepMerge(tenant, updateData);

        await tenant.save();

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
    }
}