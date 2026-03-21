import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Share,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const STORAGE_KEY = "elemetric_timesheet_entries";
const RATE_KEY = "elemetric_hourly_rate";
const JOB_KEY = "elemetric_current_job";

type BreakEntry = { start: number; end: number | null };

type TimesheetEntry = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  clockIn: number; // epoch ms
  clockOut: number | null;
  breaks: BreakEntry[];
  notes: string;
  jobAddress?: string;
  jobId?: string;
};

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function entryWorkedMs(entry: TimesheetEntry, nowMs?: number): number {
  const end = entry.clockOut ?? nowMs ?? Date.now();
  const totalMs = end - entry.clockIn;
  const breakMs = entry.breaks.reduce((sum, b) => {
    const bEnd = b.end ?? nowMs ?? Date.now();
    return sum + Math.max(0, bEnd - b.start);
  }, 0);
  return Math.max(0, totalMs - breakMs);
}

export default function Timesheet() {
  const router = useRouter();

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimesheetEntry | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hourlyRate, setHourlyRate] = useState("");
  const [editingRate, setEditingRate] = useState(false);
  const [currentJobAddress, setCurrentJobAddress] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live timer
  useEffect(() => {
    if (activeEntry && !activeEntry.clockOut) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeEntry]);

  // Load persisted data
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [raw, rateRaw, jobRaw] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEY),
            AsyncStorage.getItem(RATE_KEY),
            AsyncStorage.getItem(JOB_KEY),
          ]);
          const all: TimesheetEntry[] = raw ? JSON.parse(raw) : [];
          const open = all.find((e) => e.clockOut === null);
          setEntries(all.filter((e) => e.clockOut !== null));
          if (open) {
            setActiveEntry(open);
            const currentBreak = open.breaks.find((b) => b.end === null);
            setOnBreak(!!currentBreak);
          } else {
            setActiveEntry(null);
            setOnBreak(false);
          }
          if (rateRaw) setHourlyRate(rateRaw);
          if (jobRaw) {
            try {
              const job = JSON.parse(jobRaw);
              setCurrentJobAddress(job.address ?? job.property_address ?? null);
            } catch {}
          }
        } catch {}
      })();
    }, [])
  );

  const persist = async (all: TimesheetEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  };

  const saveRate = async (rate: string) => {
    const trimmed = rate.trim();
    setHourlyRate(trimmed);
    setEditingRate(false);
    try { await AsyncStorage.setItem(RATE_KEY, trimmed); } catch {}
  };

  const clockIn = async () => {
    if (activeEntry) return;
    const entry: TimesheetEntry = {
      id: Date.now().toString(),
      date: todayISO(),
      clockIn: Date.now(),
      clockOut: null,
      breaks: [],
      notes: "",
      jobAddress: currentJobAddress ?? undefined,
    };
    setActiveEntry(entry);
    setOnBreak(false);
    setNow(Date.now());
    const all = [entry, ...entries.map((e) => e as TimesheetEntry)];
    await persist(all);
  };

  const clockOut = async () => {
    if (!activeEntry) return;
    Alert.alert("Clock Out", "Are you sure you want to clock out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clock Out", style: "destructive",
        onPress: async () => {
          const now = Date.now();
          // End any open break
          const closedBreaks = activeEntry.breaks.map((b) =>
            b.end === null ? { ...b, end: now } : b
          );
          const closed: TimesheetEntry = { ...activeEntry, clockOut: now, breaks: closedBreaks };
          const all = [closed, ...entries];
          setEntries(all);
          setActiveEntry(null);
          setOnBreak(false);
          await persist(all);
        },
      },
    ]);
  };

  const toggleBreak = async () => {
    if (!activeEntry) return;
    const now = Date.now();
    let updatedBreaks: BreakEntry[];
    if (onBreak) {
      // End break
      updatedBreaks = activeEntry.breaks.map((b) =>
        b.end === null ? { ...b, end: now } : b
      );
      setOnBreak(false);
    } else {
      // Start break
      updatedBreaks = [...activeEntry.breaks, { start: now, end: null }];
      setOnBreak(true);
    }
    const updated = { ...activeEntry, breaks: updatedBreaks };
    setActiveEntry(updated);
    const all = [updated, ...entries];
    await persist(all);
  };

  const deleteEntry = async (id: string) => {
    Alert.alert("Delete Entry", "Remove this timesheet entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const updated = entries.filter((e) => e.id !== id);
          setEntries(updated);
          if (activeEntry?.id === id) setActiveEntry(null);
          await persist(updated);
        },
      },
    ]);
  };

  const exportCSV = async () => {
    const allClosed = entries.filter((e) => e.clockOut !== null);
    if (allClosed.length === 0) { Alert.alert("No Data", "No completed entries to export."); return; }
    const rate = parseFloat(hourlyRate) || 0;
    const header = "Date,Job,Clock In,Clock Out,Break (min),Worked (hrs),Pay ($),Notes\n";
    const rows = allClosed.map((e) => {
      const breakMs = e.breaks.reduce((s, b) => s + Math.max(0, (b.end ?? 0) - b.start), 0);
      const breakMin = Math.round(breakMs / 60000);
      const workedMs = entryWorkedMs(e);
      const workedHrs = (workedMs / 3600000).toFixed(2);
      const pay = rate > 0 ? (parseFloat(workedHrs) * rate).toFixed(2) : "";
      return [
        e.date,
        (e.jobAddress || "").replace(/,/g, ";"),
        formatTime(e.clockIn),
        e.clockOut ? formatTime(e.clockOut) : "",
        breakMin,
        workedHrs,
        pay,
        (e.notes || "").replace(/,/g, ";"),
      ].join(",");
    });
    const csv = header + rows.join("\n");
    const path = `${FileSystem.cacheDirectory}elemetric-timesheet-${Date.now()}.csv`;
    try {
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Export Timesheet CSV", UTI: "public.comma-separated-values-text" });
      } else {
        await Share.share({ message: csv, title: "Elemetric Timesheet" });
      }
    } catch (e: any) {
      Alert.alert("Export Error", e?.message ?? "Could not export CSV.");
    }
  };

  // Compute live stats
  const workedMs = activeEntry ? entryWorkedMs(activeEntry, now) : 0;
  const breakMs = activeEntry
    ? activeEntry.breaks.reduce((s, b) => s + Math.max(0, (b.end ?? now) - b.start), 0)
    : 0;
  const isClocked = !!activeEntry && !activeEntry.clockOut;

  const totalThisWeek = (() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return entries
      .filter((e) => e.clockIn >= weekAgo && e.clockOut !== null)
      .reduce((s, e) => s + entryWorkedMs(e), 0);
  })();

  const totalThisMonth = (() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return entries
      .filter((e) => e.clockIn >= monthStart && e.clockOut !== null)
      .reduce((s, e) => s + entryWorkedMs(e), 0);
  })();

  const rate = parseFloat(hourlyRate) || 0;
  const weeklyPay = rate > 0 ? (totalThisWeek / 3600000) * rate : null;
  const monthlyPay = rate > 0 ? (totalThisMonth / 3600000) * rate : null;

  // 7-day bar chart data
  const weekBarData = (() => {
    const days: { label: string; hrs: number; iso: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-AU", { weekday: "short" });
      const dayEntries = entries.filter((e) => e.date === iso && e.clockOut !== null);
      const hrs = dayEntries.reduce((s, e) => s + entryWorkedMs(e) / 3600000, 0);
      days.push({ label, hrs, iso });
    }
    return days;
  })();
  const maxHrs = Math.max(...weekBarData.map((d) => d.hrs), 1);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Timesheet</Text>
        <Text style={styles.subtitle}>Track your hours on site</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Active session card */}
        <View style={[styles.sessionCard, isClocked && styles.sessionCardActive]}>
          <View style={styles.sessionHeader}>
            <View>
              <Text style={styles.sessionTitle}>{isClocked ? "Currently Clocked In" : "Not Clocked In"}</Text>
              {isClocked && activeEntry && (
                <Text style={styles.sessionSince}>Since {formatTime(activeEntry.clockIn)}</Text>
              )}
            </View>
            {isClocked && (
              <View style={[styles.liveIndicator, onBreak && styles.liveIndicatorBreak]}>
                <Text style={styles.liveIndicatorText}>{onBreak ? "⏸ BREAK" : "● LIVE"}</Text>
              </View>
            )}
          </View>

          {isClocked && (
            <>
              <Text style={styles.timerDisplay}>{formatDuration(workedMs)}</Text>
              {breakMs > 0 && (
                <Text style={styles.breakDisplay}>Break: {formatDuration(breakMs)}</Text>
              )}
            </>
          )}

          {!isClocked && (
            <Pressable style={styles.clockInBtn} onPress={clockIn}>
              <Text style={styles.clockInBtnText}>Clock In</Text>
            </Pressable>
          )}

          {isClocked && (
            <View style={styles.sessionActions}>
              <Pressable
                style={[styles.breakBtn, onBreak && styles.breakBtnActive]}
                onPress={toggleBreak}
              >
                <Text style={[styles.breakBtnText, onBreak && styles.breakBtnTextActive]}>
                  {onBreak ? "End Break" : "Start Break"}
                </Text>
              </Pressable>
              <Pressable style={styles.clockOutBtn} onPress={clockOut}>
                <Text style={styles.clockOutBtnText}>Clock Out</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Job link indicator */}
        {currentJobAddress && !isClocked && (
          <View style={styles.jobLinkCard}>
            <Text style={styles.jobLinkLabel}>LINKED JOB</Text>
            <Text style={styles.jobLinkAddress} numberOfLines={1}>{currentJobAddress}</Text>
            <Text style={styles.jobLinkSub}>Next clock-in will be tagged to this job</Text>
          </View>
        )}

        {/* Hourly rate */}
        <View style={styles.rateCard}>
          <View style={styles.rateRow}>
            <View>
              <Text style={styles.rateLabel}>HOURLY RATE</Text>
              {editingRate ? (
                <TextInput
                  style={styles.rateInput}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 45.00"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoFocus
                  onBlur={() => saveRate(hourlyRate)}
                  onSubmitEditing={() => saveRate(hourlyRate)}
                />
              ) : (
                <Text style={styles.rateValue}>
                  {hourlyRate ? `$${parseFloat(hourlyRate).toFixed(2)}/hr` : "Not set"}
                </Text>
              )}
            </View>
            <Pressable onPress={() => setEditingRate(true)} hitSlop={8} style={styles.editRateBtn}>
              <Text style={styles.editRateBtnText}>{editingRate ? "" : "Edit"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.weekCard, styles.summaryCard]}>
            <Text style={styles.weekLabel}>THIS WEEK</Text>
            <Text style={styles.weekHours}>{(totalThisWeek / 3600000).toFixed(1)} hrs</Text>
            {weeklyPay !== null && (
              <Text style={styles.payEstimate}>${weeklyPay.toFixed(2)}</Text>
            )}
          </View>
          <View style={[styles.weekCard, styles.summaryCard]}>
            <Text style={styles.weekLabel}>THIS MONTH</Text>
            <Text style={styles.weekHours}>{(totalThisMonth / 3600000).toFixed(1)} hrs</Text>
            {monthlyPay !== null && (
              <Text style={styles.payEstimate}>${monthlyPay.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* 7-day bar chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>7-DAY OVERVIEW</Text>
          <View style={styles.chartBars}>
            {weekBarData.map((d) => {
              const today = new Date().toISOString().split("T")[0];
              const isToday = d.iso === today;
              const barH = d.hrs > 0 ? Math.max(6, (d.hrs / maxHrs) * 72) : 4;
              return (
                <View key={d.iso} style={styles.chartBarCol}>
                  <Text style={styles.chartBarValue}>
                    {d.hrs > 0 ? `${d.hrs.toFixed(1)}h` : ""}
                  </Text>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: barH, backgroundColor: isToday ? "#f97316" : "#22c55e" },
                        d.hrs === 0 && styles.chartBarEmpty,
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartBarLabel, isToday && styles.chartBarLabelToday]}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Export button */}
        {entries.length > 0 && (
          <Pressable style={styles.exportBtn} onPress={exportCSV}>
            <Text style={styles.exportBtnText}>Export CSV →</Text>
          </Pressable>
        )}

        {/* History */}
        {entries.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>TIMESHEET HISTORY</Text>
            {entries.slice(0, 30).map((entry) => {
              const worked = entryWorkedMs(entry);
              const breakMin = Math.round(
                entry.breaks.reduce((s, b) => s + Math.max(0, (b.end ?? 0) - b.start), 0) / 60000
              );
              const entryPay = rate > 0 ? (worked / 3600000) * rate : null;
              return (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryTop}>
                    <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                    <Pressable onPress={() => deleteEntry(entry.id)} hitSlop={8}>
                      <Text style={styles.deleteText}>✕</Text>
                    </Pressable>
                  </View>
                  {entry.jobAddress && (
                    <Text style={styles.entryJob} numberOfLines={1}>{entry.jobAddress}</Text>
                  )}
                  <View style={styles.entryStats}>
                    <View style={styles.entryStat}>
                      <Text style={styles.entryStatLabel}>CLOCKED IN</Text>
                      <Text style={styles.entryStatValue}>{formatTime(entry.clockIn)}</Text>
                    </View>
                    <View style={styles.entryStat}>
                      <Text style={styles.entryStatLabel}>CLOCKED OUT</Text>
                      <Text style={styles.entryStatValue}>{entry.clockOut ? formatTime(entry.clockOut) : "—"}</Text>
                    </View>
                    <View style={styles.entryStat}>
                      <Text style={styles.entryStatLabel}>WORKED</Text>
                      <Text style={[styles.entryStatValue, { color: "#22c55e" }]}>{(worked / 3600000).toFixed(2)}h</Text>
                    </View>
                    {breakMin > 0 && (
                      <View style={styles.entryStat}>
                        <Text style={styles.entryStatLabel}>BREAK</Text>
                        <Text style={styles.entryStatValue}>{breakMin}m</Text>
                      </View>
                    )}
                    {entryPay !== null && (
                      <View style={styles.entryStat}>
                        <Text style={styles.entryStatLabel}>PAY</Text>
                        <Text style={[styles.entryStatValue, { color: "#f97316" }]}>${entryPay.toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {entries.length === 0 && !isClocked && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Clock in to start tracking your hours.</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 14 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  body: { padding: 20, gap: 12, paddingBottom: 60 },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginLeft: 2,
  },

  sessionCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 20,
    gap: 14,
  },
  sessionCardActive: {
    borderColor: "rgba(34,197,94,0.30)",
    backgroundColor: "rgba(34,197,94,0.04)",
  },
  sessionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sessionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  sessionSince: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  liveIndicator: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  liveIndicatorBreak: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderColor: "rgba(249,115,22,0.35)",
  },
  liveIndicatorText: { color: "#22c55e", fontWeight: "800", fontSize: 12 },

  timerDisplay: { color: "white", fontSize: 48, fontWeight: "900", letterSpacing: -1, textAlign: "center" },
  breakDisplay: { color: "#f97316", fontWeight: "700", fontSize: 14, textAlign: "center" },

  clockInBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  clockInBtnText: { color: "#07152b", fontWeight: "900", fontSize: 16 },

  sessionActions: { flexDirection: "row", gap: 10 },
  breakBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    backgroundColor: "transparent",
  },
  breakBtnActive: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderColor: "#f97316",
  },
  breakBtnText: { color: "#f97316", fontWeight: "800", fontSize: 14 },
  breakBtnTextActive: { color: "#f97316" },

  clockOutBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
  },
  clockOutBtnText: { color: "white", fontWeight: "900", fontSize: 14 },

  jobLinkCard: {
    backgroundColor: "rgba(249,115,22,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    padding: 14,
    gap: 3,
  },
  jobLinkLabel: { color: "#f97316", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  jobLinkAddress: { color: "white", fontWeight: "700", fontSize: 14 },
  jobLinkSub: { color: "rgba(255,255,255,0.40)", fontSize: 12 },

  rateCard: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
  },
  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rateLabel: { color: "rgba(255,255,255,0.35)", fontWeight: "800", fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  rateValue: { color: "white", fontWeight: "700", fontSize: 16 },
  rateInput: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f97316",
    paddingVertical: 2,
    minWidth: 100,
  },
  editRateBtn: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
  },
  editRateBtnText: { color: "#f97316", fontWeight: "800", fontSize: 13 },

  summaryRow: { flexDirection: "row", gap: 12 },
  summaryCard: { flex: 1 },

  weekCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 4,
  },
  weekLabel: { color: "rgba(255,255,255,0.35)", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  weekHours: { color: "white", fontWeight: "900", fontSize: 24 },
  payEstimate: { color: "#22c55e", fontWeight: "700", fontSize: 14, marginTop: 2 },

  entryJob: { color: "rgba(249,115,22,0.80)", fontSize: 12, fontWeight: "600" },

  exportBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  exportBtnText: { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 14 },

  entryCard: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    gap: 10,
  },
  entryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  entryDate: { color: "white", fontWeight: "700", fontSize: 14 },
  deleteText: { color: "rgba(255,255,255,0.25)", fontSize: 16, fontWeight: "700" },
  entryStats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  entryStat: { gap: 2 },
  entryStatLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  entryStatValue: { color: "white", fontWeight: "700", fontSize: 14 },

  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" },

  // ── 7-day bar chart ───────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  chartTitle: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 16,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 100,
  },
  chartBarCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    height: 100,
    justifyContent: "flex-end",
  },
  chartBarValue: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    height: 12,
  },
  chartBarTrack: {
    width: "100%",
    height: 72,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  chartBarFill: {
    width: "70%",
    borderRadius: 3,
    minHeight: 4,
  },
  chartBarEmpty: {
    backgroundColor: "rgba(255,255,255,0.10)",
    height: 4,
  },
  chartBarLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  chartBarLabelToday: {
    color: "#f97316",
  },
});
