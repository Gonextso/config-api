-- Remap deprecated PRO plan to COMMUNITY before removing the enum variant.
UPDATE billings.pricing
SET plan_key = 'COMMUNITY'::tenants."PlanKey"
WHERE plan_key::text = 'PRO';

UPDATE billings.pricing
SET pending_plan_key = 'COMMUNITY'
WHERE pending_plan_key = 'PRO';

ALTER TYPE tenants."PlanKey" RENAME TO "PlanKey_old";

CREATE TYPE tenants."PlanKey" AS ENUM ('BASIC', 'COMMUNITY', 'ENTERPRISE');

ALTER TABLE billings.pricing
  ALTER COLUMN plan_key TYPE tenants."PlanKey"
  USING plan_key::text::tenants."PlanKey";

DROP TYPE tenants."PlanKey_old";
