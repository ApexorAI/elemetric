-- ─────────────────────────────────────────────────────────────────────────────
-- Elemetric Supabase migrations
-- Run these in the Supabase dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles table additions ──────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'individual';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS compliance_score int;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- ── teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name  text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── team_members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id    uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text DEFAULT 'member',
  joined_at  timestamptz DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- ── team_invites ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id    uuid REFERENCES teams(id) ON DELETE CASCADE,
  email      text NOT NULL,
  status     text DEFAULT 'pending',  -- pending | accepted | declined
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — jobs table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "jobs_select_own"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own jobs
CREATE POLICY "jobs_insert_own"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own jobs
CREATE POLICY "jobs_update_own"
  ON jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own jobs
CREATE POLICY "jobs_delete_own"
  ON jobs FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — profiles table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_upsert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Employer: allow reading team members' profiles via team_members table
CREATE POLICY "profiles_select_team_member"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = profiles.user_id
        AND t.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — teams table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_owner"
  ON teams FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "teams_insert_owner"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "teams_update_owner"
  ON teams FOR UPDATE
  USING (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — team_members table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Owner can read all members of their team
CREATE POLICY "team_members_select_owner"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND t.owner_id = auth.uid()
    )
  );

-- Members can see their own membership
CREATE POLICY "team_members_select_self"
  ON team_members FOR SELECT
  USING (auth.uid() = user_id);

-- Owner can insert members
CREATE POLICY "team_members_insert_owner"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND t.owner_id = auth.uid()
    )
    OR auth.uid() = user_id  -- member adding themselves via invite acceptance
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — team_invites table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Owner can manage invites for their team
CREATE POLICY "team_invites_owner"
  ON team_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_invites.team_id
        AND t.owner_id = auth.uid()
    )
  );

-- Anyone can read pending invites by email (for join-team flow)
-- Note: use service role key or a function for production; this is permissive for MVP
CREATE POLICY "team_invites_read_pending"
  ON team_invites FOR SELECT
  USING (status = 'pending');

-- Invited user can update their own invite (accept/decline)
CREATE POLICY "team_invites_update_by_member"
  ON team_invites FOR UPDATE
  USING (status = 'pending');
