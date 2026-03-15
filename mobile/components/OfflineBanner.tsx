import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOffline } from "@/hooks/use-offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityLabel="You are offline">
      <Text style={styles.text}>
        📡 No internet connection — Saved locally, will sync when connected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#1e3a5f",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(249,115,22,0.35)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  text: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
