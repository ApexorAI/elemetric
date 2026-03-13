-- Job notes / communication thread
CREATE TABLE IF NOT EXISTS job_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_notes_job_id_idx ON job_notes(job_id);
CREATE INDEX IF NOT EXISTS job_notes_created_at_idx ON job_notes(created_at);

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

-- Helper: can this user access a given job?
-- (owns it, is assigned to it, or is the team owner)

-- SELECT: job owner, assignee, or employer team owner can read notes
CREATE POLICY "job_notes_select"
  ON job_notes FOR SELECT
  USING (
    -- directly involved (owner or assignee)
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_notes.job_id
        AND (jobs.user_id = auth.uid() OR jobs.assigned_to = auth.uid())
    )
    OR
    -- employer who owns the team the job belongs to
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN team_members tm ON (tm.user_id = j.user_id OR tm.user_id = j.assigned_to)
      JOIN teams t ON t.id = tm.team_id
      WHERE j.id = job_notes.job_id
        AND t.owner_id = auth.uid()
    )
  );

-- INSERT: only the authenticated user can author their own notes,
-- and only on jobs they are directly involved in or manage
CREATE POLICY "job_notes_insert"
  ON job_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = job_notes.job_id
          AND (jobs.user_id = auth.uid() OR jobs.assigned_to = auth.uid())
      )
      OR
      EXISTS (
        SELECT 1 FROM jobs j
        JOIN team_members tm ON (tm.user_id = j.user_id OR tm.user_id = j.assigned_to)
        JOIN teams t ON t.id = tm.team_id
        WHERE j.id = job_notes.job_id
          AND t.owner_id = auth.uid()
      )
    )
  );
