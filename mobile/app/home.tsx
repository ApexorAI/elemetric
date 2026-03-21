import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import { SkeletonHomeCard } from "@/components/SkeletonLoader";

// ── Greeting ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Compliance score ring ─────────────────────────────────────────────────────

const RING_R = 34;
const RING_SW = 8;
const RING_SIZE = (RING_R + RING_SW) * 2 + 4;
const RING_CIRC = 2 * Math.PI * RING_R;

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

function ComplianceRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const offset = RING_CIRC * (1 - pct / 100);
  const color = scoreColor(pct);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <Circle cx={cx} cy={cy} r={RING_R} stroke="rgba(255,255,255,0.10)" strokeWidth={RING_SW} fill="none" />
      <Circle
        cx={cx} cy={cy} r={RING_R}
        stroke={color} strokeWidth={RING_SW} fill="none"
        strokeDasharray={`${RING_CIRC}`} strokeDashoffset={`${offset}`}
        strokeLinecap="round"
        transform={`rotate(-90, ${cx}, ${cy})`}
      />
      <SvgText x={cx} y={cy + 7} textAnchor="middle" fontSize="19" fontWeight="900" fill={color}>
        {pct}
      </SvgText>
    </Svg>
  );
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

const TYPE_ICON: Record<string, string> = {
  hotwater:   "🔧",
  gas:        "🔥",
  drainage:   "🚿",
  newinstall: "🏗️",
  electrical: "⚡",
  hvac:       "❄️",
  carpentry:  "🪚",
};

