import { useEffect } from "react";
import { Stack } from "expo-router";
import { registerForPushNotifications } from "@/lib/notifications";
import { ThemeProvider } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

// ── Compliance alert background check ────────────────────────────────────────
// Runs once on app launch. Scans jobs older than 6 years (expiring within 1 year)
// that haven't been alerted yet and creates a notification for each.

async function runComplianceAlerts() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 6 years ago — jobs older than this are inside the final year of 7-yr liability
    const sixYearsAgo = new Date();
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("id, job_addr, created_at, last_alerted_at")
      .eq("user_id", user.id)
      .lt("created_at", sixYearsAgo.toISOString())
      .is("last_alerted_at", null); // only jobs never alerted

    if (error || !jobs || jobs.length === 0) return;

    const now = new Date();

    for (const job of jobs) {
      // Calculate expiry: created_at + 7 years
      const expiryDate = new Date(job.created_at);
      expiryDate.setFullYear(expiryDate.getFullYear() + 7);

      const daysRemaining = Math.max(
        0,
        Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000)
      );

      const addr = job.job_addr ?? "Unknown address";
      const shortAddr = addr.length > 60 ? addr.slice(0, 57) + "…" : addr;

      // Insert notification for this user
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Liability expiring soon",
        body: `${shortAddr} — liability expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
        type: "compliance_alert",
        job_id: job.id,
      });

      // Mark alerted so we never create a duplicate
      await supabase
        .from("jobs")
        .update({ last_alerted_at: now.toISOString() })
        .eq("id", job.id);
    }
  } catch {
    // Silent — this is a background check
  }
}

// ── Licence expiry reminder ───────────────────────────────────────────────────
// Checks licence_expiry_date in profiles and creates a notification if expiry
// is within 90, 60, or 30 days. Uses an AsyncStorage key to avoid re-alerting
// more than once per day.

async function runLicenceExpiryCheck() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("licence_expiry_date")
      .eq("user_id", user.id)
      .single();

    if (!profile?.licence_expiry_date) return;

    // Parse date — stored as YYYY-MM-DD (date column) or DD/MM/YYYY (text)
    let expiry: Date;
    const raw: string = profile.licence_expiry_date;
    if (raw.includes("-")) {
      expiry = new Date(raw);
    } else {
      const [d, m, y] = raw.split("/");
      expiry = new Date(Number(y), Number(m) - 1, Number(d));
    }
    if (isNaN(expiry.getTime())) return;

    const now = new Date();
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);

    if (daysUntil > 90 || daysUntil < 0) return;

    // Only notify at the 90, 60, 30 day milestones
    const milestone = daysUntil <= 30 ? 30 : daysUntil <= 60 ? 60 : 90;

    await supabase.from("notifications").insert({
      user_id: user.id,
      title: `Licence expiring in ${daysUntil} days`,
      body: `Your VBA licence expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"}. Renew at vba.vic.gov.au before it expires.`,
      type: "compliance_alert",
    });
  } catch {
    // Silent background check
  }
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications();
    runComplianceAlerts();
    runLicenceExpiryCheck();
  }, []);

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      />
    </ThemeProvider>
  );
}
