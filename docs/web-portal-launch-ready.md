# Elemetric Employer Portal — Launch Ready

## Overview
The Elemetric Employer Portal is a React + TypeScript web application for Victorian plumbing employers to manage their team's AI-powered compliance documentation.

## Tech Stack
- **Framework**: React 19 + TypeScript (Vite 6)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- **Auth**: Supabase (`@supabase/supabase-js`)
- **Routing**: React Router DOM v7
- **Charts**: Recharts
- **Icons**: Lucide React
- **Deployment**: Netlify

## Brand Colors
| Name   | Hex       | Usage                          |
|--------|-----------|--------------------------------|
| Navy   | `#07152B` | Sidebar, headers, dark backgrounds |
| Orange | `#FF6B00` | CTAs, active states, accents   |

## Pages
| Route         | Page        | Description                                    |
|---------------|-------------|------------------------------------------------|
| `/login`      | Login       | Navy background, centered card with Supabase auth |
| `/dashboard`  | Dashboard   | Stats, jobs needing attention, recent activity |
| `/jobs`       | Jobs        | Paginated job table, filters, assign modal, PDF viewer |
| `/team`       | Team        | Member cards with score rings, invite modal    |
| `/analytics`  | Analytics   | Charts: trend line, trade pie, failures bar, leaderboard |
| `/compliance` | Compliance  | Risk donut, alerts list, certificate registry  |
| `/settings`   | Settings    | Company profile, subscription, notifications, integrations, account |

## Key Components
- **Layout** — Sidebar nav (240px navy) + top header with notifications + mobile bottom nav
- **NotificationBell** — Polls `/notifications/:userId` every 30s, dropdown with unread badge
- **PDFViewer** — Modal iframe with download/print/copy-link toolbar

## API Integration
All API calls use `Authorization: Bearer {session.access_token}` header.
The Railway server base URL is stored in `VITE_API_URL`.
`teamId` is sourced from `profiles.team_id` in Supabase.

## Auth Flow
1. User signs in via Supabase email/password
2. Profile is fetched from `profiles` table
3. Role is checked — must be `employer` to access portal
4. Session is stored in context and used for API calls

## Environment Variables
```
VITE_SUPABASE_URL=https://dqgphwaklhckhvqwqqfp.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>
VITE_API_URL=https://elemetric-ai-production.up.railway.app
```

## Deployment (Netlify)
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect: all routes → `/index.html` (200 status)

## Mobile Responsiveness
- Sidebar hidden on `< md` breakpoint
- Bottom nav bar (5 icons) shown on mobile
- Tables become card lists on mobile
- All modals go full-screen on mobile
- Touch targets ≥ 44px
- Charts use `ResponsiveContainer` from Recharts

## Loading States
Every data-fetching page/component shows:
- Skeleton loaders (`animate-pulse` gray divs) while loading
- Empty state illustrations when no data exists
- Error banners on API failures

## Security
- Protected routes redirect unauthenticated users to `/login`
- Role check on login: non-employers are rejected
- API tokens passed as Bearer headers, never in query params (except PDF/export where token in URL is required for iframe/download)

## Known Setup Steps Before Launch
1. Add real `VITE_SUPABASE_ANON_KEY` to `.env` and Netlify environment variables
2. Ensure `profiles` table has `role`, `team_id`, `company_name`, `full_name`, `subscription_plan`, `trial_started_at` columns
3. Ensure `analyses` table exists for job assignment
4. Configure Netlify deploy with GitHub repository

---
*Generated: March 2026 — Elemetric v1.0 Employer Portal*
