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

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications();
    runComplianceAlerts();
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
