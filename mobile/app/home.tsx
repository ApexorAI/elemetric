import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

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

  const [firstName,      setFirstName]      = useState<string | null>(null);
  const [recentJobs,     setRecentJobs]     = useState<RecentJob[]>([]);
  const [jobCount,       setJobCount]       = useState(0);
  const [isProtected,    setIsProtected]    = useState(false);
  const [loading,        setLoading]        = useState(true);

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
            .select("full_name")
            .eq("user_id", user.id)
            .single();

          if (active && profile?.full_name) {
            const first = profile.full_name.trim().split(" ")[0];
            setFirstName(first);
          }

          // Load recent jobs (last 2 only)
          const { data: jobs } = await supabase
            .from("jobs")
            .select("id, job_name, job_addr, job_type, confidence, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(2);

          // Total job count
          const { count } = await supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
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
            setJobCount(count ?? 0);
            setIsProtected((count ?? 0) > 0);
          }
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const hasJobs = jobCount > 0;

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

      {/* ── Primary CTA ── */}
      <Pressable
        style={s.startBtn}
        onPress={() => router.push("/trade")}
        accessibilityRole="button"
        accessibilityLabel="Start a New Job"
        accessibilityHint="Opens the trade selector to begin a new compliance job"
      >
        <Text style={s.startBtnText}>Start a New Job</Text>
        <Text style={s.startBtnSub}>Takes under 60 seconds</Text>
      </Pressable>

      {/* ── Stat pills ── */}
      <View style={s.pillRow}>
        <View style={s.pill}>
          <Text style={s.pillValue}>{loading ? "—" : jobCount}</Text>
          <Text style={s.pillLabel}>{jobCount === 1 ? "Job" : "Jobs"}</Text>
        </View>
        <View style={[s.pill, isProtected && s.pillProtected]}>
          <Text style={[s.pillValue, isProtected && s.pillValueProtected]}>
            {isProtected ? "✓" : "○"}
          </Text>
          <Text style={[s.pillLabel, isProtected && s.pillLabelProtected]}>
            {isProtected ? "Protected" : "Not yet"}
          </Text>
        </View>
      </View>

      {/* ── Recent jobs ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>RECENT JOBS</Text>

        {loading ? null : hasJobs ? (
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

      {/* ── Unlock prompt (only shown when no jobs) ── */}
      {!loading && !hasJobs && (
        <Text style={s.unlockHint}>
          Document your first job to unlock more tools
        </Text>
      )}

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

  // Primary CTA
  startBtn: {
    backgroundColor: "#f97316",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 6,
    marginTop: 4,
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

  // Stat pills
  pillRow: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    flex: 1,
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  pillProtected: {
    borderColor: "rgba(34,197,94,0.30)",
    backgroundColor: "rgba(34,197,94,0.07)",
  },
  pillValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  pillValueProtected: {
    color: "#22c55e",
  },
  pillLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "600",
  },
  pillLabelProtected: {
    color: "rgba(34,197,94,0.70)",
  },

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

  // Unlock hint
  unlockHint: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 20,
  },
});
