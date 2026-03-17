// ── Email via Railway server ───────────────────────────────────────────────────
// The mobile app never calls Resend directly — the API key must NOT be bundled
// in the app binary. All email is sent by POSTing to the Railway backend, which
// holds the Resend credentials server-side.
//
// Railway base: https://elemetric-ai-production.up.railway.app
//
// Existing endpoints:  POST /send-welcome
//                      POST /send-job-complete
//                      POST /send-team-invite
// Added endpoints:     POST /send-referral
//                      POST /send-invoice
//                      POST /send-client-code
//                      POST /send-password-reset
//
// Each endpoint accepts JSON and returns { ok: true } or { error: string }.

const RAILWAY = "https://elemetric-ai-production.up.railway.app";
const API_KEY  = process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "";

/**
 * Internal helper — POST to a Railway email endpoint.
 * Throws on network failure; silently swallows 4xx/5xx so a broken
 * email send never crashes the app.
 */
async function post(endpoint: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${RAILWAY}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Elemetric-Key": API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Network error — silent. Email is best-effort.
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Welcome email after signup. Matches POST /send-welcome */
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await post("/send-welcome", { to, name });
}

/** Job-complete summary email. Matches POST /send-job-complete */
export async function sendJobCompletedEmail(
  to: string,
  name: string,
  jobName: string,
  jobAddr: string,
  confidence: number,
): Promise<void> {
  await post("/send-job-complete", { to, name, jobName, jobAddr, confidence });
}

/** Team invitation email. Matches POST /send-team-invite */
export async function sendTeamInviteEmail(
  to: string,
  inviterName: string,
  teamName: string,
): Promise<void> {
  await post("/send-team-invite", { to, inviterName, teamName });
}

/** Referral invitation email. Matches POST /send-referral */
export async function sendReferralEmail(
  to: string,
  referrerName: string,
  referralCode: string,
): Promise<void> {
  await post("/send-referral", { to, referrerName, referralCode });
}

/** Invoice email to client. Matches POST /send-invoice */
export async function sendInvoiceEmail(
  to: string,
  clientName: string,
  invoiceNumber: string,
  total: number,
  dueDate: string,
): Promise<void> {
  await post("/send-invoice", { to, clientName, invoiceNumber, total, dueDate });
}

/** 6-digit verification code for the Client Portal. Matches POST /send-client-code */
export async function sendClientPortalCode(
  to: string,
  code: string,
  address: string,
): Promise<void> {
  await post("/send-client-code", { to, code, address });
}

/** Password-reset notification (supplementary — Supabase sends the actual link).
 *  Matches POST /send-password-reset */
export async function sendPasswordResetEmail(to: string): Promise<void> {
  await post("/send-password-reset", { to });
}
