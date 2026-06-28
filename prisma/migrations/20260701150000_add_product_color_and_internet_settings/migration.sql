ALTER TABLE "tenants"."nebim"
ADD COLUMN IF NOT EXISTS "product_is_color_based" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "product_use_internet_on_variant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "product_used_separator_on_color_and_item" TEXT,
ADD COLUMN IF NOT EXISTS "product_used_separator_on_color_and_item_descriptions" TEXT;
