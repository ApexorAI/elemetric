import { Resend } from "resend";

// Requires EXPO_PUBLIC_RESEND_API_KEY in your .env file.
// For production, consider moving email sends to a server-side function
// so the API key is not bundled in the app binary.
const resend = new Resend(process.env.EXPO_PUBLIC_RESEND_API_KEY);

const FROM = "Elemetric <noreply@elemetric.com.au>";

const baseHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07152b;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07152b;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:24px 32px 0;">
          <div style="font-size:28px;font-weight:900;color:#f97316;letter-spacing:3px;">ELEMETRIC</div>
        </td></tr>
        <tr><td style="background:#f97316;height:4px;margin-top:8px;"></td></tr>
        <tr><td style="background:#0d1f3c;padding:32px;border-radius:0 0 16px 16px;">
          ${content}
        </td></tr>
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="color:rgba(255,255,255,0.30);font-size:12px;margin:0;line-height:1.8;">
            Elemetric Pty Ltd &bull; ABN 19 377 661 368 &bull; Australia<br>
            <a href="https://elemetric.com.au" style="color:#f97316;text-decoration:none;">elemetric.com.au</a>
            &bull; <a href="https://elemetric.com.au/privacy" style="color:rgba(255,255,255,0.40);text-decoration:none;">Privacy Policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

