# Elemetric Employer Web Portal — Live

## Build status

Zero TypeScript errors. `npm run build` produces a clean Vite production bundle (356 ms).

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
| `/settings` | Company profile, notifications (localStorage + Supabase), password reset |

## Architecture notes

- React 19 + TypeScript strict + Vite 8 + Tailwind v4
- Route-based code splitting via `React.lazy` + `Suspense`
- Auth gate in `AppRouter` blocks all routes until `supabase.auth.getSession()` resolves
- `useAuth()` provides `session`, `profile`, `signOut`
- All data pages guard on `session && profile?.team_id` before fetching; return early with `setLoading(false)` to prevent permanent skeleton screens
- Notification preferences persisted to `localStorage` (`elemetric_notif_prefs`) with graceful Supabase upsert attempt
- Mobile: hamburger sidebar + full bottom nav (7 routes), mobile card list in Jobs, responsive modals
