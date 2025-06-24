import CoreController from "../core/CoreControler.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import Tenant from "../models/db/Tenant.js";

export default new class AdminController extends CoreController {
    constructor() {
        super();
    }
    
    health = async (_, res) => {
        return this.response(res, { status: HttpStatusCodes.SUCCESS });
    }

    createTestTenant = async (req, res) => {
        if (req.body.shopify && req.body.shopify.apiKey) {
            const apiKey = CryptoHelper.encrypt(req.body.shopify.apiKey);
            req.body.shopify.apiKey = {
                ...apiKey, 
            }
        }

        if (req.body.nebim && req.body.nebim.password) {
            const password = CryptoHelper.encrypt(req.body.nebim.password);
            req.body.nebim.password = {
                ...password, 
            }
        }
        const tenant = new Tenant(req.body);
        const { hash, key } = CryptoHelper.generateHashedKey();

        tenant.apiKey = hash

        await tenant.save();

        return this.response(res, { 
            status: HttpStatusCodes.CREATED,
            content: {
                tenant: tenant,
                decodedApiKey: key
            }
        });
    }

    deleteAllTenants = async (_, res) => {
        await Tenant.deleteMany({});
        
        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: { message: "All tenants deleted successfully." }
        });
    }
}