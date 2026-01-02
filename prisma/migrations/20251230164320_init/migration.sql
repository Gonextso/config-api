-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auths";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "billings";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "logs";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "schedules";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sync";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenants";

-- CreateEnum
CREATE TYPE "tenants"."ProcessType" AS ENUM ('SYNC_CUSTOMER', 'SYNC_ORDERS', 'SYNC_CANCEL_ORDERS', 'SYNC_FAILED_ORDERS', 'TOKEN_CHECK');

-- CreateEnum
CREATE TYPE "tenants"."PlanKey" AS ENUM ('BASIC', 'COMMUNITY', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "tenants"."info" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_test_store" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants"."shopify" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT,
    "domain" TEXT,
    "shop_id" TEXT,
    "customer_email" TEXT,
    "is_inventory_tracking" BOOLEAN NOT NULL DEFAULT true,
    "is_color_option_first" BOOLEAN NOT NULL DEFAULT true,
    "is_enterprise" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sku_fields_nebim" TEXT[],
    "sku_fields_separator" TEXT NOT NULL DEFAULT '-',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants"."nebim" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "host" TEXT,
    "user" TEXT,
    "user_group" TEXT,
    "sales_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "product_category_keys_from" TEXT[],
    "customer_phone_type" TEXT NOT NULL DEFAULT '7',
    "customer_address_type" TEXT NOT NULL DEFAULT '1',
    "customer_confirmation_form_type_code" TEXT,
    "customer_confirmation_form_status_code" TEXT,
    "customer_consent_source" TEXT NOT NULL DEFAULT 'HS_WEB',
    "customer_inactivation_reason_code" TEXT,
    "order_delivery_company" TEXT,
    "order_pos_terminal_id" INTEGER NOT NULL DEFAULT 1,
    "order_credit_card_type" TEXT,
    "order_office" TEXT,
    "order_store" TEXT,
    "order_company" TEXT,
    "order_warehouse" TEXT,
    "order_cancel_reason" TEXT,
    "proc_product_details" TEXT NOT NULL DEFAULT 'sp_INV_GetProductDetails',
    "proc_product_inventory" TEXT NOT NULL DEFAULT 'sp_INV_GetProductInventory',
    "proc_product_price" TEXT NOT NULL DEFAULT 'sp_INV_GetProductPrice',
    "proc_customer_check" TEXT NOT NULL DEFAULT 'qry_B2C_GetCustomer',
    "proc_order_status" TEXT NOT NULL DEFAULT 'sp_INV_OrderStatus',
    "proc_defaults_address_codes" TEXT NOT NULL DEFAULT 'sp_INV_GetAddressList',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nebim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auths"."shopify" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "api_key_hash" TEXT,
    "api_key_encrypted_data" TEXT,
    "api_key_iv" TEXT,
    "api_key_auth_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auths"."nebim" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "password_hash" TEXT,
    "password_encrypted_data" TEXT,
    "password_iv" TEXT,
    "password_auth_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nebim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billings"."pricing" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_key" "tenants"."PlanKey" NOT NULL,
    "subscription_id" TEXT,
    "subscription_line_id" TEXT,
    "order_limit" INTEGER NOT NULL DEFAULT 10,
    "order_used" INTEGER NOT NULL DEFAULT 0,
    "product_details_limit" INTEGER NOT NULL DEFAULT 1000,
    "product_details_used" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "pending_nonce" TEXT,
    "pending_plan_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules"."tenant" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nebim_product_inventory_interval" TEXT NOT NULL DEFAULT '0 * * * *',
    "nebim_product_inventory_start_date" TIMESTAMP(3) NOT NULL,
    "nebim_product_inventory_is_active" BOOLEAN NOT NULL DEFAULT false,
    "nebim_product_details_interval" TEXT NOT NULL DEFAULT '0 0 * * *',
    "nebim_product_details_start_date" TIMESTAMP(3) NOT NULL,
    "nebim_product_details_is_active" BOOLEAN NOT NULL DEFAULT false,
    "nebim_order_create_cancel_interval" TEXT NOT NULL DEFAULT '*/30 * * * *',
    "nebim_order_create_cancel_start_date" TIMESTAMP(3) NOT NULL,
    "nebim_order_create_cancel_is_active" BOOLEAN NOT NULL DEFAULT false,
    "nebim_order_status_interval" TEXT NOT NULL DEFAULT '0 0 * * *',
    "nebim_order_status_start_date" TIMESTAMP(3) NOT NULL,
    "nebim_order_status_is_active" BOOLEAN NOT NULL DEFAULT false,
    "redention_logs_interval" TEXT NOT NULL DEFAULT '0 0 * * *',
    "redention_logs_start_date" TIMESTAMP(3) NOT NULL,
    "redention_logs_is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync"."batch" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "process" "tenants"."ProcessType" NOT NULL,
    "request_start_date" TEXT,
    "request_end_date" TEXT,
    "request_order_number_list" TEXT[],
    "total" INTEGER,
    "create_order_total" INTEGER,
    "create_order_success" INTEGER,
    "create_order_error" INTEGER,
    "create_order_skipped_total" INTEGER,
    "create_order_skipped_already_synced" INTEGER,
    "create_order_skipped_failed" INTEGER,
    "cancel_order_total" INTEGER,
    "cancel_order_success" INTEGER,
    "cancel_order_error" INTEGER,
    "cancel_order_skipped_total" INTEGER,
    "cancel_order_skipped_already_synced" INTEGER,
    "cancel_order_skipped_failed" INTEGER,
    "cancel_order_skipped_not_found" INTEGER,
    "is_error_log_exists_for_batch" BOOLEAN,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync"."failed_order" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sync_batch_id" TEXT NOT NULL,
    "shopify_order_id" TEXT NOT NULL,
    "order_data" JSONB,
    "reason" TEXT,
    "process" "tenants"."ProcessType" NOT NULL,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failed_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync"."success_order" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sync_batch_id" TEXT NOT NULL,
    "nebim_order_id" TEXT,
    "shopify_order_id" TEXT,
    "lines" JSONB,
    "partially_cancelled_lines" JSONB,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "is_shipped" BOOLEAN NOT NULL DEFAULT false,
    "is_partially_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "trace_id" TEXT NOT NULL,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "success_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs"."request" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "request_id" TEXT,
    "method" TEXT,
    "url" TEXT,
    "body" TEXT,
    "headers" TEXT,
    "status" INTEGER,
    "response_time" TEXT,
    "response" TEXT,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_tenant_id_key" ON "tenants"."shopify"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_domain_key" ON "tenants"."shopify"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_shop_id_key" ON "tenants"."shopify"("shop_id");

-- CreateIndex
CREATE INDEX "shopify_tenant_id_idx" ON "tenants"."shopify"("tenant_id");

-- CreateIndex
CREATE INDEX "shopify_domain_idx" ON "tenants"."shopify"("domain");

-- CreateIndex
CREATE INDEX "shopify_shop_id_idx" ON "tenants"."shopify"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "nebim_tenant_id_key" ON "tenants"."nebim"("tenant_id");

-- CreateIndex
CREATE INDEX "nebim_tenant_id_idx" ON "tenants"."nebim"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_tenant_id_key" ON "auths"."shopify"("tenant_id");

-- CreateIndex
CREATE INDEX "shopify_tenant_id_idx" ON "auths"."shopify"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "nebim_tenant_id_key" ON "auths"."nebim"("tenant_id");

-- CreateIndex
CREATE INDEX "nebim_tenant_id_idx" ON "auths"."nebim"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tenant_id_key" ON "billings"."pricing"("tenant_id");

-- CreateIndex
CREATE INDEX "pricing_tenant_id_idx" ON "billings"."pricing"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_tenant_id_key" ON "schedules"."tenant"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_tenant_id_idx" ON "schedules"."tenant"("tenant_id");

-- CreateIndex
CREATE INDEX "batch_tenant_id_idx" ON "sync"."batch"("tenant_id");

-- CreateIndex
CREATE INDEX "batch_trace_id_idx" ON "sync"."batch"("trace_id");

-- CreateIndex
CREATE INDEX "batch_process_idx" ON "sync"."batch"("process");

-- CreateIndex
CREATE INDEX "failed_order_tenant_id_idx" ON "sync"."failed_order"("tenant_id");

-- CreateIndex
CREATE INDEX "failed_order_sync_batch_id_idx" ON "sync"."failed_order"("sync_batch_id");

-- CreateIndex
CREATE INDEX "failed_order_trace_id_idx" ON "sync"."failed_order"("trace_id");

-- CreateIndex
CREATE INDEX "failed_order_shopify_order_id_idx" ON "sync"."failed_order"("shopify_order_id");

-- CreateIndex
CREATE INDEX "success_order_tenant_id_idx" ON "sync"."success_order"("tenant_id");

-- CreateIndex
CREATE INDEX "success_order_sync_batch_id_idx" ON "sync"."success_order"("sync_batch_id");

-- CreateIndex
CREATE INDEX "success_order_trace_id_idx" ON "sync"."success_order"("trace_id");

-- CreateIndex
CREATE INDEX "success_order_nebim_order_id_idx" ON "sync"."success_order"("nebim_order_id");

-- CreateIndex
CREATE INDEX "success_order_shopify_order_id_idx" ON "sync"."success_order"("shopify_order_id");

-- CreateIndex
CREATE INDEX "request_tenant_id_idx" ON "logs"."request"("tenant_id");

-- CreateIndex
CREATE INDEX "request_trace_id_idx" ON "logs"."request"("trace_id");

-- AddForeignKey
ALTER TABLE "tenants"."shopify" ADD CONSTRAINT "shopify_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants"."nebim" ADD CONSTRAINT "nebim_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auths"."shopify" ADD CONSTRAINT "shopify_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auths"."nebim" ADD CONSTRAINT "nebim_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings"."pricing" ADD CONSTRAINT "pricing_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules"."tenant" ADD CONSTRAINT "tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync"."batch" ADD CONSTRAINT "batch_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync"."failed_order" ADD CONSTRAINT "failed_order_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync"."failed_order" ADD CONSTRAINT "failed_order_sync_batch_id_fkey" FOREIGN KEY ("sync_batch_id") REFERENCES "sync"."batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync"."success_order" ADD CONSTRAINT "success_order_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync"."success_order" ADD CONSTRAINT "success_order_sync_batch_id_fkey" FOREIGN KEY ("sync_batch_id") REFERENCES "sync"."batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs"."request" ADD CONSTRAINT "request_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
