-- ─────────────────────────────────────────────────────────────────────────────
-- ai_feedback table
-- Stores plumber ratings and comments on AI analysis results.
-- Run in Supabase dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_feedback (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id           text,                                          -- local job id (timestamp string)
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating           text NOT NULL CHECK (rating IN ('up', 'down')),
  comment          text,                                          -- only present for 'down' ratings
  job_type         text,
  confidence_score integer,
  created_at       timestamptz DEFAULT now() NOT NULL
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ai_feedback_user_id_idx  ON ai_feedback (user_id);
CREATE INDEX IF NOT EXISTS ai_feedback_rating_idx   ON ai_feedback (rating);
CREATE INDEX IF NOT EXISTS ai_feedback_created_idx  ON ai_feedback (created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON ai_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read only their own feedback
CREATE POLICY "Users can read own feedback"
  ON ai_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update only their own feedback (e.g. change rating before leaving the screen)
CREATE POLICY "Users can update own feedback"
  ON ai_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins/service role can read all feedback for analytics
-- (service_role bypasses RLS by default — no extra policy needed)
