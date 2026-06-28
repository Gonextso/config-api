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

        // apiKey henüz kaydedilmemiş olabilir (yeni kurulum); decrypt patlamasın,
        // Shopify erişimi gerektiren uçlar decryptedApiKey yokluğunu kendileri raporlar.
        if (tenant.shopify?.apiKey) {
            req.tenant.shopify.decryptedApiKey = CyrptoHelper.decrypt(tenant.shopify.apiKey);
            req.tenant.shopify.decyrptedApiKey = req.tenant.shopify.decryptedApiKey;
        }

        return next();
    }
}