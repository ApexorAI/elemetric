-- Subscription and free tier support

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_jobs_used integer DEFAULT 0;

-- Index for quick role lookups
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx ON profiles (stripe_customer_id);
