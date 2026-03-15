import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
} from "react-native";
import { SkeletonBox, SkeletonHomeCard } from "@/components/SkeletonLoader";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Circle, G } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import Constants from "expo-constants";

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number | null }) {
  const SIZE = 96;
  const SW = 8;
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
      <View style={s.ringInner}>
        <Text style={[s.ringScore, hasScore && { color }]}>
          {hasScore ? `${pct}%` : "—"}
        </Text>
        <Text style={s.ringCaption}>SCORE</Text>
      </View>
    </View>
  );
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function greeting(): string {
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

const TYPE_LABEL: Record<string, string> = {
  hotwater:   "Plumbing",
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Install",
  electrical: "Electrical",
  hvac:       "HVAC",
  carpentry:  "Carpentry",
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [fullName,        setFullName]        = useState<string | null>(null);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [unreadNotifs,    setUnreadNotifs]    = useState(0);
  const [recentJobs,      setRecentJobs]      = useState<RecentJob[]>([]);
  const [isEmployer,      setIsEmployer]      = useState(false);
  const [assignedCount,   setAssignedCount]   = useState(0);
  const [updateBanner,    setUpdateBanner]    = useState(false);
  const [homeLoading,     setHomeLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://elemetric.com.au/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const current = Constants.expoConfig?.version ?? "0.0.0";
        if (data?.version && data.version !== current) setUpdateBanner(true);
      } catch {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, role, compliance_score")
            .eq("user_id", user.id)
            .single();

          if (active && profile) {
            if (profile.full_name?.trim()) setFullName(profile.full_name.trim());
            if (profile.role === "employer") setIsEmployer(true);
            if (profile.compliance_score != null) setComplianceScore(profile.compliance_score);
          }

          const { data: jobs } = await supabase
            .from("jobs")
            .select("id, job_name, job_addr, job_type, confidence, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3);

          if (active && jobs) {
            setRecentJobs(
              jobs.map((j: any) => ({
                id: j.id,
                jobName: j.job_name,
                jobAddr: j.job_addr,
                jobType: j.job_type,
                confidence: j.confidence,
                createdAt: j.created_at,
              }))
            );
            if (profile?.compliance_score == null) {
              const withConf = jobs.filter((j: any) => j.confidence > 0);
              if (withConf.length > 0 && active) {
                setComplianceScore(
                  Math.round(withConf.reduce((s: number, j: any) => s + j.confidence, 0) / withConf.length)
                );
              }
            }
          }

          try {
            const { count } = await supabase
              .from("jobs")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", user.id)
              .eq("status", "assigned");
            if (active) setAssignedCount(count ?? 0);
          } catch {}

          try {
            const { count } = await supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("read", false);
            if (active) setUnreadNotifs(count ?? 0);
          } catch {}
        } catch {}
        if (active) setHomeLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const confColor = (c: number) => c >= 80 ? "#22c55e" : c >= 50 ? "#f97316" : "#ef4444";

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.brand} accessibilityRole="text" accessibilityLabel="Elemetric">ELEMETRIC</Text>
        <Pressable
          style={s.bellBtn}
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel={unreadNotifs > 0 ? `Notifications, ${unreadNotifs} unread` : "Notifications"}
          accessibilityHint="Opens the notifications centre"
        >
          <Text style={s.bellIcon}>🔔</Text>
          {unreadNotifs > 0 && (
            <View style={s.bellDot}>
              <Text style={s.bellDotText}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Version update banner */}
      {updateBanner && (
        <Pressable
          style={s.updateBanner}
          onPress={() => Linking.openURL("https://apps.apple.com/au/app/elemetric/id6745204858").catch(() => {})}
        >
          <Text style={s.updateBannerText}>New version available — update now</Text>
          <Pressable onPress={() => setUpdateBanner(false)} hitSlop={10}>
            <Text style={s.updateBannerClose}>✕</Text>
          </Pressable>
        </Pressable>
      )}

      {/* Greeting + score ring */}
      <View style={s.greetRow}>
        <View style={s.greetText}>
          <Text style={s.greetLine}>{greeting()},</Text>
          <Text style={s.greetName} numberOfLines={1}>{fullName ?? "Welcome back"}</Text>
          {isEmployer && <Text style={s.greetRole}>Employer Account</Text>}
        </View>
        <ScoreRing score={complianceScore} />
      </View>

      {/* Start New Job — primary CTA */}
      <Pressable
        style={s.newJobBtn}
        onPress={() => router.push("/trade")}
        accessibilityRole="button"
        accessibilityLabel="Start New Job"
        accessibilityHint="Opens the trade selector to begin a new compliance job"
      >
        <Text style={s.newJobText}>Start New Job</Text>
        <Text style={s.newJobArrow}>→</Text>
      </Pressable>

      {/* Secondary actions */}
      <View style={s.secondaryRow}>
        <Pressable
          style={s.secondaryBtn}
          onPress={() => router.push("/near-miss")}
          accessibilityRole="button"
          accessibilityLabel="Near Miss Report"
          accessibilityHint="Document a pre-existing non-compliance issue"
        >
          <Text style={s.secondaryBtnText}>Near Miss</Text>
        </Pressable>
        <Pressable
          style={s.secondaryBtn}
          onPress={() => router.push("/client-portal")}
          accessibilityRole="button"
          accessibilityLabel="Client Portal"
          accessibilityHint="Share compliance records with a client"
        >
          <Text style={s.secondaryBtnText}>Client Portal</Text>
        </Pressable>
        <Pressable
          style={[s.secondaryBtn, s.visualiserBtn]}
          onPress={() => router.push("/(tabs)/visualiser")}
          accessibilityRole="button"
          accessibilityLabel="AI Visualiser, beta feature"
          accessibilityHint="Opens the HVAC product reference visualiser"
        >
          <Text style={s.visualiserText}>✦ AI Visualiser</Text>
          <View style={s.betaBadge}>
            <Text style={s.betaText}>BETA</Text>
          </View>
        </Pressable>
      </View>

      {/* Assigned jobs banner */}
      {assignedCount > 0 && (
        <Pressable
          style={s.assignedBanner}
          onPress={() => router.push("/assigned-jobs")}
          accessibilityRole="button"
          accessibilityLabel={`${assignedCount} assigned ${assignedCount === 1 ? "job" : "jobs"} pending`}
          accessibilityHint="View and accept your assigned jobs"
        >
          <View style={s.assignedLeft}>
            <View style={s.assignedDot}>
              <Text style={s.assignedDotNum}>{assignedCount}</Text>
            </View>
            <View>
              <Text style={s.assignedTitle}>
                {assignedCount === 1 ? "Assigned Job" : "Assigned Jobs"} Pending
              </Text>
              <Text style={s.assignedSub}>Tap to accept or view details</Text>
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      )}

      {/* Employer portal banner */}
      {isEmployer && (
        <Pressable
          style={s.employerBanner}
          onPress={() => router.push("/employer/dashboard")}
          accessibilityRole="button"
          accessibilityLabel="Employer Portal"
          accessibilityHint="Manage your team's compliance"
        >
          <View>
            <Text style={s.employerTitle}>Employer Portal</Text>
            <Text style={s.employerSub}>Manage your team's compliance</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      )}

      {/* Recent jobs */}
      {homeLoading ? (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>RECENT JOBS</Text>
          </View>
          {[1,2,3].map((i) => <SkeletonHomeCard key={i} />)}
        </View>
      ) : recentJobs.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>RECENT JOBS</Text>
            <Pressable onPress={() => router.push("/plumbing/jobs")}>
              <Text style={s.sectionLink}>View all →</Text>
            </Pressable>
          </View>
          {recentJobs.map((job) => (
            <View key={job.id} style={s.jobCard}>
              <View style={s.jobCardLeft}>
                <Text style={s.jobName} numberOfLines={1}>{job.jobName}</Text>
                <Text style={s.jobAddr} numberOfLines={1}>{job.jobAddr}</Text>
                <Text style={s.jobMeta}>
                  {TYPE_LABEL[job.jobType] ?? job.jobType}
                  {" · "}
                  {new Date(job.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                </Text>
              </View>
              {job.confidence > 0 && (
                <View style={[s.confBadge, { borderColor: confColor(job.confidence) + "44" }]}>
                  <Text style={[s.confText, { color: confColor(job.confidence) }]}>
                    {job.confidence}%
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  body: { padding: 20, paddingTop: 48, paddingBottom: 60, gap: 14 },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  bellBtn: { position: "relative", padding: 4 },
  bellIcon: { fontSize: 22 },
  bellDot: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: "#ef4444", borderRadius: 8,
    minWidth: 16, paddingHorizontal: 3, paddingVertical: 1,
    alignItems: "center",
  },
  bellDotText: { color: "white", fontSize: 9, fontWeight: "900" },

  // Greeting
  greetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  greetText: { flex: 1, paddingRight: 12 },
  greetLine: { color: "rgba(255,255,255,0.50)", fontSize: 15 },
  greetName: { color: "white", fontSize: 28, fontWeight: "900", marginTop: 2 },
  greetRole: { color: "#f97316", fontSize: 13, fontWeight: "700", marginTop: 4 },

  // Score ring
  ringInner: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },
  ringScore: { color: "rgba(255,255,255,0.45)", fontSize: 20, fontWeight: "900" },
  ringCaption: { color: "rgba(255,255,255,0.30)", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },

  // New Job CTA
  newJobBtn: {
    backgroundColor: "#f97316",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  newJobText: { color: "#0b1220", fontWeight: "900", fontSize: 20 },
  newJobArrow: { color: "#0b1220", fontSize: 26, fontWeight: "300" },

  // Secondary row
  secondaryRow: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "white", fontWeight: "800", fontSize: 14 },
  visualiserBtn: {
    flexDirection: "row",
    gap: 8,
    borderColor: "rgba(249,115,22,0.25)",
    backgroundColor: "rgba(249,115,22,0.06)",
  },
  visualiserText: { color: "#f97316", fontWeight: "800", fontSize: 14 },
  betaBadge: {
    backgroundColor: "#f97316",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: "center",
  },
  betaText: { color: "#0b1220", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },

  // Assigned banner
  assignedBanner: {
    backgroundColor: "rgba(59,130,246,0.07)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  assignedLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  assignedDot: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center",
  },
  assignedDotNum: { color: "white", fontWeight: "900", fontSize: 16 },
  assignedTitle: { color: "#93c5fd", fontWeight: "800", fontSize: 14 },
  assignedSub: { color: "rgba(147,197,253,0.60)", fontSize: 12, marginTop: 1 },

  // Employer banner
  employerBanner: {
    backgroundColor: "rgba(249,115,22,0.07)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  employerTitle: { color: "#f97316", fontSize: 15, fontWeight: "800" },
  employerSub: { color: "rgba(249,115,22,0.60)", fontSize: 12, marginTop: 2 },

  chevron: { color: "rgba(255,255,255,0.30)", fontSize: 24, fontWeight: "300" },

  // Version update banner
  updateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.30)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  updateBannerText: {
    flex: 1,
    color: "#22c55e",
    fontWeight: "800",
    fontSize: 13,
  },
  updateBannerClose: {
    color: "rgba(34,197,94,0.60)",
    fontSize: 14,
    fontWeight: "700",
    paddingLeft: 10,
  },

  // Recent jobs
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionLink: { color: "#f97316", fontSize: 13, fontWeight: "700" },

  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 13,
  },
  jobCardLeft: { flex: 1 },
  jobName: { color: "white", fontWeight: "800", fontSize: 15 },
  jobAddr: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 },
  jobMeta: { color: "rgba(255,255,255,0.30)", fontSize: 11, marginTop: 2 },

  confBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  confText: { fontWeight: "900", fontSize: 13 },
});
