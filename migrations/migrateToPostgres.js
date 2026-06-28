/**
 * Migration script to migrate data from MongoDB to PostgreSQL
 * 
 * Usage: node migrations/migrateToPostgres.js
 * 
 * This script:
 * 1. Reads all data from MongoDB
 * 2. Normalizes nested structures
 * 3. Inserts into PostgreSQL using Prisma
 * 4. Handles encrypted fields properly
 * 5. Skips removed fields (ecommerceId, erpId, tokenUsed, tokenLimit)
 * 
 * Environment Variables:
 * - RUN_MIGRATION: Set to 'true' to enable migration (default: false)
 * - MONGO_URI: MongoDB connection string
 * - DATABASE_URL: PostgreSQL connection string
 */

import mongoose from 'mongoose';
// Import prisma after ensuring it's initialized
// Note: This requires prismaBuilder to be loaded first
import '../builders/envBuilder.js';
import prisma from '../builders/database/prismaBuilder.js';
import TenantMongo from '../models/db/Tenant.js';
import FailedOrderMongo from '../models/db/FailedOrder.js';
import SuccessOrderMongo from '../models/db/SuccessOrder.js';
import OrderSyncBatchMongo from '../models/db/OrderSyncBatch.js';
import LogHelper from '../helpers/LogHelper.js';
import moment from 'moment';

// Import SyncedBarcode MongoDB model if it exists
let SyncedBarcodeMongo = null;
try {
  // Try to import from integration-api models (if running from config-api but need to access integration-api models)
  SyncedBarcodeMongo = await import('../../integration-api/models/db/SyncedBarcode.js').then(m => m.default).catch(() => null);
} catch (error) {
  // If import fails, we'll handle it in the migration function
}

const logger = new LogHelper();

// Tenant ID mapping: MongoDB _id -> PostgreSQL UUID
const tenantIdMap = new Map();

/**
 * Check if PostgreSQL has existing data
 */
async function hasPostgreSQLData() {
  try {
    const tenantCount = await prisma.tenantInfo.count();
    return tenantCount > 0;
  } catch (error) {
    logger.error(`Error checking PostgreSQL data: ${error.message}`);
    throw error;
  }
}

/**
 * Migrate tenants
 */
