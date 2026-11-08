import prisma from '../../../builders/database/prismaBuilder.js';
import moment from 'moment';
import SystemCodes from '../../../enums/SystemCodes.js';
import ObjectHelper from '../../../helpers/ObjectHelper.js';
import LogHelper from '../../../helpers/LogHelper.js';
import { ensureSetupRecord, transformSetupToApi } from '../../../helpers/SetupHelper.js';

class TenantModel {
  constructor() {
    this.logger = new LogHelper();
  }

  /**
   * Find tenant by ID
   * If related records don't exist, creates them with default values
   */
  async findById(id) {
    let tenant = await prisma.tenantInfo.findUnique({
      where: { id },
      include: {
        shopify: true,
        nebim: true,
        shopifyAuth: true,
        nebimAuth: true,
        pricing: true,
        schedules: true,
        setup: true,
      },
    });

    if (!tenant) return null;

    // Ensure default records exist (MongoDB behavior)
    tenant = await this._ensureDefaultRecords(tenant);

    return this._transformToMongoFormat(tenant);
  }

  /**
   * Find one tenant by query
   * If related records don't exist, creates them with default values
   */
  async findOne(query) {
    const where = this._buildWhereClause(query);
    let tenant = await prisma.tenantInfo.findFirst({
      where,
      include: {
        shopify: true,
        nebim: true,
        shopifyAuth: true,
        nebimAuth: true,
        pricing: true,
        schedules: true,
        setup: true,
      },
    });

    if (!tenant) return null;

    // Ensure default records exist (MongoDB behavior)
    tenant = await this._ensureDefaultRecords(tenant);

    return this._transformToMongoFormat(tenant);
  }

  /**
   * Find all tenants matching query
   */
  async find(query = {}) {
    const where = this._buildWhereClause(query);
    const tenants = await prisma.tenantInfo.findMany({
      where,
      include: {
        shopify: true,
        nebim: true,
        shopifyAuth: true,
        nebimAuth: true,
        pricing: true,
        schedules: true,
        setup: true,
      },
    });

    // Ensure default records exist for each tenant
    const tenantsWithDefaults = await Promise.all(
      tenants.map(t => this._ensureDefaultRecords(t))
    );

    return tenantsWithDefaults.map(t => this._transformToMongoFormat(t));
  }

  /**
   * Create a new tenant
   */
  async create(data) {
    const normalized = this._normalizeFromMongoFormat(data);
    
    // Build data object, excluding undefined values
    const createData = {
      name: normalized.name,
      isActive: normalized.isActive ?? true,
      isTestStore: normalized.isTestStore ?? false,
    };

    // Always create shopify with defaults if not provided (MongoDB behavior)
    if (normalized.shopify) {
      createData.shopify = { create: normalized.shopify };
    } else {
      createData.shopify = {
        create: {
          isInventoryTracking: true,
          isColorOptionFirst: true,
          isEnterprise: false,
          isShopifyPlus: false,
          isActive: true,
          currencyCode: null,
          countryCode: null,
          skuFieldsNebim: [
            SystemCodes.NEBIM_SKU_FIELDS.ITEM_CODE,
            SystemCodes.NEBIM_SKU_FIELDS.COLOR_CODE,
            SystemCodes.NEBIM_SKU_FIELDS.ITEM_DIM1_CODE
          ],
          skuFieldsSeparator: SystemCodes.SEPARATORS.DASH,
        },
      };
    }

    // Always create nebim with defaults if not provided (MongoDB behavior)
    if (normalized.nebim) {
      createData.nebim = { create: normalized.nebim };
    } else {
      createData.nebim = {
        create: {
          isActive: true,
          blockProductGenerationWhenOff: false,
          isCargoService: false,
          productCategoryKeysFrom: [],
          productBarcodeTypeCode: 'EAN13',
          customerPhoneType: '7',
          customerAddressType: '1',
          customerConsentSource: 'HS_WEB',
          orderPosTerminalId: 1,
          orderIsMicroExport: false,
          procProductDetails: 'sp_GO_GetProductDetails',
          procProductInventory: 'sp_GO_GetProductInventory',
          procProductPrice: 'sp_GO_GetProductPrice',
          procFindStoreInventory: 'sp_GO_FindInStore',
          procGetStoreInfo: 'sp_GO_GetStoreInfo',
          procCustomerCheck: 'sp_GO_GetCustomer',
          procCustomerConcents: 'sp_GO_GetCustomerConcents',
          procOrderStatus: 'sp_GO_OrderStatus',
          procDefaultsAddressCodes: 'sp_GO_GetAddressList',
          procInputValidation: 'sp_GO_InputValidator',
        },
      };
    }

    // Always create pricing with defaults if not provided (MongoDB behavior)
    if (normalized.pricing) {
      createData.pricing = { create: normalized.pricing };
    } else {
      createData.pricing = {
        create: {
          planKey: 'BASIC',
          billingInterval: 'MONTHLY',
          orderLimit: SystemCodes.BILLING_PLANS.BASIC.LIMITS.ORDER,
          orderUsed: 0,
          productDetailsLimit: SystemCodes.BILLING_PLANS.BASIC.LIMITS.PRODUCT_DETAILS,
          productDetailsUsed: 0,
          periodStart: new Date(),
          periodEnd: moment().add(1, 'months').toDate(),
          isBlocked: false,
        },
      };
    }

    // Always create schedules with defaults if not provided (MongoDB behavior)
    if (normalized.schedules) {
      createData.schedules = { create: normalized.schedules };
    } else {
      createData.schedules = {
        create: {
          nebimProductInventoryInterval: '*/5 * * * *',
          nebimProductInventoryStartDate: moment().subtract(1, 'hours').toDate(),
          nebimProductInventoryIsActive: false,
          nebimProductDetailsInterval: '0 * * * *',
          nebimProductDetailsStartDate: moment().subtract(1, 'days').toDate(),
          nebimProductDetailsIsActive: false,
          nebimOrderCreateCancelInterval: '*/30 * * * *',
          nebimOrderCreateCancelStartDate: moment().subtract(30, 'minutes').toDate(),
          nebimOrderCreateCancelIsActive: false,
          nebimOrderStatusInterval: '0 * * * *',
          nebimOrderStatusStartDate: moment().subtract(1, 'days').toDate(),
          nebimOrderStatusIsActive: false,
          nebimCustomerConcentsInterval: '0 0 * * *',
          nebimCustomerConcentsStartDate: moment().subtract(1, 'days').toDate(),
          nebimCustomerConcentsIsActive: true,
          nebimProductFindInStoreInterval: '*/30 * * * *',
          nebimProductFindInStoreStartDate: moment().subtract(30, 'minutes').toDate(),
          nebimProductFindInStoreIsActive: false,
          nebimProductMarketSyncInterval: '0 0 * * *',
          nebimProductMarketSyncIsActive: false,
          redentionLogsInterval: '0 0 * * *',
          redentionLogsStartDate: moment().subtract(1, 'days').toDate(),
          redentionLogsIsActive: true,
        },
      };
    }

    // Only include auth if provided
    if (normalized.shopifyAuth) {
      createData.shopifyAuth = { create: normalized.shopifyAuth };
    }
    if (normalized.nebimAuth) {
      createData.nebimAuth = { create: normalized.nebimAuth };
    }

    // Setup record must exist from day one so the setup wizard starts from scratch
    createData.setup = { create: {} };

    const tenant = await prisma.tenantInfo.create({
      data: createData,
      include: {
        shopify: true,
        nebim: true,
        shopifyAuth: true,
        nebimAuth: true,
        pricing: true,
        schedules: true,
        setup: true,
      },
    });

    return this._transformToMongoFormat(tenant);
  }

