-- AlterTable: tenants.nebim store info proc for find in store
ALTER TABLE "tenants"."nebim" ADD COLUMN "proc_get_store_info" TEXT NOT NULL DEFAULT 'sp_GO_GetStoreInfo';
