-- AlterTable: tenants.nebim proc
ALTER TABLE "tenants"."nebim" ADD COLUMN "proc_find_store_inventory" TEXT NOT NULL DEFAULT 'sp_GO_FindInStore';

-- AlterTable: schedules.tenant find_in_store schedule
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_find_in_store_interval" TEXT NOT NULL DEFAULT '*/30 * * * *';
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_find_in_store_start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "schedules"."tenant" ADD COLUMN "nebim_product_find_in_store_is_active" BOOLEAN NOT NULL DEFAULT false;
