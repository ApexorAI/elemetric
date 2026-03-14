import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "elemetric_onboarding_seen";

export default function Entry() {
  const router   = useRouter();
  const opacity  = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0.82)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.spring(dotScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    }, 400);

    const timer = setTimeout(async () => {
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(async () => {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        router.replace(seen ? "/login" : "/welcome");
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.screen}>
      <Animated.View style={[s.wrap, { opacity, transform: [{ scale }] }]}>
        <Text style={s.wordmark}>ELEMETRIC</Text>
        <View style={s.taglineRow}>
          <Animated.View style={[s.dot, { transform: [{ scale: dotScale }] }]} />
          <Text style={s.tagline}>Compliance Documentation</Text>
        </View>
      </Animated.View>
      <Animated.Text style={[s.version, { opacity }]}>
        Professional Licence Platform
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07152b",
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    alignItems: "center",
  },
  wordmark: {
    color: "#FF6B00",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 6,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF6B00",
  },
  tagline: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  version: {
    position: "absolute",
    bottom: 48,
    color: "rgba(255,255,255,0.22)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
