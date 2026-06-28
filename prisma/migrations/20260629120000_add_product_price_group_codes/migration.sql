-- Add product price group codes to tenants.nebim
ALTER TABLE "tenants"."nebim"
ADD COLUMN "product_price_sell_code" TEXT,
ADD COLUMN "product_price_compare_code" TEXT;