async function migrateTenants() {
  const startTime = Date.now();
  logger.info2('Starting tenant migration...');
  
  // Select fields including those marked with select: false (apiKey, password)
  const tenants = await TenantMongo.find({}).select('+shopify.apiKey.hash +shopify.apiKey.encryptedData +shopify.apiKey.iv +shopify.apiKey.authTag +nebim.password.hash +nebim.password.encryptedData +nebim.password.iv +nebim.password.authTag');
  logger.info2(`Found ${tenants.length} tenants to migrate`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < tenants.length; i++) {
    const tenant = tenants[i];
    const currentIndex = i + 1;
    
    try {
      // Create tenant info
      const tenantInfo = await prisma.tenantInfo.create({
        data: {
          name: tenant.name,
          isActive: tenant.isActive ?? true,
          isTestStore: tenant.isTestStore ?? false,
        },
      });

      // Store ID mapping
      tenantIdMap.set(tenant._id.toString(), tenantInfo.id);
      
      // Detailed log for each tenant
      logger.info3(`Migrating tenant ${currentIndex}/${tenants.length}: ${tenant.name} (MongoDB: ${tenant._id} → PostgreSQL: ${tenantInfo.id})`);
      
      // Progress log every 10 tenants
      if (currentIndex % 10 === 0 || currentIndex === tenants.length) {
        logger.info2(`Progress: ${currentIndex}/${tenants.length} tenants migrated`);
      }

      // Create Shopify config if exists
      if (tenant.shopify) {
        logger.info3(`  [DEBUG] Tenant ${tenant.name} - shopify.shopId from MongoDB: ${tenant.shopify.shopId} (type: ${typeof tenant.shopify.shopId})`);
        
        // Check if domain or shopId already exists
        const orConditions = [];
        if (tenant.shopify.domain) {
          orConditions.push({ domain: tenant.shopify.domain });
        }
        if (tenant.shopify.shopId) {
          orConditions.push({ shopId: tenant.shopify.shopId });
        }

        let existingShopify = null;
        if (orConditions.length > 0) {
          existingShopify = await prisma.tenantShopify.findFirst({
            where: {
              OR: orConditions,
            },
          });
        }

        if (existingShopify) {
          logger.warn(`  Shopify config already exists for domain=${tenant.shopify.domain || 'N/A'}, shopId=${tenant.shopify.shopId || 'N/A'} (existing shopId: ${existingShopify.shopId || 'N/A'}), skipping creation for tenant ${tenant.name}`);
        } else {
          const shopIdValue = tenant.shopify.shopId ?? null;
          logger.info3(`  [DEBUG] Tenant ${tenant.name} - shopId value to insert: ${shopIdValue}`);
          
          await prisma.tenantShopify.create({
            data: {
              tenantId: tenantInfo.id,
              name: tenant.shopify.name,
              domain: tenant.shopify.domain,
              shopId: shopIdValue,
              customerEmail: tenant.shopify.customerEmail,
              isInventoryTracking: tenant.shopify.isInventoryTracking ?? true,
              isColorOptionFirst: tenant.shopify.isColorOptionFirst ?? true,
              isEnterprise: tenant.shopify.isEnterprise ?? false,
              isActive: tenant.shopify.isActive ?? true,
              skuFieldsNebim: tenant.shopify.skuFields?.nebim?.fields || [],
              skuFieldsSeparator: tenant.shopify.skuFields?.nebim?.separator || '-',
            },
          });
          logger.info3(`  Created Shopify config for tenant ${tenant.name}: domain=${tenant.shopify.domain || 'N/A'}, shopId=${shopIdValue || 'N/A'}`);
        }

        // Create Shopify auth if exists
        if (tenant.shopify?.apiKey) {
          const apiKey = tenant.shopify.apiKey;
          if (apiKey.hash || apiKey.encryptedData || apiKey.iv || apiKey.authTag) {
            await prisma.authShopify.create({
              data: {
                tenantId: tenantInfo.id,
                apiKeyHash: apiKey.hash || null,
                apiKeyEncryptedData: apiKey.encryptedData || null,
                apiKeyIv: apiKey.iv || null,
                apiKeyAuthTag: apiKey.authTag || null,
              },
            });
            logger.info3(`  Created Shopify auth for tenant ${tenant.name}: hash=${!!apiKey.hash}, encryptedData=${!!apiKey.encryptedData}, iv=${!!apiKey.iv}, authTag=${!!apiKey.authTag}`);
          } else {
            logger.warn(`  Shopify apiKey exists but all fields are empty for tenant ${tenant.name}`);
          }
        } else {
          logger.info3(`  No Shopify apiKey found for tenant ${tenant.name}`);
        }

        // Create pricing info if exists
        if (tenant.shopify.billing) {
          await prisma.pricingInfo.create({
            data: {
              tenantId: tenantInfo.id,
              planKey: tenant.shopify.billing.planKey || 'BASIC',
              subscriptionId: tenant.shopify.billing.subscription?.id,
              subscriptionLineId: tenant.shopify.billing.subscription?.lineId,
              orderLimit: tenant.shopify.billing.limits?.order?.limit ?? 10,
              orderUsed: tenant.shopify.billing.limits?.order?.used ?? 0,
              productDetailsLimit: tenant.shopify.billing.limits?.product_details?.limit ?? 1000,
              productDetailsUsed: tenant.shopify.billing.limits?.product_details?.used ?? 0,
              periodStart: tenant.shopify.billing.periodStart ? new Date(tenant.shopify.billing.periodStart) : new Date(),
              periodEnd: tenant.shopify.billing.periodEnd ? new Date(tenant.shopify.billing.periodEnd) : moment().add(1, 'months').toDate(),
              isBlocked: tenant.shopify.billing.isBlocked ?? false,
              pendingNonce: tenant.shopify.billing.pendingNonce,
              pendingPlanKey: tenant.shopify.billing.pendingPlanKey,
            },
          });
        }

        // Create schedules if exists
        if (tenant.shopify.schedules) {
          await prisma.scheduleTenant.create({
            data: {
              tenantId: tenantInfo.id,
              nebimProductInventoryInterval: tenant.shopify.schedules.nebim?.product?.inventory?.interval || '*/5 * * * *',
              nebimProductInventoryStartDate: tenant.shopify.schedules.nebim?.product?.inventory?.startDate ? new Date(tenant.shopify.schedules.nebim.product.inventory.startDate) : moment().subtract(1, 'hours').toDate(),
              nebimProductInventoryIsActive: tenant.shopify.schedules.nebim?.product?.inventory?.isActive ?? false,
              nebimProductDetailsInterval: tenant.shopify.schedules.nebim?.product?.details?.interval || '0 * * * *',
              nebimProductDetailsStartDate: tenant.shopify.schedules.nebim?.product?.details?.startDate ? new Date(tenant.shopify.schedules.nebim.product.details.startDate) : moment().subtract(1, 'days').toDate(),
              nebimProductDetailsIsActive: tenant.shopify.schedules.nebim?.product?.details?.isActive ?? false,
              nebimOrderCreateCancelInterval: tenant.shopify.schedules.nebim?.order?.create_and_cancel?.interval || '*/30 * * * *',
              nebimOrderCreateCancelStartDate: tenant.shopify.schedules.nebim?.order?.create_and_cancel?.startDate ? new Date(tenant.shopify.schedules.nebim.order.create_and_cancel.startDate) : moment().subtract(30, 'minutes').toDate(),
              nebimOrderCreateCancelIsActive: tenant.shopify.schedules.nebim?.order?.create_and_cancel?.isActive ?? false,
              nebimOrderStatusInterval: tenant.shopify.schedules.nebim?.order?.status?.interval || '*0 * * * *',
              nebimOrderStatusStartDate: tenant.shopify.schedules.nebim?.order?.status?.startDate ? new Date(tenant.shopify.schedules.nebim.order.status.startDate) : moment().subtract(1, 'days').toDate(),
              nebimOrderStatusIsActive: tenant.shopify.schedules.nebim?.order?.status?.isActive ?? false,
              nebimProductFindInStoreInterval: tenant.shopify.schedules.nebim?.product?.find_in_store?.interval || '*/30 * * * *',
              nebimProductFindInStoreStartDate: tenant.shopify.schedules.nebim?.product?.find_in_store?.startDate ? new Date(tenant.shopify.schedules.nebim.product.find_in_store.startDate) : moment().subtract(30, 'minutes').toDate(),
              nebimProductFindInStoreIsActive: tenant.shopify.schedules.nebim?.product?.find_in_store?.isActive ?? false,
              redentionLogsInterval: tenant.shopify.schedules.redention?.logs?.interval || '0 0 * * *',
              redentionLogsStartDate: tenant.shopify.schedules.redention?.logs?.startDate ? new Date(tenant.shopify.schedules.redention.logs.startDate) : moment().subtract(1, 'days').toDate(),
              redentionLogsIsActive: tenant.shopify.schedules.redention?.logs?.isActive ?? true,
            },
          });
        }
      }

      // Create Nebim config if exists
      if (tenant.nebim) {
        await prisma.tenantNebim.create({
          data: {
            tenantId: tenantInfo.id,
            host: tenant.nebim.host,
            user: tenant.nebim.user,
            userGroup: tenant.nebim.userGroup,
            salesUrl: tenant.nebim.salesUrl,
            isActive: tenant.nebim.isActive ?? true,
            productCategoryKeysFrom: tenant.nebim.product?.categoryKeysFrom || [],
            productBarcodeTypeCode: (tenant.nebim.product?.barcodeTypeCode || 'EAN13').trim(),
            productPriceSellCode: tenant.nebim.product?.priceSellCode?.trim() || null,
            productPriceCompareCode: tenant.nebim.product?.priceCompareCode?.trim() || null,
            productResponsibilityAreaCode: tenant.nebim.product?.responsibilityAreaCode?.trim() || null,
            productIsColorBased: tenant.nebim.product?.isColorBased ?? false,
            productUseInternetOnVariant: tenant.nebim.product?.useInternetOnVariant ?? false,
            productUsedSeparatorOnColorAndItem: tenant.nebim.product?.usedSeparatorOnColorAndItem?.trim() || null,
            productUsedSeparatorOnColorAndItemDescriptions:
              tenant.nebim.product?.usedSeparatorOnColorAndItemDescriptions?.length === 1
                ? tenant.nebim.product.usedSeparatorOnColorAndItemDescriptions
                : null,
            customerPhoneType: tenant.nebim.customer?.phoneType || '7',
            customerAddressType: tenant.nebim.customer?.addressType || '1',
            customerConfirmationFormTypeCode: tenant.nebim.customer?.confirmationFormTypeCode,
            customerConfirmationFormStatusCode: tenant.nebim.customer?.confirmationFormStatusCode,
            customerConsentSource: tenant.nebim.customer?.consentSource || 'HS_WEB',
            customerInactivationReasonCode: tenant.nebim.customer?.inactivationReasonCode,
            orderDeliveryCompany: tenant.nebim.order?.deliveryCompanyCode ?? tenant.nebim.order?.deliveryCompany,
            orderPosTerminalId: tenant.nebim.order?.posTerminalId ?? 1,
            orderCreditCardType: tenant.nebim.order?.creditCardType,
            orderOffice: tenant.nebim.order?.office,
            orderStore: tenant.nebim.order?.store,
            orderCompany: tenant.nebim.order?.company,
            orderWarehouse: tenant.nebim.order?.warehouse,
            orderCancelReason: tenant.nebim.order?.cancelReason,
            procProductDetails: tenant.nebim.procNames?.product?.details || 'sp_INV_GetProductDetails',
            procProductInventory: tenant.nebim.procNames?.product?.inventory || 'sp_INV_GetProductInventory',
            procProductPrice: tenant.nebim.procNames?.product?.price || 'sp_INV_GetProductPrice',
            procFindStoreInventory: tenant.nebim.procNames?.product?.findInStore || 'sp_GO_FindInStore',
            procGetStoreInfo: tenant.nebim.procNames?.product?.storeInfo || 'sp_GO_GetStoreInfo',
            procCustomerCheck: tenant.nebim.procNames?.customer?.check || 'qry_B2C_GetCustomer',
            procOrderStatus: tenant.nebim.procNames?.order?.status || 'sp_INV_OrderStatus',
            procDefaultsAddressCodes: tenant.nebim.procNames?.defaults?.addressCodes || 'sp_INV_GetAddressList',
          },
        });

        // Create Nebim auth if exists
        if (tenant.nebim?.password) {
          const password = tenant.nebim.password;
          if (password.hash || password.encryptedData || password.iv || password.authTag) {
            await prisma.authNebim.create({
              data: {
                tenantId: tenantInfo.id,
                passwordHash: password.hash || null,
                passwordEncryptedData: password.encryptedData || null,
                passwordIv: password.iv || null,
                passwordAuthTag: password.authTag || null,
              },
            });
            logger.info3(`  Created Nebim auth for tenant ${tenant.name}: hash=${!!password.hash}, encryptedData=${!!password.encryptedData}, iv=${!!password.iv}, authTag=${!!password.authTag}`);
          } else {
            logger.warn(`  Nebim password exists but all fields are empty for tenant ${tenant.name}`);
          }
        } else {
          logger.info3(`  No Nebim password found for tenant ${tenant.name}`);
        }
      }
      
      successCount++;
    } catch (error) {
      failCount++;
      logger.error(`Error migrating tenant ${currentIndex}/${tenants.length} (${tenant.name}, MongoDB ID: ${tenant._id}): ${error.message}`);
      console.error(error);
    }
  }

  const duration = Date.now() - startTime;
  logger.info4(`Tenant migration completed in ${duration}ms`);
  logger.info4(`Tenant migration: ${successCount}/${tenants.length} successful, ${failCount} failed`);
  
  return { successCount, failCount, duration };
}

