# Elemetric — Pre-Submission Checklist

**Generated:** 2026-03-16
**Target version:** 1.1
**Bundle ID:** com.elemetric.mobile

Work through every item below before pressing **Submit for Review** in App Store Connect. Items are grouped by who performs them and when.

---

## 1. Supabase — Run All Migrations

Log in to the Supabase dashboard → SQL Editor and run each file from `supabase/migrations/` in order. Mark each one complete when the query returns no errors.

### Critical (must run before launch — app will break without these)
- [ ] `rls_and_schema.sql` — Core schema: profiles, teams, team_members, team_invites, jobs RLS policies
- [ ] `notifications.sql` — Notifications table (compliance alerts, job assignment)
- [ ] `job_assignment.sql` — Jobs: assigned_to, status, last_alerted_at columns
- [ ] `licence_verification.sql` — profiles: licence_verified, licence_verified_at columns
- [ ] `beta_tester.sql` — profiles: beta_tester flag (removes job limit for testers)
- [ ] `job_notes.sql` — Job notes table for per-job private notes
- [ ] `licence_expiry.sql` — profiles: licence_expiry_date column
- [ ] `ai_feedback.sql` — AI feedback table (thumbs up/down, text feedback)

### Recommended (app degrades gracefully without these but they should be run)
- [ ] `property_passport.sql` — Property compliance history view
- [ ] `audit_log.sql` — Audit log table for compliance record keeping
- [ ] `indexes.sql` — Performance indexes on jobs, notifications, team_members

### Optional post-launch
- [ ] `subscription.sql` — Subscription tier tracking (feature not fully built yet)

### Additional tables needed for new features (create in SQL Editor if not already present)
- [ ] `crash_logs` table — columns: `id uuid`, `user_id uuid`, `error_message text`, `error_name text`, `component_stack text`, `stack text`, `occurred_at timestamptz`
- [ ] `near_misses` table — columns: `id uuid`, `user_id uuid`, `severity text`, `description text`, `persons_at_risk text`, `contributing_factors text`, `immediate_action text`, `corrective_actions text`, `follow_up_date text`, `supervisor_name text`, `supervisor_contact text`, `created_at timestamptz`

---

## 2. Backend (Railway) — Verify Endpoints

The AI backend is hosted at `https://elemetric-ai-production.up.railway.app`.

- [ ] `POST /review` responds correctly — send a test image and confirm JSON response with `confidence`, `detected`, `missing`, `unclear`, `actions`
- [ ] `POST /process-360` responds correctly — send a test image and confirm JSON response with `coverageScore`, `detected`, `missingFromView`, `recommendedPhotos`
- [ ] Railway service is not sleeping — check the Railway dashboard, ensure the service is awake and not on a free-tier sleep schedule
- [ ] API key (`EXPO_PUBLIC_ELEMETRIC_API_KEY`) is correctly set in the Railway environment variables

---

## 3. App Configuration (app.json / eas.json)

- [ ] `version` in `app.json` is set to `1.1.0`
- [ ] `buildNumber` (iOS) is incremented from the previous TestFlight build
- [ ] `bundleIdentifier` is `com.elemetric.mobile`
- [ ] `orientation` is `"portrait"`
- [ ] `icon` and `splash` assets are present and correct dimensions
- [ ] `scheme` is set (for deep linking)
- [ ] `eas.json` production profile is configured and the distribution certificate is valid
- [ ] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in EAS Secrets (not in source code)
- [ ] `EXPO_PUBLIC_ELEMETRIC_API_KEY` is set in EAS Secrets

---

## 4. Build & Compilation

- [x] `npx expo export --platform ios` completes with **zero errors, zero warnings** ✅ (verified 2026-03-16)
- [ ] `eas build --platform ios --profile production` completes without errors
- [ ] Build is uploaded to App Store Connect and processed (status: "Ready to Submit")
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)

---

## 5. App Store Connect — Metadata

