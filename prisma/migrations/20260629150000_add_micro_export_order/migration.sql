-- AlterTable: tenants.shopify home shop currency/country defaults
ALTER TABLE "tenants"."shopify" ADD COLUMN "currency_code" TEXT;
ALTER TABLE "tenants"."shopify" ADD COLUMN "country_code" TEXT;

-- AlterTable: tenants.nebim micro export order settings
ALTER TABLE "tenants"."nebim" ADD COLUMN "order_is_micro_export" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants"."nebim" ADD COLUMN "order_incoterm_code1" TEXT;
ALTER TABLE "tenants"."nebim" ADD COLUMN "order_incoterm_code2" TEXT;
