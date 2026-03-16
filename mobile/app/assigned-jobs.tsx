import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

type AssignedJob = {
  id: string;
  jobType: string;
  jobName: string;
  jobAddr: string;
  scheduledDate: string | null;
  status: string;
};

const JOB_TYPE_LABELS: Record<string, string> = {
  hotwater:   "Plumbing",
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Install",
  electrical: "Electrical",
  hvac:       "HVAC",
};

export default function AssignedJobs() {
  const router = useRouter();
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  const loadJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("assigned_to", user.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        setJobs(data.map((row: any) => ({
          id: row.id,
          jobType: row.job_type,
          jobName: row.job_name,
          jobAddr: row.job_addr,
          scheduledDate: row.scheduled_date ?? null,
          status: row.status,
        })));
      }
    } catch {}
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadJobs();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const acceptJob = async (job: AssignedJob) => {
    setAccepting(job.id);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "in_progress" })
        .eq("id", job.id);

      if (error) throw error;

      setJobs((prev) =>
        prev.map((j) => j.id === job.id ? { ...j, status: "in_progress" } : j)
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not accept job.");
    } finally {
      setAccepting(null);
    }
  };

  const statusBadgeStyle = (status: string) => {
    if (status === "assigned") return styles.badgeAssigned;
    if (status === "in_progress") return styles.badgeInProgress;
    return styles.badgeUnassigned;
  };

  const statusBadgeTextStyle = (status: string) => {
    if (status === "assigned") return styles.badgeAssignedText;
    if (status === "in_progress") return styles.badgeInProgressText;
    return styles.badgeUnassignedText;
  };

  const statusLabel = (status: string) => {
    if (status === "assigned") return "ASSIGNED";
    if (status === "in_progress") return "IN PROGRESS";
    return status.toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
        <Text style={styles.loadingText}>Loading assigned jobs…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Assigned Jobs</Text>
        <Text style={styles.subtitle}>Jobs assigned to you by your employer</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f97316"
            colors={["#f97316"]}
          />
        }
      >
        {jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No assigned jobs</Text>
            <Text style={styles.emptySubtitle}>Your employer will assign jobs here when they're ready</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <View key={job.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardTitles}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.jobName}</Text>
                  <Text style={styles.jobAddr} numberOfLines={2}>{job.jobAddr}</Text>
                </View>
                <View style={[styles.statusBadge, statusBadgeStyle(job.status)]}>
                  <Text style={[styles.statusBadgeText, statusBadgeTextStyle(job.status)]}>
                    {statusLabel(job.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaKey}>TYPE</Text>
                  <Text style={styles.metaVal}>{JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</Text>
                </View>
                {job.scheduledDate ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaKey}>SCHEDULED</Text>
                    <Text style={styles.metaVal}>{job.scheduledDate}</Text>
                  </View>
                ) : null}
              </View>

              {job.status === "assigned" && (
                <Pressable
                  style={[styles.acceptBtn, accepting === job.id && { opacity: 0.6 }]}
                  onPress={() => acceptJob(job)}
                  disabled={accepting === job.id}
                >
                  {accepting === job.id
                    ? <ActivityIndicator size="small" color="#0b1220" />
                    : <Text style={styles.acceptBtnText}>Accept Job →</Text>
                  }
                </Pressable>
              )}

              {job.status === "in_progress" && (
                <View style={styles.inProgressNote}>
                  <Text style={styles.inProgressNoteText}>Job in progress — generate a PDF to mark complete</Text>
                </View>
              )}

              <Pressable
                style={styles.notesBtn}
                onPress={() => router.push({ pathname: "/job-notes", params: { jobId: job.id, jobName: job.jobName } })}
              >
                <Text style={styles.notesBtnText}>View / Add Notes →</Text>
              </Pressable>
            </View>
          ))
        )}

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#07152b",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: "rgba(255,255,255,0.55)" },

  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  body: { padding: 20, gap: 12, paddingBottom: 40 },

  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 36,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "900" },
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

  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  badgeUnassigned: {
    borderColor: "rgba(156,163,175,0.40)",
  },
  badgeAssigned: {
    borderColor: "rgba(59,130,246,0.40)",
  },
  badgeInProgress: {
    borderColor: "rgba(249,115,22,0.40)",
  },
  statusBadgeText: { fontWeight: "700", fontSize: 12 },
  badgeUnassignedText: { color: "#9ca3af" },
  badgeAssignedText: { color: "#60a5fa" },
  badgeInProgressText: { color: "#f97316" },

  cardMeta: { flexDirection: "row", gap: 20 },
  metaItem: { gap: 2 },
  metaKey: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  metaVal: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },

  acceptBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  inProgressNote: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    padding: 12,
    alignItems: "center",
  },
  inProgressNoteText: { color: "#f97316", fontSize: 13, fontWeight: "700", textAlign: "center" },

  notesBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  notesBtnText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 15 },

  back: { marginTop: 6, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
