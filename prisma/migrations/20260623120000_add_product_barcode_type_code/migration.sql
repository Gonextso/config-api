-- Add product barcode type code to tenants.nebim
ALTER TABLE "tenants"."nebim"
ADD COLUMN "product_barcode_type_code" TEXT NOT NULL DEFAULT 'EAN13';
