# Elemetric — Pre-Launch Checklist

Complete every item in this list before submitting to the App Store or Google Play.

---

## 1. Supabase & Backend

- [ ] Run `supabase/migrations/rls_and_schema.sql` in the Supabase dashboard SQL Editor
- [ ] Verify RLS is active: in Table Editor, confirm the lock icon appears on `jobs`, `profiles`, `teams`, `team_members`, `team_invites`
- [ ] Test with two different accounts — confirm user A cannot read user B's jobs
- [ ] Create a test reviewer account: `reviewer@elemetric.com.au` — set a known password and save it in App Store Connect notes
- [ ] Confirm `profiles` table has columns: `full_name`, `licence_number`, `company_name`, `phone`, `role`, `compliance_score`, `push_token`
- [ ] Set up Supabase backups (enable PITR or daily backups in the Supabase dashboard)
- [ ] Review server (`server/index.js`) — ensure `ANTHROPIC_API_KEY` is set in production environment variables
- [ ] Verify server is deployed and `/analyse` endpoint is reachable from the mobile app
- [ ] Set rate limiting on the `/analyse` endpoint to prevent abuse

---

## 2. App Configuration

- [ ] Update `app.json` → `"name"` to `"Elemetric"` (not `"mobile"`)
- [ ] Set `app.json` → `"ios"` → `"bundleIdentifier"`: `"com.elemetric.mobile"`
- [ ] Set `app.json` → `"android"` → `"package"`: `"com.elemetric.mobile"`
- [ ] Set `app.json` → `"version"`: `"1.0.0"` (confirm matches App Store Connect)
- [ ] Set `app.json` → `"ios"` → `"buildNumber"`: `"1"`
- [ ] Set `app.json` → `"android"` → `"versionCode"`: `1`
- [ ] Add `"ios"` → `"infoPlist"` with `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`
- [ ] Fill in `eas.json` → `"submit"` → `"production"` → `"ios"` with real `appleId`, `ascAppId`, `appleTeamId`
- [ ] Confirm Expo project ID is linked: run `eas project:info` and verify

---

## 3. Permissions (iOS Info.plist strings)

Add to `app.json` under `"ios"` → `"infoPlist"`:

```json
"NSCameraUsageDescription": "Elemetric uses the camera to photograph your work for compliance reports.",
"NSPhotoLibraryUsageDescription": "Elemetric saves compliance photos to your photo library.",
"NSLocationWhenInUseUsageDescription": "Elemetric uses your location to auto-fill the job site address.",
"NSUserNotificationsUsageDescription": "Elemetric notifies you when a job is saved successfully."
```

- [ ] Verify each permission string is accurate and descriptive (Apple rejects vague strings)
- [ ] Test camera permission prompt on a physical device
- [ ] Test location permission prompt — confirm it only requests "When in Use"
- [ ] Test photo library permission prompt

---

## 4. Expo Application Services (EAS)

- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Log in: `eas login`
- [ ] Link project: `eas project:init` (or confirm `extra.eas.projectId` in `app.json`)
- [ ] Run preview build: `npm run build:ios` — confirm it builds without errors
- [ ] Install preview build on a physical iPhone via TestFlight or direct install
- [ ] Run Android preview build: `eas build --platform android --profile preview`
- [ ] Test the APK on a physical Android device

---

## 5. TestFlight Setup

- [ ] Log in to App Store Connect (appstoreconnect.apple.com)
- [ ] Create a new App record with bundle ID `com.elemetric.mobile`
- [ ] Fill in App Information: name, subtitle, category, privacy policy URL
- [ ] Upload build via `eas submit --platform ios --profile production` (or Transporter)
- [ ] Wait for build processing (usually 15–30 minutes)
- [ ] Add internal testers in TestFlight → enable testing
- [ ] Test all core flows on TestFlight build:
  - [ ] Sign up → receive confirmation screen
  - [ ] Log in → reach home screen
  - [ ] New Job → select trade → fill details → checklist → AI review → save → PDF export → share
  - [ ] Gas checklist → GPS address fill → PDF export
  - [ ] Near miss report → photos → PDF export
  - [ ] Profile → save details → verify they appear in next PDF
  - [ ] Settings → change password email received
  - [ ] Settings → switch to Employer → team created
  - [ ] Employer portal → invite member → second account joins via "Join Team"
  - [ ] Push notification fires when job is saved
  - [ ] Jobs list → search → filter by type → pull-to-refresh
  - [ ] Share PDF from jobs list

---

## 6. Screenshots & App Preview

