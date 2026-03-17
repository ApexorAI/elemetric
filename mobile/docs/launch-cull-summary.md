# Launch Cull Summary

All 15 tasks completed and pushed to GitHub. Each task was committed individually.

---

## Task 1 — Hide Training Mode
**Status:** Done
**Change:** Removed training mode from the "coming soon" description in `app/(tabs)/tools.tsx`.
**File kept:** `app/training-mode.tsx` (inaccessible from any navigation).
**Re-enable:** Add a card to `tools.tsx` linking to `/training-mode`.

---

## Task 2 — Hide Subcontractor Management
**Status:** Done
**Change:** Removed the Subcontractors action button from `app/employer/dashboard.tsx`.
**File kept:** `app/employer/subcontractors.tsx` (inaccessible from navigation).
**Re-enable:** Uncomment the Subcontractors `<Pressable>` in `dashboard.tsx`.

---

## Task 3 — Simplify Near Miss Reporting
**Status:** Done
**Change:** Rewrote `app/near-miss.tsx` to 3 fields only: **property address**, **what did you find**, **what did you do**. Removed severity selector, trade type chips, contributing factors, persons at risk, corrective actions, follow-up date, and supervisor fields. PDF simplified to match.
**Re-enable:** Restore the removed fields from git history.

---

## Task 4 — Move AI Visualiser to Tools Only
**Status:** Done
**Change:** Added AI Visualiser card to `app/(tabs)/tools.tsx`. Entry point is Tools tab only — the `visualiser` tab remains hidden (`href: null`).
**File kept:** `app/(tabs)/visualiser.tsx`.

---

## Task 5 — Hide Floor Plan Mapping
**Status:** Done
**Change:** Removed floor plan upload UI, state (`floorPlanUri`), handler (`pickFloorPlan`), and `floorPlanUri` from job storage in `app/plumbing/new-job.tsx`.
**File kept:** `app/plumbing/floor-plan-pin.tsx` (inaccessible from navigation).
**Re-enable:** Restore floor plan state + UI from git history.

---

## Task 6 — Hide 360° Wide Shot
**Status:** Done
**Change:** Replaced the Wide Shot — Optional section in `app/plumbing/photos.tsx` with a comment.
**Code kept:** All wide shot logic and styles remain in the file.
**Re-enable:** Uncomment the `wideShotSection` block.

---

## Task 7 — Hide Multi-Day Timeline
**Status:** Done
**Change:** Removed the PROJECT TIMELINE display from `app/plumbing/photos.tsx` and the multi-day timeline card from `app/plumbing/ai-review.tsx`.
**Code kept:** All timeline logic (`jobDays`, `allWorkDays`, styles) retained in both files.
**Re-enable:** Restore both display blocks from git history.

---

## Task 8 — Hide Benchmarking
**Status:** Done
**Change:** Replaced the live percentile/badge benchmarking card in `app/(tabs)/profile.tsx` with a static placeholder: *"Benchmarking unlocks when more plumbers join Elemetric."*
**Code kept:** `percentile`, `benchBadge` state and calculation logic remain.
**Re-enable:** Restore the conditional benchmarking card render.

---

## Task 9 — Hide Referral Leaderboard
**Status:** Done
**Change:** Replaced the leaderboard section in `app/referral.tsx` with a *"Leaderboard coming soon"* placeholder. Referral stats (total referred, pending, earned) remain.
**Code kept:** `leaderboard` state and data fetch remain.
**Re-enable:** Restore the leaderboard render block.

---

## Task 10 — Restrict Calendar to Employer Accounts
**Status:** Done
**Change:** In `app/(tabs)/_layout.tsx`, calendar tab button is conditionally rendered based on `profiles.role === 'employer'` (checked via Supabase on focus).
**Individual plumbers:** Calendar tab is hidden.
**Employers:** Calendar tab is visible.

---

## Task 11 — Invoice Contextual Only
**Status:** Done
**Change:** Added an invoice prompt card below every job card with `confidence > 0` in `app/plumbing/jobs.tsx`. Tapping opens `app/invoice.tsx` pre-filled with `jobName`, `jobAddr`, and `jobRef`. Invoice is not accessible from main nav or tools tab.

---

## Task 12 — Restrict Employer Portal to Employer Accounts
**Status:** Done
**Change:** Added role check at the top of `app/employer/dashboard.tsx`. Non-employer users are immediately redirected to `/home` before any data loads.

---

## Task 13 — Restore All 9 Trades on Trade Selection
**Status:** Done
**Change:** Removed the `jobCount === 0` first-time simplified view from `app/trade.tsx`. All 9 job types are now visible from first open: Hot Water, Gas Rough-In, Drainage, New Installation, Wood Heater, Gas Heater, Electrical, HVAC, Carpentry.

---

## Task 14 — Restore Full Home Screen
**Status:** Done
**Change:** Rewrote `app/home.tsx` to include:
- Compliance score ring (inline SVG, same design as Profile)
- Start a New Job primary CTA
- Quick actions: **Near Miss** and **Referral** only
- Recent jobs list (last 3)

---

## Task 15 — Restore Full Tab Navigation
**Status:** Done
**Change:** Rewrote `app/(tabs)/_layout.tsx`:
- **Individual plumbers:** Home · Jobs · Timeline · Tools · Profile
- **Employers:** + Calendar · Dashboard
- Tools tab always visible (Stage 2 gate removed)
- Timeline tab (`liability-timeline`) now a visible tab
- New `app/(tabs)/dashboard.tsx` redirects to `employer/dashboard`
- Role checked via Supabase on every focus

---

## Files Hidden (Not Deleted)

| File | Re-enable by |
|------|-------------|
| `app/training-mode.tsx` | Add nav link in `tools.tsx` |
| `app/employer/subcontractors.tsx` | Uncomment button in `dashboard.tsx` |
| `app/plumbing/floor-plan-pin.tsx` | Restore floor plan UI in `new-job.tsx` |
| Wide Shot code in `photos.tsx` | Uncomment `wideShotSection` block |
| Multi-day code in `photos.tsx` / `ai-review.tsx` | Restore timeline blocks |
| Benchmarking code in `profile.tsx` | Restore conditional render |
| Leaderboard code in `referral.tsx` | Restore leaderboard render |

---

*Generated 2026-03-17 — Elemetric launch cull complete.*
