# Elemetric Mobile — Overnight Batch 2 Summary

**Date:** 2026-03-16
**Branch:** `main`
**Commits:** 20 tasks + this summary document

---

## Task 1 — Gas Checklist Upgrade
**File:** `app/plumbing/gas-checklist.tsx`

- Added gas type selector chip (Natural Gas / LPG)
- Added inlet/outlet pressure fields with AS/NZS 5601.1 reference values (NG: 1.0–2.75 kPa, LPG: 2.75 kPa)
- Added gas consumption rate, appliance serial number, last service date, certifying body fields
- Added "Gas Technical Data" PDF section (3-column table: parameter / value / reference) between Appliance Details and AI Review sections
- Added `chipRow`, `chip`, `chipActive`, `fieldHint` styles

---

## Task 2 — Electrical Checklist Upgrade
**File:** `app/plumbing/electrical-checklist.tsx`

- Added supply frequency, 3-pair insulation resistance (L-N / L-PE / N-PE @ 500V DC), earth loop impedance, PSCC, RCD trip current, test instrument model and calibration date
- Replaced simple test readings with grouped sub-sections: Supply Characteristics, Insulation Resistance, Earth Fault Loop & Protection, Test Instrument Details
- Replaced PDF test table with comprehensive 3-column reference table covering all AS/NZS 3000:2018 test parameters
- Added `subHeading` style for sub-section grouping

---

## Task 3 — Plumbing Checklist Upgrade
**File:** `app/plumbing/ai-review.tsx`

- Added plumbing technical data section (conditional on hotwater/newinstall job types): water pressure at meter (max 500 kPa), pressure at fixture (min 50 kPa), hot/cold water temperatures, flow rate, pipe material and size
- Added conditional PDF section with 3-column AS/NZS 3500 reference table
- Added `techGrid`, `techCell`, `techLabel` styles
- Data appears only for relevant job types — does not affect gas, electrical, or drainage flows

---

## Task 4 — Drainage Checklist Upgrade
**File:** `app/plumbing/drainage-checklist.tsx`

- Added pipe material, diameter, gradient, drain length fields
- Added test method chip selector (Water / Air / CCTV)
- Added test duration and result chip selector (Pass / Fail) with colour coding
- Added conditional CCTV operator name and report reference fields
- Added "Drainage Test Data" PDF section (3-column table per AS/NZS 3500.2)
- Added `chipPass`, `chipFail`, `sectionSub` styles

---

## Task 5 — Property Passport
**File:** `app/property-passport.tsx`

- Added Google Maps link button (opens Maps with property address)
- Added tradies-on-record section (aggregated from jobs: installer name, trade types, job count)
- Added PDF export: compliance summary, trend table, tradies table, full job history (expo-print + expo-sharing)
- Added `actionsRow`, `actionBtn`, `tradieRow` styles

---

## Task 6 — Near Miss Upgrade
**File:** `app/near-miss.tsx`

- Added severity level chip selector (Low / Medium / High / Critical) with distinct colours
- Added persons at risk, contributing factors, immediate action taken, corrective actions required fields
- Added follow-up date and supervisor name/contact fields
- Rebuilt PDF with coloured severity banner, dual signature blocks (tradesperson + supervisor), coloured evidence sections
- Added Supabase save to `near_misses` table on submission

---

## Task 7 — Client Portal
**Files:** `app/client-portal.tsx` (new), `app/home.tsx` (updated)

- Two-step portal: email + address verification → read-only compliance results
- Supabase query using `ilike` on `job_addr` — no authentication required
- Results show overall compliance score, job cards with score pills, missing items, recommended actions
- Disclaimer note: AI scores are informational, not official certificates
- Added Client Portal button to home screen secondary actions

---

## Task 8 — Advanced Employer Dashboard
**File:** `app/employer/dashboard.tsx`

- Added period selector (Week / Month / Year) — filters all dashboard metrics
- Added compliance score distribution horizontal bar chart (green ≥80, orange 60-79, red <60)
- Added league table sorted by compliance score (top-ranked gets orange card)
- Added activity feed — chronological list of recent jobs across all team members in the selected period
- Period filtering is applied to already-loaded data (no extra network calls on period change)

---

## Task 9 — Invoice Generator
**File:** `app/invoice.tsx` (new)