/**
 * Migrate sync batches
 */
async function migrateSyncBatches() {
  const startTime = Date.now();
  logger.info2('Starting sync batch migration...');
  
  const batches = await OrderSyncBatchMongo.find({});
  logger.info2(`Found ${batches.length} sync batches to migrate`);

  const batchIdMap = new Map();
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const currentIndex = i + 1;
    
    try {
      const tenantId = tenantIdMap.get(batch.tenant.toString());
      if (!tenantId) {
        skippedCount++;
        logger.warn(`Tenant not found for batch ${currentIndex}/${batches.length} (MongoDB ID: ${batch._id}), skipping...`);
        continue;
      }

      const syncBatch = await prisma.syncBatch.create({
        data: {
          tenantId: tenantId,
          process: batch.process,
          requestStartDate: batch.request?.startDate || null,
          requestEndDate: batch.request?.endDate || null,
          requestOrderNumberList: batch.request?.orderNumberList || [],
          total: batch.numbers?.total || null,
          createOrderTotal: batch.numbers?.createOrderTotal || null,
          createOrderSuccess: batch.numbers?.createOrderSuccess || null,
          createOrderError: batch.numbers?.createOrderError || null,
          createOrderSkippedTotal: batch.numbers?.createOrderSkippedTotal || null,
          createOrderSkippedAlreadySynced: batch.numbers?.createOrderSkippedAlreadySynced || null,
          createOrderSkippedFailed: batch.numbers?.createOrderSkippedFailed || null,
          cancelOrderTotal: batch.numbers?.cancelOrderTotal || null,
          cancelOrderSuccess: batch.numbers?.cancelOrderSuccess || null,
          cancelOrderError: batch.numbers?.cancelOrderError || null,
          cancelOrderSkippedTotal: batch.numbers?.cancelOrderSkippedTotal || null,
          cancelOrderSkippedAlreadySynced: batch.numbers?.cancelOrderSkippedAlreadySynced || null,
          cancelOrderSkippedFailed: batch.numbers?.cancelOrderSkippedFailed || null,
          cancelOrderSkippedNotFound: batch.numbers?.cancelOrderSkippedNotFound || null,
          isErrorLogExistsForBatch: batch.isErrorLogExistsForThisBatch || null,
          traceId: batch.traceId,
          createdAt: batch.createdAt,
        },
      });

      batchIdMap.set(batch._id.toString(), syncBatch.id);
      
      // Detailed log for each batch
      logger.info3(`Migrating sync batch ${currentIndex}/${batches.length}: Process=${batch.process}, Total=${batch.numbers?.total || 0}, TraceId=${batch.traceId} (MongoDB: ${batch._id} → PostgreSQL: ${syncBatch.id})`);
      
      // Progress log every 10 batches
      if (currentIndex % 10 === 0 || currentIndex === batches.length) {
        logger.info2(`Progress: ${currentIndex}/${batches.length} sync batches migrated`);
      }
      
      successCount++;
    } catch (error) {
      failCount++;
      logger.error(`Error migrating sync batch ${currentIndex}/${batches.length} (MongoDB ID: ${batch._id}, Process: ${batch.process}): ${error.message}`);
      console.error(error);
    }
  }

  const duration = Date.now() - startTime;
  logger.info4(`Sync batch migration completed in ${duration}ms`);
  logger.info4(`Sync batch migration: ${successCount}/${batches.length} successful, ${failCount} failed, ${skippedCount} skipped`);
  
  return batchIdMap;
}

