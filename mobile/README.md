# Elemetric — Mobile App

AI-powered compliance reporting for Australian tradespeople. Generate professional PDF compliance reports on-site in under 5 minutes.

---

## What is Elemetric?

Elemetric is a React Native app for licensed plumbers, gas fitters, electricians, and HVAC technicians in Australia. Users:

1. Select a trade type (hot water, gas, drainage, new installation, electrical, HVAC)
2. Complete an on-site checklist with photo evidence
3. Run AI analysis against AS/NZS standards (3500, 5601, 3000, 1668)
4. Sign and export a branded PDF compliance report

Employers can create teams, invite tradespeople, and monitor their compliance scores from an Employer Portal.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Expo](https://expo.dev) (SDK 54) + React Native 0.81 |
| Routing | [Expo Router](https://expo.github.io/router) v6 (file-based) |
| Language | TypeScript 5.9 |
| Auth & Database | [Supabase](https://supabase.com) (Postgres + Auth + RLS) |
| Offline storage | AsyncStorage |
| AI analysis | Custom Express server → Anthropic Claude API |
| PDF generation | expo-print (WebKit HTML renderer) |
| PDF sharing | expo-sharing |
| Photos | expo-image-picker + expo-image-manipulator |
| Location | expo-location (GPS + reverse geocode) |
| Address search | OpenStreetMap Nominatim (no API key needed) |
| Push notifications | expo-notifications |
| Haptics | expo-haptics |
| SVG | react-native-svg |
| QR codes | qrcode npm package |
| Build/deploy | EAS Build + EAS Submit |

---

## Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`
- iOS: Xcode 15+ (Mac only) or Expo Go app
- Android: Android Studio or Expo Go app
- A [Supabase](https://supabase.com) project (free tier is fine)

---

## Environment Variables

Create a `.env` file in the `mobile/` directory (never commit this):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Resend (transactional email) — get your key at https://resend.com
EXPO_PUBLIC_RESEND_API_KEY=re_your_key_here
```

> **Security note:** `EXPO_PUBLIC_` variables are bundled into the app binary. For production, consider proxying email sends through your backend server and storing `RESEND_API_KEY` as a server-only environment variable.

The AI server URL is hardcoded in `app/plumbing/drainage-checklist.tsx` and `gas-checklist.tsx` as:
```
https://elemetric-ai-production.up.railway.app
```
Update this if you deploy the server elsewhere.

---

## Supabase Setup

Run the SQL in `supabase/migrations/rls_and_schema.sql` in the Supabase dashboard → SQL Editor. This creates:

- `profiles` table additions: `role`, `compliance_score`, `push_token`, `onboarding_complete`
- `teams`, `team_members`, `team_invites` tables
- Row Level Security policies on all tables

Your `profiles` table must also have: `user_id`, `full_name`, `licence_number`, `company_name`, `phone`.

---

## Running Locally

```bash
# Install dependencies
cd mobile
npm install

# Start the Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Regenerate splash screen (requires canvas devDependency)
npm run generate:splash
```

Then open the Expo Go app on your phone and scan the QR code, or press `i`/`a` in the terminal for simulators.

---

## Building for TestFlight

```bash
# Install EAS CLI if needed
npm install -g eas-cli

# Log in to your Expo account
eas login

# Preview build (internal distribution — installs directly via TestFlight link)
npm run build:ios
# equivalent: eas build --platform ios --profile preview

# Production build (for App Store submission)
npm run build:ios:prod
# equivalent: eas build --platform ios --profile production
```

Before running a production build, update `eas.json` → `submit.production.ios` with your:
- `appleId` — your Apple ID email
- `ascAppId` — App Store Connect App ID (found in App Store Connect → App Information)
- `appleTeamId` — your Apple Developer Team ID

Then submit:
```bash
eas submit --platform ios --profile production
```

See `docs/launch-checklist.md` for the full pre-submission checklist.

---

## Folder Structure

```
mobile/
├── app/                        # All screens (Expo Router file-based routing)
│   ├── _layout.tsx             # Root layout — registers push notifications
│   ├── index.tsx               # Entry point — redirects to /welcome or /login
│   ├── welcome.tsx             # Marketing onboarding slides (first launch)
│   ├── login.tsx               # Sign in / create account
│   ├── signup-confirm.tsx      # Post-signup email confirmation screen
│   ├── home.tsx                # Main home screen (New Job, Past Jobs, Near Miss)
│   ├── trade.tsx               # Trade type selection (6 types)
│   ├── near-miss.tsx           # Near miss / pre-existing non-compliance report
│   ├── settings.tsx            # Account settings, role toggle, sign out
│   ├── onboarding/
│   │   └── index.tsx           # Post-signup 4-step onboarding setup
│   ├── employer/
│   │   ├── dashboard.tsx       # Employer team overview + compliance scores
│   │   ├── invite.tsx          # Send team invites by email
│   │   └── join-team.tsx       # Individual plumber joins a team via invite
│   ├── plumbing/
│   │   ├── new-job.tsx         # Job name + address entry (Nominatim autocomplete)
│   │   ├── checklist.tsx       # Hot water system checklist
│   │   ├── gas-checklist.tsx   # Gas rough-in checklist (AS/NZS 5601)
│   │   ├── drainage-checklist.tsx
│   │   ├── newinstall-checklist.tsx
│   │   ├── general-checklist.tsx  # Electrical + HVAC documentation
│   │   ├── ai-review.tsx       # AI analysis results + job save + PDF export
│   │   └── jobs.tsx            # Past jobs list with search, filter, share PDF
│   └── (tabs)/
│       ├── _layout.tsx         # Tab bar layout (Home | Timeline | Profile)
│       ├── index.tsx           # Redirects to /home
│       ├── liability-timeline.tsx  # 7-year liability countdown per job
│       └── profile.tsx         # Profile + compliance score widget
│
├── assets/
│   ├── app.png                 # App icon (1024×1024)
│   ├── images/
│   │   └── splash-icon.png     # Splash screen (1284×2778, generated by script)
│   └── trades/                 # Trade card background images
│
├── components/                 # Shared UI components
├── constants/                  # Theme colours
├── hooks/                      # Custom hooks
├── lib/
│   ├── supabase.ts             # Supabase client (reads EXPO_PUBLIC_ env vars)
│   └── notifications.ts        # Push notification registration + local notifications
│
├── scripts/
│   └── generate-splash.js      # Generates splash-icon.png using canvas
│
├── supabase/
│   └── migrations/
│       └── rls_and_schema.sql  # All SQL to run in Supabase dashboard
│
├── docs/
│   ├── app-store-listing.md    # iOS App Store metadata + screenshot specs
│   ├── play-store-listing.md   # Google Play metadata + screenshot specs
│   └── launch-checklist.md     # Full pre-submission checklist
│
├── app.json                    # Expo config (bundle IDs, permissions, plugins)
├── eas.json                    # EAS Build profiles (development/preview/production)
├── package.json
└── tsconfig.json
```

---

## Key AsyncStorage Keys

| Key | Purpose |
|-----|---------|
| `elemetric_onboarding_seen` | Whether the user has seen the welcome slides |
| `elemetric_current_job` | Active job details (type, name, address) |
| `elemetric_jobs` | Local job history (offline fallback) |
| `elemetric_pdf_generated` | Flag: user has generated at least one PDF |
| `elemetric_signature_svg` | Saved installer signature SVG |
| `elemetric_installer_name` | Saved installer name for AI review |

---

## AI Server

The AI analysis server lives in `../server/index.js` (a separate Node.js/Express app deployed on Railway).

**Endpoint:** `POST /analyse`
**Body:** `{ photos: string[], type: "gas" | "plumbing" | "electrical" | "hvac" }`
**Returns:** `{ confidence, relevant, detected, unclear, missing, action }`

The server requires `ANTHROPIC_API_KEY` as an environment variable.

---

## Haptic Feedback Map

| Action | Haptic |
|--------|--------|
| Tap checklist item / toggle status | Light impact |
| Save job to Supabase | Medium impact |
| Generate or share PDF | Heavy impact |
| Tab bar presses | Light (via HapticTab component) |
| Onboarding navigation | Light impact |

---

## Licence

Private — Elemetric Pty Ltd. All rights reserved.
