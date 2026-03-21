import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Tools tab — unlocked after first PDF report (Stage 2) ────────────────────

type Tool = {
  icon: string;
  label: string;
  description: string;
  route: string;
  accentColor: string;
};

const TOOLS: Tool[] = [
  {
    icon: "🛡️",
    label: "See When I'm Protected",
    description: "View the 7-year liability window for every job you've completed.",
    route: "/(tabs)/liability-timeline",
    accentColor: "#22c55e",
  },
  {
    icon: "📤",
    label: "Share with Client",
    description: "Give your client read-only access to their property's compliance records.",
    route: "/client-portal",
    accentColor: "#3b82f6",
  },
  {
    icon: "📜",
    label: "Generate Certificate",
    description: "Create a formal Certificate of Compliance for client handover.",
    route: "/plumbing/ai-review",
    accentColor: "#f97316",
  },
];

export default function ToolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.body, { paddingTop: Math.max(52, insets.top + 12) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.wordmark}>ELEMETRIC</Text>
      <Text style={s.title}>Tools</Text>
      <Text style={s.subtitle}>Everything you need on the job</Text>

      <View style={s.toolList}>
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.route}
            style={s.toolCard}
            onPress={() => router.push(tool.route as any)}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
          >
            <View style={[s.toolIconWrap, { backgroundColor: tool.accentColor + "15", borderColor: tool.accentColor + "35" }]}>
              <Text style={s.toolIcon}>{tool.icon}</Text>
            </View>
            <View style={s.toolText}>
              <Text style={s.toolLabel}>{tool.label}</Text>
              <Text style={s.toolDesc}>{tool.description}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* AI Visualiser */}
      <Pressable
        style={s.toolCard}
        onPress={() => router.push("/(tabs)/visualiser" as any)}
        accessibilityRole="button"
        accessibilityLabel="AI Visualiser"
      >
        <View style={[s.toolIconWrap, { backgroundColor: "#a78bfa15", borderColor: "#a78bfa35" }]}>
          <Text style={s.toolIcon}>🤖</Text>
        </View>
        <View style={s.toolText}>
          <Text style={s.toolLabel}>AI Visualiser</Text>
          <Text style={s.toolDesc}>Upload photos of pre-existing work for instant AI analysis and documentation.</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>

      <View style={s.moreCard}>
        <Text style={s.moreTitle}>More tools coming soon</Text>
        <Text style={s.moreBody}>
          Invoice generator, timesheet tracking, and referral rewards are available from your Profile.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  body: { padding: 20, paddingTop: 52, paddingBottom: 60, gap: 16 },

  wordmark: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 3 },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "rgba(255,255,255,0.50)", fontSize: 14, marginTop: 2 },

  toolList: { gap: 12, marginTop: 4 },

  toolCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  toolIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toolIcon: { fontSize: 26 },
  toolText: { flex: 1 },
  toolLabel: { color: "#ffffff", fontSize: 15, fontWeight: "700", lineHeight: 20 },
  toolDesc: { color: "rgba(255,255,255,0.50)", fontSize: 13, marginTop: 3, lineHeight: 18 },
  chevron: { color: "rgba(255,255,255,0.25)", fontSize: 22, fontWeight: "300" },

  moreCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
  },
  moreTitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },
  moreBody: { color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 18 },
});