/**
 * Migrate failed orders
 */
async function migrateFailedOrders(batchIdMap) {
  const startTime = Date.now();
  logger.info2('Starting failed order migration...');
  
  const orders = await FailedOrderMongo.find({});
  logger.info2(`Found ${orders.length} failed orders to migrate`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const currentIndex = i + 1;
    
    try {
      const tenantId = tenantIdMap.get(order.tenant.toString());
      const syncBatchId = batchIdMap.get(order.syncBatchId.toString());
      
      if (!tenantId) {
        skippedCount++;
        logger.warn(`Tenant not found for failed order ${currentIndex}/${orders.length} (MongoDB ID: ${order._id}, Shopify Order: ${order.ecommerceId}), skipping...`);
        continue;
      }
      if (!syncBatchId) {
        skippedCount++;
        logger.warn(`Sync batch not found for failed order ${currentIndex}/${orders.length} (MongoDB ID: ${order._id}, Shopify Order: ${order.ecommerceId}), skipping...`);
        continue;
      }

      await prisma.syncFailedOrder.create({
        data: {
          tenantId: tenantId,
          syncBatchId: syncBatchId,
          shopifyOrderId: order.ecommerceId, // Using ecommerceId as shopifyOrderId
          orderData: order.orderData || null,
          reason: order.reason || null,
          process: order.process,
          isCancelled: order.isCancelled ?? false,
          traceId: order.traceId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt || order.createdAt,
        },
      });

      // Detailed log for each order (every 50 orders to avoid too much logging)
      if (currentIndex % 50 === 0 || currentIndex === orders.length) {
        logger.info3(`Migrating failed order ${currentIndex}/${orders.length}: Shopify Order=${order.ecommerceId}, Process=${order.process}, Reason=${order.reason || 'N/A'}`);
      }
      
      // Progress log every 100 orders
      if (currentIndex % 100 === 0 || currentIndex === orders.length) {
        logger.info2(`Progress: ${currentIndex}/${orders.length} failed orders migrated`);
      }
      
      successCount++;
    } catch (error) {
      failCount++;
      logger.error(`Error migrating failed order ${currentIndex}/${orders.length} (MongoDB ID: ${order._id}, Shopify Order: ${order.ecommerceId}): ${error.message}`);
      console.error(error);
    }
  }

  const duration = Date.now() - startTime;
  logger.info4(`Failed order migration completed in ${duration}ms`);
  logger.info4(`Failed order migration: ${successCount}/${orders.length} successful, ${failCount} failed, ${skippedCount} skipped`);
}

