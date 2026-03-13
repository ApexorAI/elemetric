import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

// ── Trade / job-type data ─────────────────────────────────────────────────────

type JobType = {
  label: string;
  description: string;
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
        description: "Installation & compliance — AS/NZS 3500",
        params: {},
      },
      {
        label: "Gas Rough-In",
        description: "Gas fitting documentation — AS/NZS 5601",
        params: { type: "gas" },
      },
      {
        label: "Drainage",
        description: "Drainage & sanitary — AS/NZS 3500",
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
        label: "General Electrical Documentation",
        description: "Wiring & installation — AS/NZS 3000",
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
        label: "General HVAC Documentation",
        description: "Mechanical services — AS/NZS 1668",
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
        label: "General Carpentry Documentation",
        description: "Structural & finishing documentation",
        params: { type: "carpentry" },
      },
    ],
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TradeScreen() {
  const router = useRouter();
  const [selectedTrade, setSelectedTrade] = useState<string>("plumber");

  const trade = TRADES.find((t) => t.id === selectedTrade)!;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>New Job</Text>
        <Text style={styles.subtitle}>Select your trade, then choose a job type</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Primary Trade Selector ── */}
        <Text style={styles.sectionLabel}>PRIMARY TRADE</Text>
        <View style={styles.tradeRow}>
          {TRADES.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.tradeChip, selectedTrade === t.id && styles.tradeChipActive]}
              onPress={() => setSelectedTrade(t.id)}
            >
              <Text style={styles.tradeChipIcon}>{t.icon}</Text>
              <Text style={[styles.tradeChipLabel, selectedTrade === t.id && styles.tradeChipLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Job Types for selected trade ── */}
        <Text style={styles.sectionLabel}>JOB TYPE</Text>
        <View style={styles.jobTypeGroup}>
          {trade.jobTypes.map((job, idx) => (
            <React.Fragment key={job.label}>
              {idx > 0 && <View style={styles.divider} />}
              <Pressable
                style={styles.jobTypeRow}
                onPress={() =>
                  router.push({
                    pathname: "/plumbing/new-job",
                    params: job.params ?? {},
                  })
                }
              >
                <View style={styles.jobTypeLeft}>
                  <View style={styles.jobTypeDot} />
                  <View>
                    <Text style={styles.jobTypeLabel}>{job.label}</Text>
                    <Text style={styles.jobTypeDesc}>{job.description}</Text>
                  </View>
                </View>
                <View style={styles.jobTypeArrow}>
                  <Text style={styles.jobTypeArrowText}>›</Text>
                </View>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.5)", fontSize: 13 },

  body: { paddingHorizontal: 18, paddingBottom: 60 },

  sectionLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Trade chips
  tradeRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  tradeChip: {
    flex: 1,
    minWidth: "40%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  tradeChipActive: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderColor: "#f97316",
  },
  tradeChipIcon: { fontSize: 24 },
  tradeChipLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
  },
  tradeChipLabelActive: {
    color: "#f97316",
  },

  // Job type list
  jobTypeGroup: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 16,
  },
  jobTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  jobTypeLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  jobTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f97316",
  },
  jobTypeLabel: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  jobTypeDesc: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginTop: 2,
  },
  jobTypeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(249,115,22,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  jobTypeArrowText: {
    color: "#f97316",
    fontSize: 22,
    fontWeight: "300",
    marginTop: -1,
  },

  back: { marginTop: 32, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
