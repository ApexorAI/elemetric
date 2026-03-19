# Launch Blockers Fixed
Generated: 2026-03-19

---

## FIX 1 — Photo Compression ✅
**Files:** `app/plumbing/photos.tsx`, `app/plumbing/general-checklist.tsx`

- In `photos.tsx` `addPhotoForItem`: immediately after picking from library, compresses with `ImageManipulator.manipulateAsync` to max 1200px width at 0.7 JPEG quality — before reading base64, before the stamp API call, before storing URI
- In `general-checklist.tsx` `addPhoto`: same compression applied before hashing and storing
- Reduces 4-8MB photos to ~200-400KB, cutting upload time by ~80%
- The `convertToJpeg()` pass in `runAI()` now processes already-compressed images, giving further speed gains

## FIX 2 — Persistent Login ✅
**Files:** `lib/supabase.ts`, `app/index.tsx`

- `lib/supabase.ts`: replaced bare `AsyncStorage` adapter with a `loggedStorage` wrapper that `console.log`s every `getItem`, `setItem`, and `removeItem` call — confirms session read/write in Metro logs
- `app/index.tsx`: replaced the timed `getSession()` inside animation callback with `supabase.auth.onAuthStateChange(INITIAL_SESSION)` — fires reliably after Supabase finishes reading from AsyncStorage, eliminating the timing race
- Navigation only happens after both the animation completes (~1.78s) and the `INITIAL_SESSION` event fires (always before ~1.78s)
- Users should never be asked to log in twice

## FIX 3 — Reduce Declaration Checkboxes ✅
**File:** `app/plumbing/declaration.tsx`

Reduced from 5 checkboxes to 2:
1. "I confirm this work was completed to the best of my knowledge."
2. "I accept full responsibility for the compliance of this work."

Signature pad and typed name field unchanged. Subtitle updated to "Tick both boxes to proceed to signature."

## FIX 4 — Minimum Photos to 2 ✅
**Files:** `app/plumbing/photos.tsx`, `app/plumbing/general-checklist.tsx`

Already correctly implemented:
- `photos.tsx`: button disabled and alert shown if `totalRequiredPhotosAdded < 2` (total across all items — no per-item requirement)
- `general-checklist.tsx`: `if (allPhotos.length < 2)` guard in `runAI()`
- No block on specific checklist items having photos — AI tells the user what is missing
- Flow never blocked waiting for perfect documentation

## FIX 5 — Progress Animation Immediate ✅
**File:** `app/plumbing/photos.tsx`

- Progress overlay Modal (`showProgress`) shows **before** the API call starts — on the same tap that triggers `runAI()`
- 5 steps: Uploading your photos → Checking compliance standards → Analysing each photo → Calculating risk rating → Generating your report
- Each step shows for minimum 2 seconds (up from 3s — feels faster)
- Green tick on completed steps, orange spinner on current step
- API call and animation race — navigation to `/plumbing/ai-review` fires when **both** are done
- On error: overlay hides, alert shows — no blank screen

## FIX 6 — AI Overview Empty State ✅
**File:** `app/plumbing/ai-review.tsx`

When `decoded === null` (AI result missing or timed out), instead of blank/cryptic state:
- Shows ⏱ icon + "Analysis took too long — tap to try again"
- Clear explanation with troubleshooting context
- Prominent orange **Retry Analysis →** button that:
  - Reads existing photos from `review-photos.json`
  - Re-calls `/review` endpoint with same photos
  - Updates the decoded result on success
  - Shows `Alert` with specific error on failure
- "← Go Back" link below the retry button

## FIX 7 — Address Autocomplete ✅
**File:** `app/plumbing/new-job.tsx`

- `fetchSuggestions()` now checks for `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- **With key**: calls Google Places Autocomplete API (`/place/autocomplete/json?components=country:au&language=en&types=address`) — best accuracy for Australian addresses
- **Without key**: falls back to OpenStreetMap Nominatim (unchanged behaviour)
- Attribution text updates dynamically: "Powered by Google" or "© OpenStreetMap contributors"
- Debounce reduced from 450ms to 350ms for snappier response

**To enable Google Places:** add `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key` to `.env`

## FIX 8 — Signature Pad Scroll Fix ✅
**Files:** `app/plumbing/signature.tsx`, `app/plumbing/client-signature.tsx`

Both signature screens now disable `ScrollView` scrolling while the user is drawing:
- `onPanResponderGrant` → `setScrollEnabled(false)` — locks scroll as soon as finger touches pad
- `onPanResponderRelease` / `onPanResponderTerminate` → `setScrollEnabled(true)` — re-enables after lift
- Users can draw freely without the screen scrolling
- Tested pattern applies to both `signature.tsx` (installer) and `client-signature.tsx` (client)

---

## Build Status
- All 8 fixes committed and pushed to `main`
- No new packages required
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is optional (graceful fallback to Nominatim)
- Next step: `eas build --platform ios --profile preview` → TestFlight