- [ ] Capture 6 iPhone screenshots at 1320 × 2868px (iPhone 6.9") — see `docs/app-store-listing.md`
- [ ] Capture 6 iPad screenshots at 2048 × 2732px (iPad 13") if supporting iPad
- [ ] Add marketing captions in post-production (Figma or Canva)
- [ ] Capture 8 Android screenshots at 1080 × 1920px — see `docs/play-store-listing.md`
- [ ] Create Feature Graphic for Google Play at 1024 × 500px
- [ ] Confirm app icon is 1024 × 1024px with no alpha channel for iOS
- [ ] Confirm app icon is 512 × 512px PNG for Google Play

---

## 7. App Store Connect Metadata

- [ ] App name: `Elemetric`
- [ ] Subtitle: `Plumbing Compliance Reports`
- [ ] Description: paste from `docs/app-store-listing.md`
- [ ] Keywords: paste from `docs/app-store-listing.md`
- [ ] What's New: paste from `docs/app-store-listing.md`
- [ ] Support URL: `https://elemetric.com.au/support`
- [ ] Marketing URL: `https://elemetric.com.au`
- [ ] Privacy Policy URL: `https://elemetric.com.au/privacy`
- [ ] Set age rating: 4+
- [ ] Upload all 6 screenshots
- [ ] Set pricing: Free
- [ ] Set availability: Australia (add New Zealand if desired)
- [ ] Demo account credentials filled in review notes

---

## 8. Google Play Console Metadata

- [ ] Create app in Google Play Console (play.google.com/console)
- [ ] App name: `Elemetric - Plumbing Compliance`
- [ ] Short description: paste from `docs/play-store-listing.md`
- [ ] Full description: paste from `docs/play-store-listing.md`
- [ ] Upload 8 screenshots (phone)
- [ ] Upload Feature Graphic (1024 × 500px)
- [ ] Upload hi-res icon (512 × 512px)
- [ ] Complete Data Safety section — see `docs/play-store-listing.md`
- [ ] Set content rating via IARC questionnaire
- [ ] Set pricing: Free
- [ ] Set distribution: Australia (+ New Zealand)
- [ ] Set category: Business
- [ ] Fill in contact email and website

---

## 9. Privacy Policy & Terms

- [ ] Privacy policy is live at `https://elemetric.com.au/privacy` — must cover:
  - What data is collected (email, name, photos, location, job data)
  - How it's stored (Supabase, encrypted at rest and in transit)
  - How long it's retained
  - How to request deletion (support@elemetric.com.au)
  - Whether data is shared with third parties (Anthropic API for photo analysis — disclose this)
- [ ] Terms & Conditions are live at `https://elemetric.com.au/terms`
- [ ] Both URLs return 200 (not placeholder/404)

---

## 10. Security & Code

- [ ] Remove any hardcoded API keys, secrets, or passwords from the codebase
- [ ] Confirm `.env` or `app.config.js` is not committed to the repo (check `.gitignore`)
- [ ] Supabase anon key is the public anon key only — service role key is never in the mobile app
- [ ] Verify `expo-secure-store` or equivalent is used for any sensitive tokens (not plain AsyncStorage)
- [ ] Run `npm audit` and address any high/critical vulnerabilities

---

## 11. Performance & Quality

- [ ] Test on the oldest supported iOS version (currently iOS 16 minimum for Expo SDK 54)
- [ ] Test on the oldest supported Android version (Android 10 / API 29 minimum)
- [ ] Confirm app launches in under 3 seconds on an older device
- [ ] Verify no React Native red screen errors in production build
- [ ] Check all PDF generation flows complete without timeout on slow networks
- [ ] Confirm address autocomplete degrades gracefully with no internet (no crash)
- [ ] Confirm AI analysis shows a friendly error if the server is unreachable
- [ ] Test dark mode (iOS) — app is always dark-themed, should not break in light system mode

---

## 12. Production Build & Submission

### iOS
- [ ] Run production build: `eas build --platform ios --profile production`
- [ ] Submit to App Store: `eas submit --platform ios --profile production`
- [ ] Complete all App Store Connect checklist items
- [ ] Submit for review — average review time: 1–3 business days

### Android
- [ ] Run production build: `eas build --platform android --profile production`
- [ ] Submit to Google Play: `eas submit --platform android --profile production`
- [ ] Complete all Play Console checklist items
- [ ] Submit for review — average review time: 1–7 business days (first submission longer)

---

## 13. Post-Launch

- [ ] Monitor Supabase usage dashboard for unexpected spikes
- [ ] Monitor server logs for errors on `/analyse` endpoint
- [ ] Set up error alerting (Sentry, LogRocket, or similar)
- [ ] Respond to any App Store/Play Store review notes within 24 hours
- [ ] Set up a basic support inbox at support@elemetric.com.au
- [ ] Plan first update: OTA via `eas update` for JS-only changes (no binary changes needed)

---

## Quick Reference Commands

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login
eas login

# Preview build (TestFlight / internal)
npm run build:ios
# or
eas build --platform ios --profile preview

# Production build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios --profile production
eas submit --platform android --profile production

# OTA update (JS changes only — no App Store review needed)
eas update --channel production --message "Fix: address autocomplete"
```
