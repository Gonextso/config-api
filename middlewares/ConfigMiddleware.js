import CoreController from "../core/CoreControler.js";
import Tenant from "../models/db/Tenant.js"
import mongoose from "mongoose";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import CyrptoHelper from "../helpers/CryptoHelper.js"

export default new class ConfigMiddleware extends CoreController {
    constructor() {
        super();
    }

    setConfigViaTenantId = async (req, res, next) => {
        const tenantId = req.headers["x-tenant-id"] || req.get("x-tenant-id");

        if (!tenantId) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "'x-tenant-id' header is required.",
            });
        }

        if (!mongoose.isValidObjectId(tenantId)) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Invalid mongo object id format.",
            });
        }

        const tenant = await Tenant.findById(tenantId)
            .select('+shopify.apiKey.encryptedData')
            .select('+shopify.apiKey.iv')
            .select('+shopify.apiKey.authTag')
            .lean();

        if (!tenant) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_FOUND,
                info: "Tenant not found.",
            });
        }

        req.tenant = tenant;
        req.tenant.shopify.decyrptedApiKey = CyrptoHelper.decrypt(tenant.shopify.apiKey);

        return next();
    }
}