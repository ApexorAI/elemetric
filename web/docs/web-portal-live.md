# Elemetric Employer Web Portal — Launch Verified

## Build status

Zero TypeScript errors. `npm run build` produces a clean Vite production bundle (622 ms, 2351 modules).

## Verification checklist (2026-03-22)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm run build` | PASS — clean bundle |
| All 17 portal tasks | COMPLETE |
| Australian English (en-AU dates, Licence) | PASS |
| iOS zoom prevention (font-size: 16px globally) | PASS |
| 44px minimum touch targets (global CSS) | PASS |
| Skip link + aria-label nav | PASS |
| Per-page ErrorBoundary isolation | PASS |
| Session expiry warning banner | PASS |
| Route progress bar | PASS |
| SWR-style cache hook (`src/lib/cache.ts`) | PASS |
| robots.txt (noindex — private portal) | PASS |
| OG/Twitter/Apple PWA meta tags | PASS |

## Deploy

- **Platform**: Netlify (auto-deploy from `main` branch)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 20
- **Config**: `web/netlify.toml`

All SPA routes redirect to `index.html` (Netlify `[[redirects]]` rule).

## Security headers (netlify.toml)

| Header | Value |
|---|---|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| CSP | Restricts to self + Google Maps + Supabase + Railway |

## Environment variables required on Netlify

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | Railway API base URL |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Places Autocomplete (optional) |

## Pages completed

| Route | Status |
|---|---|
| `/login` | Auth with Supabase, redirect on success |
| `/dashboard` | Live stats, trend arrows, retry, no-team state |
| `/jobs` | Live job list, filters, assign modal, PDF viewer |
| `/team` | Member grid, detail panel, invite, remove |
| `/analytics` | Charts (trend/pie/bar), leaderboard, date range |
| `/compliance` | Certificate registry, near-miss reports from Supabase |
| `/reports` | 4 PDF report types, current-month defaults |
| `/settings` | Company profile, ABN, address, contact, compliance thresholds, 7 notification toggles |
| `/reports` | 4 PDF report types, email modal, "what's included" previews |
| `/notifications` | Full page with tabs (All/Unread/Alerts), type icons, load more |
| `*` | 404 page with link back to dashboard |

## Architecture notes

- React 19 + TypeScript strict + Vite 8 + Tailwind v4
- Route-based code splitting via `React.lazy` + `Suspense`
- Auth gate in `AppRouter` blocks all routes until `supabase.auth.getSession()` resolves
- `useAuth()` provides `session`, `profile`, `signOut`
- All data pages guard on `session && profile?.team_id` before fetching; return early with `setLoading(false)` to prevent permanent skeleton screens
- Notification preferences persisted to `localStorage` (`elemetric_notif_prefs`) with graceful Supabase upsert attempt
- Mobile: hamburger sidebar + full bottom nav (7 routes), mobile card list in Jobs, responsive modals
