import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { sendExpoPushNotification } from "@/lib/notifications";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlannerJob = {
  id: string;
  jobName: string;
  jobAddr: string;
  jobType: string;
  scheduledDate: string | null;
  status: string;
  assignedTo: string | null;
  plumberName: string;
};

type TeamMember = {
  userId: string;
  fullName: string;
  pushToken: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const JOB_TYPE_LABELS: Record<string, string> = {
  hotwater:   "Plumbing",
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Install",
  electrical: "Electrical",
  hvac:       "HVAC",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unassigned:  { label: "UNASSIGNED",  color: "#9ca3af" },
  assigned:    { label: "ASSIGNED",    color: "#60a5fa" },
  in_progress: { label: "IN PROGRESS", color: "#f97316" },
  completed:   { label: "COMPLETED",   color: "#22c55e" },
};

/** Format a Date as "D Mon YYYY" — matches the assign-job placeholder format */
function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Get the 7 days of the current calendar week (Mon … Sun) */
function getWeekDays(referenceDate: Date): Date[] {
  const dow = referenceDate.getDay(); // 0=Sun
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function JobPlanner() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allJobs, setAllJobs] = useState<PlannerJob[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // Reassign modal state
  const [editJob, setEditJob] = useState<PlannerJob | null>(null);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (active) setLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          // Get employer's team
          const { data: team } = await supabase
            .from("teams")
            .select("id")
            .eq("owner_id", user.id)
            .single();
          if (!team || !active) return;

          // Get team member user IDs + names + push tokens
          const { data: rawMembers } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", team.id);
          if (!rawMembers || !active) return;

          const hydratedMembers: TeamMember[] = [];
          for (const m of rawMembers) {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, push_token")
                .eq("user_id", m.user_id)
                .single();
              hydratedMembers.push({
                userId: m.user_id,
                fullName: profile?.full_name ?? "Unknown",
                pushToken: profile?.push_token ?? null,
              });
            } catch {}
          }
          if (active) setMembers(hydratedMembers);

          // Get all jobs created by this employer (or assigned to team members)
          const memberIds = rawMembers.map((m: any) => m.user_id);
          const { data: jobs } = await supabase
            .from("jobs")
            .select("*")
            .or(`user_id.eq.${user.id},assigned_to.in.(${memberIds.join(",")})`)
            .not("scheduled_date", "is", null)
            .order("created_at", { ascending: false });

          if (!jobs || !active) return;

          // Hydrate plumber names
          const nameCache: Record<string, string> = {};
          const hydrated: PlannerJob[] = [];
          for (const row of jobs) {
            const assignedTo: string | null = row.assigned_to ?? null;
            let plumberName = "Unassigned";
            if (assignedTo) {
              if (!nameCache[assignedTo]) {
                try {
                  const { data: p } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("user_id", assignedTo)
                    .single();
                  nameCache[assignedTo] = p?.full_name ?? "Unknown";
                } catch {
                  nameCache[assignedTo] = "Unknown";
                }
              }
              plumberName = nameCache[assignedTo];
            }
            hydrated.push({
              id: row.id,
              jobName: row.job_name,
              jobAddr: row.job_addr,
              jobType: row.job_type,
              scheduledDate: row.scheduled_date ?? null,
              status: row.status ?? "unassigned",
              assignedTo,
              plumberName,
            });
          }
          if (active) setAllJobs(hydrated);
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  // ── Week navigation ───────────────────────────────────────────────────────────

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const selKey = formatDay(selectedDay);
  const dayJobs = allJobs.filter(
    (j) => j.scheduledDate && j.scheduledDate.trim() === selKey
  );

  // ── Reassign/reschedule modal ─────────────────────────────────────────────────

  const openEdit = (job: PlannerJob) => {
    setEditJob(job);
    setEditMemberId(job.assignedTo);
    setEditDate(job.scheduledDate ?? "");
  };

  const saveEdit = async () => {
    if (!editJob) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        scheduled_date: editDate.trim() || null,
        assigned_to: editMemberId || null,
        status: editMemberId ? "assigned" : "unassigned",
      };
      const { error } = await supabase
        .from("jobs")
        .update(updates)
        .eq("id", editJob.id);
      if (error) throw error;

      // Send push notification if reassigned to a different member
      if (editMemberId && editMemberId !== editJob.assignedTo) {
        const member = members.find((m) => m.userId === editMemberId);
        if (member?.pushToken) {
          const dateStr = editDate.trim() || "date TBC";
          await sendExpoPushNotification(
            member.pushToken,
            "New job assigned",
            `${editJob.jobAddr} on ${dateStr}. Open Elemetric to accept.`
          );
        }
      }

      // Update local state
      setAllJobs((prev) =>
        prev.map((j) =>
          j.id === editJob.id
            ? {
                ...j,
                assignedTo: editMemberId,
                scheduledDate: editDate.trim() || null,
                status: editMemberId ? "assigned" : "unassigned",
                plumberName: members.find((m) => m.userId === editMemberId)?.fullName ?? "Unassigned",
              }
            : j
        )
      );
      setEditJob(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Job Planner</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#f97316" />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : (
        <>
          {/* ── Week navigator ── */}
          <View style={styles.weekNav}>
            <Pressable style={styles.navArrow} onPress={() => setWeekOffset((o) => o - 1)}>
              <Text style={styles.navArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.weekLabel}>
              {formatDay(weekDays[0])} – {formatDay(weekDays[6])}
            </Text>
            <Pressable style={styles.navArrow} onPress={() => setWeekOffset((o) => o + 1)}>
              <Text style={styles.navArrowText}>›</Text>
            </Pressable>
          </View>

          {/* ── Day chips ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            {weekDays.map((day) => {
              const key = formatDay(day);
              const isSelected = key === selKey;
              const hasJobs = allJobs.some(
                (j) => j.scheduledDate && j.scheduledDate.trim() === key
              );
              const isToday = key === formatDay(new Date());
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.dayChip,
                    isSelected && styles.dayChipSelected,
                    isToday && !isSelected && styles.dayChipToday,
                  ]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dayChipDow, isSelected && styles.dayChipTextSelected]}>
                    {DAY_NAMES[day.getDay()]}
                  </Text>
                  <Text style={[styles.dayChipNum, isSelected && styles.dayChipTextSelected]}>
                    {day.getDate()}
                  </Text>
                  {hasJobs && (
                    <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── Jobs for selected day ── */}
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.dayHeading}>
              {DAY_NAMES[selectedDay.getDay()]}, {selKey}
            </Text>

            {dayJobs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No jobs scheduled</Text>
                <Text style={styles.emptySubtitle}>Assign a job to this date to see it here</Text>
              </View>
            ) : (
              dayJobs.map((job) => {
                const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.unassigned;
                return (
                  <Pressable key={job.id} style={styles.card} onPress={() => openEdit(job)}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitles}>
                        <Text style={styles.jobTitle} numberOfLines={1}>{job.jobName}</Text>
                        <Text style={styles.jobAddr} numberOfLines={1}>{job.jobAddr}</Text>
                      </View>
                      <View style={[styles.statusBadge, { borderColor: sc.color + "55", backgroundColor: sc.color + "1a" }]}>
                        <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                    </View>

                    <View style={styles.cardMeta}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaKey}>TYPE</Text>
                        <Text style={styles.metaVal}>{JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaKey}>ASSIGNED TO</Text>
                        <Text style={styles.metaVal}>{job.plumberName}</Text>
                      </View>
                    </View>

                    <Text style={styles.tapHint}>Tap to reassign or reschedule →</Text>
                  </Pressable>
                );
              })
            )}

            <Pressable onPress={() => router.push("/employer/assign-job")} style={styles.addJobBtn}>
              <Text style={styles.addJobBtnText}>+ Assign New Job</Text>
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </ScrollView>
        </>
      )}

      {/* ── Edit/Reassign Modal ── */}
      <Modal
        visible={!!editJob}
        transparent
        animationType="slide"
        onRequestClose={() => setEditJob(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditJob(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Reassign / Reschedule</Text>
            {editJob && (
              <Text style={styles.modalJobName} numberOfLines={1}>{editJob.jobName}</Text>
            )}

            <Text style={styles.modalLabel}>Scheduled Date</Text>
            <TextInput
              style={styles.modalInput}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="e.g. 20 Mar 2026"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.modalLabel}>Assign To</Text>
            <Pressable
              style={[styles.memberRow, !editMemberId && styles.memberRowActive]}
              onPress={() => setEditMemberId(null)}
            >
              <Text style={styles.memberName}>Unassigned</Text>
              {!editMemberId && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            {members.map((m) => (
              <Pressable
                key={m.userId}
                style={[styles.memberRow, editMemberId === m.userId && styles.memberRowActive]}
                onPress={() => setEditMemberId(m.userId)}
              >
                <Text style={styles.memberName}>{m.fullName}</Text>
                {editMemberId === m.userId && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            ))}

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#0b1220" />
                : <Text style={styles.saveBtnText}>Save Changes</Text>
              }
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => setEditJob(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "rgba(255,255,255,0.55)" },

  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  navArrow: { padding: 8 },
  navArrowText: { color: "#f97316", fontSize: 26, fontWeight: "900" },
  weekLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },

  dayRow: { paddingHorizontal: 20, paddingBottom: 10, gap: 8 },
  dayChip: {
    width: 48,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    gap: 3,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  dayChipSelected: { backgroundColor: "#f97316", borderColor: "#f97316" },
  dayChipToday: { borderColor: "rgba(249,115,22,0.40)" },
  dayChipDow: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" },
  dayChipNum: { color: "white", fontSize: 15, fontWeight: "900" },
  dayChipTextSelected: { color: "#07152b" },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#f97316",
    marginTop: 1,
  },
  dayDotSelected: { backgroundColor: "#07152b" },

  body: { padding: 20, gap: 12, paddingBottom: 40 },

  dayHeading: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },

  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "white", fontSize: 15, fontWeight: "900" },
  emptySubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center" },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitles: { flex: 1 },
  jobTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  jobAddr: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, backgroundColor: "transparent" },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  cardMeta: { flexDirection: "row", gap: 20 },
  metaItem: { gap: 2 },
  metaKey: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  metaVal: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },
  tapHint: { color: "#f97316", fontSize: 12, fontWeight: "700" },

  addJobBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
  },
  addJobBtnText: { color: "#f97316", fontWeight: "900", fontSize: 15 },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#0f2035",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 10,
    paddingBottom: 40,
  },
  modalTitle: { color: "white", fontWeight: "900", fontSize: 18, marginBottom: 2 },
  modalJobName: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 8 },
  modalLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: "#07152b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#07152b",
  },
  memberRowActive: {
    borderColor: "rgba(249,115,22,0.40)",
    backgroundColor: "rgba(249,115,22,0.06)",
  },
  memberName: { color: "white", fontWeight: "700", fontSize: 15 },
  checkmark: { color: "#f97316", fontWeight: "900", fontSize: 16 },
  saveBtn: {
    marginTop: 8,
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
