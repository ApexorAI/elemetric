import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalJob = {
  id: string;
  jobType: string;
  jobName: string;
  jobAddr: string;
  scheduledDate: string | null;
  status: string;
  confidence: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const JOB_TYPE_ICONS: Record<string, string> = {
  hotwater: "🔧", gas: "🔥", drainage: "🚿", newinstall: "🏗️",
  electrical: "⚡", hvac: "❄️", carpentry: "🪚",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  hotwater: "Plumbing", gas: "Gas", drainage: "Drainage",
  newinstall: "New Install", electrical: "Electrical", hvac: "HVAC", carpentry: "Carpentry",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function statusColor(status: string): string {
  if (status === "assigned") return "#60a5fa";
  if (status === "in_progress") return "#f97316";
  if (status === "complete") return "#22c55e";
  return "#9ca3af";
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Mon=0 system
  return (day + 6) % 7;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [jobs, setJobs] = useState<CalJob[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          // Load assigned jobs (with scheduled date) + recently completed jobs
          const { data: assignedData } = await supabase
            .from("jobs")
            .select("id, job_type, job_name, job_addr, scheduled_date, status, confidence")
            .eq("assigned_to", user.id)
            .in("status", ["assigned", "in_progress"]);

          const { data: ownData } = await supabase
            .from("jobs")
            .select("id, job_type, job_name, job_addr, scheduled_date, status, confidence, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100);

          if (!active) return;

          const all: CalJob[] = [
            ...(assignedData ?? []).map((r: any) => ({
              id: r.id,
              jobType: r.job_type,
              jobName: r.job_name,
              jobAddr: r.job_addr,
              scheduledDate: r.scheduled_date,
              status: r.status,
              confidence: r.confidence ?? 0,
            })),
            ...(ownData ?? []).map((r: any) => ({
              id: r.id,
              jobType: r.job_type,
              jobName: r.job_name,
              jobAddr: r.job_addr,
              scheduledDate: r.scheduled_date ?? r.created_at?.substring(0, 10),
              status: r.status ?? "complete",
              confidence: r.confidence ?? 0,
            })),
          ];

          // De-dupe by id
          const seen = new Set<string>();
          const unique = all.filter((j) => {
            if (seen.has(j.id)) return false;
            seen.add(j.id);
            return true;
          });

          if (active) setJobs(unique);
        } catch {} finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  // Map date strings -> jobs
  const jobsByDate: Record<string, CalJob[]> = {};
  for (const j of jobs) {
    if (!j.scheduledDate) continue;
    const key = j.scheduledDate.substring(0, 10);
    if (!jobsByDate[key]) jobsByDate[key] = [];
    jobsByDate[key].push(j);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);

  const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedKey = selectedDay ? formatDateKey(year, month, selectedDay) : null;
  const selectedJobs = selectedKey ? (jobsByDate[selectedKey] ?? []) : [];

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  // All calendar cells (leading empty + days)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Calendar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#f97316" />
          </View>
        ) : (
          <>
            {/* ── Month nav ── */}
            <View style={styles.monthNav}>
              <Pressable style={styles.navBtn} onPress={prevMonth}>
                <Text style={styles.navBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
              <Pressable style={styles.navBtn} onPress={nextMonth}>
                <Text style={styles.navBtnText}>›</Text>
              </Pressable>
            </View>

            {/* ── Day-of-week header ── */}
            <View style={styles.dowRow}>
              {DAY_NAMES.map((d) => (
                <Text key={d} style={[styles.dowCell, (d === "Sat" || d === "Sun") && styles.dowWeekend]}>{d}</Text>
              ))}
            </View>

            {/* ── Grid ── */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={styles.cell} />;
                const key = formatDateKey(year, month, day);
                const dayJobs = jobsByDate[key] ?? [];
                const isToday = key === todayKey;
                const isSelected = day === selectedDay;
                const dots = dayJobs.slice(0, 3);
                return (
                  <Pressable
                    key={`day-${day}`}
                    style={[
                      styles.cell,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                  >
                    <Text style={[
                      styles.cellText,
                      isToday && styles.cellTextToday,
                      isSelected && styles.cellTextSelected,
                    ]}>{day}</Text>
                    {dots.length > 0 && (
                      <View style={styles.dotRow}>
                        {dots.map((j, i) => (
                          <View key={i} style={[styles.dot, { backgroundColor: statusColor(j.status) }]} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── Legend ── */}
            <View style={styles.legend}>
              {[
                { color: "#60a5fa", label: "Assigned" },
                { color: "#f97316", label: "In Progress" },
                { color: "#22c55e", label: "Complete" },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>

            {/* ── Selected day jobs ── */}
            {selectedDay && (
              <View style={styles.daySection}>
                <Text style={styles.daySectionTitle}>
                  {DAY_NAMES[new Date(year, month, selectedDay).getDay() === 0 ? 6 : new Date(year, month, selectedDay).getDay() - 1]}, {selectedDay} {MONTH_NAMES[month]}
                </Text>
                {selectedJobs.length === 0 ? (
                  <Text style={styles.noJobs}>No jobs scheduled this day</Text>
                ) : (
                  selectedJobs.map((j) => (
                    <View key={j.id} style={styles.jobCard}>
                      <View style={styles.jobCardLeft}>
                        <Text style={styles.jobIcon}>{JOB_TYPE_ICONS[j.jobType] ?? "📋"}</Text>
                        <View>
                          <Text style={styles.jobName} numberOfLines={1}>{j.jobName}</Text>
                          <Text style={styles.jobAddr} numberOfLines={1}>{j.jobAddr}</Text>
                          <Text style={styles.jobType}>{JOB_TYPE_LABELS[j.jobType] ?? j.jobType}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusPill, { borderColor: statusColor(j.status) + "44", backgroundColor: statusColor(j.status) + "18" }]}>
                        <Text style={[styles.statusPillText, { color: statusColor(j.status) }]}>
                          {j.status.replace("_", " ").toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ── Monthly summary ── */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {MONTH_NAMES[month]} {year} — {Object.values(jobsByDate).filter((_, k) => {
                  const keys = Object.keys(jobsByDate);
                  return keys[k]?.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);
                }).flat().length} jobs
              </Text>
              {Object.entries(jobsByDate)
                .filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(0, 5)
                .map(([dateKey, dayJobs]) => (
                  <View key={dateKey} style={styles.summaryRow}>
                    <Text style={styles.summaryDate}>{parseInt(dateKey.split("-")[2])}</Text>
                    <Text style={styles.summaryJobs} numberOfLines={1}>
                      {dayJobs.map((j) => j.jobName).join(", ")}
                    </Text>
                    <View style={[styles.dot, { backgroundColor: statusColor(dayJobs[0]?.status ?? "") }]} />
                  </View>
                ))
              }
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CELL_SIZE = 46;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },

  body: { padding: 16, gap: 14, paddingBottom: 40 },

  loadingWrap: { paddingTop: 60, alignItems: "center" },

  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" },
  navBtnText: { color: "white", fontSize: 22, fontWeight: "700" },
  monthLabel: { color: "white", fontWeight: "900", fontSize: 18 },

  dowRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 2 },
  dowCell: { width: CELL_SIZE, textAlign: "center", color: "rgba(255,255,255,0.40)", fontWeight: "700", fontSize: 12 },
  dowWeekend: { color: "#f97316" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  cellToday: { backgroundColor: "rgba(249,115,22,0.15)", borderWidth: 1, borderColor: "rgba(249,115,22,0.40)" },
  cellSelected: { backgroundColor: "#f97316" },
  cellText: { color: "rgba(255,255,255,0.75)", fontWeight: "600", fontSize: 14 },
  cellTextToday: { color: "#f97316", fontWeight: "900" },
  cellTextSelected: { color: "#0b1220", fontWeight: "900" },
  dotRow: { flexDirection: "row", gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  legend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: "rgba(255,255,255,0.55)", fontSize: 12 },

  daySection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    gap: 10,
  },
  daySectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  noJobs: { color: "rgba(255,255,255,0.35)", fontSize: 13 },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  jobCardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  jobIcon: { fontSize: 20, width: 26, textAlign: "center" },
  jobName: { color: "white", fontWeight: "700", fontSize: 14 },
  jobAddr: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  jobType: { color: "rgba(255,255,255,0.30)", fontSize: 11 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusPillText: { fontWeight: "800", fontSize: 10 },

  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 14,
    gap: 8,
  },
  summaryTitle: { color: "rgba(255,255,255,0.45)", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryDate: { color: "#f97316", fontWeight: "900", fontSize: 14, width: 28 },
  summaryJobs: { color: "rgba(255,255,255,0.65)", fontSize: 13, flex: 1 },
});