/**
 * Migrate success orders
 */
async function migrateSuccessOrders(batchIdMap) {
  const startTime = Date.now();
  logger.info2('Starting success order migration...');
  
  const orders = await SuccessOrderMongo.find({});
  logger.info2(`Found ${orders.length} success orders to migrate`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const currentIndex = i + 1;
    
    try {
      const tenantId = tenantIdMap.get(order.tenant.toString());
      const syncBatchId = batchIdMap.get(order.syncBatchId.toString());
      
      if (!tenantId) {
        skippedCount++;
        logger.warn(`Tenant not found for success order ${currentIndex}/${orders.length} (MongoDB ID: ${order._id}, Shopify Order: ${order.ecommerceId}), skipping...`);
        continue;
      }
      if (!syncBatchId) {
        skippedCount++;
        logger.warn(`Sync batch not found for success order ${currentIndex}/${orders.length} (MongoDB ID: ${order._id}, Shopify Order: ${order.ecommerceId}), skipping...`);
        continue;
      }

      await prisma.syncSuccessOrder.create({
        data: {
          tenantId: tenantId,
          syncBatchId: syncBatchId,
          nebimOrderId: order.erpId || null, // Using erpId as nebimOrderId
          shopifyOrderId: order.ecommerceId || null, // Using ecommerceId as shopifyOrderId
          lines: order.lines || null,
          partiallyCancelledLines: order.partiallyCancelledLines || null,
          isCancelled: order.isCancelled ?? false,
          isShipped: order.isShipped ?? false,
          isPartiallyCancelled: order.isPartiallyCancelled ?? false,
          traceId: order.traceId,
          cleared: order.cleared ?? false,
          createdAt: order.createdAt,
        },
      });

      // Detailed log for each order (every 50 orders to avoid too much logging)
      if (currentIndex % 50 === 0 || currentIndex === orders.length) {
        logger.info3(`Migrating success order ${currentIndex}/${orders.length}: Shopify Order=${order.ecommerceId}, Nebim Order=${order.erpId || 'N/A'}, Cancelled=${order.isCancelled}, Shipped=${order.isShipped}`);
      }
      
      // Progress log every 100 orders
      if (currentIndex % 100 === 0 || currentIndex === orders.length) {
        logger.info2(`Progress: ${currentIndex}/${orders.length} success orders migrated`);
      }
      
      successCount++;
    } catch (error) {
      failCount++;
      logger.error(`Error migrating success order ${currentIndex}/${orders.length} (MongoDB ID: ${order._id}, Shopify Order: ${order.ecommerceId}): ${error.message}`);
      console.error(error);
    }
  }

  const duration = Date.now() - startTime;
  logger.info4(`Success order migration completed in ${duration}ms`);
  logger.info4(`Success order migration: ${successCount}/${orders.length} successful, ${failCount} failed, ${skippedCount} skipped`);
}

