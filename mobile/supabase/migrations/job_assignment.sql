-- Job assignment: assigned_to, status, scheduled_date columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unassigned';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_date text;

-- Index for fast assigned-jobs lookup
CREATE INDEX IF NOT EXISTS jobs_assigned_to_idx ON jobs(assigned_to);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);

-- ─── RLS policies ──────────────────────────────────────────────────────────────

-- Drop any pre-existing policies on jobs so we can recreate cleanly
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Assigned users can view their assigned jobs" ON jobs;
DROP POLICY IF EXISTS "Employers can view team member jobs" ON jobs;
DROP POLICY IF EXISTS "Employers can insert jobs for team members" ON jobs;

-- Enable RLS (idempotent)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 1. Users can CRUD their own jobs (jobs they created)
CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Plumbers can view jobs assigned to them
CREATE POLICY "Assigned users can view their assigned jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = assigned_to);

-- 3. Plumbers can update the status of jobs assigned to them (accept / complete)
CREATE POLICY "Assigned users can update their assigned jobs"
  ON jobs FOR UPDATE
  USING (auth.uid() = assigned_to);

-- 4. Employers can view jobs belonging to their team members
--    (employer owns a team → team has members → those members have jobs)
CREATE POLICY "Employers can view team member jobs"
  ON jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.owner_id = auth.uid()
        AND tm.user_id = jobs.user_id
    )
    OR
    EXISTS (
      SELECT 1
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.owner_id = auth.uid()
        AND tm.user_id = jobs.assigned_to
    )
  );

-- 5. Employers can INSERT jobs and assign them to team members
CREATE POLICY "Employers can insert jobs for team members"
  ON jobs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.owner_id = auth.uid()
        AND tm.user_id = jobs.assigned_to
    )
  );

-- 6. Employers can update jobs belonging to their team members
CREATE POLICY "Employers can update team member jobs"
  ON jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.owner_id = auth.uid()
        AND (tm.user_id = jobs.user_id OR tm.user_id = jobs.assigned_to)
    )
  );
