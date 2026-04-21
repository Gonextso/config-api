import prisma from '../../../builders/database/prismaBuilder.js';
import moment from 'moment';
import SystemCodes from '../../../enums/SystemCodes.js';
import ObjectHelper from '../../../helpers/ObjectHelper.js';
import LogHelper from '../../../helpers/LogHelper.js';

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
          isActive: true,
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
          customerPhoneType: '7',
          customerAddressType: '1',
          customerConsentSource: 'HS_WEB',
          orderPosTerminalId: 1,
          procProductDetails: 'sp_INV_GetProductDetails',
          procProductInventory: 'sp_INV_GetProductInventory',
          procProductPrice: 'sp_INV_GetProductPrice',
          procCustomerCheck: 'qry_B2C_GetCustomer',
          procOrderStatus: 'sp_INV_OrderStatus',
          procDefaultsAddressCodes: 'sp_INV_GetAddressList',
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
          orderLimit: 10,
          orderUsed: 0,
          productDetailsLimit: 1000,
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
          nebimProductInventoryInterval: '0 * * * *',
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
    
    const tenant = await prisma.tenantInfo.create({
      data: createData,
      include: {
        shopify: true,
        nebim: true,
        shopifyAuth: true,
        nebimAuth: true,
        pricing: true,
        schedules: true,
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
            isActive: true,
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
            customerPhoneType: '7',
            customerAddressType: '1',
            customerConsentSource: 'HS_WEB',
            orderPosTerminalId: 1,
            procProductDetails: 'sp_INV_GetProductDetails',
            procProductInventory: 'sp_INV_GetProductInventory',
            procProductPrice: 'sp_INV_GetProductPrice',
            procCustomerCheck: 'qry_B2C_GetCustomer',
            procOrderStatus: 'sp_INV_OrderStatus',
            procDefaultsAddressCodes: 'sp_INV_GetAddressList',
          },
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
            orderLimit: 10,
            orderUsed: 0,
            productDetailsLimit: 1000,
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
            nebimProductInventoryInterval: '0 * * * *',
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
    
    // Preserve shopId if it's not in the update and exists in the current tenant
    if (normalized.shopify && existingTenant?.shopify?.shopId && !update.shopify?.shopId && !update['shopify.shopId']) {
      normalized.shopify.shopId = existingTenant.shopify.shopId;
    }
    
    // Handle nested updates
    const updateData = {
      ...normalized.base,
    };

    if (normalized.shopify) {
      updateData.shopify = {
        upsert: {
          create: normalized.shopify,
          update: normalized.shopify,
        },
      };
    }

    if (normalized.nebim) {
      updateData.nebim = {
        upsert: {
          create: normalized.nebim,
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

    if (normalized.pricing) {
      updateData.pricing = {
        upsert: {
          create: normalized.pricing,
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
        isActive: data.shopify.isActive ?? true,
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
          subscriptionId: data.shopify.billing.subscription?.id || null,
          subscriptionLineId: data.shopify.billing.subscription?.lineId || null,
          orderLimit: data.shopify.billing.limits?.order?.limit ?? 10,
          orderUsed: data.shopify.billing.limits?.order?.used ?? 0,
          productDetailsLimit: data.shopify.billing.limits?.product_details?.limit ?? 1000,
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
          nebimProductInventoryInterval: data.shopify.schedules.nebim?.product?.inventory?.interval || '0 * * * *',
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
        customerPhoneType: data.nebim.customer?.phoneType || '7',
        customerAddressType: data.nebim.customer?.addressType || '1',
        customerConfirmationFormTypeCode: data.nebim.customer?.confirmationFormTypeCode,
        customerConfirmationFormStatusCode: data.nebim.customer?.confirmationFormStatusCode,
        customerConsentSource: data.nebim.customer?.consentSource || 'HS_WEB',
        customerInactivationReasonCode: data.nebim.customer?.inactivationReasonCode,
        orderDeliveryCompany: data.nebim.order?.deliveryCompany,
        orderPosTerminalId: data.nebim.order?.posTerminalId ?? 1,
        orderCreditCardType: data.nebim.order?.creditCardType,
        orderOffice: data.nebim.order?.office,
        orderStore: data.nebim.order?.store,
        orderCompany: data.nebim.order?.company ? String(data.nebim.order.company) : null,
        orderWarehouse: data.nebim.order?.warehouse,
        orderCancelReason: data.nebim.order?.cancelReason,
        procProductDetails: data.nebim.procNames?.product?.details || 'sp_INV_GetProductDetails',
        procProductInventory: data.nebim.procNames?.product?.inventory || 'sp_INV_GetProductInventory',
        procProductPrice: data.nebim.procNames?.product?.price || 'sp_INV_GetProductPrice',
        procCustomerCheck: data.nebim.procNames?.customer?.check || 'qry_B2C_GetCustomer',
        procOrderStatus: data.nebim.procNames?.order?.status || 'sp_INV_OrderStatus',
        procDefaultsAddressCodes: data.nebim.procNames?.defaults?.addressCodes || 'sp_INV_GetAddressList',
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

    // Preserve existing used values in billing limits if not in update
    if (nestedUpdate.shopify?.billing?.limits && existingTenant?.shopify?.billing?.limits) {
      // Preserve product_details.used if not in update
      if (nestedUpdate.shopify.billing.limits.product_details && 
          nestedUpdate.shopify.billing.limits.product_details.used === undefined) {
        nestedUpdate.shopify.billing.limits.product_details.used = 
          existingTenant.shopify.billing.limits.product_details?.used ?? 0;
      }
      // Preserve order.used if not in update
      if (nestedUpdate.shopify.billing.limits.order && 
          nestedUpdate.shopify.billing.limits.order.used === undefined) {
        nestedUpdate.shopify.billing.limits.order.used = 
          existingTenant.shopify.billing.limits.order?.used ?? 0;
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

    // Preserve existing used values in billing limits for object-style updates (before normalization)
    if (update.shopify?.billing?.limits && existingTenant?.shopify?.billing?.limits) {
      // Preserve product_details.used if not in update
      if (update.shopify.billing.limits.product_details && 
          update.shopify.billing.limits.product_details.used === undefined) {
        update.shopify.billing.limits.product_details.used = 
          existingTenant.shopify.billing.limits.product_details?.used ?? 0;
      }
      // Preserve order.used if not in update
      if (update.shopify.billing.limits.order && 
          update.shopify.billing.limits.order.used === undefined) {
        update.shopify.billing.limits.order.used = 
          existingTenant.shopify.billing.limits.order?.used ?? 0;
      }
    }

    if (update.name !== undefined) normalized.base.name = update.name;
    if (update.isActive !== undefined) normalized.base.isActive = update.isActive;
    if (update.isTestStore !== undefined) normalized.base.isTestStore = update.isTestStore;

    if (update.shopify) {
      normalized.shopify = this._normalizeFromMongoFormat({ shopify: update.shopify }).shopify;
    }

    if (update.nebim) {
      const nebimNormalized = this._normalizeFromMongoFormat({ nebim: update.nebim });
      normalized.nebim = nebimNormalized.nebim;
      // If password was in nebim, it's already normalized to nebimAuth
      if (nebimNormalized.nebimAuth) {
        normalized.nebimAuth = nebimNormalized.nebimAuth;
      }
    }

    if (update.shopify?.apiKey) {
      normalized.shopifyAuth = this._normalizeFromMongoFormat({ shopify: { apiKey: update.shopify.apiKey } }).shopifyAuth;
    }

    // Check if password exists separately (in case it wasn't in update.nebim)
    if (update.nebim?.password && !normalized.nebimAuth) {
      normalized.nebimAuth = this._normalizeFromMongoFormat({ nebim: { password: update.nebim.password } }).nebimAuth;
    }

    // Check billing after merge - use nestedUpdate if update.shopify.billing doesn't exist
    if (update.shopify?.billing) {
      normalized.pricing = this._normalizeFromMongoFormat({ shopify: { billing: update.shopify.billing } }).pricing;
    } else if (nestedUpdate.shopify?.billing) {
      // Fallback: use nestedUpdate if merge didn't work
      normalized.pricing = this._normalizeFromMongoFormat({ shopify: { billing: nestedUpdate.shopify.billing } }).pricing;
    }
    
    // Merge $unset nulls into pricing
    if (normalized.pricing && Object.keys(unsetValues).length > 0) {
      for (const [key, value] of Object.entries(unsetValues)) {
        if (value === 1 || value === true) {
          if (key.startsWith('shopify.billing.')) {
            const field = key.replace('shopify.billing.', '');
            // Field is already in camelCase (pendingNonce, pendingPlanKey)
            // Use it directly for Prisma client
            normalized.pricing[field] = null;
          }
        }
      }
    }

    if (update.shopify?.schedules) {
      normalized.schedules = this._normalizeFromMongoFormat({ shopify: { schedules: update.shopify.schedules } }).schedules;
    }

    return normalized;
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
        isActive: tenant.shopify.isActive,
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
          deliveryCompany: tenant.nebim.orderDeliveryCompany,
          posTerminalId: tenant.nebim.orderPosTerminalId,
          creditCardType: tenant.nebim.orderCreditCardType,
          office: tenant.nebim.orderOffice,
          store: tenant.nebim.orderStore,
          company: tenant.nebim.orderCompany,
          warehouse: tenant.nebim.orderWarehouse,
          cancelReason: tenant.nebim.orderCancelReason,
        },
        procNames: {
          product: {
            details: tenant.nebim.procProductDetails,
            inventory: tenant.nebim.procProductInventory,
            price: tenant.nebim.procProductPrice,
          },
          customer: {
            check: tenant.nebim.procCustomerCheck,
          },
          order: {
            status: tenant.nebim.procOrderStatus,
          },
          defaults: {
            addressCodes: tenant.nebim.procDefaultsAddressCodes,
          },
        },
      };

      // Password is intentionally excluded from response for security reasons
      // Do not include nebim.password in the response
    }

    return result;
  }
}

// Export singleton instance
export default new TenantModel();

