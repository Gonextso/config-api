import Tenant from "../models/db/postgres/Tenant.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import ObjectHelper from "../helpers/ObjectHelper.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import { isFindInStorePlanAllowed } from "../helpers/FindInStorePlanGuard.js";

export class TenantPatchError extends Error {
    constructor(status, info, error) {
        super(info);
        this.status = status;
        this.info = info;
        this.error = error;
    }
}

export async function applyTenantPatch(tenantId, updateData, { httpRequest }) {
    let tenant = await Tenant.findById(tenantId);
    if (!tenant) {
        throw new TenantPatchError(HttpStatusCodes.NOT_FOUND, "Tenant not found.");
    }

    if (updateData.nebim && (updateData.nebim.password || (updateData.nebim.host && updateData.nebim.host !== tenant.nebim.host) || (updateData.nebim.user && updateData.nebim.user !== tenant.nebim.user) || (updateData.nebim.userGroup && updateData.nebim.userGroup !== tenant.nebim.userGroup))) {
        let response;
        try {
            response = await httpRequest.post(`${process.env.INTEGRATION_API_HOST}/nebim/check`, {
                ...tenant.nebim,
                ...updateData.nebim
            }, {
                headers: {
                    "x-tenant-id": tenant.id
                }
            });
        } catch (error) {
            const info = error?.isAxiosError ? error.response?.data?.info : null;
            const message = info ? `Nebim V3 bağlantı hatası: "${info}"` : "Nebim V3'e bağlanırken hata oluştu";
            throw new TenantPatchError(HttpStatusCodes.BAD_GATEWAY, message, error);
        }

        tenant.nebim.user = response.data.content.UserName;
        tenant.nebim.userGroup = response.data.content.UserGroupCode;
        tenant.nebim.order.office = response.data.content.OfficeCode ?? "";
        tenant.nebim.order.store = response.data.content.StoreCode ?? "";
        tenant.nebim.order.company = response.data.content.CompanyCode ?? "";

        if (updateData.nebim.password) {
            const encryptedPassword = CryptoHelper.encrypt(updateData.nebim.password);
            tenant.nebim.password = encryptedPassword;
            if (!updateData.nebim) updateData.nebim = {};
            updateData.nebim.password = encryptedPassword;
        }
    }

    if (updateData?.shopify?.apiKey) delete updateData.shopify.apiKey;

    if ((updateData?.shopify?.schedules) && tenant.shopify.billing?.isBlocked === true) {
        throw new TenantPatchError(
            HttpStatusCodes.BAD_REQUEST,
            "Schedules cannot be patched when there is no active plan on store",
        );
    }

    const findInStoreActive = updateData?.shopify?.schedules?.nebim?.product?.find_in_store?.isActive;
    if (findInStoreActive === true && tenant.shopify.billing.planKey !== "ENTERPRISE") {
        throw new TenantPatchError(
            HttpStatusCodes.BAD_REQUEST,
            "Mağazada Bul senkronizasyonu yalnızca ENTERPRISE planda etkinleştirilebilir",
        );
    }

    if (updateData?.shopify?.billing) delete updateData.shopify.billing;

    if (updateData.nebim?.product?.barcodeTypeCode !== undefined
        && !updateData.nebim.product.barcodeTypeCode?.trim()) {
        throw new TenantPatchError(HttpStatusCodes.BAD_REQUEST, "Barkod Tipi Kodu boş olamaz");
    }

    const passwordToSave = updateData.nebim?.password || null;

    if (updateData?.shopify?.schedules && tenant.shopify?.schedules) {
        updateData.shopify.schedules = ObjectHelper.deepMerge(
            JSON.parse(JSON.stringify(tenant.shopify.schedules)),
            updateData.shopify.schedules
        );
    }

    const mergedData = ObjectHelper.deepMerge({}, tenant);
    ObjectHelper.deepMerge(mergedData, updateData);

    if (passwordToSave) {
        if (!mergedData.nebim) mergedData.nebim = {};
        mergedData.nebim.password = passwordToSave;
    }

    const mergedBarcodeTypeCode = mergedData.nebim?.product?.barcodeTypeCode?.trim();
    if (!mergedBarcodeTypeCode) {
        throw new TenantPatchError(HttpStatusCodes.BAD_REQUEST, "Barkod Tipi Kodu boş olamaz");
    }
    if (!mergedData.nebim.product) mergedData.nebim.product = {};
    mergedData.nebim.product.barcodeTypeCode = mergedBarcodeTypeCode;

    if (
        !isFindInStorePlanAllowed(mergedData.shopify?.billing?.planKey)
        && mergedData.shopify?.schedules?.nebim?.product?.find_in_store?.isActive
    ) {
        mergedData.shopify.schedules.nebim.product.find_in_store.isActive = false;
    }

    await Tenant.updateOne({ id: tenant.id }, mergedData);
    return Tenant.findById(tenant.id);
}
