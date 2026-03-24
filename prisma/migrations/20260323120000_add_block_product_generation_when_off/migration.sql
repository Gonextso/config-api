-- Add blockProductGenerationWhenOff to tenants.nebim
ALTER TABLE "tenants"."nebim"
ADD COLUMN "block_product_generation_when_off" BOOLEAN NOT NULL DEFAULT false;
