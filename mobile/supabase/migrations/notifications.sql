-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text,
  type        text        NOT NULL DEFAULT 'general',
  read        boolean     NOT NULL DEFAULT false,
  job_id      uuid        REFERENCES jobs(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- type values: 'job_assigned' | 'job_completed' | 'compliance_alert' | 'near_miss' | 'general'

CREATE INDEX IF NOT EXISTS notifications_user_id_idx  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_idx      ON notifications(user_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications are inserted server-side or by authorised callers;
-- the inserting user_id must match the authenticated session OR be an employer
-- inserting for a team member (team owner can create notifications for their members)
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    -- Employer can create notifications for their team members
    EXISTS (
      SELECT 1
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.owner_id = auth.uid()
        AND tm.user_id = notifications.user_id
    )
  );

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);
