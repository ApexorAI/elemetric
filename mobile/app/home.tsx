import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, G } from "react-native-svg";
import { supabase } from "@/lib/supabase";

// ── Compliance score ring ─────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number | null }) {
  const SIZE = 108;
  const SW = 9;
  const R = (SIZE - SW) / 2;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.min(Math.max(score ?? 0, 0), 100);
  const offset = CIRC - (pct / 100) * CIRC;
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f97316" : "#ef4444";
  const hasScore = score !== null;

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        <G rotation="-90" origin={`${SIZE / 2},${SIZE / 2}`}>
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            stroke="rgba(255,255,255,0.08)" strokeWidth={SW} fill="none"
          />
          {hasScore && (
            <Circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              stroke={color} strokeWidth={SW} fill="none"
              strokeDasharray={`${CIRC}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </G>
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={[styles.ringScore, hasScore && { color }]}>
          {hasScore ? `${pct}%` : "—"}
        </Text>
        <Text style={styles.ringCaption}>SCORE</Text>
      </View>
    </View>
  );
}

// ── Greeting helper ───────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentJob = {
  id: string;
  jobName: string;
  jobAddr: string;
  jobType: string;
  confidence: number;
  createdAt: string;
};

const JOB_TYPE_LABELS: Record<string, string> = {
  hotwater:   "Plumbing",
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Install",
  electrical: "Electrical",
  hvac:       "HVAC",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [fullName,        setFullName]        = useState<string | null>(null);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [isEmployer,      setIsEmployer]      = useState(false);
  const [totalJobs,       setTotalJobs]       = useState(0);
  const [jobsThisMonth,   setJobsThisMonth]   = useState(0);
  const [avgConfidence,   setAvgConfidence]   = useState<number | null>(null);
  const [assignedCount,   setAssignedCount]   = useState(0);
  const [recentJobs,      setRecentJobs]      = useState<RecentJob[]>([]);
  const [unreadNotifs,    setUnreadNotifs]    = useState(0);

  // Checklist flags
  const [profileDone, setProfileDone] = useState(false);
  const [jobDone,     setJobDone]     = useState(false);
  const [pdfDone,     setPdfDone]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          // Profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, role, compliance_score")
            .eq("user_id", user.id)
            .single();

          if (active && profile) {
            if (profile.full_name?.trim()) {
              setFullName(profile.full_name.trim());
              setProfileDone(true);
            }
            if (profile.role === "employer") setIsEmployer(true);
            if (profile.compliance_score != null) setComplianceScore(profile.compliance_score);
          }

          // Jobs stats
          const thisMonthStart = new Date();
          thisMonthStart.setDate(1);
          thisMonthStart.setHours(0, 0, 0, 0);

          const { data: jobs } = await supabase
            .from("jobs")
            .select("id, job_name, job_addr, job_type, confidence, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (active && jobs) {
            setTotalJobs(jobs.length);
            if (jobs.length > 0) setJobDone(true);

            const monthJobs = jobs.filter(
              (j: any) => new Date(j.created_at) >= thisMonthStart
            );
            setJobsThisMonth(monthJobs.length);

            const withConf = jobs.filter((j: any) => typeof j.confidence === "number" && j.confidence > 0);
            if (withConf.length > 0) {
              setAvgConfidence(
                Math.round(withConf.reduce((s: number, j: any) => s + j.confidence, 0) / withConf.length)
              );
              // Use avg confidence as score if profile doesn't have one
              if (profile?.compliance_score == null) {
                setComplianceScore(
                  Math.round(withConf.reduce((s: number, j: any) => s + j.confidence, 0) / withConf.length)
                );
              }
            }

            setRecentJobs(
              jobs.slice(0, 3).map((j: any) => ({
                id: j.id,
                jobName: j.job_name,
                jobAddr: j.job_addr,
                jobType: j.job_type,
                confidence: j.confidence,
                createdAt: j.created_at,
              }))
            );
          }

          // Assigned jobs count
          try {
            const { count } = await supabase
              .from("jobs")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", user.id)
              .eq("status", "assigned");
            if (active) setAssignedCount(count ?? 0);
          } catch {}

          // Unread notifications
          try {
            const { count } = await supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("read", false);
            if (active) setUnreadNotifs(count ?? 0);
          } catch {}

        } catch {}

        // AsyncStorage flags
        try {
          const flag = await AsyncStorage.getItem("elemetric_pdf_generated");
          if (active && flag === "1") setPdfDone(true);
        } catch {}
      })();
      return () => { active = false; };
    }, [])
  );

  const allDone = profileDone && jobDone && pdfDone;
  const checklistCount = [profileDone, jobDone, pdfDone].filter(Boolean).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <Text style={styles.logo}>ELEMETRIC</Text>
        <Pressable
          style={styles.bellBtn}
          onPress={() => router.push("/notifications")}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadNotifs > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Greeting ── */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.greetingName} numberOfLines={1}>
            {fullName ?? "Welcome back"}
          </Text>
          {isEmployer && (
            <Text style={styles.greetingRole}>Employer Account</Text>
          )}
        </View>
        <ScoreRing score={complianceScore} />
      </View>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalJobs}</Text>
          <Text style={styles.statLabel}>Total Jobs</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMid]}>
          <Text style={styles.statValue}>{jobsThisMonth}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, avgConfidence !== null && {
            color: avgConfidence >= 80 ? "#22c55e" : avgConfidence >= 50 ? "#f97316" : "#ef4444"
          }]}>
            {avgConfidence !== null ? `${avgConfidence}%` : "—"}
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      {/* ── Quick actions ── */}
      <View style={styles.actionsGrid}>
        <Pressable style={styles.actionPrimary} onPress={() => router.push("/trade")}>
          <Text style={styles.actionPrimaryText}>New Job</Text>
          <Text style={styles.actionPrimaryArrow}>→</Text>
        </Pressable>
        <Pressable style={styles.actionSecondary} onPress={() => router.push("/(tabs)/liability-timeline")}>
          <Text style={styles.actionSecondaryText}>Timeline</Text>
        </Pressable>
        <Pressable style={styles.actionDanger} onPress={() => router.push("/near-miss")}>
          <Text style={styles.actionDangerText}>Near Miss</Text>
        </Pressable>
      </View>

      {/* ── Assigned jobs badge ── */}
      {assignedCount > 0 && (
        <Pressable style={styles.assignedBanner} onPress={() => router.push("/assigned-jobs")}>
          <View style={styles.assignedLeft}>
            <View style={styles.assignedBadge}>
              <Text style={styles.assignedBadgeNum}>{assignedCount}</Text>
            </View>
            <View>
              <Text style={styles.assignedTitle}>
                {assignedCount === 1 ? "Assigned Job" : "Assigned Jobs"} Pending
              </Text>
              <Text style={styles.assignedSub}>Tap to accept or view details</Text>
            </View>
          </View>
          <Text style={styles.assignedArrow}>→</Text>
        </Pressable>
      )}

      {/* ── Employer portal banner ── */}
      {isEmployer && (
        <Pressable style={styles.employerBanner} onPress={() => router.push("/employer/dashboard")}>
          <View>
            <Text style={styles.employerTitle}>Employer Portal</Text>
            <Text style={styles.employerSub}>Manage your team's compliance</Text>
          </View>
          <Text style={styles.assignedArrow}>→</Text>
        </Pressable>
      )}

      {/* ── Recent jobs ── */}
      {recentJobs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            <Pressable onPress={() => router.push("/plumbing/jobs")}>
              <Text style={styles.sectionLink}>View all →</Text>
            </Pressable>
          </View>
          <View style={styles.recentList}>
            {recentJobs.map((job) => (
              <View key={job.id} style={styles.recentCard}>
                <View style={styles.recentCardLeft}>
                  <Text style={styles.recentJobName} numberOfLines={1}>{job.jobName}</Text>
                  <Text style={styles.recentJobAddr} numberOfLines={1}>{job.jobAddr}</Text>
                  <Text style={styles.recentJobType}>
                    {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                    {" · "}
                    {new Date(job.createdAt).toLocaleDateString("en-AU", {
                      day: "numeric", month: "short"
                    })}
                  </Text>
                </View>
                <View style={[
                  styles.recentConfBadge,
                  { borderColor: (job.confidence >= 80 ? "#22c55e" : job.confidence >= 50 ? "#f97316" : "#ef4444") + "44" }
                ]}>
                  <Text style={[
                    styles.recentConfText,
                    { color: job.confidence >= 80 ? "#22c55e" : job.confidence >= 50 ? "#f97316" : "#ef4444" }
                  ]}>
                    {job.confidence}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Past jobs shortcut (if no recent jobs yet) ── */}
      {recentJobs.length === 0 && jobDone && (
        <Pressable style={styles.plainBtn} onPress={() => router.push("/plumbing/jobs")}>
          <Text style={styles.plainBtnText}>Past Jobs</Text>
          <Text style={styles.plainBtnArrow}>→</Text>
        </Pressable>
      )}

      {/* ── Getting started checklist ── */}
      {!allDone && (
        <View style={styles.checklistCard}>
          <View style={styles.checklistHeader}>
            <Text style={styles.checklistTitle}>Getting Started</Text>
            <Text style={styles.checklistProgress}>{checklistCount}/3</Text>
          </View>
          <Text style={styles.checklistSub}>Complete these steps to get the most out of Elemetric</Text>
          <ChecklistItem done={profileDone} label="Add your profile details"
            hint="Licence number and company appear in your reports"
            onPress={() => router.push("/(tabs)/profile")} />
          <ChecklistItem done={jobDone} label="Complete your first job"
            hint="Run a checklist and AI analysis"
            onPress={() => router.push("/trade")} />
          <ChecklistItem done={pdfDone} label="Generate your first PDF report"
            hint="Export a compliance report to share or store"
            onPress={() => router.push("/plumbing/jobs")} />
        </View>
      )}

      {allDone && (
        <View style={styles.allDoneCard}>
          <Text style={styles.allDoneText}>✓ Setup complete — you're all set!</Text>
        </View>
      )}

    </ScrollView>
  );
}

// ── Checklist item ────────────────────────────────────────────────────────────

function ChecklistItem({
  done, label, hint, onPress,
}: {
  done: boolean; label: string; hint: string; onPress: () => void;
}) {
  return (
    <Pressable style={styles.checkItem} onPress={!done ? onPress : undefined}>
      <View style={[styles.checkBox, done && styles.checkBoxDone]}>
        {done && <Text style={styles.checkTick}>✓</Text>}
      </View>
      <View style={styles.checkTextWrap}>
        <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{label}</Text>
        {!done && <Text style={styles.checkHint}>{hint}</Text>}
      </View>
      {!done && <Text style={styles.checkArrow}>›</Text>}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  body: { padding: 20, paddingTop: 44, paddingBottom: 60, gap: 14 },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 22, fontWeight: "900", color: "#f97316", letterSpacing: 2 },
  bellBtn: { position: "relative", padding: 4 },
  bellIcon: { fontSize: 22 },
  bellBadge: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: "#ef4444", borderRadius: 8,
    minWidth: 16, paddingHorizontal: 3, paddingVertical: 1,
    alignItems: "center",
  },
  bellBadgeText: { color: "white", fontSize: 9, fontWeight: "900" },

  // Greeting + score
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  greetingText: { flex: 1, paddingRight: 12 },
  greeting: { color: "rgba(255,255,255,0.55)", fontSize: 16 },
  greetingName: { color: "white", fontSize: 26, fontWeight: "900", marginTop: 2 },
  greetingRole: { color: "#f97316", fontSize: 13, fontWeight: "700", marginTop: 4 },

  // Score ring
  ringLabel: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },
  ringScore: { color: "rgba(255,255,255,0.5)", fontSize: 22, fontWeight: "900" },
  ringCaption: { color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12, alignItems: "center", gap: 3,
  },
  statCardMid: {
    borderColor: "rgba(249,115,22,0.20)",
    backgroundColor: "rgba(249,115,22,0.06)",
  },
  statValue: { color: "white", fontSize: 22, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", textAlign: "center" },

  // Actions
  actionsGrid: { flexDirection: "row", gap: 10 },
  actionPrimary: {
    flex: 2,
    backgroundColor: "#f97316",
    borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  actionPrimaryText: { color: "#0b1220", fontWeight: "900", fontSize: 17 },
  actionPrimaryArrow: { color: "#0b1220", fontSize: 22, fontWeight: "300" },
  actionSecondary: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  actionSecondaryText: { color: "white", fontWeight: "800", fontSize: 14, textAlign: "center" },
  actionDanger: {
    flex: 1,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  actionDangerText: { color: "#f87171", fontWeight: "800", fontSize: 14, textAlign: "center" },

  // Assigned jobs banner
  assignedBanner: {
    backgroundColor: "rgba(59,130,246,0.08)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(59,130,246,0.25)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  assignedLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  assignedBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center",
  },
  assignedBadgeNum: { color: "white", fontWeight: "900", fontSize: 16 },
  assignedTitle: { color: "#93c5fd", fontWeight: "800", fontSize: 15 },
  assignedSub: { color: "rgba(147,197,253,0.65)", fontSize: 12, marginTop: 2 },
  assignedArrow: { color: "rgba(255,255,255,0.35)", fontSize: 22, fontWeight: "300" },

  // Employer banner
  employerBanner: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(249,115,22,0.22)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  employerTitle: { color: "#f97316", fontSize: 16, fontWeight: "800" },
  employerSub: { color: "rgba(249,115,22,0.65)", fontSize: 12, marginTop: 3 },

  // Recent jobs section
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionLink: { color: "#f97316", fontSize: 13, fontWeight: "700" },
  recentList: { gap: 8 },
  recentCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 13,
  },
  recentCardLeft: { flex: 1 },
  recentJobName: { color: "white", fontWeight: "800", fontSize: 14 },
  recentJobAddr: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  recentJobType: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
  recentConfBadge: {
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, backgroundColor: "transparent",
  },
  recentConfText: { fontWeight: "900", fontSize: 13 },

  // Plain button
  plainBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  plainBtnText: { color: "white", fontSize: 17, fontWeight: "800" },
  plainBtnArrow: { color: "rgba(255,255,255,0.35)", fontSize: 22, fontWeight: "300" },

  // Checklist
  checklistCard: {
    borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    backgroundColor: "rgba(249,115,22,0.06)",
    padding: 18,
  },
  checklistHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  checklistTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  checklistProgress: { color: "#f97316", fontWeight: "900", fontSize: 15 },
  checklistSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 14 },
  checkItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  checkBox: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  checkBoxDone: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkTick: { color: "white", fontSize: 14, fontWeight: "900" },
  checkTextWrap: { flex: 1 },
  checkLabel: { color: "white", fontWeight: "800", fontSize: 15 },
  checkLabelDone: { color: "rgba(255,255,255,0.45)", textDecorationLine: "line-through" },
  checkHint: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  checkArrow: { color: "rgba(255,255,255,0.35)", fontSize: 22, fontWeight: "300" },

  allDoneCard: {
    borderRadius: 14, padding: 14,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1, borderColor: "rgba(34,197,94,0.25)",
    alignItems: "center",
  },
  allDoneText: { color: "#22c55e", fontWeight: "900", fontSize: 14 },
});