  /**
   * Ensure default records exist for tenant (MongoDB behavior)
   * Creates shopify, nebim, pricing, schedules with default values if they don't exist
   */
  async _ensureDefaultRecords(tenant) {
    const updates = {};

    // Create shopify if not exists
    if (!tenant.shopify) {
      updates.shopify = {
        upsert: {
          create: {
            isInventoryTracking: true,
            isColorOptionFirst: true,
            isEnterprise: false,
            isShopifyPlus: false,
            isActive: true,
            currencyCode: null,
            countryCode: null,
            skuFieldsNebim: [
              SystemCodes.NEBIM_SKU_FIELDS.ITEM_CODE,
              SystemCodes.NEBIM_SKU_FIELDS.COLOR_CODE,
              SystemCodes.NEBIM_SKU_FIELDS.ITEM_DIM1_CODE
            ],
            skuFieldsSeparator: SystemCodes.SEPARATORS.DASH,
          },
          update: {},
        },
      };
    }

    // Create nebim if not exists
    if (!tenant.nebim) {
      updates.nebim = {
        upsert: {
          create: {
            isActive: true,
            blockProductGenerationWhenOff: false,
            isCargoService: false,
            productCategoryKeysFrom: [],
            productBarcodeTypeCode: 'EAN13',
            customerPhoneType: '7',
            customerAddressType: '1',
            customerConsentSource: 'HS_WEB',
            orderPosTerminalId: 1,
            orderIsMicroExport: false,
            procProductDetails: 'sp_GO_GetProductDetails',
            procProductInventory: 'sp_GO_GetProductInventory',
            procProductPrice: 'sp_GO_GetProductPrice',
            procFindStoreInventory: 'sp_GO_FindInStore',
            procGetStoreInfo: 'sp_GO_GetStoreInfo',
            procCustomerCheck: 'sp_GO_GetCustomer',
            procCustomerConcents: 'sp_GO_GetCustomerConcents',
            procOrderStatus: 'sp_GO_OrderStatus',
            procDefaultsAddressCodes: 'sp_GO_GetAddressList',
            procInputValidation: 'sp_GO_InputValidator',
          },
          update: {},
        },
      };
    }

    // Create setup if not exists
    if (!tenant.setup) {
      updates.setup = {
        upsert: {
          create: {},
          update: {},
        },
      };
    }

    // Create pricing if not exists
    if (!tenant.pricing) {
      updates.pricing = {
        upsert: {
          create: {
            planKey: 'BASIC',
            billingInterval: 'MONTHLY',
            orderLimit: SystemCodes.BILLING_PLANS.BASIC.LIMITS.ORDER,
            orderUsed: 0,
            productDetailsLimit: SystemCodes.BILLING_PLANS.BASIC.LIMITS.PRODUCT_DETAILS,
            productDetailsUsed: 0,
            periodStart: new Date(),
            periodEnd: moment().add(1, 'months').toDate(),
            isBlocked: false,
          },
          update: {},
        },
      };
    }

    // Create schedules if not exists
    if (!tenant.schedules) {
      updates.schedules = {
        upsert: {
          create: {
            nebimProductInventoryInterval: '*/5 * * * *',
            nebimProductInventoryStartDate: moment().subtract(1, 'hours').toDate(),
            nebimProductInventoryIsActive: false,
            nebimProductDetailsInterval: '0 * * * *',
            nebimProductDetailsStartDate: moment().subtract(1, 'days').toDate(),
            nebimProductDetailsIsActive: false,
            nebimOrderCreateCancelInterval: '*/30 * * * *',
            nebimOrderCreateCancelStartDate: moment().subtract(30, 'minutes').toDate(),
            nebimOrderCreateCancelIsActive: false,
            nebimOrderStatusInterval: '0 * * * *',
            nebimOrderStatusStartDate: moment().subtract(1, 'days').toDate(),
            nebimOrderStatusIsActive: false,
            nebimCustomerConcentsInterval: '0 0 * * *',
            nebimCustomerConcentsStartDate: moment().subtract(1, 'days').toDate(),
            nebimCustomerConcentsIsActive: true,
            nebimProductFindInStoreInterval: '*/30 * * * *',
            nebimProductFindInStoreStartDate: moment().subtract(30, 'minutes').toDate(),
            nebimProductFindInStoreIsActive: false,
            nebimProductMarketSyncInterval: '0 0 * * *',
            nebimProductMarketSyncIsActive: false,
            redentionLogsInterval: '0 0 * * *',
            redentionLogsStartDate: moment().subtract(1, 'days').toDate(),
            redentionLogsIsActive: true,
          },
          update: {},
        },
      };
    }

    // Update tenant with missing records
    if (Object.keys(updates).length > 0) {
      tenant = await prisma.tenantInfo.update({
        where: { id: tenant.id },
        data: updates,
        include: {
          shopify: true,
          nebim: true,
          shopifyAuth: true,
          nebimAuth: true,
          pricing: true,
          schedules: true,
        },
      });
    }

    return tenant;
  }

