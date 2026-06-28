import Tenant from "../models/db/postgres/Tenant.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import ObjectHelper from "../helpers/ObjectHelper.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import { isFindInStorePlanAllowed, isMarketSyncAllowed } from "../helpers/FindInStorePlanGuard.js";
import { markSetupStep, resetValidationStep } from "../helpers/SetupHelper.js";

export const SETUP_ACTION_STEP_MAP = {
    "nebim-connections": "connection",
    "settings-sql": "validation",
    "settings-customer": "customer",
    "settings-product": "product",
    "settings-order": "order",
};

export class TenantPatchError extends Error {
    constructor(status, info, error) {
        super(info);
        this.status = status;
        this.info = info;
        this.error = error;
    }
}

export async function applyTenantPatch(tenantId, updateData, { httpRequest, setupStep } = {}) {
    let tenant = await Tenant.findById(tenantId);
    if (!tenant) {
        throw new TenantPatchError(HttpStatusCodes.NOT_FOUND, "Tenant not found.");
    }

    let connectionToken = null;

    if (updateData.nebim && (updateData.nebim.password || (updateData.nebim.host && updateData.nebim.host !== tenant.nebim.host) || (updateData.nebim.user && updateData.nebim.user !== tenant.nebim.user) || (updateData.nebim.userGroup && updateData.nebim.userGroup !== tenant.nebim.userGroup))) {
        let response;
        let connectionChanged = (updateData.nebim.host && updateData.nebim.host !== tenant.nebim.host)
            || (updateData.nebim.user && updateData.nebim.user !== tenant.nebim.user)
            || (updateData.nebim.userGroup && updateData.nebim.userGroup !== tenant.nebim.userGroup);

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
            const errorPayload = error?.isAxiosError
                ? (error.response?.data?.content?.error ?? error.response?.data?.error)
                : null;
            const message = info ? `Nebim V3 bağlantı hatası: "${info}"` : "Nebim V3'e bağlanırken hata oluştu";
            const patchError = new TenantPatchError(HttpStatusCodes.BAD_GATEWAY, message, error);
            if (errorPayload) patchError.errorPayload = errorPayload;
            throw patchError;
        }

        if (response?.data?.isSuccess === false) {
            const patchError = new TenantPatchError(
                HttpStatusCodes.BAD_GATEWAY,
                response.data.info || "Nebim V3 bağlantı hatası",
            );
        if (response?.data?.content?.error) {
            patchError.errorPayload = response.data.content.error;
        } else if (response.data.error) {
            patchError.errorPayload = response.data.error;
        }
            throw patchError;
        }

        tenant.nebim.user = response.data.content.UserName;
        tenant.nebim.userGroup = response.data.content.UserGroupCode;
        tenant.nebim.order.office = response.data.content.OfficeCode ?? "";
        tenant.nebim.order.store = response.data.content.StoreCode ?? "";
        tenant.nebim.order.company = response.data.content.CompanyCode ?? "";
        connectionToken = response.data.content?.Token ?? null;

        if (connectionChanged) {
            await resetValidationStep(tenant.id);
        }

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
    if (findInStoreActive === true && !isFindInStorePlanAllowed(tenant.shopify.billing.planKey, tenant.shopify.isEnterprise)) {
        throw new TenantPatchError(
            HttpStatusCodes.BAD_REQUEST,
            "Mağazada Bul senkronizasyonu yalnızca ENTERPRISE planda etkinleştirilebilir",
        );
    }

    const marketSyncActive = updateData?.shopify?.schedules?.nebim?.product?.market_sync?.isActive;
    if (marketSyncActive === true && !isMarketSyncAllowed(tenant.shopify.billing.planKey, tenant.shopify.isShopifyPlus, tenant.shopify.isEnterprise)) {
        throw new TenantPatchError(
            HttpStatusCodes.BAD_REQUEST,
            "Çoklu Market senkronizasyonu yalnızca Shopify Plus mağazalarda ve ENTERPRISE planda etkinleştirilebilir",
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

    if (updateData.nebim?.order) {
        if (!mergedData.nebim) mergedData.nebim = {};
        if (!mergedData.nebim.order) mergedData.nebim.order = {};
        const patchOrder = updateData.nebim.order;
        if (patchOrder.deliveryCompany !== undefined) {
            mergedData.nebim.order.deliveryCompany = patchOrder.deliveryCompany;
            mergedData.nebim.order.deliveryCompanyCode = patchOrder.deliveryCompany;
        } else if (patchOrder.deliveryCompanyCode !== undefined) {
            mergedData.nebim.order.deliveryCompanyCode = patchOrder.deliveryCompanyCode;
            mergedData.nebim.order.deliveryCompany = patchOrder.deliveryCompanyCode;
        }
    }

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

    if (updateData.nebim?.product?.priceSellCode !== undefined) {
        const trimmed = updateData.nebim.product.priceSellCode?.trim();
        mergedData.nebim.product.priceSellCode = trimmed || null;
    }
    if (updateData.nebim?.product?.priceCompareCode !== undefined) {
        const trimmed = updateData.nebim.product.priceCompareCode?.trim();
        mergedData.nebim.product.priceCompareCode = trimmed || null;
    }
    if (updateData.nebim?.product?.responsibilityAreaCode !== undefined) {
        const trimmed = updateData.nebim.product.responsibilityAreaCode?.trim();
        mergedData.nebim.product.responsibilityAreaCode = trimmed || null;
    }
    if (updateData.nebim?.product?.isColorBased !== undefined) {
        mergedData.nebim.product.isColorBased = Boolean(updateData.nebim.product.isColorBased);
    }
    if (updateData.nebim?.product?.useInternetOnVariant !== undefined) {
        mergedData.nebim.product.useInternetOnVariant = Boolean(updateData.nebim.product.useInternetOnVariant);
    }
    if (updateData.nebim?.product?.usedSeparatorOnColorAndItem !== undefined) {
        const trimmed = updateData.nebim.product.usedSeparatorOnColorAndItem?.trim();
        mergedData.nebim.product.usedSeparatorOnColorAndItem = trimmed || null;
    }
    if (updateData.nebim?.product?.usedSeparatorOnColorAndItemDescriptions !== undefined) {
        const value = updateData.nebim.product.usedSeparatorOnColorAndItemDescriptions;
        mergedData.nebim.product.usedSeparatorOnColorAndItemDescriptions =
            value?.length === 1 ? value : null;
    }
    if (mergedData.nebim?.product?.isColorBased) {
        const itemSep = mergedData.nebim.product.usedSeparatorOnColorAndItem?.trim();
        const descSep = mergedData.nebim.product.usedSeparatorOnColorAndItemDescriptions;
        if (!itemSep || itemSep.length !== 1) {
            throw new TenantPatchError(
                HttpStatusCodes.BAD_REQUEST,
                "Renk kırılımı aktifken ürün kodu ve renk kodu arası ayırıcı tek karakter olmalıdır",
            );
        }
        if (descSep?.length !== 1) {
            throw new TenantPatchError(
                HttpStatusCodes.BAD_REQUEST,
                "Renk kırılımı aktifken açıklamalar arası ayırıcı tek karakter olmalıdır",
            );
        }
        mergedData.nebim.product.usedSeparatorOnColorAndItem = itemSep;
    }

    if (
        !isFindInStorePlanAllowed(mergedData.shopify?.billing?.planKey, mergedData.shopify?.isEnterprise)
        && mergedData.shopify?.schedules?.nebim?.product?.find_in_store?.isActive
    ) {
        mergedData.shopify.schedules.nebim.product.find_in_store.isActive = false;
    }

    if (
        !isMarketSyncAllowed(mergedData.shopify?.billing?.planKey, mergedData.shopify?.isShopifyPlus, mergedData.shopify?.isEnterprise)
        && mergedData.shopify?.schedules?.nebim?.product?.market_sync?.isActive
    ) {
        mergedData.shopify.schedules.nebim.product.market_sync.isActive = false;
    }

    await Tenant.updateOne({ id: tenant.id }, mergedData);

    if (setupStep) {
        await markSetupStep(tenant.id, setupStep);
    }

    const updatedTenant = await Tenant.findById(tenant.id);
    return {
        tenant: updatedTenant,
        meta: connectionToken ? { token: connectionToken } : undefined,
    };
}
