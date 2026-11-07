-- Expiring offline access tokens (Shopify requires them for public apps from 2027-01-01).
-- access_token_expires_at NULL means the stored api_key_* token is a legacy non-expiring token.
ALTER TABLE "auths"."shopify"
    ADD COLUMN IF NOT EXISTS "access_token_expires_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "refresh_token_encrypted_data" TEXT,
    ADD COLUMN IF NOT EXISTS "refresh_token_iv" TEXT,
    ADD COLUMN IF NOT EXISTS "refresh_token_auth_tag" TEXT,
    ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "token_refreshed_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "reauth_required_at" TIMESTAMP(3);
