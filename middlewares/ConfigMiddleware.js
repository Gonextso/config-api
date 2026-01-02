import CoreController from "../core/CoreControler.js";
import Tenant from "../models/db/postgres/Tenant.js"
import UuidHelper from "../helpers/UuidHelper.js";
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

        if (!UuidHelper.isValidUuid(tenantId)) {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Invalid UUID format.",
            });
        }

        const tenant = await Tenant.findById(tenantId);

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