  /**
   * Update tenant
   * Prisma update requires unique where clause (id)
   */
  async updateOne(query, update) {
    // Prisma update requires unique where clause (id)
    // If query doesn't have id, find the tenant first to get id
    let where;
    let existingTenant = null;
    if (query.id || query._id) {
      where = { id: query.id || query._id };
      existingTenant = await this.findOne({ id: query.id || query._id });
    } else {
      // Find tenant first to get id
      const foundTenant = await this.findOne(query);
      if (!foundTenant) {
        throw new Error(`Tenant not found for update query: ${JSON.stringify(query)}`);
      }
      where = { id: foundTenant.id || foundTenant._id };
      existingTenant = foundTenant;
    }
    
    // Merge schedules with existing tenant schedules before normalization
    // This ensures that partial schedule updates preserve existing values
    if (update.shopify?.schedules && existingTenant?.shopify?.schedules) {
      update.shopify.schedules = ObjectHelper.deepMerge(
        JSON.parse(JSON.stringify(existingTenant.shopify.schedules)),
        update.shopify.schedules
      );
    }
    
    const normalized = this._normalizeUpdate(update, existingTenant);

    // Handle nested updates.
    // `update` branches only write the fields present in the request (partial),
    // `create` branches fall back to full objects with defaults so that a
    // missing related record can still be created with valid values.
    const updateData = {
      ...normalized.base,
    };

    if (normalized.shopify && Object.keys(normalized.shopify).length > 0) {
      updateData.shopify = {
        upsert: {
          create: this._normalizeFromMongoFormat({ shopify: update.shopify ?? {} }).shopify,
          update: normalized.shopify,
        },
      };
    }

    if (normalized.nebim && Object.keys(normalized.nebim).length > 0) {
      updateData.nebim = {
        upsert: {
          create: this._normalizeFromMongoFormat({ nebim: update.nebim ?? {} }).nebim,
          update: normalized.nebim,
        },
      };
    }

    if (normalized.shopifyAuth) {
      updateData.shopifyAuth = {
        upsert: {
          create: normalized.shopifyAuth,
          update: normalized.shopifyAuth,
        },
      };
    }

    if (normalized.nebimAuth) {
      updateData.nebimAuth = {
        upsert: {
          create: normalized.nebimAuth,
          update: normalized.nebimAuth,
        },
      };
    }

    if (normalized.pricing && Object.keys(normalized.pricing).length > 0) {
      updateData.pricing = {
        upsert: {
          create: this._normalizeFromMongoFormat({ shopify: { billing: update.shopify?.billing ?? {} } }).pricing,
          update: normalized.pricing,
        },
      };
    }

    if (normalized.schedules) {
      updateData.schedules = {
        upsert: {
          create: normalized.schedules,
          update: normalized.schedules,
        },
      };
    }

    const tenant = await prisma.tenantInfo.update({
      where,
      data: updateData,
      include: {
        shopify: true,
        nebim: true,
        shopifyAuth: true,
        nebimAuth: true,
        pricing: true,
        schedules: true,
        setup: true,
      },
    });

    return this._transformToMongoFormat(tenant);
  }

  /**
   * Delete tenant
   */
  async deleteOne(query) {
    const where = this._buildWhereClause(query);
    await prisma.tenantInfo.delete({
      where,
    });
    return { acknowledged: true, deletedCount: 1 };
  }

  /**
   * Save method (for compatibility with Mongoose)
   */
  async save(tenantData) {
    if (tenantData.id || tenantData._id) {
      const id = tenantData.id || tenantData._id;
      return this.updateOne({ id }, tenantData);
    } else {
      return this.create(tenantData);
    }
  }

