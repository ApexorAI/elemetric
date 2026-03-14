-- Audit log: records key user actions for liability and traceability
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action        text NOT NULL,
  job_id        text,
  timestamp     timestamptz NOT NULL DEFAULT now(),
  ip_address    text,
  metadata      jsonb
);

-- Index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS audit_log_user_timestamp
  ON audit_log (user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit records
CREATE POLICY "Users can view own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role can insert (server-side inserts only)
-- App clients cannot insert directly — audit records are trusted only if written server-side
-- For now, allow authenticated inserts so the mobile app can log client-side events
CREATE POLICY "Authenticated users can insert audit records"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
