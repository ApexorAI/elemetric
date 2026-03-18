import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { supabase } from "@/lib/supabase";

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

          // Load recent jobs (last 3)
          const { data: jobs } = await supabase
            .from("jobs")
            .select("id, job_name, job_addr, job_type, confidence, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3);

          // Total job count + compliance score
          const { data: allJobs } = await supabase
            .from("jobs")
            .select("confidence")
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
      <View style={s.scoreCard}>
        <View style={s.scoreLeft}>
          <Text style={s.scoreTitle}>Compliance Score</Text>
          <Text style={s.scoreSub}>
            {complianceScore === null
              ? "Complete a job to generate your score"
              : `Based on ${jobCount} job${jobCount === 1 ? "" : "s"}`}
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
      </View>

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
        <Text style={s.sectionLabel}>RECENT JOBS</Text>

        {loading ? null : recentJobs.length > 0 ? (
          recentJobs.map((job) => (
            <View key={job.id} style={s.jobCard}>
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
            </View>
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
  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
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
});