export async function sendWelcomeEmail(to: string, name: string) {
  const html = baseHtml(`
    <h1 style="color:white;font-size:24px;font-weight:900;margin:0 0 16px;">Welcome to Elemetric, ${name}!</h1>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 16px;">
      You're all set to generate professional compliance reports on-site in under 5 minutes.
    </p>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 16px;">Here's what you can do with Elemetric:</p>
    <ul style="color:rgba(255,255,255,0.75);font-size:15px;line-height:2.2;padding-left:20px;margin:0 0 28px;">
      <li>Complete on-site compliance checklists for 9 job types</li>
      <li>Run AI analysis against AS/NZS standards (3500, 5601, 3000, 1668)</li>
      <li>Generate and share branded PDF compliance reports</li>
      <li>Sign reports digitally with your installer signature</li>
      <li>Track your compliance score over time</li>
    </ul>
    <a href="https://elemetric.com.au" style="display:inline-block;background:#f97316;color:#07152b;font-weight:900;font-size:16px;padding:14px 28px;border-radius:12px;text-decoration:none;">
      Open Elemetric →
    </a>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to Elemetric",
    html,
  });
}

export async function sendJobCompletedEmail(
  to: string,
  name: string,
  jobName: string,
  jobAddr: string,
  confidence: number,
) {
  const confColor = confidence >= 80 ? "#22c55e" : confidence >= 50 ? "#f97316" : "#ef4444";
  const confLabel = confidence >= 80 ? "LOW RISK" : confidence >= 50 ? "MEDIUM RISK" : "HIGH RISK";

  const html = baseHtml(`
    <h1 style="color:white;font-size:24px;font-weight:900;margin:0 0 8px;">Job Report Ready</h1>
    <p style="color:rgba(255,255,255,0.55);font-size:14px;margin:0 0 24px;">Hi ${name}, your compliance report has been saved.</p>

    <div style="background:#07152b;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.10);">
      <div style="margin-bottom:14px;">
        <div style="color:rgba(255,255,255,0.40);font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:4px;">JOB NAME</div>
        <div style="color:white;font-size:17px;font-weight:800;">${jobName}</div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="color:rgba(255,255,255,0.40);font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:4px;">ADDRESS</div>
        <div style="color:rgba(255,255,255,0.80);font-size:15px;">${jobAddr}</div>
      </div>
      <div>
        <div style="color:rgba(255,255,255,0.40);font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:8px;">AI CONFIDENCE SCORE</div>
        <div style="display:inline-block;background:${confColor}22;border:1px solid ${confColor}55;border-radius:8px;padding:8px 16px;">
          <span style="color:${confColor};font-size:22px;font-weight:900;">${confidence}%</span>
          <span style="color:${confColor};font-size:11px;font-weight:800;margin-left:10px;">${confLabel}</span>
        </div>
      </div>
    </div>

    <p style="color:rgba(255,255,255,0.55);font-size:13px;line-height:1.6;margin:0 0 8px;">
      Open the Elemetric app to view the full AI analysis, share the PDF report, or add your signature.
    </p>
    <p style="color:rgba(255,255,255,0.30);font-size:11px;line-height:1.6;margin:0;">
      This is an automated summary. Final compliance responsibility remains with the licensed tradesperson.
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Job Report: ${jobName}`,
    html,
  });
}

export async function sendReferralEmail(to: string, referrerName: string, referralCode: string) {
  const link = `https://elemetric.com.au/ref/${referralCode}`;
  const html = baseHtml(`
    <h1 style="color:white;font-size:22px;font-weight:900;margin:0 0 12px;">You've been invited to Elemetric</h1>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${referrerName} invited you to try Elemetric — the compliance reporting app built for licensed Australian tradespeople.
    </p>
    <a href="${link}" style="display:inline-block;background:#f97316;color:#07152B;font-weight:900;font-size:16px;padding:16px 32px;border-radius:12px;text-decoration:none;">
      Sign Up Free →
    </a>
  `);
  return resend.emails.send({ from: FROM, to, subject: `${referrerName} invited you to Elemetric`, html });
}

export async function sendInvoiceEmail(
  to: string,
  clientName: string,
  invoiceNumber: string,
  total: number,
  dueDate: string
) {
  const html = baseHtml(`
    <h1 style="color:white;font-size:22px;font-weight:900;margin:0 0 12px;">Invoice from Elemetric</h1>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 16px;">
      Hi ${clientName}, please find your invoice details below.
    </p>
    <div style="background:#07152b;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.10);">
      <div style="margin-bottom:12px;">
        <div style="color:rgba(255,255,255,0.40);font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:4px;">INVOICE NUMBER</div>
        <div style="color:white;font-size:16px;font-weight:800;">${invoiceNumber}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="color:rgba(255,255,255,0.40);font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:4px;">AMOUNT DUE</div>
        <div style="color:#f97316;font-size:28px;font-weight:900;">$${total.toFixed(2)}</div>
      </div>
      <div>
        <div style="color:rgba(255,255,255,0.40);font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:4px;">DUE DATE</div>
        <div style="color:rgba(255,255,255,0.80);font-size:15px;">${dueDate}</div>
      </div>
    </div>
    <p style="color:rgba(255,255,255,0.40);font-size:12px;margin:0;line-height:1.6;">
      Please contact your tradesperson if you have any questions about this invoice.
    </p>
  `);
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Invoice ${invoiceNumber} — $${total.toFixed(2)} due ${dueDate}`,
    html,
  });
}

export async function sendClientPortalCode(to: string, code: string, address: string) {
  const html = baseHtml(`
    <h1 style="color:white;font-size:22px;font-weight:900;margin:0 0 12px;">Your verification code</h1>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 24px;">
      Use this code to access compliance records for:<br>
      <strong style="color:white;">${address}</strong>
    </p>
    <div style="background:#07152B;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;border:1px solid rgba(249,115,22,0.30);">
      <div style="font-size:48px;font-weight:900;color:#f97316;letter-spacing:8px;">${code}</div>
    </div>
    <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0;">
      This code expires in 10 minutes. If you didn't request this, ignore this email.
    </p>
  `);
  return resend.emails.send({ from: FROM, to, subject: "Your Elemetric verification code", html });
}

export async function sendPasswordResetEmail(to: string) {
  const html = baseHtml(`
    <h1 style="color:white;font-size:24px;font-weight:900;margin:0 0 16px;">Reset Your Password</h1>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 16px;">
      We received a request to reset the password for your Elemetric account.
    </p>
    <p style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.6;margin:0 0 24px;">
      Use the reset link sent to this address to set a new password. The link expires in 24 hours.
    </p>
    <p style="color:rgba(255,255,255,0.40);font-size:13px;line-height:1.6;margin:0;">
      If you didn't request a password reset, you can safely ignore this email. Your account remains secure.
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Elemetric password",
    html,
  });
}
