-- AlterTable
-- Add order_data column to sync.failed_order if it doesn't exist
ALTER TABLE "sync"."failed_order" 
ADD COLUMN IF NOT EXISTS "order_data" JSONB;

