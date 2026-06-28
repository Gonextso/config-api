-- Add SETUP_TEST_ORDER to tenants.ProcessType (used by the order setup-wizard test push)
ALTER TYPE "tenants"."ProcessType" ADD VALUE IF NOT EXISTS 'SETUP_TEST_ORDER';
