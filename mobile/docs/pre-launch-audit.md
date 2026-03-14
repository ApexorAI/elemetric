# Pre-Launch Audit — Elemetric

Audit of all screen files for hardcoded test data, placeholder text, TODO comments, and critical bugs before App Store submission.

Audit date: 2026-03-14

---

## Critical Issues (Must Fix Before Launch)

### ✅ FIXED — Syntax error in `photos.tsx`
- **File:** `app/plumbing/photos.tsx` line 313
- **Issue:** Double comma `,,` in fetch headers object caused a JavaScript syntax error that would prevent the file from compiling.
- **Fix:** Removed duplicate comma. Fixed in commit `191ffb2+`.

### ✅ FIXED — Hardcoded PDF report title in `ai-review.tsx`
- **File:** `app/plumbing/ai-review.tsx` line 383
- **Issue:** PDF always printed "Hot Water System Compliance Report · AS/NZS 3500" regardless of actual job type (gas, electrical, HVAC, etc.).
- **Fix:** Added `JOB_TYPE_META` map and replaced hardcoded string with dynamic lookup based on `currentJob.type`.

### ✅ FIXED — Empty orphaned file `select-job.tsx`
- **File:** `app/plumbing/select-job.tsx`
- **Issue:** File existed with 1 empty line. Not referenced anywhere in the codebase but could cause confusion.
- **Fix:** Deleted file via `git rm`.

---

## Stripe Payment Links — Not Configured

**Files:** `app/paywall.tsx`, `app/subscription.tsx`

All four Stripe Payment Link URLs are placeholder values:
```
"https://buy.stripe.com/your_core_link"
"https://buy.stripe.com/your_pro_link"
"https://buy.stripe.com/your_employer_link"
"https://buy.stripe.com/your_employer_plus_link"
```

The code detects these and shows a "Coming Soon" alert instead of crashing — safe for TestFlight but **must be replaced before public launch**.

**Action:** Follow `docs/stripe-setup.md` to create Payment Links, then replace all 4 URLs in both files.

---

## Non-Critical Findings

### `help.tsx` — Hardcoded app version
- **Line ~141:** Support email template body contains `App version: 1.0.0`
- **Impact:** Low — this is pre-filled text that users edit before sending.
- **Recommendation:** Pull from `expo-constants` (`Constants.expoConfig?.version`) before launch.

### `help.tsx` — Email template placeholder text
- **Lines ~141:** Template body contains `[Describe your issue here]` and `[Your device]`
- **Impact:** None — intentional placeholder text for users to fill in their email client.
- **Status:** Acceptable as-is.

### `login.tsx` — Dev-only reset button
- **Lines ~220+:** `__DEV__`-only "Reset Onboarding" button is conditionally rendered.
- **Impact:** None — correctly guarded by `__DEV__`, will not appear in production builds.
- **Status:** OK.

### `ai-review.tsx` — Default job state values
- **Lines 76–78:** `type: "hotwater"`, `jobName: "Untitled Job"`, `jobAddr: "No address"` used as initial state before data loads from AsyncStorage.
- **Impact:** None — these are functional defaults, not user-facing unless the app fails to load job data.
- **Status:** OK.

### `employer/assign-job.tsx` — "date TBC" fallback
- **Lines ~151, 173:** Notification body uses `"date TBC"` when no scheduled date is provided.
- **Impact:** Low — only appears in push notifications when employer assigns without a date.
- **Recommendation:** Consider "No date set" or "Date not specified" for professional tone.

---

## Navigation Audit

| Screen | Back Button | Notes |
|---|---|---|
| `welcome.tsx` | None (intentional) | Entry point — no back needed |
| `login.tsx` | None (intentional) | Auth entry point |
| `signup-confirm.tsx` | ✅ → `/login` | OK |
| `home.tsx` | None (intentional) | Root hub screen |
| `(tabs)/profile.tsx` | Via tab bar | Tab screen |
| `(tabs)/liability-timeline.tsx` | Via tab bar | Tab screen |
| `(tabs)/visualiser.tsx` | Via tab bar | Tab screen |
| `assigned-jobs.tsx` | ✅ `router.back()` | OK |
| `near-miss.tsx` | ✅ `router.back()` | OK |
| `help.tsx` | ✅ `router.back()` | OK |
| `settings.tsx` | ✅ `router.back()` | OK |
| `subscription.tsx` | ✅ `router.back()` | OK |
| `notifications.tsx` | ✅ `router.back()` | OK |
| `job-notes.tsx` | ✅ `router.back()` | OK |
| `employer/dashboard.tsx` | ✅ `router.back()` | OK |
| `employer/assign-job.tsx` | ✅ `router.back()` | OK |
| `employer/invite.tsx` | ✅ `router.back()` | OK |
| `employer/job-planner.tsx` | ✅ `router.back()` | OK |
| `employer/join-team.tsx` | ✅ `router.back()` | OK |
| `employer/team-report.tsx` | ✅ `router.back()` | OK |
| `plumbing/ai-review.tsx` | ✅ `router.back()` | OK |
| `plumbing/declaration.tsx` | ✅ `router.back()` | OK |
| `plumbing/photos.tsx` | ✅ `router.back()` | OK |
| `plumbing/job-detail.tsx` | ✅ `router.back()` | OK |
| `plumbing/checklist.tsx` | ✅ `router.back()` | OK |
| `plumbing/signature.tsx` | ✅ `router.back()` | OK |
| `plumbing/electrical-checklist.tsx` | ✅ `router.back()` | OK |
| `plumbing/gas-checklist.tsx` | ✅ `router.back()` | OK |
| `plumbing/drainage-checklist.tsx` | ✅ `router.back()` | OK |
| `plumbing/newinstall-checklist.tsx` | ✅ `router.back()` | OK |
| `plumbing/carpentry-checklist.tsx` | ✅ `router.back()` | OK |
| `plumbing/general-checklist.tsx` | ✅ `router.back()` | OK |

**No dead-end screens found** (excluding intentional entry points: welcome, login, home tab screens).

---

## App Store Submission Checklist

### Content
- [ ] Replace all 4 Stripe Payment Link URLs in `paywall.tsx` and `subscription.tsx`
- [ ] Confirm `docs/stripe-setup.md` webhook is live and receiving events
- [ ] Update Privacy Policy and Terms & Conditions URLs from placeholder (`/privacy.html`, `/terms.html`) to live URLs
- [ ] Confirm support email `support@elemetric.com.au` is monitored

### Technical
- [ ] All `sk_test_` Stripe keys replaced with `sk_live_` in Railway
- [ ] Run `npx expo export` and confirm no TypeScript/build errors
- [ ] Test on physical iOS device (not just simulator) — especially PDF generation and sharing
- [ ] Test PDF share on Android — confirm `mimeType` and `UTI` work correctly
- [ ] Verify Supabase Row Level Security (RLS) policies are enabled on `jobs` and `profiles` tables
- [ ] Confirm `EXPO_PUBLIC_ELEMETRIC_API_KEY` is set in EAS build secrets

### App Store Assets
- [ ] App icon (1024×1024 PNG, no transparency)
- [ ] Screenshots for all required iPhone sizes (6.9", 6.5", 5.5")
- [ ] App description, keywords, category (Business or Productivity)
- [ ] Privacy policy URL live and accessible
- [ ] Age rating form completed (likely 4+)

### Expo / EAS
- [ ] `app.json` version and `buildNumber`/`versionCode` incremented
- [ ] EAS build profile set to `production` with correct bundle ID
- [ ] Push notification certificates configured (if using APNs for production notifications)
