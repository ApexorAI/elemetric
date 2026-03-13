import { Redirect } from "expo-router";

// The real home screen lives at app/home.tsx (route: /home).
// This redirect ensures the Home tab always takes the user there.
export default function TabsIndex() {
  return <Redirect href="/home" />;
}
