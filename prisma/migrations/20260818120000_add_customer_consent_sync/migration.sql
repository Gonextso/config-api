CREATE SCHEMA IF NOT EXISTS "audit";

ALTER TABLE "tenants"."nebim"
ADD COLUMN "proc_customer_concents" TEXT NOT NULL DEFAULT 'sp_GO_GetCustomerConcents';

ALTER TABLE "schedules"."tenant"
ADD COLUMN "nebim_customer_concents_interval" TEXT NOT NULL DEFAULT '0 0 * * *',
ADD COLUMN "nebim_customer_concents_start_date" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP - INTERVAL '1 day'),
ADD COLUMN "nebim_customer_concents_is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "audit"."customer_consent_transfer_log" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_name" TEXT,
    "shop_domain" TEXT,
    "source_system" TEXT NOT NULL,
    "target_system" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "channel" TEXT,
    "source_event_id" TEXT,
    "source_customer_ref" TEXT,
    "target_customer_ref" TEXT,
    "consent_state" TEXT,
    "consent_updated_at" TIMESTAMP(3),
    "source_payload_raw" TEXT,
    "target_request_raw" TEXT,
    "target_http_status" INTEGER,
    "target_response_raw" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "error_message" TEXT,
    "trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "customer_consent_transfer_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_consent_transfer_log_source_system_check" CHECK ("source_system" IN ('NEBIM', 'SHOPIFY')),
    CONSTRAINT "customer_consent_transfer_log_target_system_check" CHECK ("target_system" IN ('NEBIM', 'SHOPIFY')),
    CONSTRAINT "customer_consent_transfer_log_direction_check" CHECK ("source_system" <> "target_system"),
    CONSTRAINT "customer_consent_transfer_log_trigger_type_check" CHECK ("trigger_type" IN ('CRON', 'WEBHOOK')),
    CONSTRAINT "customer_consent_transfer_log_status_check" CHECK ("status" IN ('PENDING', 'SUCCESS', 'SKIPPED', 'FAILED')),
    CONSTRAINT "customer_consent_transfer_log_flow_sequence_key" UNIQUE ("flow_id", "sequence_no")
);

CREATE INDEX "customer_consent_transfer_log_tenant_id_created_at_idx"
ON "audit"."customer_consent_transfer_log"("tenant_id", "created_at");
CREATE INDEX "customer_consent_transfer_log_source_event_id_idx"
ON "audit"."customer_consent_transfer_log"("source_event_id");
CREATE INDEX "customer_consent_transfer_log_trace_id_idx"
ON "audit"."customer_consent_transfer_log"("trace_id");
CREATE INDEX "customer_consent_transfer_log_status_idx"
ON "audit"."customer_consent_transfer_log"("status");

CREATE OR REPLACE FUNCTION "audit"."protect_customer_consent_transfer_log"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'customer consent audit records cannot be deleted';
    END IF;

    IF OLD."status" <> 'PENDING' THEN
        RAISE EXCEPTION 'completed customer consent audit records are immutable';
    END IF;

    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."flow_id" IS DISTINCT FROM OLD."flow_id"
       OR NEW."sequence_no" IS DISTINCT FROM OLD."sequence_no"
       OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
       OR NEW."tenant_name" IS DISTINCT FROM OLD."tenant_name"
       OR NEW."shop_domain" IS DISTINCT FROM OLD."shop_domain"
       OR NEW."source_system" IS DISTINCT FROM OLD."source_system"
       OR NEW."target_system" IS DISTINCT FROM OLD."target_system"
       OR NEW."trigger_type" IS DISTINCT FROM OLD."trigger_type"
       OR NEW."operation" IS DISTINCT FROM OLD."operation"
       OR NEW."channel" IS DISTINCT FROM OLD."channel"
       OR NEW."source_event_id" IS DISTINCT FROM OLD."source_event_id"
       OR NEW."source_customer_ref" IS DISTINCT FROM OLD."source_customer_ref"
       OR NEW."consent_state" IS DISTINCT FROM OLD."consent_state"
       OR NEW."consent_updated_at" IS DISTINCT FROM OLD."consent_updated_at"
       OR NEW."source_payload_raw" IS DISTINCT FROM OLD."source_payload_raw"
       OR NEW."target_request_raw" IS DISTINCT FROM OLD."target_request_raw"
       OR NEW."trace_id" IS DISTINCT FROM OLD."trace_id"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
        RAISE EXCEPTION 'customer consent audit identity and payload fields are immutable';
    END IF;

    IF NEW."status" = 'PENDING' OR NEW."completed_at" IS NULL THEN
        RAISE EXCEPTION 'customer consent audit can only transition to a completed state';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "customer_consent_transfer_log_protect_update"
BEFORE UPDATE ON "audit"."customer_consent_transfer_log"
FOR EACH ROW EXECUTE FUNCTION "audit"."protect_customer_consent_transfer_log"();

CREATE TRIGGER "customer_consent_transfer_log_protect_delete"
BEFORE DELETE ON "audit"."customer_consent_transfer_log"
FOR EACH ROW EXECUTE FUNCTION "audit"."protect_customer_consent_transfer_log"();
