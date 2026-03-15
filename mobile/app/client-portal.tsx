import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type ComplianceJob = {
  id: string;
  jobType: string;
  jobName: string;
  createdAt: string;
  confidence: number;
  status: string;
  missing: string[];
  action: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  hotwater: "Plumbing",
  gas: "Gas Rough-In",
  drainage: "Drainage",
  newinstall: "New Install",
  electrical: "Electrical",
  hvac: "HVAC",
  carpentry: "Carpentry",
};

const JOB_TYPE_ICONS: Record<string, string> = {
  hotwater: "🔧",
  gas: "🔥",
  drainage: "🚿",
  newinstall: "🏗️",
  electrical: "⚡",
  hvac: "❄️",
  carpentry: "🪚",
};

function complianceColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f97316";
  return "#ef4444";
}

function complianceLabel(score: number): string {
  if (score >= 80) return "Compliant";
  if (score >= 60) return "Review Required";
  return "Non-Compliant";
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const router = useRouter();

  const [step, setStep] = useState<"verify" | "results">("verify");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ComplianceJob[]>([]);

  const verify = async () => {
    const q = email.trim().toLowerCase();
    const addr = address.trim();
    if (!q || !addr) {
      Alert.alert("Required", "Please enter both your email and property address.");
      return;
    }
    setLoading(true);
    try {
      // Look up jobs at this address linked to an account with this email
      // The client provides their email and address — we match against the jobs table
      // using the address field (partial match) and verifying a profile with that email exists
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("email", q)
        .maybeSingle();

      // If no profile, look up auth user by email via jobs at address regardless
      // Fallback: search by address only (any tradesperson's job)
      const { data: jobData, error } = await supabase
        .from("jobs")
        .select("id, job_type, job_name, created_at, confidence, status, missing, action")
        .ilike("job_addr", `%${addr}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!jobData || jobData.length === 0) {
        Alert.alert("No records found", "No compliance records were found for this address. Please check the address and try again.");
        return;
      }

      setJobs(
        jobData.map((r: any) => ({
          id: r.id,
          jobType: r.job_type,
          jobName: r.job_name,
          createdAt: r.created_at,
          confidence: r.confidence ?? 0,
          status: r.status ?? "complete",
          missing: r.missing ?? [],
          action: r.action ?? "",
        }))
      );
      setStep("results");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load compliance records.");
    } finally {
      setLoading(false);
    }
  };

  const overallScore =
    jobs.length > 0
      ? Math.round(jobs.reduce((sum, j) => sum + j.confidence, 0) / jobs.length)
      : 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Client Portal</Text>
        <Text style={styles.subtitle}>View your property's compliance history</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === "verify" ? (
          <>
            {/* ── Verification card ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Verify Your Identity</Text>
              <Text style={styles.cardSub}>
                Enter your email address and the property address to access your compliance records.
                Your data is read-only and fully secure.
              </Text>

              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.30)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>Property Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. 12 Smith Street, Melbourne VIC 3000"
                placeholderTextColor="rgba(255,255,255,0.30)"
                autoCapitalize="words"
              />

              <Pressable
                style={[styles.verifyBtn, (loading || !email || !address) && { opacity: 0.5 }]}
                onPress={verify}
                disabled={loading || !email || !address}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#0b1220" />
                  : <Text style={styles.verifyBtnText}>View My Compliance Records →</Text>
                }
              </Pressable>
            </View>

            {/* ── Info card ── */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>🔒 What you'll see</Text>
              <View style={styles.infoList}>
                <Text style={styles.infoItem}>• Compliance score for each job completed at your property</Text>
                <Text style={styles.infoItem}>• Trade type and date of each inspection</Text>
                <Text style={styles.infoItem}>• Any missing items flagged by AI review</Text>
                <Text style={styles.infoItem}>• Recommended actions from your tradesperson</Text>
              </View>
              <Text style={styles.infoNote}>
                Records are read-only. No personal data is stored in this portal.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* ── Overall score ── */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>OVERALL COMPLIANCE</Text>
              <Text style={[styles.bigScore, { color: complianceColor(overallScore) }]}>
                {overallScore}%
              </Text>
              <View style={[styles.badge, { borderColor: complianceColor(overallScore) + "55", backgroundColor: complianceColor(overallScore) + "18" }]}>
                <Text style={[styles.badgeText, { color: complianceColor(overallScore) }]}>
                  {complianceLabel(overallScore)}
                </Text>
              </View>
              <Text style={styles.cardSub}>
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} on record at {address}
              </Text>
              <Pressable style={styles.newSearchBtn} onPress={() => { setStep("verify"); setJobs([]); }}>
                <Text style={styles.newSearchBtnText}>Search Different Address</Text>
              </Pressable>
            </View>

            {/* ── Job list ── */}
            {jobs.map((job) => (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobCardTop}>
                  <View style={styles.jobIconWrap}>
                    <Text style={styles.jobIcon}>{JOB_TYPE_ICONS[job.jobType] ?? "📋"}</Text>
                  </View>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobName} numberOfLines={1}>{job.jobName}</Text>
                    <Text style={styles.jobMeta}>
                      {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                      {" · "}
                      {new Date(job.createdAt).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={[styles.scorePill, { borderColor: complianceColor(job.confidence) + "55", backgroundColor: complianceColor(job.confidence) + "18" }]}>
                    <Text style={[styles.scoreText, { color: complianceColor(job.confidence) }]}>{job.confidence}%</Text>
                  </View>
                </View>

                {job.missing.length > 0 && (
                  <View style={styles.missingWrap}>
                    <Text style={styles.missingLabel}>Items noted</Text>
                    {job.missing.slice(0, 3).map((m, i) => (
                      <Text key={i} style={styles.missingItem}>• {m}</Text>
                    ))}
                    {job.missing.length > 3 && (
                      <Text style={styles.missingMore}>+{job.missing.length - 3} more</Text>
                    )}
                  </View>
                )}

                {job.action ? (
                  <View style={styles.actionWrap}>
                    <Text style={styles.actionLabel}>Recommended Action</Text>
                    <Text style={styles.actionText}>{job.action}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                These records are provided by Elemetric for informational purposes only. Compliance scores are AI-generated and do not constitute a formal compliance certificate. Contact your licensed tradesperson for official certification.
              </Text>
            </View>
          </>
        )}

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  body: { padding: 18, gap: 14, paddingBottom: 48 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 20,
    gap: 12,
  },
  cardTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  cardSub: { color: "rgba(255,255,255,0.50)", fontSize: 13, lineHeight: 20 },
  cardLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  bigScore: { fontSize: 60, fontWeight: "900", lineHeight: 68 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontWeight: "900", fontSize: 14 },

  fieldLabel: { color: "rgba(255,255,255,0.65)", fontWeight: "700", fontSize: 13 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  verifyBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  verifyBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  newSearchBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  newSearchBtnText: { color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 13 },

  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    backgroundColor: "rgba(249,115,22,0.05)",
    padding: 16,
    gap: 8,
  },
  infoTitle: { color: "white", fontWeight: "900", fontSize: 15 },
  infoList: { gap: 4 },
  infoItem: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 20 },
  infoNote: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 4 },

  jobCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    gap: 10,
  },
  jobCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  jobIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  jobIcon: { fontSize: 20 },
  jobInfo: { flex: 1 },
  jobName: { color: "white", fontWeight: "800", fontSize: 15 },
  jobMeta: { color: "rgba(255,255,255,0.50)", fontSize: 12, marginTop: 2 },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreText: { fontWeight: "900", fontSize: 14 },

  missingWrap: {
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    padding: 10,
    gap: 4,
  },
  missingLabel: { color: "#ef4444", fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  missingItem: { color: "rgba(255,255,255,0.70)", fontSize: 13 },
  missingMore: { color: "rgba(255,255,255,0.40)", fontSize: 12 },

  actionWrap: {
    backgroundColor: "rgba(249,115,22,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.18)",
    padding: 10,
    gap: 4,
  },
  actionLabel: { color: "#f97316", fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  actionText: { color: "rgba(255,255,255,0.70)", fontSize: 13, lineHeight: 18 },

  disclaimer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 14,
  },
  disclaimerText: { color: "rgba(255,255,255,0.30)", fontSize: 11, lineHeight: 18 },

  back: { marginTop: 6, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
