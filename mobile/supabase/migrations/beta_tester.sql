-- ─────────────────────────────────────────────────────────────────────────────
-- beta_tester column on profiles
-- Grants beta testers unlimited jobs, bypassing the free tier paywall.
-- Run in Supabase dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beta_tester boolean DEFAULT false;

-- To manually grant beta access to a specific user (run as service role):
-- UPDATE profiles SET beta_tester = true WHERE user_id = '<user-uuid>';

-- To revoke beta access:
-- UPDATE profiles SET beta_tester = false WHERE user_id = '<user-uuid>';

-- Index for fast lookups during the paywall check
CREATE INDEX IF NOT EXISTS profiles_beta_tester_idx ON profiles (beta_tester) WHERE beta_tester = true;
