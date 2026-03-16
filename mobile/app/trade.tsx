import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_KEY = "elemetric_recent_trade";

type JobType = {
  label: string;
  description: string;
  standard: string;
  pathname?: string;
  params?: Record<string, string>;
};

type Trade = {
  id: string;
  label: string;
  icon: string;
  color: string;
  jobTypes: JobType[];
};

const TRADES: Trade[] = [
  {
    id: "plumber",
    label: "Plumber",
    icon: "🔧",
    color: "#60a5fa",
    jobTypes: [
      { label: "Hot Water System",   description: "Tempering valve, PTR, compliance plate", standard: "AS/NZS 3500",   params: {} },
      { label: "Gas Rough-In",       description: "Pressure test, isolation, certificates",  standard: "AS/NZS 5601",   params: { type: "gas" } },
      { label: "Drainage",           description: "Grade, CCTV, test method, results",       standard: "AS/NZS 3500.2", params: { type: "drainage" } },
      { label: "New Installation",   description: "Full new install compliance package",      standard: "AS/NZS 3500",   params: { type: "newinstall" } },
      { label: "Wood Heater",        description: "Clearances, flue, hearth compliance",     standard: "AS/NZS 2918",   params: { type: "woodheater" } },
      { label: "Gas Heater",         description: "Gas appliance installation check",         standard: "AS/NZS 5601.1", params: { type: "gasheater" } },
    ],
  },
  {
    id: "electrician",
    label: "Electrician",
    icon: "⚡",
    color: "#fbbf24",
    jobTypes: [
      { label: "Electrical Documentation", description: "RCD, insulation, earth loop, switchboard", standard: "AS/NZS 3000", params: { type: "electrical" } },
    ],
  },
  {
    id: "hvac",
    label: "HVAC",
    icon: "❄️",
    color: "#a78bfa",
    jobTypes: [
      { label: "HVAC Documentation", description: "Mechanical services commissioning", standard: "AS/NZS 1668", params: { type: "hvac" } },
    ],
  },
  {
    id: "carpenter",
    label: "Carpenter",
    icon: "🪚",
    color: "#f97316",
    jobTypes: [
      { label: "Carpentry Documentation", description: "Timber framing, fixings, bracing", standard: "AS 1684", params: { type: "carpentry" } },
    ],
  },
];

