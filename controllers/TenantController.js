import CoreController from '../core/CoreControler.js';
import Tenant from '../models/db/postgres/Tenant.js';
import CryptoHelper from '../helpers/CryptoHelper.js';
import HttpStatusCodes from '../enums/HttpStatusCodes.js';
import ObjectHelper from '../helpers/ObjectHelper.js';
import NebimCache from '../cache/NebimCache.js';
import ShopifyCache from '../cache/ShopifyCache.js';
import SuccessOrder from '../models/db/postgres/SuccessOrder.js';
import FailedOrder from '../models/db/postgres/FailedOrder.js';
import OrderSyncBatch from '../models/db/postgres/OrderSyncBatch.js';
import RequestLog from '../models/db/postgres/RequestLog.js';

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

    patchTenant = async (req, res) => {
        const updateData = req.body;
        let tenant = await Tenant.findById(req.tenant.id);

        if (updateData.nebim && (updateData.nebim.password || (updateData.nebim.host && updateData.nebim.host !== tenant.nebim.host) || (updateData.nebim.user && updateData.nebim.user !== tenant.nebim.user) || (updateData.nebim.userGroup && updateData.nebim.userGroup !== tenant.nebim.userGroup))) {
            const response = await this.httpRequest.post(`${process.env.INTEGRATION_API_HOST}/nebim/check`, {
                ...tenant.nebim,
                ...updateData.nebim
            }, {
                headers: {
                    'x-tenant-id': tenant.id
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
            
            if (updateData.nebim.password) {
                const encryptedPassword = CryptoHelper.encrypt(updateData.nebim.password);
                tenant.nebim.password = encryptedPassword;
                // Set encrypted password in updateData to ensure it's saved correctly
                if (!updateData.nebim) updateData.nebim = {};
                updateData.nebim.password = encryptedPassword;
            }
        }

        if (updateData?.shopify?.apiKey) delete updateData.shopify.apiKey;

        if ((updateData?.shopify?.schedules) && tenant.shopify.billing.isBlocked) 
            return this.response(res, {
                content: tenant,
                info: "Schedules cannot be patched when there is no active plan on store",
                status: HttpStatusCodes.BAD_REQUEST
            });

        if (updateData?.shopify?.billing) delete updateData.shopify.billing;

        // Store encrypted password BEFORE merge (it might get lost during merge)
        const passwordToSave = updateData.nebim?.password || null;

        // Handle schedules separately to ensure proper merging of nested schedule objects
        // If schedules are being updated, merge them properly with existing schedules
        if (updateData?.shopify?.schedules && tenant.shopify?.schedules) {
            // Deep merge schedules to preserve existing schedule values that aren't being updated
            updateData.shopify.schedules = ObjectHelper.deepMerge(
                JSON.parse(JSON.stringify(tenant.shopify.schedules)),
                updateData.shopify.schedules
            );
        }

        // Deep merge update data into tenant object
        const mergedData = ObjectHelper.deepMerge({}, tenant);
        ObjectHelper.deepMerge(mergedData, updateData);
        
        // Ensure password is preserved after merge (deepMerge might not handle nested objects correctly)
        if (passwordToSave) {
            if (!mergedData.nebim) mergedData.nebim = {};
            mergedData.nebim.password = passwordToSave;
        }
        
        await Tenant.updateOne({ id: tenant.id }, mergedData);
        
        // Reload tenant to return updated version
        tenant = await Tenant.findById(tenant.id);

        return this.response(res, {
            content: tenant,
            status: HttpStatusCodes.SUCCESS
        });
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
}