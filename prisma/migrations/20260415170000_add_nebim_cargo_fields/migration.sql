-- Add cargo settings fields to tenants.nebim
ALTER TABLE "tenants"."nebim"
ADD COLUMN "cargo_item_code" TEXT,
ADD COLUMN "is_cargo_service" BOOLEAN NOT NULL DEFAULT false;
