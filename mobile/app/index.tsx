import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

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

    // Capture session via onAuthStateChange INITIAL_SESSION — fires reliably after
    // Supabase finishes reading from AsyncStorage (avoids timing race with getSession)
    type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];
    const sessionRef: { value: Session | undefined; resolved: boolean } = { value: undefined, resolved: false };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        sessionRef.value = session;
        sessionRef.resolved = true;
        console.log("[Auth] INITIAL_SESSION →", session ? `session found (user: ${session.user.id})` : "no session");
      }
    });

    const navigate = async (session: Session) => {
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!seen) {
        router.replace("/welcome");
        return;
      }
      if (session) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_complete")
            .eq("user_id", session.user.id)
            .single();
          if (!profile?.onboarding_complete) {
            router.replace("/onboarding");
            return;
          }
        } catch {
          // Profile fetch failed — go home, login guard will catch real auth issues
        }
        console.log("[Auth] Session valid → navigating to /home");
        router.replace("/home");
      } else {
        console.log("[Auth] No session → navigating to /login");
        router.replace("/login");
      }
    };

    const timer = setTimeout(async () => {
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(async () => {
        // If INITIAL_SESSION has fired, use that session
        if (sessionRef.resolved) {
          await navigate(sessionRef.value ?? null);
          return;
        }
        // INITIAL_SESSION hasn't fired yet — fall back to getSession()
        console.log("[Auth] INITIAL_SESSION not yet fired — falling back to getSession()");
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) console.warn("[Auth] getSession error:", error.message);
          console.log("[Auth] getSession() →", session ? `session found (user: ${session.user.id})` : "no session");
          await navigate(session);
        } catch (e) {
          console.error("[Auth] getSession failed:", e);
          const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
          router.replace(!seen ? "/welcome" : "/login");
        }
      });
    }, 1500);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
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