- Business details: name, ABN, address, phone, email, licence number
- Client details: name, address, email
- Invoice metadata: invoice number, date, due date, job reference
- Dynamic line items: add/remove rows with description, quantity, unit price, line total preview
- GST toggle (10% on/off) with ATO-compliant labelling
- Live subtotal, GST, and TOTAL DUE calculations using `Intl.NumberFormat`
- Professional PDF: navy header, INVOICE badge, from/to layout, dark-header table, totals block, footer
- Pre-fills from Supabase profile (company name, licence) and AsyncStorage (current job)

---

## Task 10 — Calendar
**Files:** `app/(tabs)/calendar.tsx` (new), `app/(tabs)/_layout.tsx` (updated)

- Monthly calendar grid with Mon-start day-of-week headers
- Today highlight (orange border), selected day highlight (orange fill)
- Job status dots on date cells (up to 3 dots: blue=assigned, orange=in_progress, green=complete)
- Month navigation (prev/next with year rollover)
- Day selection panel showing jobs for the selected date with status pill
- Monthly summary section (first 5 dates with jobs)
- Data loaded from Supabase: assigned jobs (`assigned_to=user`) + own completed jobs, de-duplicated by ID
- Registered as tab in `_layout.tsx` with `calendar.badge.clock` icon

---

## Task 11 — Signature Improvements
**File:** `app/plumbing/signature.tsx`

- Added typed full name field (required before save)
- Auto-filled date display with "Auto-filled" badge
- Undo last stroke button
- Minimum signature size validation (span ≥15% of pad width, ≥2 strokes, ≥10 points)
- Save as default toggle (persists name to `elemetric_signature_name` in AsyncStorage)
- Saved signature preview banner (shows if previous signature exists)
- Clear All button; save button disabled until name + valid signature present

---

## Task 12 — Photo Enhancement
**File:** `app/plumbing/photos.tsx`

- Tap-to-zoom: full-screen modal overlay with image preview and "Tap to close"
- 90° rotation: `ImageManipulator.manipulateAsync` with `{ rotate: 90 }`, updates URI in state + AsyncStorage
- Reorder arrows (◀ ▶): move photos left/right within each checklist item
- Photo count badge: "1/3" overlay on each thumbnail
- New styles: `modalOverlay`, `modalImage`, `countBadge`, `reorderRow`, `reorderBtn`

---

## Task 13 — Notification Rebuild
**File:** `app/notifications.tsx`

- Category filter chips: All / Jobs / Compliance / Near Miss / Updates — with per-category counts
- Collapsible preferences panel with Sound toggle (persisted to `elemetric_notif_sound` AsyncStorage key)
- Delete All action with confirmation alert (Supabase delete by user_id)
- Existing features retained: search, mark all as read, swipe-delete, type badges, unread indicator, pull-to-refresh

---

## Task 14 — Settings Rebuild
**File:** `app/settings.tsx`

- Account section now shows full name from `profiles.full_name`
- Added Notifications section (quick link to Notification Centre)
- Added Privacy & Data section:
  - Export My Data → navigates to new `data-export.tsx` screen
  - Request Account Deletion → pre-filled `mailto:` with email/user ID
- Unused inline export/deletion functions refactored to delegate to the new screen

---

## Task 15 — Onboarding Upgrade
**File:** `app/welcome.tsx`

- Expanded from 3 to 6 slides
- Each slide has an emoji illustration card with per-slide accent colour
- Progress bar at top of screen (width = current/total)
- Skip button (top-right, hidden on last slide)
- Back navigation button (disabled on first slide, transparent)
- Step counter label (e.g. "2 of 6") at bottom of slide content
- Dots are tappable and expand when active (dot → pill)

---

## Task 16 — Trade Selection Upgrade
**File:** `app/trade.tsx`

- Rebuilt trade selector as 2-column visual cards (icon, label, job count badge, checkmark)
- Each trade card uses its own accent colour (blue for Plumber, yellow for Electrician, etc.)
- Search bar filters across all job types and trades simultaneously (cross-trade search results list)
- Recently used section: shows last trade + job type, persisted to `elemetric_recent_trade` (AsyncStorage)
- Job type rows now show AS/NZS standard label below description
- Empty state shown when search matches no job types

---

## Task 17 — PDF Viewer
**File:** `app/pdf-preview.tsx` (new)

