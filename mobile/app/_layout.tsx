import { useEffect } from "react";
import { Stack } from "expo-router";
import { registerForPushNotifications } from "@/lib/notifications";

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />
  );
}