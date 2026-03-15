# Elemetric Security Checklist

Reviewed: 2026-03-15
Owner: Project maintainer

---

## Account Security

- [ ] **Enable MFA on Supabase dashboard account**
  Go to: Supabase Dashboard → Account → Security → Enable multi-factor authentication.
  Use an authenticator app (not SMS). Required before going to production.

- [ ] **Set a strong, unique password on your Supabase account**
  Must not be reused anywhere else. Use a password manager. Minimum 20 characters.

- [ ] **Enable MFA on Railway account** (where the server is hosted)
  Railway Dashboard → Account Settings → Security → Enable 2FA.

- [ ] **Enable MFA on Stripe Dashboard account**
  Stripe Dashboard → Settings → Team and Security → Two-step authentication.

---

## Supabase Configuration

- [ ] **Rotate Supabase service role key every 90 days**
  Supabase Dashboard → Project Settings → API → Service role key → Rotate.
  Update `SUPABASE_SERVICE_ROLE_KEY` in Railway environment variables after rotation.
  Next rotation due: 2026-06-15

- [ ] **Never expose service role key in mobile app — server only**
  The mobile app must only use the `anon` key. The service role key bypasses all RLS
  and must never appear in app source code or `.env` files committed to git.

- [ ] **Enable Supabase email confirmation** ✅ Already enabled
  Supabase Dashboard → Authentication → Email → Confirm email.

- [ ] **Review Row Level Security (RLS) policies monthly**
  Supabase Dashboard → Table Editor → [table] → RLS Policies.
  Confirm every table has RLS enabled. Check for overly permissive `SELECT *` policies.

- [ ] **Enable Supabase database password rotation**
  Supabase Dashboard → Project Settings → Database → Database password → Reset.
  Rotate every 90 days alongside the service role key.

- [ ] **Set up Supabase alerts for unusual database activity**
  Supabase Dashboard → Reports → Enable email alerts for:
  - Spike in authentication failures
  - Unusual query volume
  - Storage usage alerts

---

## Server (Railway)

- [ ] **Monitor Railway logs weekly for unusual patterns**
  Look for: repeated 401s from unexpected IPs, unusual request volumes to `/review`
  or `/visualise`, errors suggesting injection attempts, repeated auth failures.

- [ ] **Review Railway environment variables quarterly**
  Confirm no secrets are logged. Remove any deprecated keys.

- [ ] **Keep Node.js and all npm dependencies up to date**
  Run `npm audit` monthly. Patch any high/critical vulnerabilities within 7 days.

---

## Code & API Security

- [ ] **Never commit `.env` files to git**
  Confirm `.gitignore` includes `.env` and `.env.*`. Check with `git log --all -- .env`.

- [ ] **Rotate `ELEMETRIC_API_KEY` if ever exposed**
  This is the shared secret between the mobile app and Railway server.
  Update in both Railway environment variables and Expo environment config.

- [ ] **Review Stripe webhook secret quarterly**
  Stripe Dashboard → Developers → Webhooks → [endpoint] → Signing secret → Reveal.
  Rotate if the server has been compromised or key may have been exposed.

---

## Ongoing Monitoring

| Task | Frequency | Owner |
|------|-----------|-------|
| Review Railway logs | Weekly | Dev |
| Check Supabase auth anomalies | Weekly | Dev |
| Rotate service role key | Every 90 days | Dev |
| Review RLS policies | Monthly | Dev |
| Run `npm audit` on server | Monthly | Dev |
| Penetration test / security review | Annually | External |

---

## Notes

- The Supabase service role key is only used server-side in Railway. It is never
  bundled into the mobile app or committed to any git repository.
- All user data endpoints on the server validate the `X-Elemetric-Key` API key,
  strip null bytes and control characters from all string inputs, and reject
  malformed Authorization headers.
- Rate limiting is enforced globally (20 req/15 min) and per-endpoint
  (/review: 5/min, /visualise: 3/10 min).
