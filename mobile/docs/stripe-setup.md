# Stripe Setup Guide — Elemetric

Step-by-step instructions for creating Stripe Payment Links for all 4 subscription tiers and connecting the webhook to the Railway server.

---

## 1. Create Products in Stripe

Log in to [dashboard.stripe.com](https://dashboard.stripe.com) → **Products** → **Add product**.

Create **4 products** with the following details:

| Product Name | Price | Billing | Description |
|---|---|---|---|
| Elemetric Core | $24.99 AUD | Monthly | Compliance docs for solo tradespeople |
| Elemetric Pro | $39.99 AUD | Monthly | Core + AI analysis |
| Elemetric Employer | $99.00 AUD | Monthly | Up to 5 team members |
| Elemetric Employer Plus | $149.00 AUD | Monthly | Up to 15 team members |

For each product:
- Currency: **AUD**
- Billing period: **Monthly**
- Tax behaviour: **Exclusive** (GST is added on top)

Copy the **Price ID** for each product (format: `price_xxxxxxxxxxxxx`). You'll need these for the Railway environment variables.

---

## 2. Create Payment Links

For each product, go to **Payment Links** → **New payment link**:

1. Select the product you just created
2. Under **After payment**: set redirect to `https://elemetric.com.au/success` (or your landing page URL)
3. Enable **Customer email collection**
4. Enable **Allow promotion codes** (optional)
5. Click **Create link**

Copy each Payment Link URL (format: `https://buy.stripe.com/xxxxxxxxx`).

### Add Payment Links to the App

Open `app/paywall.tsx` and `app/subscription.tsx` and replace the placeholder URLs:

```ts
// app/paywall.tsx
const STRIPE_URLS: Record<string, string> = {
  core:         "https://buy.stripe.com/YOUR_CORE_LINK",
  pro:          "https://buy.stripe.com/YOUR_PRO_LINK",
  employer:     "https://buy.stripe.com/YOUR_EMPLOYER_LINK",
  employerPlus: "https://buy.stripe.com/YOUR_EMPLOYER_PLUS_LINK",
};

// app/subscription.tsx — same STRIPE_URLS object, update identically
```

---

## 3. Set Up the Webhook

### 3a. In Stripe Dashboard

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://YOUR_RAILWAY_APP.up.railway.app/webhook`
3. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**
5. Copy the **Signing secret** (format: `whsec_xxxxxxxxxxxxx`)

### 3b. In Railway

Go to your Railway project → **Variables** and set the following:

```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PRICE_CORE=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_EMPLOYER=price_xxxxxxxxxxxxx
STRIPE_PRICE_EMPLOYER_PLUS=price_xxxxxxxxxxxxx
```

> Use `sk_test_` and `whsec_test_` keys during development, `sk_live_` in production.

---

## 4. Full Railway Environment Variables Reference

These are all the environment variables your Railway server requires:

```
# Core
NODE_ENV=production
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (service role — server-side only, never expose to client)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Elemetric API auth (set this in the app too as EXPO_PUBLIC_ELEMETRIC_API_KEY)
ELEMETRIC_API_KEY=your-secret-api-key

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PRICE_CORE=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_EMPLOYER=price_xxxxxxxxxxxxx
STRIPE_PRICE_EMPLOYER_PLUS=price_xxxxxxxxxxxxx
```

### App `.env` / EAS Secrets

These variables must also be set in the **Expo / EAS** build environment:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_ELEMETRIC_API_KEY=your-secret-api-key
```

Set these in `eas.json` under `env`, or via the EAS dashboard at **expo.dev** → your project → **Secrets**.

---

## 5. Role Mapping (How Subscriptions Map to Roles)

The server maps Stripe Price IDs to user roles in the `profiles` Supabase table:

| Stripe Price | Role |
|---|---|
| `STRIPE_PRICE_CORE` | `core` |
| `STRIPE_PRICE_PRO` | `pro` |
| `STRIPE_PRICE_EMPLOYER` | `employer` |
| `STRIPE_PRICE_EMPLOYER_PLUS` | `employer_plus` |
| Subscription deleted | `free` |

Roles are checked in `app/plumbing/new-job.tsx` before allowing job creation. Free users are limited to 3 jobs.

---

## 6. Testing with Stripe CLI (Development)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhook

# Trigger a test subscription event
stripe trigger customer.subscription.created
```

Use test card `4242 4242 4242 4242` with any future expiry and any CVC on the Payment Link.

---

## 7. Going Live Checklist

- [ ] Switch from `sk_test_` to `sk_live_` keys in Railway
- [ ] Update webhook endpoint to use live signing secret
- [ ] Replace Payment Link URLs in `paywall.tsx` and `subscription.tsx`
- [ ] Verify webhook events arriving in Stripe dashboard under **Developers → Webhooks → Recent deliveries**
- [ ] Test a real purchase end-to-end and confirm `profiles.role` updates in Supabase