export default function TradeScreen() {
  const router = useRouter();
  const [selectedTrade, setSelectedTrade] = useState<string>("plumber");
  const [search, setSearch] = useState("");
  const [recentTradeId, setRecentTradeId] = useState<string | null>(null);
  const [recentJobLabel, setRecentJobLabel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(RECENT_KEY).then((val) => {
        if (val) {
          try {
            const parsed = JSON.parse(val);
            setRecentTradeId(parsed.tradeId ?? null);
            setRecentJobLabel(parsed.jobLabel ?? null);
          } catch {}
        }
      });
    }, [])
  );

  const trade = TRADES.find((t) => t.id === selectedTrade)!;

  const filteredJobTypes = trade.jobTypes.filter((j) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return j.label.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) || j.standard.toLowerCase().includes(q);
  });

  const allJobTypesFlat = search.trim()
    ? TRADES.flatMap((t) =>
        t.jobTypes
          .filter((j) => {
            const q = search.toLowerCase();
            return j.label.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) || j.standard.toLowerCase().includes(q);
          })
          .map((j) => ({ ...j, tradeLabel: t.label, tradeIcon: t.icon, tradeId: t.id }))
      )
    : null;

  const navigate = async (job: JobType, tradeId: string) => {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify({ tradeId, jobLabel: job.label }));
    router.push({
      pathname: (job.pathname ?? "/plumbing/new-job") as never,
      params: job.params ?? {},
    });
  };

  const recentTrade = TRADES.find((t) => t.id === recentTradeId);
  const recentJob = recentTrade?.jobTypes.find((j) => j.label === recentJobLabel);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.brand}>ELEMETRIC</Text>
        <Text style={s.title}>New Job</Text>
        <Text style={s.subtitle}>Select trade, then job type</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search job types…"
          placeholderTextColor="rgba(255,255,255,0.30)"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Recently used */}
        {!search.trim() && recentTrade && recentJob && (
          <>
            <Text style={s.sectionLabel}>RECENTLY USED</Text>
            <Pressable
              style={s.recentCard}
              onPress={() => navigate(recentJob, recentTrade.id)}
            >
              <View style={[s.recentIconWrap, { backgroundColor: recentTrade.color + "20", borderColor: recentTrade.color + "40" }]}>
                <Text style={s.recentIcon}>{recentTrade.icon}</Text>
              </View>
              <View style={s.recentInfo}>
                <Text style={s.recentLabel}>{recentJob.label}</Text>
                <Text style={s.recentMeta}>{recentTrade.label} · {recentJob.standard}</Text>
              </View>
              <Text style={s.recentChevron}>›</Text>
            </Pressable>
          </>
        )}

        {/* Search results across all trades */}
        {allJobTypesFlat !== null ? (
          <>
            <Text style={s.sectionLabel}>{allJobTypesFlat.length} RESULT{allJobTypesFlat.length !== 1 ? "S" : ""}</Text>
            {allJobTypesFlat.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No job types match "{search}"</Text>
              </View>
            ) : (
              <View style={s.jobList}>
                {allJobTypesFlat.map((job, idx) => (
                  <React.Fragment key={`${job.tradeId}-${job.label}`}>
                    {idx > 0 && <View style={s.divider} />}
                    <Pressable style={s.jobRow} onPress={() => navigate(job, job.tradeId)}>
                      <Text style={s.jobTypeTradeIcon}>{job.tradeIcon}</Text>
                      <View style={s.jobInfo}>
                        <Text style={s.jobLabel}>{job.label}</Text>
                        <Text style={s.jobDesc}>{job.tradeLabel} · {job.standard}</Text>
                      </View>
                      <Text style={s.jobChevron}>›</Text>
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Trade cards */}
            <Text style={s.sectionLabel}>TRADE</Text>
            <View style={s.tradeGrid}>
              {TRADES.map((t) => (
                <Pressable
                  key={t.id}
                  style={[
                    s.tradeCard,
                    selectedTrade === t.id && { borderColor: t.color + "60", backgroundColor: t.color + "14" },
                  ]}
                  onPress={() => setSelectedTrade(t.id)}
                >
                  <Text style={s.tradeCardIcon}>{t.icon}</Text>
                  <Text style={[s.tradeCardLabel, selectedTrade === t.id && { color: "white" }]}>{t.label}</Text>
                  <View style={[s.tradeCardBadge, selectedTrade === t.id && { backgroundColor: t.color + "30", borderColor: t.color + "55" }]}>
                    <Text style={[s.tradeCardBadgeText, selectedTrade === t.id && { color: t.color }]}>
                      {t.jobTypes.length} type{t.jobTypes.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  {selectedTrade === t.id && (
                    <View style={[s.tradeCardCheck, { backgroundColor: t.color }]}>
                      <Text style={s.tradeCardCheckText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Job types for selected trade */}
            <Text style={s.sectionLabel}>JOB TYPE — {trade.label.toUpperCase()}</Text>
            <View style={s.jobList}>
              {filteredJobTypes.map((job, idx) => (
                <React.Fragment key={job.label}>
                  {idx > 0 && <View style={s.divider} />}
                  <Pressable style={s.jobRow} onPress={() => navigate(job, trade.id)}>
                    <View style={[s.jobDot, { backgroundColor: trade.color }]} />
                    <View style={s.jobInfo}>
                      <Text style={s.jobLabel}>{job.label}</Text>
                      <Text style={s.jobDesc}>{job.description}</Text>
                      <Text style={s.jobStandard}>{job.standard}</Text>
                    </View>
                    <Text style={s.jobChevron}>›</Text>
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  searchInput: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  body: { paddingHorizontal: 20, paddingBottom: 60 },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
    textTransform: "uppercase",
  },

  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    padding: 16,
  },
  recentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recentIcon: { fontSize: 22 },
  recentInfo: { flex: 1 },
  recentLabel: { color: "white", fontWeight: "700", fontSize: 15 },
  recentMeta: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  recentChevron: { color: "rgba(255,255,255,0.35)", fontSize: 26, fontWeight: "300" },

  tradeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tradeCard: {
    width: "47%",
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 6,
    position: "relative",
  },
  tradeCardIcon: { fontSize: 28 },
  tradeCardLabel: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 15 },
  tradeCardBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tradeCardBadgeText: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "500" },
  tradeCardCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tradeCardCheckText: { color: "#07152b", fontWeight: "900", fontSize: 12 },

  jobList: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 16,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  jobDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  jobTypeTradeIcon: { fontSize: 20, width: 28, textAlign: "center" },
  jobInfo: { flex: 1 },
  jobLabel: { color: "white", fontSize: 15, fontWeight: "700" },
  jobDesc: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  jobStandard: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  jobChevron: { color: "rgba(255,255,255,0.35)", fontSize: 26, fontWeight: "300", marginTop: -2 },

  emptyState: { padding: 24, alignItems: "center" },
  emptyText: { color: "rgba(255,255,255,0.35)", fontSize: 14 },

  back: { marginTop: 32, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 15 },
});
