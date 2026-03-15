# Elemetric — Pending Supabase Migrations

Run these SQL files in the Supabase dashboard → **SQL Editor**, in the order listed below.

**Project URL:** https://dqgphwaklhckhvqwqqfp.supabase.co

---

## Migration Checklist

Run each file from `supabase/migrations/` in the SQL Editor:

- [ ] `rls_and_schema.sql` — Core schema: profiles additions, teams, team_members, team_invites, jobs RLS policies
- [ ] `notifications.sql` — Notifications table with user_id, title, body, type, read, job_id, created_at
- [ ] `job_assignment.sql` — Jobs table additions: assigned_to, status (unassigned/assigned/in_progress/completed), last_alerted_at
- [ ] `job_notes.sql` — Job notes table for private per-job notes
- [ ] `licence_verification.sql` — profiles additions: licence_verified, licence_verified_at
- [ ] `licence_expiry.sql` — profiles addition: licence_expiry_date
- [ ] `beta_tester.sql` — profiles addition: beta_tester boolean flag
- [ ] `ai_feedback.sql` — AI feedback table for thumbs up/down ratings and text feedback
- [ ] `property_passport.sql` — Property passport / compliance history view
- [ ] `subscription.sql` — Subscription tier tracking
- [ ] `audit_log.sql` — Audit log table for compliance record keeping
- [ ] `indexes.sql` — Performance indexes on jobs, notifications, team_members tables

---

## How to Run

1. Open Supabase Dashboard → SQL Editor
2. Click **New Query**
3. Copy and paste the contents of each `.sql` file above
4. Click **Run**
5. Confirm no errors before proceeding to the next file

---

## Critical Migrations (run before launch)

The following must be run before the app goes live — without them, core features will fail:

1. **`rls_and_schema.sql`** — Required for all auth and job storage
2. **`notifications.sql`** — Required for compliance alerts and job assignment notifications
3. **`job_assignment.sql`** — Required for employer portal and job assignment workflow
4. **`licence_verification.sql`** — Required for VBA licence verification badge
5. **`beta_tester.sql`** — Required for beta tester flag (removes job limits)

---

## Optional Migrations (can run post-launch)

- `property_passport.sql` — Property compliance history feature
- `subscription.sql` — Subscription tier feature (not fully built yet)
- `audit_log.sql` — Detailed audit logging
- `indexes.sql` — Performance optimization (recommended but not critical)
