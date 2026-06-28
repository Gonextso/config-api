-- Add proc_input_validation to tenants.nebim
ALTER TABLE "tenants"."nebim"
ADD COLUMN IF NOT EXISTS "proc_input_validation" TEXT NOT NULL DEFAULT 'sp_GO_InputValidator';

-- Create tenants.setup table
CREATE TABLE IF NOT EXISTS "tenants"."setup" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "setup_completed" BOOLEAN NOT NULL DEFAULT false,
    "step_connection" BOOLEAN NOT NULL DEFAULT false,
    "step_validation" BOOLEAN NOT NULL DEFAULT false,
    "step_customer" BOOLEAN NOT NULL DEFAULT false,
    "step_product" BOOLEAN NOT NULL DEFAULT false,
    "step_order" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "setup_tenant_id_key" ON "tenants"."setup"("tenant_id");
CREATE INDEX IF NOT EXISTS "setup_tenant_id_idx" ON "tenants"."setup"("tenant_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'setup_tenant_id_fkey'
    ) THEN
        ALTER TABLE "tenants"."setup"
        ADD CONSTRAINT "setup_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill setup rows from existing tenant config
INSERT INTO "tenants"."setup" (
    "id",
    "tenant_id",
    "step_connection",
    "step_validation",
    "step_customer",
    "step_product",
    "step_order",
    "setup_completed",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    n."tenant_id",
    (n."host" IS NOT NULL AND n."host" <> '' AND n."user" IS NOT NULL AND n."user" <> '' AND n."user_group" IS NOT NULL AND n."user_group" <> ''),
    (
        n."proc_input_validation" IS NOT NULL AND n."proc_input_validation" <> ''
        AND n."proc_product_details" IS NOT NULL AND n."proc_product_details" <> ''
        AND n."proc_product_inventory" IS NOT NULL AND n."proc_product_inventory" <> ''
        AND n."proc_product_price" IS NOT NULL AND n."proc_product_price" <> ''
        AND n."proc_find_store_inventory" IS NOT NULL AND n."proc_find_store_inventory" <> ''
        AND n."proc_get_store_info" IS NOT NULL AND n."proc_get_store_info" <> ''
        AND n."proc_customer_check" IS NOT NULL AND n."proc_customer_check" <> ''
        AND n."proc_order_status" IS NOT NULL AND n."proc_order_status" <> ''
        AND n."proc_defaults_address_codes" IS NOT NULL AND n."proc_defaults_address_codes" <> ''
    ),
    (
        n."customer_phone_type" IS NOT NULL AND n."customer_phone_type" <> ''
        AND n."customer_address_type" IS NOT NULL AND n."customer_address_type" <> ''
    ),
    (n."product_barcode_type_code" IS NOT NULL AND n."product_barcode_type_code" <> ''),
    (
        n."sales_url" IS NOT NULL AND n."sales_url" <> ''
        AND n."order_credit_card_type" IS NOT NULL AND n."order_credit_card_type" <> ''
        AND n."order_warehouse" IS NOT NULL AND n."order_warehouse" <> ''
    ),
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tenants"."nebim" n
WHERE NOT EXISTS (
    SELECT 1 FROM "tenants"."setup" s WHERE s."tenant_id" = n."tenant_id"
);

UPDATE "tenants"."setup" s
SET "setup_completed" = (
    s."step_connection"
    AND s."step_validation"
    AND s."step_customer"
    AND s."step_product"
    AND s."step_order"
),
"updated_at" = CURRENT_TIMESTAMP;