Log in to App Store Connect → your app → Version Information.

- [ ] App name: `Elemetric` (9 chars — within 30 char limit ✅)
- [ ] Subtitle: `Trade Compliance & AI Reports` (29 chars — within 30 char limit ✅)
- [ ] Description: copied from `docs/app-store-listing.md` (includes 360°, floor plan, multi-day timeline, invoice, calendar)
- [ ] Keywords: `plumbing,compliance,gas,checklist,PDF,tradesperson,AS/NZS,certificate,inspection,electrician` (91 chars — within 100 char limit ✅)
- [ ] What's New: copied from `docs/app-store-listing.md` — Version 1.1 section
- [ ] Support URL: `https://elemetric.com.au/support`
- [ ] Marketing URL: `https://elemetric.com.au`
- [ ] Privacy Policy URL: `https://elemetric.com.au/privacy`
- [ ] Primary category: **Business**
- [ ] Secondary category: **Utilities**
- [ ] Age rating: **4+**
- [ ] Pricing: **Free**
- [ ] In-App Purchases: **None**
- [ ] Content Rights: confirmed (standards are public, no copyrighted content reproduced)

---

## 6. App Store Connect — Review Information

- [ ] Sign-in required: **Yes**
- [ ] Demo account email: `reviewer@elemetric.com.au`
- [ ] Demo account password: set in App Store Connect (not in source code) — use a strong, unique password
- [ ] Demo account has at least 3 completed jobs, employer team with 2 members, 1 near miss report saved
- [ ] Notes for reviewer: copied from `docs/app-store-listing.md` — App Store Review Information section
- [ ] No special entitlements or unusual permissions beyond camera, photo library, push notifications, and network access

---

## 7. Screenshots

Follow `docs/app-store-screenshots.md` for capture instructions.

- [ ] Screenshot 1 — Trade & Job Type Selection (`app/trade.tsx`)
- [ ] Screenshot 2 — AI Confidence Gauge (`app/plumbing/ai-review.tsx` — 80%+ score, green gauge)
- [ ] Screenshot 3 — Detailed Breakdown with Retake (`app/plumbing/ai-review.tsx` — mixed result)
- [ ] Screenshot 4 — PDF Compliance Report (first page rendered from Files/Preview)
- [ ] Screenshot 5 — Liability Timeline (`app/(tabs)/liability-timeline.tsx`)
- [ ] Screenshot 6 — Employer Dashboard (`app/employer/dashboard.tsx`)
- [ ] (Optional) Screenshot 7 — Near Miss Reporting
- [ ] (Optional) Screenshot 8 — Job Summary (PASS/FAIL badges)
- [ ] (Optional) Screenshot 9 — Visualiser
- [ ] (Optional) Screenshot 10 — Profile & Compliance Score
- [ ] (Optional) Screenshot 11 — 360° Room Analysis
- [ ] (Optional) Screenshot 12 — Floor Plan with Pins

### Screenshot quality checks
- [ ] All captured on iPhone 15 Pro Max or 16 Pro Max (1320 × 2868 px)
- [ ] Dynamic Island visible, status bar shows full signal / Wi-Fi / 100% battery (use iOS Demo Mode)
- [ ] No real personal data, real addresses, or real licence numbers visible
- [ ] Caption overlay applied consistently (navy bar, SF Pro Bold, orange accent `#f97316`)
- [ ] Exported as PNG, no alpha channel
- [ ] Previewed in App Store Connect before submission
- [ ] 6.5" versions (1242 × 2688 px) generated for older devices

---

## 8. Privacy & Permissions

