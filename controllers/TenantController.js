import CoreController from '../core/CoreControler.js';
import Tenant from '../models/db/Tenant.js';
import CryptoHelper from '../helpers/CryptoHelper.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import ObjectHelper from '../helpers/ObjectHelper.js';
import NebimCache from '../cache/NebimCache.js';
import ShopifyCache from '../cache/ShopifyCache.js';
import SuccessOrder from '../models/db/SuccessOrder.js';
import FailedOrder from '../models/db/FailedOrder.js';
import OrderSyncBatch from '../models/db/OrderSyncBatch.js';
import RequestLog from '../models/db/RequestLog.js';

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

        if (updateData.nebim && (updateData.nebim.password || (updateData.nebim.host && updateData.nebim.host !== tenant.nebim.host) || (updateData.nebim.user && updateData.nebim.user !== tenant.nebim.user) || (updateData.nebim.userGroup && updateData.nebim.userGroup !== tenant.nebim.userGroup))) {
            const response = await this.httpRequest.post(`${process.env.INTEGRATION_API_HOST}/nebim/check`, {
                ...tenant.nebim,
                ...updateData.nebim
            }, {
                headers: {
                    'x-tenant-id': tenant._id
                }
            }).catch(error => {
                const info = error?.isAxiosError ? error.response?.data?.info : null;
                const message = info ? `Nebim V3 bağlantı hatası: "${info}"` : "Nebim V3'e bağlanırken hata oluştu";
                this.throws(message, true);
            });

            tenant.nebim.user = response.data.content.UserName;
            tenant.nebim.userGroup = response.data.content.UserGroupCode;

            tenant.nebim.order.office = response.data.content.OfficeCode ?? "";
            tenant.nebim.order.store = response.data.content.StoreCode ?? "";
            tenant.nebim.order.company = response.data.content.CompanyCode ?? "";

            if (updateData.nebim.password) tenant.nebim.password = CryptoHelper.encrypt(updateData.nebim.password);
        }

        if (updateData?.shopify?.apiKey) delete updateData.shopify.apiKey;

        if ((updateData?.shopify?.schedules) && tenant.shopify.billing.isBlocked) 
            return this.response(res, {
                content: tenant,
                info: "Schedules cannot be patched when there is no active plan on store",
                status: HttpStatusCodes.BAD_REQUEST
            });

        if (updateData?.shopify?.billing) delete updateData.shopify.billing;

        ObjectHelper.deepMerge(tenant, updateData);

        await tenant.save();

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
    }

    deleteTenant = async (req, res) => {
        const tenant = await Tenant.findById(req.tenant._id);

        if (!tenant) return this.response(res, {
            status: HttpStatusCodes.BAD_REQUEST,
            info: `Tenant not found for deletion: ${req.tenant._id}`
        });

        this.logger.info(`Deleting tenant: ${tenant.name} - ${tenant.shopify.shopId}`);

        const nebimCache = new NebimCache(tenant);
        const shopifyCache = new ShopifyCache(tenant);

        await nebimCache.deleteAll();
        await shopifyCache.deleteAll();

        await SuccessOrder.deleteMany({
            tenant: tenant._id
        });

        await FailedOrder.deleteMany({
            tenant: tenant._id
        });

        await OrderSyncBatch.deleteMany({
            tenant: tenant._id
        });

        await RequestLog.deleteMany({
            tenant: tenant._id
        });

        await Tenant.deleteOne({
            _id: tenant._id
        });
        
        this.logger.info(`Tenant deleted: ${tenant.name} - ${tenant.shopify.shopId}`);

        return this.response(res, {
            status: HttpStatusCodes.SUCCESS
        });
    }
}