  /**
   * Build where clause from MongoDB-style query
   */
  _buildWhereClause(query) {
    const where = {};

    if (query._id || query.id) {
      where.id = query._id || query.id;
    }

    if (query.name) {
      where.name = query.name;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Handle nested queries like "shopify.shopId"
    if (query['shopify.shopId'] || query['shopify.shop_id']) {
      where.shopify = {
        shopId: query['shopify.shopId'] || query['shopify.shop_id'],
      };
    }

    if (query['shopify.domain']) {
      where.shopify = {
        ...where.shopify,
        domain: query['shopify.domain'],
      };
    }

    if (query['shopify.apiKey.hash']) {
      where.shopifyAuth = {
        is: {
          apiKeyHash: query['shopify.apiKey.hash'],
        },
      };
    }

    if (query['nebim.password.hash']) {
      where.nebimAuth = {
        is: {
          passwordHash: query['nebim.password.hash'],
        },
      };
    }

    return where;
  }

  /**
   * Normalize MongoDB format to Prisma format
   */
  _normalizeFromMongoFormat(data) {
    const normalized = {
      name: data.name,
      isActive: data.isActive ?? true,
      isTestStore: data.isTestStore ?? false,
    };

    if (data.shopify) {
      normalized.shopify = {
        name: data.shopify.name,
        domain: data.shopify.domain,
        shopId: data.shopify.shopId ? String(data.shopify.shopId) : null,
        customerEmail: data.shopify.customerEmail,
        isInventoryTracking: data.shopify.isInventoryTracking ?? true,
        isColorOptionFirst: data.shopify.isColorOptionFirst ?? true,
        isEnterprise: data.shopify.isEnterprise ?? false,
        isShopifyPlus: data.shopify.isShopifyPlus ?? false,
        isActive: data.shopify.isActive ?? true,
        currencyCode: data.shopify.currencyCode ?? null,
        countryCode: data.shopify.countryCode ?? null,
        skuFieldsNebim: data.shopify.skuFields?.nebim?.fields && data.shopify.skuFields.nebim.fields.length > 0
          ? data.shopify.skuFields.nebim.fields
          : [
              SystemCodes.NEBIM_SKU_FIELDS.ITEM_CODE,
              SystemCodes.NEBIM_SKU_FIELDS.COLOR_CODE,
              SystemCodes.NEBIM_SKU_FIELDS.ITEM_DIM1_CODE
            ],
        skuFieldsSeparator: data.shopify.skuFields?.nebim?.separator || SystemCodes.SEPARATORS.DASH,
      };

      if (data.shopify.apiKey) {
        normalized.shopifyAuth = {
          apiKeyHash: data.shopify.apiKey.hash,
          apiKeyEncryptedData: data.shopify.apiKey.encryptedData,
          apiKeyIv: data.shopify.apiKey.iv,
          apiKeyAuthTag: data.shopify.apiKey.authTag,
        };
      }

      if (data.shopify.billing) {
        normalized.pricing = {
          planKey: data.shopify.billing.planKey || 'BASIC',
          billingInterval: data.shopify.billing.billingInterval || 'MONTHLY',
          subscriptionId: data.shopify.billing.subscription?.id || null,
          subscriptionLineId: data.shopify.billing.subscription?.lineId || null,
          orderLimit: data.shopify.billing.limits?.order?.limit ?? SystemCodes.BILLING_PLANS.BASIC.LIMITS.ORDER,
          orderUsed: data.shopify.billing.limits?.order?.used ?? 0,
          productDetailsLimit: data.shopify.billing.limits?.product_details?.limit ?? SystemCodes.BILLING_PLANS.BASIC.LIMITS.PRODUCT_DETAILS,
          productDetailsUsed: data.shopify.billing.limits?.product_details?.used ?? 0,
          periodStart: data.shopify.billing.periodStart ? new Date(data.shopify.billing.periodStart) : new Date(),
          periodEnd: data.shopify.billing.periodEnd ? new Date(data.shopify.billing.periodEnd) : moment().add(1, 'months').toDate(),
          isBlocked: data.shopify.billing.isBlocked ?? false,
          pendingNonce: data.shopify.billing.pendingNonce || null,
          pendingPlanKey: data.shopify.billing.pendingPlanKey || null,
        };
      }

      if (data.shopify.schedules) {
        normalized.schedules = {
          nebimProductInventoryInterval: data.shopify.schedules.nebim?.product?.inventory?.interval || '*/5 * * * *',
          nebimProductInventoryStartDate: data.shopify.schedules.nebim?.product?.inventory?.startDate ? new Date(data.shopify.schedules.nebim.product.inventory.startDate) : moment().subtract(1, 'hours').toDate(),
          nebimProductInventoryIsActive: data.shopify.schedules.nebim?.product?.inventory?.isActive ?? false,
          nebimProductDetailsInterval: data.shopify.schedules.nebim?.product?.details?.interval || '0 * * * *',
          nebimProductDetailsStartDate: data.shopify.schedules.nebim?.product?.details?.startDate ? new Date(data.shopify.schedules.nebim.product.details.startDate) : moment().subtract(1, 'days').toDate(),
          nebimProductDetailsIsActive: data.shopify.schedules.nebim?.product?.details?.isActive ?? false,
          nebimOrderCreateCancelInterval: data.shopify.schedules.nebim?.order?.create_and_cancel?.interval || '*/30 * * * *',
          nebimOrderCreateCancelStartDate: data.shopify.schedules.nebim?.order?.create_and_cancel?.startDate ? new Date(data.shopify.schedules.nebim.order.create_and_cancel.startDate) : moment().subtract(30, 'minutes').toDate(),
          nebimOrderCreateCancelIsActive: data.shopify.schedules.nebim?.order?.create_and_cancel?.isActive ?? false,
          nebimOrderStatusInterval: data.shopify.schedules.nebim?.order?.status?.interval || '0 * * * *',
          nebimOrderStatusStartDate: data.shopify.schedules.nebim?.order?.status?.startDate ? new Date(data.shopify.schedules.nebim.order.status.startDate) : moment().subtract(1, 'days').toDate(),
          nebimOrderStatusIsActive: data.shopify.schedules.nebim?.order?.status?.isActive ?? false,
          nebimCustomerConcentsInterval: data.shopify.schedules.nebim?.customer?.concents?.interval || '0 0 * * *',
          nebimCustomerConcentsStartDate: data.shopify.schedules.nebim?.customer?.concents?.startDate ? new Date(data.shopify.schedules.nebim.customer.concents.startDate) : moment().subtract(1, 'days').toDate(),
          nebimCustomerConcentsIsActive: data.shopify.schedules.nebim?.customer?.concents?.isActive ?? true,
          nebimProductFindInStoreInterval: data.shopify.schedules.nebim?.product?.find_in_store?.interval || '*/30 * * * *',
          nebimProductFindInStoreStartDate: data.shopify.schedules.nebim?.product?.find_in_store?.startDate ? new Date(data.shopify.schedules.nebim.product.find_in_store.startDate) : moment().subtract(30, 'minutes').toDate(),
          nebimProductFindInStoreIsActive: data.shopify.schedules.nebim?.product?.find_in_store?.isActive ?? false,
          nebimProductMarketSyncInterval: data.shopify.schedules.nebim?.product?.market_sync?.interval || '0 0 * * *',
          nebimProductMarketSyncIsActive: data.shopify.schedules.nebim?.product?.market_sync?.isActive ?? false,
          nebimProductMarketPriceStartDate: data.shopify.schedules.nebim?.product?.market_sync?.priceStartDate ? new Date(data.shopify.schedules.nebim.product.market_sync.priceStartDate) : null,
          nebimProductMarketContentStartDate: data.shopify.schedules.nebim?.product?.market_sync?.contentStartDate ? new Date(data.shopify.schedules.nebim.product.market_sync.contentStartDate) : null,
          redentionLogsInterval: data.shopify.schedules.redention?.logs?.interval || '0 0 * * *',
          redentionLogsStartDate: data.shopify.schedules.redention?.logs?.startDate ? new Date(data.shopify.schedules.redention.logs.startDate) : moment().subtract(1, 'days').toDate(),
          redentionLogsIsActive: data.shopify.schedules.redention?.logs?.isActive ?? true,
        };
      }
    }

    if (data.nebim) {
      normalized.nebim = {
        host: data.nebim.host,
        user: data.nebim.user,
        userGroup: data.nebim.userGroup,
        salesUrl: data.nebim.salesUrl,
        isActive: data.nebim.isActive ?? true,
        blockProductGenerationWhenOff: data.nebim.blockProductGenerationWhenOff ?? false,
        cargoItemCode: data.nebim.order?.cargoItemCode ?? data.nebim.cargoItemCode,
        isCargoService: data.nebim.order?.isCargoService ?? data.nebim.isCargoService ?? false,
        productCategoryKeysFrom: data.nebim.product?.categoryKeysFrom || [],
        productBarcodeTypeCode: (data.nebim.product?.barcodeTypeCode || 'EAN13').trim(),
        productPriceSellCode: data.nebim.product?.priceSellCode?.trim() || null,
        productPriceCompareCode: data.nebim.product?.priceCompareCode?.trim() || null,
        productResponsibilityAreaCode: data.nebim.product?.responsibilityAreaCode?.trim() || null,
        productIsColorBased: data.nebim.product?.isColorBased ?? false,
        productUseInternetOnVariant: data.nebim.product?.useInternetOnVariant ?? false,
        productUsedSeparatorOnColorAndItem: data.nebim.product?.usedSeparatorOnColorAndItem?.trim() || null,
        productUsedSeparatorOnColorAndItemDescriptions:
          data.nebim.product?.usedSeparatorOnColorAndItemDescriptions?.length === 1
            ? data.nebim.product.usedSeparatorOnColorAndItemDescriptions
            : null,
        customerPhoneType: data.nebim.customer?.phoneType || '7',
        customerAddressType: data.nebim.customer?.addressType || '1',
        customerConfirmationFormTypeCode: data.nebim.customer?.confirmationFormTypeCode,
        customerConfirmationFormStatusCode: data.nebim.customer?.confirmationFormStatusCode,
        customerConsentSource: data.nebim.customer?.consentSource || 'HS_WEB',
        customerInactivationReasonCode: data.nebim.customer?.inactivationReasonCode,
        orderDeliveryCompany:
          data.nebim.order?.deliveryCompany
          ?? data.nebim.order?.deliveryCompanyCode
          ?? null,
        orderPosTerminalId: data.nebim.order?.posTerminalId ?? 1,
        orderCreditCardType: data.nebim.order?.creditCardType,
        orderOffice: data.nebim.order?.office,
        orderStore: data.nebim.order?.store,
        orderCompany: data.nebim.order?.company ? String(data.nebim.order.company) : null,
        orderWarehouse: data.nebim.order?.warehouse,
        orderCancelReason: data.nebim.order?.cancelReason,
        orderIsMicroExport: data.nebim.order?.isMicroExport ?? false,
        orderIncotermCode1: data.nebim.order?.incotermCode1?.trim() || null,
        orderIncotermCode2: data.nebim.order?.incotermCode2?.trim() || null,
        procProductDetails: data.nebim.procNames?.product?.details || 'sp_GO_GetProductDetails',
        procProductInventory: data.nebim.procNames?.product?.inventory || 'sp_GO_GetProductInventory',
        procProductPrice: data.nebim.procNames?.product?.price || 'sp_GO_GetProductPrice',
        procFindStoreInventory: data.nebim.procNames?.product?.findInStore || 'sp_GO_FindInStore',
        procGetStoreInfo: data.nebim.procNames?.product?.storeInfo || 'sp_GO_GetStoreInfo',
        procCustomerCheck: data.nebim.procNames?.customer?.check || 'sp_GO_GetCustomer',
        procCustomerConcents: data.nebim.procNames?.customer?.concents || 'sp_GO_GetCustomerConcents',
        procOrderStatus: data.nebim.procNames?.order?.status || 'sp_GO_OrderStatus',
        procDefaultsAddressCodes: data.nebim.procNames?.defaults?.addressCodes || 'sp_GO_GetAddressList',
        procInputValidation: data.nebim.procNames?.inputValidation || 'sp_GO_InputValidator',
      };

      if (data.nebim.password) {
        normalized.nebimAuth = {
          passwordHash: data.nebim.password.hash,
          passwordEncryptedData: data.nebim.password.encryptedData,
          passwordIv: data.nebim.password.iv,
          passwordAuthTag: data.nebim.password.authTag,
        };
      }
    }

    return normalized;
  }

  /**
   * Normalize update object
   */
  _normalizeUpdate(update, existingTenant = null) {
    const normalized = {
      base: {},
      shopify: null,
      nebim: null,
      shopifyAuth: null,
      nebimAuth: null,
      pricing: null,
      schedules: null,
    };

    // Store $unset values before removing from update
    const unsetValues = update.$unset ? { ...update.$unset } : {};
    
    // Handle $unset (MongoDB-style unset) - store for later processing
    if (update.$unset) {
      // Remove $unset from update to avoid processing it as a regular field
      delete update.$unset;
    }

    // Handle nested MongoDB-style paths (e.g., "shopify.billing.planKey")
    const nestedUpdate = {};
    for (const [key, value] of Object.entries(update)) {
      if (key.includes('.')) {
        const keys = key.split('.');
        if (keys[0] === 'shopify') {
          if (!nestedUpdate.shopify) nestedUpdate.shopify = {};
          if (keys[1] === 'billing') {
            if (!nestedUpdate.shopify.billing) nestedUpdate.shopify.billing = {};
            const billingKey = keys.slice(2).join('.');
            // Handle nested billing keys
            if (billingKey.includes('.')) {
              const billingKeys = billingKey.split('.');
              if (billingKeys[0] === 'subscription') {
                if (!nestedUpdate.shopify.billing.subscription) nestedUpdate.shopify.billing.subscription = {};
                nestedUpdate.shopify.billing.subscription[billingKeys[1]] = value;
              } else if (billingKeys[0] === 'limits') {
                if (!nestedUpdate.shopify.billing.limits) nestedUpdate.shopify.billing.limits = {};
                if (!nestedUpdate.shopify.billing.limits[billingKeys[1]]) nestedUpdate.shopify.billing.limits[billingKeys[1]] = {};
                nestedUpdate.shopify.billing.limits[billingKeys[1]][billingKeys[2]] = value;
              } else {
                nestedUpdate.shopify.billing[billingKey] = value;
              }
            } else {
              nestedUpdate.shopify.billing[billingKey] = value;
            }
          } else {
            nestedUpdate.shopify[keys[1]] = value;
          }
        } else if (keys[0] === 'nebim') {
          if (!nestedUpdate.nebim) nestedUpdate.nebim = {};
          nestedUpdate.nebim[keys.slice(1).join('.')] = value;
        }
      } else {
        // Direct property
        if (key === 'name') normalized.base.name = value;
        else if (key === 'isActive') normalized.base.isActive = value;
        else if (key === 'isTestStore') normalized.base.isTestStore = value;
      }
    }

    // Merge nested updates with deep merge to preserve nested objects
    if (nestedUpdate.shopify) {
      if (!update.shopify) update.shopify = {};
      ObjectHelper.deepMerge(update.shopify, nestedUpdate.shopify);
    }
    if (nestedUpdate.nebim) {
      if (!update.nebim) update.nebim = {};
      ObjectHelper.deepMerge(update.nebim, nestedUpdate.nebim);
    }

    if (update.name !== undefined) normalized.base.name = update.name;
    if (update.isActive !== undefined) normalized.base.isActive = update.isActive;
    if (update.isTestStore !== undefined) normalized.base.isTestStore = update.isTestStore;

    // Partial normalization: only the fields present in the update are written,
    // so a narrow update (e.g. apiKey rotation or a billing webhook) can never
    // reset unrelated columns back to their defaults.
    if (update.shopify) {
      normalized.shopify = this._normalizeShopifyPartial(update.shopify);
    }

    if (update.nebim) {
      normalized.nebim = this._normalizeNebimPartial(update.nebim);
    }

    if (update.shopify?.apiKey) {
      normalized.shopifyAuth = this._normalizeFromMongoFormat({ shopify: { apiKey: update.shopify.apiKey } }).shopifyAuth;
    }

    if (update.nebim?.password) {
      normalized.nebimAuth = this._normalizeFromMongoFormat({ nebim: { password: update.nebim.password } }).nebimAuth;
    }

    if (update.shopify?.billing) {
      normalized.pricing = this._normalizePricingPartial(update.shopify.billing);
    }

    // Merge $unset nulls into pricing
    const billingUnsetKeys = Object.entries(unsetValues)
      .filter(([key, value]) => (value === 1 || value === true) && key.startsWith('shopify.billing.'))
      .map(([key]) => key.replace('shopify.billing.', ''));
    if (billingUnsetKeys.length > 0) {
      if (!normalized.pricing) normalized.pricing = {};
      for (const field of billingUnsetKeys) {
        // Field is already in camelCase (pendingNonce, pendingPlanKey)
        normalized.pricing[field] = null;
      }
    }

    if (update.shopify?.schedules) {
      normalized.schedules = this._normalizeFromMongoFormat({ shopify: { schedules: update.shopify.schedules } }).schedules;
    }

    return normalized;
  }

  /**
   * Normalize a partial shopify update: maps only the provided fields to their
   * Prisma column names. apiKey/billing/schedules are handled separately.
   */
  _normalizeShopifyPartial(shopify) {
    const out = {};

    if (shopify.name !== undefined) out.name = shopify.name;
    if (shopify.domain !== undefined) out.domain = shopify.domain;
    if (shopify.shopId !== undefined) out.shopId = shopify.shopId ? String(shopify.shopId) : null;
    if (shopify.customerEmail !== undefined) out.customerEmail = shopify.customerEmail;
    if (shopify.isInventoryTracking !== undefined) out.isInventoryTracking = shopify.isInventoryTracking;
    if (shopify.isColorOptionFirst !== undefined) out.isColorOptionFirst = shopify.isColorOptionFirst;
    if (shopify.isEnterprise !== undefined) out.isEnterprise = shopify.isEnterprise;
    if (shopify.isShopifyPlus !== undefined) out.isShopifyPlus = shopify.isShopifyPlus;
    if (shopify.isActive !== undefined) out.isActive = shopify.isActive;
    if (shopify.currencyCode !== undefined) out.currencyCode = shopify.currencyCode;
    if (shopify.countryCode !== undefined) out.countryCode = shopify.countryCode;

    if (shopify.skuFields?.nebim?.fields !== undefined) {
      out.skuFieldsNebim = shopify.skuFields.nebim.fields.length > 0
        ? shopify.skuFields.nebim.fields
        : [
            SystemCodes.NEBIM_SKU_FIELDS.ITEM_CODE,
            SystemCodes.NEBIM_SKU_FIELDS.COLOR_CODE,
            SystemCodes.NEBIM_SKU_FIELDS.ITEM_DIM1_CODE
          ];
    }
    if (shopify.skuFields?.nebim?.separator !== undefined) {
      out.skuFieldsSeparator = shopify.skuFields.nebim.separator || SystemCodes.SEPARATORS.DASH;
    }

    return out;
  }

  /**
   * Normalize a partial nebim update: maps only the provided fields to their
   * Prisma column names. password is handled separately (nebimAuth).
   */
  _normalizeNebimPartial(nebim) {
    const out = {};

    if (nebim.host !== undefined) out.host = nebim.host;
    if (nebim.user !== undefined) out.user = nebim.user;
    if (nebim.userGroup !== undefined) out.userGroup = nebim.userGroup;
    if (nebim.salesUrl !== undefined) out.salesUrl = nebim.salesUrl;
    if (nebim.isActive !== undefined) out.isActive = nebim.isActive;
    if (nebim.blockProductGenerationWhenOff !== undefined) out.blockProductGenerationWhenOff = nebim.blockProductGenerationWhenOff;

    const order = nebim.order ?? {};
    if (order.cargoItemCode !== undefined || nebim.cargoItemCode !== undefined) {
      out.cargoItemCode = order.cargoItemCode ?? nebim.cargoItemCode;
    }
    if (order.isCargoService !== undefined || nebim.isCargoService !== undefined) {
      out.isCargoService = order.isCargoService ?? nebim.isCargoService ?? false;
    }
    if (order.deliveryCompany !== undefined || order.deliveryCompanyCode !== undefined) {
      out.orderDeliveryCompany = order.deliveryCompany ?? order.deliveryCompanyCode ?? null;
    }
    if (order.posTerminalId !== undefined) out.orderPosTerminalId = order.posTerminalId ?? 1;
    if (order.creditCardType !== undefined) out.orderCreditCardType = order.creditCardType;
    if (order.office !== undefined) out.orderOffice = order.office;
    if (order.store !== undefined) out.orderStore = order.store;
    if (order.company !== undefined) out.orderCompany = order.company ? String(order.company) : null;
    if (order.warehouse !== undefined) out.orderWarehouse = order.warehouse;
    if (order.cancelReason !== undefined) out.orderCancelReason = order.cancelReason;
    if (order.isMicroExport !== undefined) out.orderIsMicroExport = order.isMicroExport ?? false;
    if (order.incotermCode1 !== undefined) out.orderIncotermCode1 = order.incotermCode1?.trim() || null;
    if (order.incotermCode2 !== undefined) out.orderIncotermCode2 = order.incotermCode2?.trim() || null;

    const product = nebim.product ?? {};
    if (product.categoryKeysFrom !== undefined) out.productCategoryKeysFrom = product.categoryKeysFrom || [];
    if (product.barcodeTypeCode !== undefined) out.productBarcodeTypeCode = (product.barcodeTypeCode || 'EAN13').trim();
    if (product.priceSellCode !== undefined) out.productPriceSellCode = product.priceSellCode?.trim() || null;
    if (product.priceCompareCode !== undefined) out.productPriceCompareCode = product.priceCompareCode?.trim() || null;
    if (product.responsibilityAreaCode !== undefined) out.productResponsibilityAreaCode = product.responsibilityAreaCode?.trim() || null;
    if (product.isColorBased !== undefined) out.productIsColorBased = product.isColorBased ?? false;
    if (product.useInternetOnVariant !== undefined) out.productUseInternetOnVariant = product.useInternetOnVariant ?? false;
    if (product.usedSeparatorOnColorAndItem !== undefined) {
      out.productUsedSeparatorOnColorAndItem = product.usedSeparatorOnColorAndItem?.trim() || null;
    }
    if (product.usedSeparatorOnColorAndItemDescriptions !== undefined) {
      out.productUsedSeparatorOnColorAndItemDescriptions =
        product.usedSeparatorOnColorAndItemDescriptions?.length === 1
          ? product.usedSeparatorOnColorAndItemDescriptions
          : null;
    }

    const customer = nebim.customer ?? {};
    if (customer.phoneType !== undefined) out.customerPhoneType = customer.phoneType || '7';
    if (customer.addressType !== undefined) out.customerAddressType = customer.addressType || '1';
    if (customer.confirmationFormTypeCode !== undefined) out.customerConfirmationFormTypeCode = customer.confirmationFormTypeCode;
    if (customer.confirmationFormStatusCode !== undefined) out.customerConfirmationFormStatusCode = customer.confirmationFormStatusCode;
    if (customer.consentSource !== undefined) out.customerConsentSource = customer.consentSource || 'HS_WEB';
    if (customer.inactivationReasonCode !== undefined) out.customerInactivationReasonCode = customer.inactivationReasonCode;

    const procNames = nebim.procNames ?? {};
    if (procNames.product?.details !== undefined) out.procProductDetails = procNames.product.details || 'sp_GO_GetProductDetails';
    if (procNames.product?.inventory !== undefined) out.procProductInventory = procNames.product.inventory || 'sp_GO_GetProductInventory';
    if (procNames.product?.price !== undefined) out.procProductPrice = procNames.product.price || 'sp_GO_GetProductPrice';
    if (procNames.product?.findInStore !== undefined) out.procFindStoreInventory = procNames.product.findInStore || 'sp_GO_FindInStore';
    if (procNames.product?.storeInfo !== undefined) out.procGetStoreInfo = procNames.product.storeInfo || 'sp_GO_GetStoreInfo';
    if (procNames.customer?.check !== undefined) out.procCustomerCheck = procNames.customer.check || 'sp_GO_GetCustomer';
    if (procNames.customer?.concents !== undefined) out.procCustomerConcents = procNames.customer.concents || 'sp_GO_GetCustomerConcents';
    if (procNames.order?.status !== undefined) out.procOrderStatus = procNames.order.status || 'sp_GO_OrderStatus';
    if (procNames.defaults?.addressCodes !== undefined) out.procDefaultsAddressCodes = procNames.defaults.addressCodes || 'sp_GO_GetAddressList';
    if (procNames.inputValidation !== undefined) out.procInputValidation = procNames.inputValidation || 'sp_GO_InputValidator';

    return out;
  }

  /**
   * Normalize a partial billing update: maps only the provided fields to their
   * Prisma pricing column names.
   */
  _normalizePricingPartial(billing) {
    const out = {};

    if (billing.planKey !== undefined) out.planKey = billing.planKey || 'BASIC';
    if (billing.billingInterval !== undefined) out.billingInterval = billing.billingInterval || 'MONTHLY';
    if (billing.subscription?.id !== undefined) out.subscriptionId = billing.subscription.id || null;
    if (billing.subscription?.lineId !== undefined) out.subscriptionLineId = billing.subscription.lineId || null;
    if (billing.limits?.order?.limit !== undefined) out.orderLimit = billing.limits.order.limit;
    if (billing.limits?.order?.used !== undefined) out.orderUsed = billing.limits.order.used;
    if (billing.limits?.product_details?.limit !== undefined) out.productDetailsLimit = billing.limits.product_details.limit;
    if (billing.limits?.product_details?.used !== undefined) out.productDetailsUsed = billing.limits.product_details.used;
    if (billing.periodStart !== undefined) out.periodStart = new Date(billing.periodStart);
    if (billing.periodEnd !== undefined) out.periodEnd = new Date(billing.periodEnd);
    if (billing.isBlocked !== undefined) out.isBlocked = billing.isBlocked;
    if (billing.pendingNonce !== undefined) out.pendingNonce = billing.pendingNonce || null;
    if (billing.pendingPlanKey !== undefined) out.pendingPlanKey = billing.pendingPlanKey || null;

    return out;
  }

  /**
   * Transform Prisma format to MongoDB-like format
   */
  _transformToMongoFormat(tenant) {
    const result = {
      _id: tenant.id,
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      isTestStore: tenant.isTestStore,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };

    if (tenant.shopify) {
      result.shopify = {
        name: tenant.shopify.name,
        domain: tenant.shopify.domain,
        shopId: tenant.shopify.shopId,
        customerEmail: tenant.shopify.customerEmail,
        isInventoryTracking: tenant.shopify.isInventoryTracking,
        isColorOptionFirst: tenant.shopify.isColorOptionFirst,
        isEnterprise: tenant.shopify.isEnterprise,
        isShopifyPlus: tenant.shopify.isShopifyPlus,
        isActive: tenant.shopify.isActive,
        currencyCode: tenant.shopify.currencyCode ?? null,
        countryCode: tenant.shopify.countryCode ?? null,
        skuFields: {
          nebim: {
            fields: tenant.shopify.skuFieldsNebim && tenant.shopify.skuFieldsNebim.length > 0
              ? tenant.shopify.skuFieldsNebim
              : [
                  SystemCodes.NEBIM_SKU_FIELDS.ITEM_CODE,
                  SystemCodes.NEBIM_SKU_FIELDS.COLOR_CODE,
                  SystemCodes.NEBIM_SKU_FIELDS.ITEM_DIM1_CODE
                ],
            separator: tenant.shopify.skuFieldsSeparator || SystemCodes.SEPARATORS.DASH,
          },
        },
      };

      if (tenant.shopifyAuth) {
        result.shopify.apiKey = {
          hash: tenant.shopifyAuth.apiKeyHash,
          encryptedData: tenant.shopifyAuth.apiKeyEncryptedData,
          iv: tenant.shopifyAuth.apiKeyIv,
          authTag: tenant.shopifyAuth.apiKeyAuthTag,
        };
      }

      if (tenant.pricing) {
        result.shopify.billing = {
          planKey: tenant.pricing.planKey,
          billingInterval: tenant.pricing.billingInterval ?? 'MONTHLY',
          subscription: {
            id: tenant.pricing.subscriptionId,
            lineId: tenant.pricing.subscriptionLineId,
          },
          limits: {
            order: {
              limit: tenant.pricing.orderLimit,
              used: tenant.pricing.orderUsed,
            },
            product_details: {
              limit: tenant.pricing.productDetailsLimit,
              used: tenant.pricing.productDetailsUsed,
            },
          },
          periodStart: tenant.pricing.periodStart.toISOString(),
          periodEnd: tenant.pricing.periodEnd.toISOString(),
          isBlocked: tenant.pricing.isBlocked,
          pendingNonce: tenant.pricing.pendingNonce,
          pendingPlanKey: tenant.pricing.pendingPlanKey,
        };
      } else {
        // pricing satırı yoksa BASIC default — bloklanmış sayılmaz
        result.shopify.billing = {
          planKey: 'BASIC',
          billingInterval: 'MONTHLY',
          subscription: { id: null, lineId: null },
          limits: {
            order: { limit: SystemCodes.BILLING_PLANS.BASIC.LIMITS.ORDER, used: 0 },
            product_details: { limit: SystemCodes.BILLING_PLANS.BASIC.LIMITS.PRODUCT_DETAILS, used: 0 },
          },
          periodStart: new Date().toISOString(),
          periodEnd: new Date(Date.now() + 30 * 864e5).toISOString(),
          isBlocked: false,
          pendingNonce: null,
          pendingPlanKey: null,
        };
      }

      if (tenant.schedules) {
        result.shopify.schedules = {
          nebim: {
            product: {
              inventory: {
                interval: tenant.schedules.nebimProductInventoryInterval,
                startDate: tenant.schedules.nebimProductInventoryStartDate.toISOString(),
                isActive: tenant.schedules.nebimProductInventoryIsActive,
              },
              details: {
                interval: tenant.schedules.nebimProductDetailsInterval,
                startDate: tenant.schedules.nebimProductDetailsStartDate.toISOString(),
                isActive: tenant.schedules.nebimProductDetailsIsActive,
              },
              find_in_store: {
                interval: tenant.schedules.nebimProductFindInStoreInterval,
                startDate: tenant.schedules.nebimProductFindInStoreStartDate.toISOString(),
                isActive: tenant.schedules.nebimProductFindInStoreIsActive,
              },
              market_sync: {
                interval: tenant.schedules.nebimProductMarketSyncInterval,
                isActive: tenant.schedules.nebimProductMarketSyncIsActive,
                priceStartDate: tenant.schedules.nebimProductMarketPriceStartDate ? tenant.schedules.nebimProductMarketPriceStartDate.toISOString() : null,
                contentStartDate: tenant.schedules.nebimProductMarketContentStartDate ? tenant.schedules.nebimProductMarketContentStartDate.toISOString() : null,
              },
            },
            customer: {
              concents: {
                interval: tenant.schedules.nebimCustomerConcentsInterval,
                startDate: tenant.schedules.nebimCustomerConcentsStartDate.toISOString(),
                isActive: tenant.schedules.nebimCustomerConcentsIsActive,
              },
            },
            order: {
              create_and_cancel: {
                interval: tenant.schedules.nebimOrderCreateCancelInterval,
                startDate: tenant.schedules.nebimOrderCreateCancelStartDate.toISOString(),
                isActive: tenant.schedules.nebimOrderCreateCancelIsActive,
              },
              status: {
                interval: tenant.schedules.nebimOrderStatusInterval,
                startDate: tenant.schedules.nebimOrderStatusStartDate.toISOString(),
                isActive: tenant.schedules.nebimOrderStatusIsActive,
              },
            },
          },
          redention: {
            logs: {
              interval: tenant.schedules.redentionLogsInterval,
              startDate: tenant.schedules.redentionLogsStartDate.toISOString(),
              isActive: tenant.schedules.redentionLogsIsActive,
            },
          },
        };
      }
    }

    if (tenant.nebim) {
      result.nebim = {
        host: tenant.nebim.host,
        user: tenant.nebim.user,
        userGroup: tenant.nebim.userGroup,
        salesUrl: tenant.nebim.salesUrl,
        isActive: tenant.nebim.isActive,
        blockProductGenerationWhenOff: tenant.nebim.blockProductGenerationWhenOff ?? false,
        product: {
          categoryKeysFrom: tenant.nebim.productCategoryKeysFrom,
          barcodeTypeCode: tenant.nebim.productBarcodeTypeCode,
          priceSellCode: tenant.nebim.productPriceSellCode,
          priceCompareCode: tenant.nebim.productPriceCompareCode,
          responsibilityAreaCode: tenant.nebim.productResponsibilityAreaCode,
          isColorBased: tenant.nebim.productIsColorBased ?? false,
          useInternetOnVariant: tenant.nebim.productUseInternetOnVariant ?? false,
          usedSeparatorOnColorAndItem: tenant.nebim.productUsedSeparatorOnColorAndItem,
          usedSeparatorOnColorAndItemDescriptions: tenant.nebim.productUsedSeparatorOnColorAndItemDescriptions,
        },
        customer: {
          phoneType: tenant.nebim.customerPhoneType,
          addressType: tenant.nebim.customerAddressType,
          confirmationFormTypeCode: tenant.nebim.customerConfirmationFormTypeCode,
          confirmationFormStatusCode: tenant.nebim.customerConfirmationFormStatusCode,
          consentSource: tenant.nebim.customerConsentSource,
          inactivationReasonCode: tenant.nebim.customerInactivationReasonCode,
        },
        order: {
          cargoItemCode: tenant.nebim.cargoItemCode,
          isCargoService: tenant.nebim.isCargoService ?? false,
          deliveryCompanyCode: tenant.nebim.orderDeliveryCompany,
          deliveryCompany: tenant.nebim.orderDeliveryCompany,
          posTerminalId: tenant.nebim.orderPosTerminalId,
          creditCardType: tenant.nebim.orderCreditCardType,
          office: tenant.nebim.orderOffice,
          store: tenant.nebim.orderStore,
          company: tenant.nebim.orderCompany,
          warehouse: tenant.nebim.orderWarehouse,
          cancelReason: tenant.nebim.orderCancelReason,
          isMicroExport: tenant.nebim.orderIsMicroExport ?? false,
          incotermCode1: tenant.nebim.orderIncotermCode1 ?? null,
          incotermCode2: tenant.nebim.orderIncotermCode2 ?? null,
        },
        procNames: {
          product: {
            details: tenant.nebim.procProductDetails,
            inventory: tenant.nebim.procProductInventory,
            price: tenant.nebim.procProductPrice,
            findInStore: tenant.nebim.procFindStoreInventory,
            storeInfo: tenant.nebim.procGetStoreInfo,
          },
          customer: {
            check: tenant.nebim.procCustomerCheck,
            concents: tenant.nebim.procCustomerConcents,
          },
          order: {
            status: tenant.nebim.procOrderStatus,
          },
          defaults: {
            addressCodes: tenant.nebim.procDefaultsAddressCodes,
          },
          inputValidation: tenant.nebim.procInputValidation,
        },
      };

      // Password is intentionally excluded from response for security reasons
      // Do not include nebim.password in the response
    }

    if (tenant.setup) {
      result.setup = transformSetupToApi(tenant.setup);
    } else {
      result.setup = transformSetupToApi(null);
    }

    return result;
  }
}

// Export singleton instance
export default new TenantModel();