- [ ] Camera permission string is human-readable: e.g. "Used to photograph your completed work for compliance reports"
- [ ] Photo library permission string is human-readable: e.g. "Used to attach photos to job reports"
- [ ] Push notification permission: confirmed requested at first run
- [ ] No analytics SDKs (Firebase, Mixpanel, etc.) installed — confirm in package.json
- [ ] Privacy policy at `https://elemetric.com.au/privacy` is live, accessible, and covers: data collected, how it's used, third-party sharing (Supabase, Railway AI), Australian Privacy Act compliance, GDPR right to erasure
- [ ] App Store Connect Privacy nutrition label filled in accurately:
  - Data linked to user: Email address, Name, Identifiers (user ID)
  - Data not linked to user: Crash logs (anonymous), Usage data
  - No data sold to third parties

---

## 9. TestFlight Pre-Submission Testing

- [ ] TestFlight build distributed to at least 2 external testers
- [ ] Full job flow tested end-to-end: New Job → Trade → Checklist → Photos → AI Review → Declaration → Signature → PDF generated
- [ ] 360° photo flow: tap 360° button → tooltip shown on first use → photo picked → AI analysis runs → Room Analysis card displays → PDF contains 360° section
- [ ] Floor plan flow: upload floor plan in new job → mark pins per checklist item → floor plan with pins renders in PDF
- [ ] Multi-day flow: add photos on day 1, close app, re-open job next day, add more photos → Day 1 / Day 2 timeline visible → PDF groups by day
- [ ] Invoice generator: fills from profile, adds line items, GST toggle, PDF generates correctly
- [ ] Calendar tab: month grid loads, dots appear on days with jobs, day selection panel shows correct jobs
- [ ] Data export: JSON export works, CSV export works, Clear Local Cache shows confirmation
- [ ] Employer portal: create team, invite member (email sent via Resend), assign job, dashboard shows compliance
- [ ] Near miss report: severity chips, signature, PDF exports with coloured severity banner
- [ ] Notifications: compliance alerts fire, category filter chips work, sound preference persists
- [ ] Offline mode: disable Wi-Fi, verify offline banner appears, job saves locally, re-enable Wi-Fi, verify sync
- [ ] Signature: typed name required, undo works, minimum size validation rejects too-small signatures, save-as-default persists name
- [ ] Error boundary: app does not crash on any test screen
- [ ] No crash reports in Supabase `crash_logs` during testing session

---

## 10. Legal & Compliance

- [ ] App does not reproduce any copyrighted AS/NZS standards text verbatim — only references (e.g. "AS/NZS 3500.2") and threshold values from publicly available sources
- [ ] AI analysis disclaimer is visible in `ai-review.tsx`: "AI scores are informational only — not a substitute for a licensed inspection"
- [ ] Client portal disclaimer is visible: "Scores are informational. This is not an official compliance certificate."
- [ ] No unlicensed fonts or images embedded in the app or PDFs
- [ ] All third-party libraries in `package.json` are MIT, BSD, or Apache-2.0 licensed — no GPL-incompatible licenses
- [ ] Supabase data is stored in an Australian or geographically appropriate region (check Supabase dashboard → Project Settings → Region)

---

## 11. Pre-Submit Final Checks in App Store Connect

- [ ] Build is selected under "Build" in the version submission page
- [ ] All required metadata fields show green ticks (no yellow warnings)
- [ ] Export compliance questionnaire completed (encryption — answer No, no proprietary encryption used; using standard HTTPS)
- [ ] Review screenshots one final time in the App Store Connect preview tool
- [ ] Version status shows "Ready to Submit"
- [ ] Press **Submit for Review**

---

## 12. Post-Submit

- [ ] Monitor App Store Connect for reviewer questions (typically 1–3 business days)
- [ ] If rejected: read the rejection reason carefully, fix the specific issue, re-submit — do not appeal unless the rejection is factually wrong
- [ ] Once approved: set release to **Manual Release** so you can coordinate the launch announcement before the app goes public
- [ ] Announce on LinkedIn / social: "Elemetric is live on the App Store"
- [ ] Monitor Supabase `crash_logs` in the 48 hours after launch for any production crashes
- [ ] Monitor Railway logs for any `/review` or `/process-360` errors after launch traffic begins

---

*Generated automatically — last updated 2026-03-16.*
