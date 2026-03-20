import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