const TYPE_LABEL: Record<string, string> = {
  hotwater:   "Hot Water",
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Installation",
  electrical: "Electrical",
  hvac:       "HVAC",
  carpentry:  "Carpentry",
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [firstName,       setFirstName]       = useState<string | null>(null);
  const [recentJobs,      setRecentJobs]      = useState<RecentJob[]>([]);
  const [jobCount,        setJobCount]        = useState(0);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [trialDaysLeft,   setTrialDaysLeft]   = useState<number | null>(null);
  const [scoreModalOpen,  setScoreModalOpen]  = useState(false);
  const [typeBreakdown,   setTypeBreakdown]   = useState<{ type: string; avg: number; count: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          // Load profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, role, beta_tester, trial_started_at")
            .eq("user_id", user.id)
            .single();

          if (active && profile?.full_name) {
            setFirstName(profile.full_name.trim().split(" ")[0]);
          }

          // Calculate trial days remaining
          if (active) {
            const role = profile?.role ?? "free";
            const isPaid = role && role !== "free";
            const isBeta = profile?.beta_tester === true;
            if (!isPaid && !isBeta && profile?.trial_started_at) {
              const trialStart = new Date(profile.trial_started_at);
              const daysSince = Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
              const daysRemaining = 14 - daysSince;
              if (daysRemaining >= 1 && daysRemaining <= 14) {
                setTrialDaysLeft(daysRemaining);
              } else {
                setTrialDaysLeft(null);
              }
            } else {
              setTrialDaysLeft(null);
            }
          }

          // Load recent jobs (last 2)
          const { data: jobs } = await supabase
            .from("jobs")
            .select("id, job_name, job_addr, job_type, confidence, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(2);

          // Total job count + compliance score
          const { data: allJobs } = await supabase
            .from("jobs")
            .select("confidence, job_type")
            .eq("user_id", user.id);

          if (active) {
            const jobList = (jobs ?? []).map((j: any) => ({
              id: j.id,
              jobName: j.job_name ?? "Untitled Job",
              jobAddr: j.job_addr ?? "",
              jobType: j.job_type ?? "",
              confidence: j.confidence ?? 0,
              createdAt: j.created_at,
            }));
            setRecentJobs(jobList);
            setJobCount(allJobs?.length ?? 0);
            if (allJobs && allJobs.length > 0) {
              const avg = Math.round(
                allJobs.reduce((s: number, j: any) => s + (j.confidence ?? 0), 0) / allJobs.length
              );
              setComplianceScore(avg);

              // Per-type breakdown
              const byType: Record<string, { total: number; count: number }> = {};
              allJobs.forEach((j: any) => {
                const t = j.job_type ?? "other";
                if (!byType[t]) byType[t] = { total: 0, count: 0 };
                byType[t].total += j.confidence ?? 0;
                byType[t].count += 1;
              });
              const breakdown = Object.entries(byType)
                .map(([type, { total, count }]) => ({ type, avg: Math.round(total / count), count }))
                .sort((a, b) => b.avg - a.avg);
              setTypeBreakdown(breakdown);
            }
          }
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.body}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Wordmark ── */}
      <Text style={s.wordmark}>ELEMETRIC</Text>

      {/* ── Greeting ── */}
      <Text style={s.greeting}>
        {greeting()}{firstName ? `, ${firstName}` : ""}
      </Text>

      {/* ── Compliance score ring ── */}
      <Pressable
        style={s.scoreCard}
        onPress={() => complianceScore !== null && setScoreModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="View compliance score breakdown"
        accessibilityHint="Opens a breakdown of your compliance score by job type"
      >
        <View style={s.scoreLeft}>
          <Text style={s.scoreTitle}>Compliance Score</Text>
          <Text style={s.scoreSub}>
            {complianceScore === null
              ? "Complete a job to generate your score"
              : `Based on ${jobCount} job${jobCount === 1 ? "" : "s"} — tap to break down`}
          </Text>
          {complianceScore !== null && (
            <View style={[s.scoreBadge, {
              borderColor: scoreColor(complianceScore) + "50",
              backgroundColor: scoreColor(complianceScore) + "18",
            }]}>
              <Text style={[s.scoreBadgeText, { color: scoreColor(complianceScore) }]}>
                {complianceScore >= 80 ? "Excellent" : complianceScore >= 50 ? "Good" : "Needs Attention"}
              </Text>
            </View>
          )}
        </View>
        <View style={s.scoreRight}>
          {complianceScore !== null ? (
            <ComplianceRing score={complianceScore} />
          ) : (
            <View style={[s.scorePlaceholder, { width: RING_SIZE, height: RING_SIZE }]}>
              <Text style={s.scorePlaceholderText}>—</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* ── Score breakdown modal ── */}
      <Modal
        visible={scoreModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setScoreModalOpen(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setScoreModalOpen(false)} accessibilityRole="button" accessibilityLabel="Close score breakdown">
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Compliance Breakdown</Text>
            <Text style={s.modalSub}>Average AI confidence score by job type</Text>

            <View style={s.breakdownList}>
              {typeBreakdown.map((row) => (
                <View key={row.type} style={s.breakdownRow}>
                  <Text style={s.breakdownIcon}>{TYPE_ICON[row.type] ?? "📋"}</Text>
                  <View style={s.breakdownInfo}>
                    <Text style={s.breakdownLabel}>{TYPE_LABEL[row.type] ?? row.type}</Text>
                    <Text style={s.breakdownCount}>{row.count} job{row.count !== 1 ? "s" : ""}</Text>
                  </View>
                  <View style={s.breakdownBar}>
                    <View style={[s.breakdownFill, { width: `${row.avg}%` as any, backgroundColor: scoreColor(row.avg) }]} />
                  </View>
                  <Text style={[s.breakdownScore, { color: scoreColor(row.avg) }]}>{row.avg}%</Text>
                </View>
              ))}
            </View>

            <View style={s.modalDivider} />
            <View style={s.modalOverallRow}>
              <Text style={s.modalOverallLabel}>Overall average</Text>
              <Text style={[s.modalOverallScore, { color: scoreColor(complianceScore ?? 0) }]}>
                {complianceScore}%
              </Text>
            </View>

            <Pressable style={s.modalClose} onPress={() => setScoreModalOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Trial banner ── */}
      {trialDaysLeft !== null && (
        <Pressable
          style={s.trialBanner}
          onPress={() => router.push("/subscription")}
          accessibilityRole="button"
          accessibilityLabel="Trial banner — upgrade to Pro"
        >
          <Text style={s.trialBannerIcon}>📅</Text>
          <View style={s.trialBannerText}>
            <Text style={s.trialBannerTitle}>
              {trialDaysLeft === 1
                ? "Last day of your free trial — upgrade now"
                : `${trialDaysLeft} days left in your free trial`}
            </Text>
            <Text style={s.trialBannerSub}>Upgrade to Pro for unlimited jobs →</Text>
          </View>
        </Pressable>
      )}

      {/* ── Primary CTA ── */}
      <Pressable
        style={s.startBtn}
        onPress={() => router.push("/trade")}
        accessibilityRole="button"
        accessibilityLabel="Start a New Job"
      >
        <Text style={s.startBtnText}>Start a New Job</Text>
        <Text style={s.startBtnSub}>Takes under 60 seconds</Text>
      </Pressable>

      {/* ── Quick actions ── */}
      <View style={s.quickRow}>
        <Pressable
          style={s.quickCard}
          onPress={() => router.push("/near-miss")}
          accessibilityRole="button"
          accessibilityLabel="Report a Problem"
        >
          <Text style={s.quickIcon}>⚠️</Text>
          <Text style={s.quickLabel}>Near Miss</Text>
          <Text style={s.quickSub}>Report a problem found</Text>
        </Pressable>
        <Pressable
          style={s.quickCard}
          onPress={() => router.push("/referral")}
          accessibilityRole="button"
          accessibilityLabel="Refer a Friend"
        >
          <Text style={s.quickIcon}>🎁</Text>
          <Text style={s.quickLabel}>Refer</Text>
          <Text style={s.quickSub}>Earn rewards</Text>
        </Pressable>
      </View>

      {/* ── Recent jobs ── */}
      <View style={s.section}>
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>RECENT JOBS</Text>
          {recentJobs.length > 0 && (
            <Pressable onPress={() => router.push("/(tabs)/jobs")} accessibilityRole="link" accessibilityLabel="View all jobs">
              <Text style={s.sectionLink}>View all →</Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <>
            <SkeletonHomeCard />
            <SkeletonHomeCard />
          </>
        ) : recentJobs.length > 0 ? (
          recentJobs.map((job) => (
            <Pressable
              key={job.id}
              style={s.jobCard}
              onPress={() => router.push("/(tabs)/jobs")}
              accessibilityRole="button"
              accessibilityLabel={`View job at ${job.jobAddr}`}
            >
              <View style={s.jobIcon}>
                <Text style={s.jobIconText}>{TYPE_ICON[job.jobType] ?? "📋"}</Text>
              </View>
              <View style={s.jobInfo}>
                <Text style={s.jobName} numberOfLines={1}>{job.jobName}</Text>
                <Text style={s.jobAddr} numberOfLines={1}>{job.jobAddr}</Text>
                <Text style={s.jobMeta}>
                  {TYPE_LABEL[job.jobType] ?? job.jobType}
                  {" · "}
                  {new Date(job.createdAt).toLocaleDateString("en-AU", {
                    day: "numeric", month: "short",
                  })}
                </Text>
              </View>
              {job.confidence > 0 && (
                <Text style={[
                  s.jobScore,
                  { color: job.confidence >= 80 ? "#22c55e" : job.confidence >= 50 ? "#f97316" : "#ef4444" },
                ]}>
                  {job.confidence}%
                </Text>
              )}
            </Pressable>
          ))
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No jobs yet — tap above to start</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  body: { padding: 20, paddingTop: 52, paddingBottom: 60, gap: 16 },

  wordmark: {
    color: "#f97316",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },

  greeting: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 32,
  },

  // Compliance score ring card
  scoreCard: {
    backgroundColor: "#0f2035",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreLeft: { flex: 1, paddingRight: 12 },
  scoreTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  scoreSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  scoreBadge: {
    marginTop: 10, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  scoreBadgeText: { fontWeight: "700", fontSize: 12 },
  scoreRight: {},
  scorePlaceholder: {
    borderRadius: RING_SIZE / 2, borderWidth: 3,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  scorePlaceholderText: { color: "rgba(255,255,255,0.35)", fontSize: 20, fontWeight: "900" },

  // Trial banner
  trialBanner: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f97316",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trialBannerIcon: { fontSize: 22 },
  trialBannerText: { flex: 1 },
  trialBannerTitle: { color: "#f97316", fontWeight: "700", fontSize: 14, lineHeight: 20 },
  trialBannerSub: { color: "rgba(249,115,22,0.70)", fontSize: 12, marginTop: 2 },

  // Primary CTA
  startBtn: {
    backgroundColor: "#f97316",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 6,
  },
  startBtnText: {
    color: "#07152b",
    fontSize: 22,
    fontWeight: "900",
  },
  startBtnSub: {
    color: "rgba(7,21,43,0.60)",
    fontSize: 13,
    fontWeight: "600",
  },

  // Quick actions
  quickRow: { flexDirection: "row", gap: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    gap: 4,
    alignItems: "flex-start",
  },
  quickIcon: { fontSize: 22, marginBottom: 2 },
  quickLabel: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  quickSub: { color: "rgba(255,255,255,0.40)", fontSize: 11 },

  // Section
  section: { gap: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionLink: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "700",
  },

  // Job cards
  jobCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  jobIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(249,115,22,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  jobIconText: { fontSize: 20 },
  jobInfo: { flex: 1 },
  jobName: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  jobAddr: { color: "rgba(255,255,255,0.50)", fontSize: 13, marginTop: 1 },
  jobMeta: { color: "rgba(255,255,255,0.30)", fontSize: 11, marginTop: 2 },
  jobScore: { fontSize: 14, fontWeight: "900", flexShrink: 0 },

  // Empty state
  emptyCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderStyle: "dashed",
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Score breakdown modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#0f2035",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },
  modalSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
  },
  breakdownList: { gap: 12, marginTop: 4 },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownIcon: { fontSize: 20, width: 26 },
  breakdownInfo: { width: 100 },
  breakdownLabel: { color: "white", fontSize: 13, fontWeight: "700" },
  breakdownCount: { color: "rgba(255,255,255,0.40)", fontSize: 11 },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  breakdownFill: { height: 8, borderRadius: 4 },
  breakdownScore: { fontSize: 13, fontWeight: "900", width: 36, textAlign: "right" },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginVertical: 4,
  },
  modalOverallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOverallLabel: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
  modalOverallScore: { fontSize: 22, fontWeight: "900" },
  modalClose: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCloseText: { color: "white", fontWeight: "700", fontSize: 15 },
});
