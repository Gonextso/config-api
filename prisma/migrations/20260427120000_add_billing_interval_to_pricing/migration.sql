-- CreateEnum
CREATE TYPE "billings"."BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "billings"."pricing" ADD COLUMN "billing_interval" "billings"."BillingInterval" NOT NULL DEFAULT 'MONTHLY';
