# Elemetric Pre-Build Checklist

Generated: 2026-03-17
App version: 1.0.1
Build target: iOS (EAS Build)

---

## Export Check

- [x] `npx expo export --platform ios` completes with 0 errors
- [x] Bundle: `entry-af8ed527e4bb4221b086489fc73c3ec3.hbc` (5.84 MB)
- [x] 1807 modules bundled successfully
- [x] 23 assets resolved

---

## App Config (app.json)

- [x] `scheme`: `elemetric` — deep links registered
- [x] `version`: `1.0.1`
- [x] `orientation`: `portrait`
- [x] `userInterfaceStyle`: `dark`
- [x] `newArchEnabled`: `true`
- [x] iOS bundle ID: `com.elemetric.mobile`
- [x] Android package: `com.elemetric.mobile`

---

## Assets

- [x] iOS icon: `assets/app.png`
- [x] Splash image: `assets/images/splash-icon.png`
- [x] Android adaptive foreground: `assets/images/android-icon-foreground.png`
- [x] Android adaptive background: `assets/images/android-icon-background.png`
- [x] Android monochrome: `assets/images/android-icon-monochrome.png`
- [x] Web favicon: `assets/images/favicon.png`

---

## Core Screens

- [x] Onboarding (`app/welcome.tsx`) — 6 slides, progress dots, Back/Next
- [x] Login / Register (`app/login.tsx`, `app/register.tsx`)
- [x] Home / Trade selector (`app/(tabs)/index.tsx`, `app/trade.tsx`)
- [x] New Job (`app/plumbing/new-job.tsx`) — address autocomplete, free tier gate
- [x] Checklists:
  - [x] `app/plumbing/general-checklist.tsx` — 23 job types (electrical, HVAC, carpentry)
  - [x] `app/plumbing/electrical-checklist.tsx`
  - [x] `app/plumbing/gas-checklist.tsx`
  - [x] `app/plumbing/drainage-checklist.tsx`
  - [x] `app/plumbing/newinstall-checklist.tsx`
  - [x] `app/plumbing/carpentry-checklist.tsx`
- [x] AI Review (`app/plumbing/ai-review.tsx`) — animated loading overlay, PDF generation
- [x] Job history (`app/(tabs)/jobs.tsx`)
- [x] Profile (`app/(tabs)/profile.tsx`) — employer switch modal
- [x] More tab (`app/(tabs)/more.tsx`) — grid nav with 7 items
- [x] Settings (`app/settings.tsx`) — all sections, orange headers
- [x] Help & FAQ (`app/help.tsx`) — 5 expandable sections
- [x] Paywall (`app/paywall.tsx`)
- [x] Referral (`app/referral.tsx`) — memoized, stable callbacks
- [x] Employer portal (`app/employer/dashboard.tsx`, `app/employer/invite.tsx`)

---

## AI Routing

- [x] Electrical subtypes (powerpoint, lighting, switchboard, circuit, faultfinding, appliance, smokealarm) → `type: "electrical"` + correct `subtype` → server routes to 20 PASS/20 FAIL calibrated prompts
- [x] HVAC subtypes (splitsystem, ducted, refrigerant, hvacservice, ventilation) → `type: "hvac"`
- [x] Carpentry subtypes (framing, decking, pergola, door, window, flooring, fixing, woodheater) → `type: "carpentry"`
- [x] Gas heater → `type: "gas"`

---

## Security

- [x] Email sent via Railway backend only (Resend removed from mobile)
- [x] API key gated: `X-Elemetric-Key` header on all AI requests
- [x] Supabase RLS enabled (managed server-side)
- [x] Free tier gate: 3 jobs max, beta_tester bypass, paid role bypass

---

## Tab Structure

- [x] Home (`index`) — trade selector
- [x] Jobs (`jobs`) — job history + compliance timeline
- [x] New Job (`new-job` hidden, accessed via home)
- [x] More (`more`) — Settings, Help, Near Miss, Referral, Training (coming soon), About
- [x] Employer (`employer/dashboard`) — role-gated

---

## Email Templates

- [x] `email-templates/invite-email.html` — dual CTA (web + `elemetric://` deep link)
- [x] `email-templates/job-assignment-email.html` — dual CTA (web + `elemetric://` deep link)

---

## Known Deferred (Post-Launch)

- [ ] Training Mode — visible in More grid with "SOON" badge, not functional
- [ ] Floor plan upload — hidden in new-job.tsx (code intact, UI suppressed)
- [ ] Near Miss screen — navigates to placeholder
- [ ] About screen — navigates to placeholder

---

## EAS Build Next Steps

1. `eas build --platform ios --profile preview` — internal TestFlight build
2. Verify deep link scheme `elemetric://` opens correctly on device
3. Test all 8 job types through full photo → AI → PDF flow
4. Submit via `eas submit --platform ios` when ready
