import CoreController from "../core/CoreControler.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import Tenant from "../models/db/postgres/Tenant.js";
import OrderSyncBatch from "../models/db/postgres/OrderSyncBatch.js";
import RequestLog from "../models/db/postgres/RequestLog.js";
import UuidHelper from "../helpers/UuidHelper.js";

export default new class AdminController extends CoreController {
    constructor() {
        super();
    }
    
    health = async (_, res) => {
        return this.response(res, { status: HttpStatusCodes.SUCCESS });
    }

    _validateTenantId = (tenantId, res) => {
        if (!UuidHelper.isValidUuid(tenantId)) {
            this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Invalid UUID format.",
            });
            return false;
        }
        return true;
    }

    _findTenantOrRespond = async (tenantId, res) => {
        if (!this._validateTenantId(tenantId, res)) return null;
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            await this.response(res, {
                status: HttpStatusCodes.NOT_FOUND,
                info: "Tenant not found.",
            });
            return null;
        }
        return tenant;
    }

    getTenants = async (_, res) => {
        const tenants = await Tenant.find({});
        const content = tenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
        }));

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content,
        });
    }

    getTenantById = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: tenant,
        });
    }

    getTenantOverview = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        const syncBatches = await OrderSyncBatch.find({ tenant: tenantId });
        const totalSyncedOrders = syncBatches.reduce((sum, batch) => {
            return sum + (batch.numbers?.createOrderSuccess || 0);
        }, 0);

        const scheduleItems = [
            tenant?.shopify?.schedules?.nebim?.product?.inventory,
            tenant?.shopify?.schedules?.nebim?.product?.details,
            tenant?.shopify?.schedules?.nebim?.order?.create_and_cancel,
            tenant?.shopify?.schedules?.nebim?.order?.status,
            tenant?.shopify?.schedules?.redention?.logs,
        ].filter(Boolean);
        const activeScheduleCount = scheduleItems.filter((item) => item.isActive).length;

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: {
                tenantId: tenant.id,
                tenantName: tenant.name,
                planKey: tenant?.shopify?.billing?.planKey ?? null,
                orderUsed: tenant?.shopify?.billing?.limits?.order?.used ?? 0,
                skuUsed: tenant?.shopify?.billing?.limits?.product_details?.used ?? 0,
                totalSyncedSku: tenant?.shopify?.billing?.limits?.product_details?.used ?? 0,
                totalSyncedOrders,
                activeSchedules: activeScheduleCount,
                totalSchedules: scheduleItems.length,
            },
        });
    }

    getTenantLogs = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        const status = req.query.status !== undefined ? Number(req.query.status) : undefined;

        const query = {
            tenant: tenant.id,
            url: req.query.url || undefined,
            method: req.query.method || undefined,
            status: Number.isNaN(status) ? undefined : status,
            traceId: req.query.traceId || req.query.trace_id || undefined,
        };

        const [data, urls] = await Promise.all([
            RequestLog.findSummary(query),
            RequestLog.distinctUrls({ tenant: tenant.id }),
        ]);
        const statuses = [...new Set(
            data
                .map((item) => item.status)
                .filter((status) => typeof status === "number")
        )].sort((a, b) => a - b);

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: {
                urls,
                statuses,
                data,
            },
        });
    }

    getTenantLogById = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const logId = req.params.log_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        const item = await RequestLog.findOne({ id: logId, tenant: tenant.id });
        if (!item) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_FOUND,
                info: "Log not found.",
            });
        }

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: item,
        });
    }

    getTenantJobs = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        const items = await OrderSyncBatch.find({ tenant: tenant.id });

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: {
                items,
                total: items.length,
            },
        });
    }

    getTenantJobById = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const jobId = req.params.job_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        const item = await OrderSyncBatch.findOne({ id: jobId, tenant: tenant.id });
        if (!item) {
            return this.response(res, {
                status: HttpStatusCodes.NOT_FOUND,
                info: "Job not found.",
            });
        }

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: item,
        });
    }

    patchTenantBilling = async (req, res) => {
        const tenantId = req.params.tenant_id;
        const tenant = await this._findTenantOrRespond(tenantId, res);
        if (!tenant) return;

        const incomingBilling = req.body?.billing ?? req.body;
        if (!incomingBilling || typeof incomingBilling !== "object") {
            return this.response(res, {
                status: HttpStatusCodes.BAD_REQUEST,
                info: "Billing payload is required.",
            });
        }

        const updated = await Tenant.updateOne(
            { id: tenant.id },
            { shopify: { billing: incomingBilling } },
        );

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS,
            content: updated?.shopify?.billing ?? {},
        });
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
        const { hash, key } = CryptoHelper.generateHashedKey();
        req.body.apiKey = hash;
        
        const tenant = await Tenant.create(req.body);

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