import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useOffline } from "@/hooks/use-offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const shown = useRef(false);

  useEffect(() => {
    if (isOffline && !shown.current) {
      shown.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else if (!isOffline && shown.current) {
      shown.current = false;
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isOffline, slideAnim]);

  if (!isOffline && !shown.current) return null;

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="You are offline"
    >
      <Text style={styles.icon}>!</Text>
      <Text style={styles.text}>
        No internet — data saved locally, syncs when reconnected
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1e3a5f",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(249,115,22,0.40)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    justifyContent: "center",
  },
  icon: {
    color: "#f97316",
    fontSize: 14,
    fontWeight: "900",
  },
  text: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
});
