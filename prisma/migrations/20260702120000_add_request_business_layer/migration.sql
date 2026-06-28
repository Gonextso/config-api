-- Add business_layer to logs.request (WebRequestHelper caller classification)
ALTER TABLE "logs"."request"
ADD COLUMN IF NOT EXISTS "business_layer" TEXT;

CREATE INDEX IF NOT EXISTS "request_business_layer_idx" ON "logs"."request"("business_layer");