- Accepts `uri`, `filename`, `title` route params
- Shows PDF metadata card: emoji icon with PDF badge, title, filename, file size (read via `FileSystem.getInfoAsync`), status pills
- "Open PDF" button: opens via `expo-web-browser` (system PDF viewer on iOS/Android)
- "Share / Export" button: `expo-sharing.shareAsync` with `application/pdf` MIME type
- Info note explaining what the report contains
- Usable from any PDF generation screen via `router.push("/pdf-preview", { uri, filename, title })`

---

## Task 18 — Data Export
**File:** `app/data-export.tsx` (new), `app/settings.tsx` (updated)

- Full JSON Export: gathers all Supabase data (jobs, profile, near misses) + all AsyncStorage data → JSON file → `expo-sharing`
- Jobs CSV Export: flattens all jobs (cloud + local) into CSV with standard column headers → `expo-sharing`
- Clear Local Cache: `AsyncStorage.multiRemove` of all 11 Elemetric storage keys with confirmation alert
- Request Account Deletion: pre-filled mailto to `cayde@elemetric.com.au` citing Australian Privacy Act and GDPR "right to be forgotten"
- Linked from Settings → Privacy & Data section

---

## Task 19 — Error Handling
**Files:** `components/ErrorBoundary.tsx` (new), `app/_layout.tsx` (updated)

- `ErrorBoundary` class component wraps entire app in root layout
- `componentDidCatch` reports crashes to Supabase `crash_logs` table (user_id, error_message, name, component_stack, stack, occurred_at) — best-effort, silent on failure
- Recovery UI shows: error name, message, explanatory text, "Retry" button (resets error state)
- `getDerivedStateFromError` pattern used for clean render-phase error capture
- Does not suppress expected errors (auth failures, network timeouts) — only catches unhandled render errors

---

## Task 20 — Final Polish
**File:** `app/home.tsx` (updated)

- Added Invoice Generator and Data Export to home screen secondary actions row
- Ensures all new screens are reachable from the app's primary navigation hub without requiring menu traversal

---

## New Files Created

| File | Description |
|------|-------------|
| `app/client-portal.tsx` | Client-facing compliance record viewer |
| `app/invoice.tsx` | Professional invoice generator with GST |
| `app/(tabs)/calendar.tsx` | Monthly job calendar grid |
| `app/pdf-preview.tsx` | In-app PDF preview + share screen |
| `app/data-export.tsx` | Data export (JSON/CSV) + GDPR deletion |
| `components/ErrorBoundary.tsx` | Global React error boundary |

## Modified Files

| File | Changes |
|------|---------|
| `app/plumbing/gas-checklist.tsx` | Gas type, pressures, serial, service date, certifying body |
| `app/plumbing/electrical-checklist.tsx` | Extended test readings, 3-column PDF table |
| `app/plumbing/ai-review.tsx` | Conditional plumbing technical data section |
| `app/plumbing/drainage-checklist.tsx` | Pipe data, test method/result chips, CCTV fields |
| `app/plumbing/signature.tsx` | Name field, undo, size validation, save-as-default |
| `app/plumbing/photos.tsx` | Zoom, rotate, reorder, count badge |
| `app/property-passport.tsx` | Maps link, PDF export, tradies section |
| `app/near-miss.tsx` | Severity, persons at risk, corrective actions, Supabase save |
| `app/employer/dashboard.tsx` | Period selector, bar chart, league table, activity feed |
| `app/notifications.tsx` | Category filter, sound preference, delete all |
| `app/settings.tsx` | Full name, notifications link, privacy/data section |
| `app/welcome.tsx` | 6 slides, progress bar, back nav, skip, illustrations |
| `app/trade.tsx` | Visual cards, search, recently used, standards |
| `app/home.tsx` | Invoice + Data Export shortcuts |
| `app/(tabs)/_layout.tsx` | Calendar tab registration |
| `app/_layout.tsx` | ErrorBoundary wrapper |

---

## Supabase Tables Referenced

| Table | Usage |
|-------|-------|
| `jobs` | Client portal search, data export, calendar |
| `near_misses` | Near miss Supabase save, data export |
| `profiles` | Settings full name, data export |
| `notifications` | Notification rebuild, licence expiry |
| `crash_logs` | Error boundary crash reporting |
| `teams` / `team_members` | Employer dashboard |

---

*Generated automatically at end of overnight batch 2.*
