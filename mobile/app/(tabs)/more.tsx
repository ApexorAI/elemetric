import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

type MoreItem = {
  icon: string;
  label: string;
  sub: string;
  route?: string;
  comingSoon?: boolean;
  color?: string;
};

const ITEMS: MoreItem[] = [
  {
    icon: "⚙️",
    label: "Settings",
    sub: "Account, notifications, data",
    route: "/settings",
    color: "#6b7280",
  },
  {
    icon: "❓",
    label: "Help & FAQ",
    sub: "Guides and common questions",
    route: "/help",
    color: "#3b82f6",
  },
  {
    icon: "💬",
    label: "AI Assistant",
    sub: "Ask compliance questions instantly",
    route: "/chatbot",
    color: "#f97316",
  },
  {
    icon: "⚠️",
    label: "Near Miss",
    sub: "Report a problem found on site",
    route: "/near-miss",
    color: "#ef4444",
  },
  {
    icon: "🎁",
    label: "Referral Program",
    sub: "Earn rewards by referring friends",
    route: "/referral",
    color: "#22c55e",
  },
  {
    icon: "📊",
    label: "AI Visualiser",
    sub: "See your compliance analysis visually",
    route: "/(tabs)/visualiser",
    color: "#a78bfa",
  },
  {
    icon: "ℹ️",
    label: "About Elemetric",
    sub: "Version, legal, and licence info",
    route: "/about",
    color: "#60a5fa",
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nearMissCount, setNearMissCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { count } = await supabase
            .from("near_misses")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);
          setNearMissCount(count ?? 0);
        } catch {}
      })();
    }, [])
  );

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: Math.max(52, insets.top + 12) }]}>
        <Text style={s.brand}>ELEMETRIC</Text>
        <Text style={s.title}>More</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.label}
              style={[s.card, item.comingSoon && s.cardDisabled]}
              onPress={() => {
                if (item.comingSoon) return;
                if (item.route) router.push(item.route as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              disabled={item.comingSoon}
            >
              <View style={[s.iconWrap, { backgroundColor: (item.color ?? "#f97316") + "18", borderColor: (item.color ?? "#f97316") + "30" }]}>
                <Text style={s.icon}>{item.icon}</Text>
                {item.label === "Near Miss" && nearMissCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{nearMissCount > 99 ? "99+" : String(nearMissCount)}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.label, item.comingSoon && s.labelDisabled]}>{item.label}</Text>
              <Text style={s.sub} numberOfLines={2}>{item.sub}</Text>
              {item.comingSoon && (
                <View style={s.soonBadge}>
                  <Text style={s.soonText}>SOON</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 28, fontWeight: "900" },

  body: { paddingHorizontal: 16, paddingBottom: 40 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  card: {
    width: "47%",
    backgroundColor: "#0f2035",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
    position: "relative",
  },
  cardDisabled: {
    opacity: 0.6,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    position: "relative",
  },
  icon: { fontSize: 24 },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#07152b",
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "900" },

  label: { color: "white", fontSize: 15, fontWeight: "800" },
  labelDisabled: { color: "rgba(255,255,255,0.55)" },
  sub: { color: "rgba(255,255,255,0.40)", fontSize: 12, lineHeight: 16 },

  soonBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(167,139,250,0.20)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.40)",
  },
  soonText: { color: "#a78bfa", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
});
