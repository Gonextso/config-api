-- Create system schema for cross-tenant platform data
CREATE SCHEMA IF NOT EXISTS "system";

-- Tone enum (lowercase on purpose: values map 1:1 to Polaris Banner `tone`)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'NotificationTone' AND n.nspname = 'system'
    ) THEN
        CREATE TYPE "system"."NotificationTone" AS ENUM ('info', 'warning', 'critical', 'success');
    END IF;
END $$;

-- Create system.notifications table
CREATE TABLE IF NOT EXISTS "system"."notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "tone" "system"."NotificationTone" NOT NULL DEFAULT 'info',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "show_to_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_is_active_idx" ON "system"."notifications"("is_active");

-- At most one active notification globally; on a race the losing writer gets a
-- unique violation instead of a second active banner
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_single_active_idx"
    ON "system"."notifications"((true)) WHERE "is_active";

-- Create system.notification_tenants table
CREATE TABLE IF NOT EXISTS "system"."notification_tenants" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_tenants_notification_id_tenant_id_key"
    ON "system"."notification_tenants"("notification_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "notification_tenants_tenant_id_idx" ON "system"."notification_tenants"("tenant_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notification_tenants_notification_id_fkey'
    ) THEN
        ALTER TABLE "system"."notification_tenants"
        ADD CONSTRAINT "notification_tenants_notification_id_fkey"
        FOREIGN KEY ("notification_id") REFERENCES "system"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notification_tenants_tenant_id_fkey'
    ) THEN
        ALTER TABLE "system"."notification_tenants"
        ADD CONSTRAINT "notification_tenants_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"."info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
