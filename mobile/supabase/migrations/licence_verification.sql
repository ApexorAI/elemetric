-- VBA licence verification fields on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS licence_verified     boolean     DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS licence_verified_at  timestamptz;

-- Compliance alert tracking on jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_alerted_at timestamptz;

CREATE INDEX IF NOT EXISTS jobs_last_alerted_idx ON jobs(user_id, last_alerted_at);
