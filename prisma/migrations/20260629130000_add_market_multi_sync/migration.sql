-- AlterTable: tenants.shopify Shopify Plus flag
ALTER TABLE "tenants"."shopify" ADD COLUMN "is_shopify_plus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: schedules.tenant multi-market sync schedule (single toggle, two start dates)
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_market_sync_interval" TEXT NOT NULL DEFAULT '0 0 * * *';
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_market_sync_is_active" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_market_price_start_date" TIMESTAMP(3);
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_market_content_start_date" TIMESTAMP(3);