/**
 * Create products schema and synced_barcode table if they don't exist
 */
async function createProductsSchema() {
  const startTime = Date.now();
  logger.info2('Creating products schema and synced_barcode table...');
  
  try {
    // Create products schema if it doesn't exist
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "products";`);
    logger.info3('Created products schema (or it already exists)');
    
    // Create synced_barcode table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "products"."synced_barcode" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "barcode" TEXT NOT NULL,
        "product_id" TEXT,
        "variant_id" TEXT,
        "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "synced_barcode_pkey" PRIMARY KEY ("id")
      );
    `);
    logger.info3('Created synced_barcode table (or it already exists)');
    
    // Create indexes if they don't exist
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "synced_barcode_tenant_id_idx" ON "products"."synced_barcode"("tenant_id");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "synced_barcode_barcode_idx" ON "products"."synced_barcode"("barcode");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "synced_barcode_barcode_tenant_id_key" ON "products"."synced_barcode"("barcode", "tenant_id");
    `);
    
    // Add foreign key if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'synced_barcode_tenant_id_fkey'
        ) THEN
          ALTER TABLE "products"."synced_barcode" 
          ADD CONSTRAINT "synced_barcode_tenant_id_fkey" 
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    
    logger.info3('Created indexes and foreign keys for synced_barcode table');
    
    const duration = Date.now() - startTime;
    logger.info4(`Products schema creation completed in ${duration}ms`);
  } catch (error) {
    logger.error(`Error creating products schema: ${error.message}`);
    throw error;
  }
}

/**
 * Migrate synced barcodes from MongoDB to PostgreSQL
 */
async function migrateSyncedBarcodes() {
  const startTime = Date.now();
  logger.info2('Starting synced barcode migration...');
  
  // Try to import SyncedBarcode MongoDB model
  let SyncedBarcodeMongo = null;
  try {
    const module = await import('../../integration-api/models/db/SyncedBarcode.js');
    SyncedBarcodeMongo = module.default;
  } catch (error) {
    logger.warn('SyncedBarcode MongoDB model not found, skipping synced barcode migration');
    return;
  }
  
  const barcodes = await SyncedBarcodeMongo.find({});
  logger.info2(`Found ${barcodes.length} synced barcodes to migrate`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < barcodes.length; i++) {
    const barcode = barcodes[i];
    const currentIndex = i + 1;
    
    try {
      const tenantId = tenantIdMap.get(barcode.tenant.toString());
      
      if (!tenantId) {
        skippedCount++;
        logger.warn(`Tenant not found for synced barcode ${currentIndex}/${barcodes.length} (MongoDB ID: ${barcode._id}, Barcode: ${barcode.barcode}), skipping...`);
        continue;
      }

      // Check if barcode already exists (unique constraint: barcode + tenant_id)
      const existing = await prisma.$queryRaw`
        SELECT id FROM "products"."synced_barcode" 
        WHERE barcode = ${barcode.barcode} AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (existing && existing.length > 0) {
        skippedCount++;
        logger.info3(`Synced barcode already exists: ${barcode.barcode} for tenant ${tenantId}, skipping...`);
        continue;
      }

      const barcodeId = barcode._id?.toString() || crypto.randomUUID();
      const syncedAt = barcode.syncedAt || new Date();
      
      await prisma.$executeRaw`
        INSERT INTO "products"."synced_barcode" (id, tenant_id, barcode, product_id, variant_id, synced_at)
        VALUES (${barcodeId}, ${tenantId}, ${barcode.barcode}, ${barcode.productId || null}, ${barcode.variantId || null}, ${syncedAt})
      `;

      // Detailed log for each barcode (every 100 barcodes to avoid too much logging)
      if (currentIndex % 100 === 0 || currentIndex === barcodes.length) {
        logger.info3(`Migrating synced barcode ${currentIndex}/${barcodes.length}: Barcode=${barcode.barcode}, ProductId=${barcode.productId || 'N/A'}, VariantId=${barcode.variantId || 'N/A'}`);
      }
      
      // Progress log every 500 barcodes
      if (currentIndex % 500 === 0 || currentIndex === barcodes.length) {
        logger.info2(`Progress: ${currentIndex}/${barcodes.length} synced barcodes migrated`);
      }
      
      successCount++;
    } catch (error) {
      failCount++;
      logger.error(`Error migrating synced barcode ${currentIndex}/${barcodes.length} (MongoDB ID: ${barcode._id}, Barcode: ${barcode.barcode}): ${error.message}`);
      console.error(error);
    }
  }

  const duration = Date.now() - startTime;
  logger.info4(`Synced barcode migration completed in ${duration}ms`);
  logger.info4(`Synced barcode migration: ${successCount}/${barcodes.length} successful, ${failCount} failed, ${skippedCount} skipped`);
}

