import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const STORAGE_KEY = "elemetric_timesheet_entries";

type BreakEntry = { start: number; end: number | null };

type TimesheetEntry = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  clockIn: number; // epoch ms
  clockOut: number | null;
  breaks: BreakEntry[];
  notes: string;
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
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          const all: TimesheetEntry[] = raw ? JSON.parse(raw) : [];
          // Check if there's an active (unclosed) entry
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
        } catch {}
      })();
    }, [])
  );

  const persist = async (all: TimesheetEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
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
    const header = "Date,Clock In,Clock Out,Break (min),Worked (hrs),Notes\n";
    const rows = allClosed.map((e) => {
      const breakMs = e.breaks.reduce((s, b) => s + Math.max(0, (b.end ?? 0) - b.start), 0);
      const breakMin = Math.round(breakMs / 60000);
      const workedMs = entryWorkedMs(e);
      const workedHrs = (workedMs / 3600000).toFixed(2);
      return [
        e.date,
        formatTime(e.clockIn),
        e.clockOut ? formatTime(e.clockOut) : "",
        breakMin,
        workedHrs,
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

        {/* Weekly summary */}
        <View style={styles.weekCard}>
          <Text style={styles.weekLabel}>THIS WEEK</Text>
          <Text style={styles.weekHours}>{(totalThisWeek / 3600000).toFixed(1)} hrs</Text>
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
              return (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryTop}>
                    <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                    <Pressable onPress={() => deleteEntry(entry.id)} hitSlop={8}>
                      <Text style={styles.deleteText}>✕</Text>
                    </Pressable>
                  </View>
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

  weekCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekLabel: { color: "rgba(255,255,255,0.35)", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  weekHours: { color: "white", fontWeight: "900", fontSize: 26 },

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
});
