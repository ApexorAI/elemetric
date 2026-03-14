import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

type JobType = {
  label: string;
  description: string;
  pathname?: string;
  params?: Record<string, string>;
};

type Trade = {
  id: string;
  label: string;
  icon: string;
  jobTypes: JobType[];
};

const TRADES: Trade[] = [
  {
    id: "plumber",
    label: "Plumber",
    icon: "🔧",
    jobTypes: [
      {
        label: "Hot Water System",
        description: "AS/NZS 3500 compliance",
        params: {},
      },
      {
        label: "Gas Rough-In",
        description: "AS/NZS 5601 gas fitting",
        params: { type: "gas" },
      },
      {
        label: "Drainage",
        description: "AS/NZS 3500 drainage & sanitary",
        params: { type: "drainage" },
      },
      {
        label: "New Installation",
        description: "Full new install compliance package",
        params: { type: "newinstall" },
      },
    ],
  },
  {
    id: "electrician",
    label: "Electrician",
    icon: "⚡",
    jobTypes: [
      {
        label: "Electrical Documentation",
        description: "AS/NZS 3000 wiring rules",
        params: { type: "electrical" },
      },
    ],
  },
  {
    id: "hvac",
    label: "HVAC",
    icon: "❄️",
    jobTypes: [
      {
        label: "HVAC Documentation",
        description: "AS/NZS 1668 mechanical services",
        params: { type: "hvac" },
      },
    ],
  },
  {
    id: "carpenter",
    label: "Carpenter",
    icon: "🪚",
    jobTypes: [
      {
        label: "Carpentry Documentation",
        description: "AS 1684 residential timber framing",
        params: { type: "carpentry" },
      },
    ],
  },
];

export default function TradeScreen() {
  const router = useRouter();
  const [selectedTrade, setSelectedTrade] = useState<string>("plumber");

  const trade = TRADES.find((t) => t.id === selectedTrade)!;

  const navigate = (job: JobType) => {
    router.push({
      pathname: (job.pathname ?? "/plumbing/new-job") as never,
      params: job.params ?? {},
    });
  };

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.brand}>ELEMETRIC</Text>
        <Text style={s.title}>New Job</Text>
        <Text style={s.subtitle}>Select trade, then job type</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Trade selector */}
        <Text style={s.sectionLabel}>TRADE</Text>
        <View style={s.tradeList}>
          {TRADES.map((t) => (
            <Pressable
              key={t.id}
              style={[s.tradeRow, selectedTrade === t.id && s.tradeRowActive]}
              onPress={() => setSelectedTrade(t.id)}
            >
              <Text style={s.tradeIcon}>{t.icon}</Text>
              <Text style={[s.tradeName, selectedTrade === t.id && s.tradeNameActive]}>
                {t.label}
              </Text>
              {selectedTrade === t.id && (
                <Text style={s.tradeCheck}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Job types */}
        <Text style={s.sectionLabel}>JOB TYPE</Text>
        <View style={s.jobList}>
          {trade.jobTypes.map((job, idx) => (
            <React.Fragment key={job.label}>
              {idx > 0 && <View style={s.divider} />}
              <Pressable style={s.jobRow} onPress={() => navigate(job)}>
                <View style={s.jobDot} />
                <View style={s.jobInfo}>
                  <Text style={s.jobLabel}>{job.label}</Text>
                  <Text style={s.jobDesc}>{job.description}</Text>
                </View>
                <Text style={s.jobChevron}>›</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { paddingHorizontal: 20, paddingBottom: 60 },

  sectionLabel: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },

  // Trade list
  tradeList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  tradeRowActive: {
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  tradeIcon: { fontSize: 22, width: 28, textAlign: "center" },
  tradeName: {
    flex: 1,
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    fontWeight: "700",
  },
  tradeNameActive: { color: "white" },
  tradeCheck: { color: "#f97316", fontSize: 16, fontWeight: "900" },

  // Job type list
  jobList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 16,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  jobDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f97316",
    flexShrink: 0,
  },
  jobInfo: { flex: 1 },
  jobLabel: { color: "white", fontSize: 15, fontWeight: "700" },
  jobDesc: { color: "rgba(255,255,255,0.40)", fontSize: 13, marginTop: 2 },
  jobChevron: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 26,
    fontWeight: "300",
    marginTop: -2,
  },

  back: { marginTop: 32, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 15 },
});
