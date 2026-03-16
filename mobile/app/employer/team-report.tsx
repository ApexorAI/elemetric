import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberReport = {
  userId: string;
  fullName: string;
  licenceNumber: string;
  companyName: string;
  jobsCompletedThisMonth: number;
  avgCompliance: number | null;
  totalJobs: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const complianceColor = (score: number | null): string => {
  if (score == null) return "rgba(255,255,255,0.45)";
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f97316";
  return "#ef4444";
};

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function monthLabel(): string {
  return new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TeamReport() {
  const router = useRouter();

  const [loading, setLoading]         = useState(true);
  const [teamName, setTeamName]       = useState("My Team");
  const [members, setMembers]         = useState<MemberReport[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (active) { setLoading(true); setErrorMsg(null); }
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          const { data: team, error: teamErr } = await supabase
            .from("teams")
            .select("id, team_name")
            .eq("owner_id", user.id)
            .single();

          if (teamErr || !team) {
            if (active) setErrorMsg("No team found. Set up your employer account in Settings.");
            return;
          }
          if (active) setTeamName(team.team_name ?? "My Team");

          const { data: rawMembers } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", team.id);
          if (!rawMembers || !active) return;

          const monthStart = startOfMonth();
          const reports: MemberReport[] = [];

          for (const m of rawMembers) {
            if (!active) break;

            let fullName = "Unknown";
            let licenceNumber = "—";
            let companyName = "—";
            let avgCompliance: number | null = null;

            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, licence_number, company_name, compliance_score")
                .eq("user_id", m.user_id)
                .single();
              if (profile) {
                fullName    = profile.full_name      ?? "Unknown";
                licenceNumber = profile.licence_number ?? "—";
                companyName = profile.company_name   ?? "—";
                avgCompliance = profile.compliance_score ?? null;
              }
            } catch {}

            // Total jobs (all time)
            let totalJobs = 0;
            let jobsCompletedThisMonth = 0;
            let sumConfidence = 0;
            let countConfidence = 0;

            try {
              const { data: jobs } = await supabase
                .from("jobs")
                .select("confidence, status, created_at")
                .eq("user_id", m.user_id);

              if (jobs) {
                totalJobs = jobs.length;
                for (const j of jobs) {
                  if (j.status === "completed" && j.created_at >= monthStart) {
                    jobsCompletedThisMonth++;
                  }
                  if (typeof j.confidence === "number" && j.confidence > 0) {
                    sumConfidence += j.confidence;
                    countConfidence++;
                  }
                }
              }
            } catch {}

            // Use computed avg confidence if profile score not available
            if (avgCompliance == null && countConfidence > 0) {
              avgCompliance = Math.round(sumConfidence / countConfidence);
            }

            reports.push({
              userId: m.user_id,
              fullName,
              licenceNumber,
              companyName,
              jobsCompletedThisMonth,
              avgCompliance,
              totalJobs,
            });
          }

          if (active) setMembers(reports);
        } catch (e: any) {
          if (active) setErrorMsg(e?.message ?? "Could not load team data.");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  // ── PDF generation ───────────────────────────────────────────────────────────

  const generatePdf = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setGeneratingPdf(true);
    try {
      const reportDate = new Date().toLocaleString("en-AU");
      const month = monthLabel();
      const td = "border:1px solid #d1d5db;padding:10px;font-size:13px;";
      const th = `${td}background:#f3f4f6;font-weight:bold;text-align:left;`;

      const totalCompleted = members.reduce((s, m) => s + m.jobsCompletedThisMonth, 0);
      const withScore = members.filter((m) => m.avgCompliance != null);
      const teamAvg = withScore.length
        ? Math.round(withScore.reduce((s, m) => s + (m.avgCompliance ?? 0), 0) / withScore.length)
        : null;

      const memberRows = members.map((m) => `
        <tr>
          <td style="${td}">${m.fullName}</td>
          <td style="${td}">${m.licenceNumber}</td>
          <td style="${td}text-align:center;">${m.jobsCompletedThisMonth}</td>
          <td style="${td}text-align:center;">${m.totalJobs}</td>
          <td style="${td}text-align:center;font-weight:bold;color:${
            m.avgCompliance == null ? "#6b7280"
            : m.avgCompliance >= 80 ? "#16a34a"
            : m.avgCompliance >= 50 ? "#d97706"
            : "#dc2626"
          };">${m.avgCompliance != null ? `${m.avgCompliance}%` : "—"}</td>
        </tr>
      `).join("");

      const html = `<html><head><style>
        @page{margin:15mm;
          @bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}
          @bottom-left{content:"ELEMETRIC · Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}
        }
        body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}
      </style></head>
      <body>
        <div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
            <div style="font-size:12px;margin-top:4px;opacity:0.7;">Employer Team Report</div>
          </div>
          <div style="text-align:right;font-size:12px;opacity:0.8;">
            <div>${teamName}</div>
            <div>${reportDate}</div>
          </div>
        </div>
        <div style="background:#f97316;color:white;padding:10px 24px;font-size:14px;font-weight:bold;">
          ${month} — Compliance Summary
        </div>

        <div style="padding:22px;">

          <div style="display:flex;gap:16px;margin-bottom:24px;">
            <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:36px;font-weight:900;color:#111827;">${members.length}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Team Members</div>
            </div>
            <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:36px;font-weight:900;color:#111827;">${totalCompleted}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Jobs Completed This Month</div>
            </div>
            <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:36px;font-weight:900;color:${teamAvg == null ? '#6b7280' : teamAvg >= 80 ? '#16a34a' : teamAvg >= 50 ? '#d97706' : '#dc2626'};">${teamAvg != null ? `${teamAvg}%` : "—"}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Avg Team Compliance</div>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <div style="font-size:19px;font-weight:bold;margin-bottom:12px;">Member Breakdown</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <th style="${th}">Name</th>
                <th style="${th}">Licence No.</th>
                <th style="${th}text-align:center;">Completed (${month.split(" ")[0]})</th>
                <th style="${th}text-align:center;">Total Jobs</th>
                <th style="${th}text-align:center;">Avg Compliance</th>
              </tr>
              ${memberRows}
            </table>
          </div>

          <div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.7;">
            <strong style="color:#374151;">Note:</strong> Compliance scores are calculated from AI-assisted photo analysis. Job counts reflect work recorded in Elemetric. This report is for internal use only.
          </div>
        </div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${teamName} — Team Report`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Created", `Saved to: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Loading / error ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
        <Text style={styles.loadingText}>Loading team data…</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>ELEMETRIC</Text>
          <Text style={styles.title}>Team Report</Text>
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const totalCompleted = members.reduce((s, m) => s + m.jobsCompletedThisMonth, 0);
  const withScore = members.filter((m) => m.avgCompliance != null);
  const teamAvg = withScore.length
    ? Math.round(withScore.reduce((s, m) => s + (m.avgCompliance ?? 0), 0) / withScore.length)
    : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Team Report</Text>
        <Text style={styles.subtitle}>{teamName} · {monthLabel()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Summary stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed{"\n"}This Month</Text>
          </View>
          <View style={[styles.statCard]}>
            <Text style={[styles.statValue, { color: complianceColor(teamAvg) }]}>
              {teamAvg != null ? `${teamAvg}%` : "—"}
            </Text>
            <Text style={styles.statLabel}>Avg{"\n"}Compliance</Text>
          </View>
        </View>

        {/* ── Member breakdown ── */}
        <Text style={styles.sectionLabel}>MEMBER BREAKDOWN</Text>

        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No team members yet.</Text>
          </View>
        ) : (
          members.map((m) => (
            <View key={m.userId} style={styles.memberCard}>
              <View style={styles.memberTop}>
                <View>
                  <Text style={styles.memberName}>{m.fullName}</Text>
                  <Text style={styles.memberLicence}>{m.licenceNumber}</Text>
                </View>
                <Text style={[styles.memberScore, { color: complianceColor(m.avgCompliance) }]}>
                  {m.avgCompliance != null ? `${m.avgCompliance}%` : "—"}
                </Text>
              </View>

              <View style={styles.memberDivider} />

              <View style={styles.memberStats}>
                <View style={styles.memberStat}>
                  <Text style={styles.memberStatLabel}>Completed This Month</Text>
                  <Text style={styles.memberStatValue}>{m.jobsCompletedThisMonth}</Text>
                </View>
                <View style={styles.memberStat}>
                  <Text style={styles.memberStatLabel}>Total Jobs (All Time)</Text>
                  <Text style={styles.memberStatValue}>{m.totalJobs}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* ── Export PDF ── */}
        <Pressable
          style={[styles.pdfBtn, generatingPdf && { opacity: 0.6 }]}
          onPress={generatePdf}
          disabled={generatingPdf}
        >
          {generatingPdf
            ? <ActivityIndicator color="white" />
            : <Text style={styles.pdfBtnText}>Export Team Report PDF</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1, backgroundColor: "#07152b",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  loadingText: { color: "rgba(255,255,255,0.55)" },

  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "#f97316", fontSize: 13, fontWeight: "700" },

  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center" },

  body: { padding: 20, gap: 12, paddingBottom: 60 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16, alignItems: "center", gap: 4,
  },
  statValue: { color: "white", fontSize: 28, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "800", textAlign: "center", letterSpacing: 1, textTransform: "uppercase" },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
    marginTop: 4, marginLeft: 4,
  },

  emptyCard: {
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 20, alignItems: "center",
  },
  emptyText: { color: "rgba(255,255,255,0.55)", fontSize: 13 },

  memberCard: {
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16, gap: 12,
  },
  memberTop: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  memberName: { color: "white", fontSize: 15, fontWeight: "700" },
  memberLicence: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  memberScore: { fontSize: 22, fontWeight: "900" },
  memberDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  memberStats: { flexDirection: "row", gap: 16 },
  memberStat: { flex: 1, gap: 3 },
  memberStatLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  memberStatValue: { color: "white", fontSize: 15, fontWeight: "700" },

  pdfBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, height: 56,
    alignItems: "center", justifyContent: "center", marginTop: 4,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.40)",
  },
  pdfBtnText: { color: "#22c55e", fontWeight: "900", fontSize: 15 },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
