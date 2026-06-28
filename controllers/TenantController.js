import CoreController from '../core/CoreControler.js';
import Tenant from '../models/db/postgres/Tenant.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import NebimCache from '../cache/NebimCache.js';
import ShopifyCache from '../cache/ShopifyCache.js';
import SuccessOrder from '../models/db/postgres/SuccessOrder.js';
import FailedOrder from '../models/db/postgres/FailedOrder.js';
import OrderSyncBatch from '../models/db/postgres/OrderSyncBatch.js';
import RequestLog from '../models/db/postgres/RequestLog.js';
import ClientProvider from '../cache/ClientProvider.js';
import { applyTenantPatch, TenantPatchError } from '../helpers/TenantPatchHelper.js';

export default new class TenantController extends CoreController {
    constructor() {
        super();
    }

    getTenant = async (req, res) => { 
        const tenant = await Tenant.findById(req.tenant.id);

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
    }

    getSyncStatus = async (req, res) => {
        try {
            const tenant = await Tenant.findById(req.tenant.id);
            if (!tenant) {
                return this.response(res, {
                    info: "Tenant not found",
                    status: HttpStatusCodes.NOT_FOUND
                });
            }

            const redisClient = ClientProvider.systemClient;
            if (!redisClient) {
                return this.response(res, {
                    info: "Redis client not initialized",
                    status: HttpStatusCodes.SERVER_ERROR
                });
            }

            const schedules = tenant?.shopify?.schedules?.nebim;
            const jobs = [
                {
                    key: "product.details",
                    label: "Ürün Detay&Fiyat",
                    schedule: schedules?.product?.details
                },
                {
                    key: "product.inventory",
                    label: "Ürün Envanter",
                    schedule: schedules?.product?.inventory
                },
                {
                    key: "product.find_in_store",
                    label: "Mağazada Bul",
                    schedule: schedules?.product?.find_in_store
                },
                {
                    key: "order.create_and_cancel",
                    label: "Sipariş",
                    schedule: schedules?.order?.create_and_cancel
                },
                {
                    key: "order.status",
                    label: "Sipariş Durum Sorgulama",
                    schedule: schedules?.order?.status
                }
            ];

            const jobStatuses = await Promise.all(jobs.map(async (job) => {
                const isActive = Boolean(job.schedule?.isActive);
                const interval = job.schedule?.interval || "";
                let status = "disabled";

                if (isActive) {
                    const [parentKey, childKey] = job.key.split(".");
                    const redisKey = `cron:${tenant.id}:${parentKey}:${childKey}`;
                    const redisValue = await redisClient.get(redisKey);
                    status = redisValue ? "active" : "idle";
                }

                return {
                    key: job.key,
                    label: job.label,
                    status,
                    isActive,
                    interval
                };
            }));

            return this.response(res, {
                content: { jobs: jobStatuses },
                status: HttpStatusCodes.SUCCESS
            });
        } catch (error) {
            return this.response(res, {
                status: HttpStatusCodes.SERVER_ERROR,
                info: "Failed to fetch sync status",
                error
            });
        }
    }

    patchTenant = async (req, res) => {
        try {
            const tenant = await applyTenantPatch(req.tenant.id, req.body, { httpRequest: this.httpRequest });
            return this.response(res, {
                content: tenant,
                status: HttpStatusCodes.SUCCESS
            });
        } catch (error) {
            if (error instanceof TenantPatchError) {
                return this.response(res, {
                    status: error.status,
                    info: error.info,
                    error: error.error,
                });
            }
            throw error;
        }
    }

    deleteTenant = async (req, res) => {
        const tenantId = req.tenant.id;
        const tenant = await Tenant.findById(tenantId);

        if (!tenant) return this.response(res, {
            status: HttpStatusCodes.BAD_REQUEST,
            info: `Tenant not found for deletion: ${tenantId}`
        });

        this.logger.info(`Deleting tenant: ${tenant.name} - ${tenant.shopify.shopId}`);

        const nebimCache = new NebimCache(tenant);
        const shopifyCache = new ShopifyCache(tenant);

        await nebimCache.deleteAll();
        await shopifyCache.deleteAll();

        await SuccessOrder.deleteMany({
            tenant: tenant.id
        });

        await FailedOrder.deleteMany({
            tenant: tenant.id
        });

        await OrderSyncBatch.deleteMany({
            tenant: tenant.id
        });

        await RequestLog.deleteMany({
            tenant: tenant.id
        });

        await Tenant.deleteOne({
            id: tenant.id
        });
        
        this.logger.info(`Tenant deleted: ${tenant.name} - ${tenant.shopify.shopId}`);

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS
        });
    }

    getRequestLogs = async (req, res) => {
        try {
            const tenantId = req.tenant.id;
            const page = Number(req.query.page || 0);
            const limit = Number(req.query.limit || 25);
            const status = req.query.status !== undefined ? Number(req.query.status) : undefined;
            const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

            const query = {
                tenant: tenantId,
                page,
                limit,
                sortOrder,
                url: req.query.url || undefined,
                method: req.query.method || undefined,
                status: Number.isNaN(status) ? undefined : status,
                traceId: req.query.traceId || undefined,
                body: req.query.body || undefined,
                response: req.query.response || undefined,
            };

            const [items, total] = await Promise.all([
                RequestLog.findPage(query),
                RequestLog.count(query)
            ]);

            const safePage = Number.isFinite(page) && page > 0 ? page : 0;
            const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 25;

            return this.response(res, {
                content: {
                    items,
                    total,
                    page: safePage,
                    limit: safeLimit,
                    hasPrevious: safePage > 0,
                    hasNext: (safePage + 1) * safeLimit < total
                },
                status: HttpStatusCodes.SUCCESS
            });
        } catch (error) {
            return this.response(res, {
                status: HttpStatusCodes.SERVER_ERROR,
                info: "Failed to fetch request logs",
                error
            });
        }
    }

    getRequestLogUrls = async (req, res) => {
        try {
            const tenantId = req.tenant.id;
            const urls = await RequestLog.distinctUrls({
                tenant: tenantId
            });

            return this.response(res, {
                content: { urls },
                status: HttpStatusCodes.SUCCESS
            });
        } catch (error) {
            return this.response(res, {
                status: HttpStatusCodes.SERVER_ERROR,
                info: "Failed to fetch request log urls",
                error
            });
        }
    }
}