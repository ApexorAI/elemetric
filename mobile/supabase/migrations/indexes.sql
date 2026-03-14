-- Performance indexes for Elemetric core tables

-- jobs
CREATE INDEX IF NOT EXISTS jobs_user_id_idx        ON jobs (user_id);
CREATE INDEX IF NOT EXISTS jobs_assigned_to_idx    ON jobs (assigned_to);
CREATE INDEX IF NOT EXISTS jobs_status_idx         ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx     ON jobs (created_at DESC);

-- team_members
CREATE INDEX IF NOT EXISTS team_members_team_id_idx   ON team_members (team_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx   ON team_members (user_id);

-- notifications
CREATE INDEX IF NOT EXISTS notifications_user_id_idx  ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx     ON notifications (user_id, read);