/**
 * Main migration function
 */
async function migrate() {
  const migrationStartTime = Date.now();
  
  try {
    // Check if migration should run
    if (process.env.RUN_MIGRATION !== 'true') {
      logger.info2('Migration skipped: RUN_MIGRATION is not set to "true"');
      return;
    }

    logger.info2('Starting MongoDB to PostgreSQL migration...');
    logger.info2('Checking PostgreSQL for existing data...');

    // Check if PostgreSQL has existing data
    const hasData = await hasPostgreSQLData();
    if (hasData) {
      logger.warn('Migration skipped: PostgreSQL already contains data. To force migration, clear the database first.');
      return;
    }

    logger.info4('PostgreSQL is empty, proceeding with migration...');

    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
      logger.error('MONGO_URI is not set. Cannot connect to MongoDB.');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    logger.info4('Connected to MongoDB');

    // Create products schema and synced_barcode table first
    await createProductsSchema();
    
    // Migrate in order (due to foreign key dependencies)
    const tenantResult = await migrateTenants();
    const batchIdMap = await migrateSyncBatches();
    await migrateFailedOrders(batchIdMap);
    await migrateSuccessOrders(batchIdMap);
    await migrateSyncedBarcodes();

    const totalDuration = Date.now() - migrationStartTime;
    logger.info4('='.repeat(60));
    logger.info4('Migration completed successfully!');
    logger.info4(`Total migration time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    logger.info4('='.repeat(60));
    
    // Close connections
    await mongoose.disconnect();
    logger.info4('Disconnected from MongoDB');
    await prisma.$disconnect();
    logger.info4('Disconnected from PostgreSQL');
    
    process.exit(0);
  } catch (error) {
    const totalDuration = Date.now() - migrationStartTime;
    logger.error(`Migration failed after ${totalDuration}ms: ${error.message}`);
    console.error(error);
    
    try {
      await mongoose.disconnect();
      await prisma.$disconnect();
    } catch (disconnectError) {
      logger.error(`Error disconnecting: ${disconnectError.message}`);
    }
    
    process.exit(1);
  }
}

// Run migration if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export default migrate;

