import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions on device, fetch Expo push token,
 * and persist it to profiles.push_token in Supabase.
 * Returns the token string, or null if unavailable/denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications don't work on simulators
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Elemetric",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      undefined;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

    // Persist token to Supabase (best-effort)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .upsert({ user_id: user.id, push_token: token }, { onConflict: "user_id" });
      }
    } catch {}

    return token;
  } catch {
    return null;
  }
}

/**
 * Send an Expo push notification to a specific device push token.
 * Uses the Expo push HTTP API — no server required.
 * Best-effort: silently swallows errors.
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string
): Promise<void> {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: "default",
        title,
        body,
      }),
    });
  } catch {}
}

/**
 * Send a push notification to a specific user by fetching their push_token from Supabase.
 * Use this from anywhere in the app when you need to notify another user.
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token, notification_preferences")
      .eq("user_id", userId)
      .single();

    if (!profile?.push_token) return;

    // Check preferences
    const prefs = (profile.notification_preferences as Record<string, boolean>) ?? {};
    const type = data?.type as string | undefined;
    if (type && prefs[type] === false) return; // user opted out

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: profile.push_token,
        sound: "default",
        title,
        body,
        data: data ?? {},
      }),
    });
  } catch {}
}

/**
 * Fire an immediate local notification.
 */
export async function sendLocalNotification(
  title: string,
  body: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // fire immediately
    });
  } catch {}
}

// ── Notification content templates ────────────────────────────────────────────

/**
 * Notify a subcontractor that they have been assigned a new job.
 */
export async function notifyJobAssigned(
  userId: string,
  jobName: string,
  jobAddr: string
): Promise<void> {
  await sendNotificationToUser(
    userId,
    "New Job Assigned",
    `You've been assigned "${jobName}" at ${jobAddr}. Tap to open your job details.`,
    { type: "job_assigned" }
  );
}

/**
 * Alert a tradesperson that a compliance item requires attention before the 7-year period expires.
 */
export async function notifyComplianceAlert(
  userId: string,
  jobName: string,
  daysUntilExpiry: number
): Promise<void> {
  await sendNotificationToUser(
    userId,
    "Compliance Record Expiring Soon",
    `Your 7-year liability record for "${jobName}" expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}. Export a backup now.`,
    { type: "compliance_alert" }
  );
}

/**
 * Remind a user their free trial is expiring soon.
 */
export async function notifyTrialExpiring(
  userId: string,
  daysLeft: number
): Promise<void> {
  const urgent = daysLeft <= 1;
  await sendNotificationToUser(
    userId,
    urgent ? "Your Free Trial Ends Today" : `${daysLeft} Days Left in Your Free Trial`,
    urgent
      ? "Upgrade to Elemetric Pro to keep generating compliance reports and protecting your licence."
      : `After ${daysLeft} day${daysLeft !== 1 ? "s" : ""}, job reports will be locked. Upgrade to Pro for unlimited access.`,
    { type: "trial_expiring" }
  );
}

/**
 * Send a compliance tip to nudge good documentation habits.
 */
export async function notifyComplianceTip(userId: string): Promise<void> {
  const tips = [
    "Tip: Photograph your PTR valve and tempering valve settings on every hot water job — BPC auditors check these first.",
    "Tip: Record trench depth before backfilling. A quick photo proves AS/NZS 3500.4:2025 Cl. 4.10 compliance.",
    "Tip: Your 7-year liability clock starts from the date of work — keep photos dated and geotagged.",
    "Tip: Gas compliance certificates must be issued before the appliance is operated. Photograph the certificate on site.",
    "Tip: Always photograph the RCD test result on the breaker — it's evidence AS/NZS 3000:2018 Cl. 2.6 was met.",
  ];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  await sendNotificationToUser(userId, "Elemetric Compliance Tip", tip, { type: "tip" });
}

/**
 * Celebrate a job milestone (e.g. 10th job, 50th job).
 */
export async function notifyMilestone(
  userId: string,
  jobCount: number
): Promise<void> {
  await sendNotificationToUser(
    userId,
    `${jobCount} Jobs Documented`,
    `You've completed ${jobCount} compliance-documented jobs in Elemetric. Your 7-year liability record is growing — keep it up.`,
    { type: "milestone" }
  );
}
