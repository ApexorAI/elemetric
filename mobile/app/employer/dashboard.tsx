import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

// ── Types ────────────────────────────────────────────────────────────────────

type MemberData = {
  userId: string;
  fullName: string;
  licenceNumber: string;
  complianceScore: number | null;
  jobCount: number;
  lastActive: string | null;
  role: string;
  periodJobCount: number;
  periodAvgScore: number | null;
};

type ActivityItem = {
  id: string;
  userName: string;
  jobType: string;
  jobName: string;
  confidence: number;
  createdAt: string;
};

type Period = "week" | "month" | "year";

const JOB_TYPE_ICONS: Record<string, string> = {
  hotwater: "🔧", gas: "🔥", drainage: "🚿", newinstall: "🏗️",
  electrical: "⚡", hvac: "❄️", carpentry: "🪚",
};

function periodStart(p: Period): Date {
  const d = new Date();
  if (p === "week") d.setDate(d.getDate() - 7);
  else if (p === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function EmployerDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<MemberData[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [topFailures, setTopFailures] = useState<[string, number][]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [allJobs, setAllJobs] = useState<any[]>([]);

  // ── Load data ────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (active) {
          setLoading(true);
          setErrorMsg(null);
        }
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user || !active) return;

          // Role gate — redirect non-employers immediately
          const { data: profileCheck } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .single();
          if (active && profileCheck?.role !== "employer") {
            router.replace("/home");
            return;
          }

          // Get team
          const { data: team, error: teamError } = await supabase
            .from("teams")
            .select("id, team_name")
            .eq("owner_id", user.id)
            .single();

          if (teamError || !team) {
            if (active) setErrorMsg("No team found. Go to Settings to set up your employer account.");
            return;
          }

          if (active) setTeamName(team.team_name ?? "My Team");

          // Get team members
          const { data: rawMembers, error: membersError } = await supabase
            .from("team_members")
            .select("user_id, role, joined_at")
            .eq("team_id", team.id);

          if (membersError || !rawMembers || !active) return;

          // Hydrate each member with profile + job data
          const hydrated: MemberData[] = [];
          const activityItems: ActivityItem[] = [];

          for (const m of rawMembers) {
            if (!active) break;

            let fullName = "Unknown";
            let licenceNumber = "—";
            let complianceScore: number | null = null;
            let jobCount = 0;
            let lastActive: string | null = null;

            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, licence_number, compliance_score")
                .eq("user_id", m.user_id)
                .single();

              if (profile) {
                if (profile.full_name) fullName = profile.full_name;
                if (profile.licence_number) licenceNumber = profile.licence_number;
                if (profile.compliance_score != null)
                  complianceScore = profile.compliance_score;
              }
            } catch {}

            let periodJobCount = 0;
            let periodAvgScore: number | null = null;
            try {
              const { data: jobs } = await supabase
                .from("jobs")
                .select("created_at, confidence, job_type, job_name, id")
                .eq("user_id", m.user_id)
                .order("created_at", { ascending: false });

              if (jobs) {
                jobCount = jobs.length;
                lastActive = jobs[0]?.created_at ?? null;
                const pStart = periodStart(period);
                const pJobs = jobs.filter((j: any) => new Date(j.created_at) >= pStart);
                periodJobCount = pJobs.length;
                if (pJobs.length > 0) {
                  periodAvgScore = Math.round(pJobs.reduce((s: number, j: any) => s + (j.confidence ?? 0), 0) / pJobs.length);
                }
                // Add to activity feed
                for (const j of pJobs.slice(0, 5)) {
                  activityItems.push({
                    id: j.id,
                    userName: fullName,
                    jobType: j.job_type,
                    jobName: j.job_name,
                    confidence: j.confidence ?? 0,
                    createdAt: j.created_at,
                  });
                }
              }
            } catch {}

            hydrated.push({
              userId: m.user_id,
              fullName,
              licenceNumber,
              complianceScore,
              jobCount,
              lastActive,
              role: m.role ?? "member",
              periodJobCount,
              periodAvgScore,
            });
          }

          if (active) {
            setMembers(hydrated);
            setActivity(
              activityItems
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
            );

            // Compute top failures from all team jobs
            const allJobsFlat: any[] = [];
            for (const m of hydrated) {
              const { data: mJobs } = await supabase
                .from("jobs")
                .select("missing, created_at")
                .eq("user_id", m.userId);
              if (mJobs) allJobsFlat.push(...mJobs);
            }
            setAllJobs(allJobsFlat);
            const failureCounts: Record<string, number> = {};
            allJobsFlat.forEach((j: any) => {
              (j.missing ?? []).forEach((mItem: string) => {
                failureCounts[mItem] = (failureCounts[mItem] ?? 0) + 1;
              });
            });
            const sorted = Object.entries(failureCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);
            if (active) setTopFailures(sorted);
          }
        } catch (e: any) {
          if (active)
            setErrorMsg(e?.message ?? "An error occurred loading team data.");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const complianceColor = (score: number | null): string => {
    if (score == null) return "rgba(255,255,255,0.45)";
    if (score >= 80) return "#22c55e";
    if (score >= 50) return "#f97316";
    return "#ef4444";
  };

  const avgCompliance = (): string => {
    const withScore = members.filter((m) => m.complianceScore != null);
    if (withScore.length === 0) return "—";
    const avg =
      withScore.reduce((sum, m) => sum + (m.complianceScore ?? 0), 0) /
      withScore.length;
    return `${Math.round(avg)}%`;
  };

  const exportAnalyticsPdf = async () => {
    setExportingPdf(true);
    try {
      const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
      const avgComp = members.filter((m) => m.complianceScore != null).length > 0
        ? Math.round(members.filter((m) => m.complianceScore != null).reduce((s, m) => s + (m.complianceScore ?? 0), 0) / members.filter((m) => m.complianceScore != null).length)
        : null;
      const failureRows = topFailures.map(([item, count]) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;">${item}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;">${count}</td></tr>`
      ).join("");
      const memberRows = members.slice().sort((a, b) => (b.complianceScore ?? -1) - (a.complianceScore ?? -1)).map((m, i) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;">#${i + 1}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:bold;">${m.fullName}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">${m.jobCount}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${complianceColor(m.complianceScore)};">${m.complianceScore != null ? m.complianceScore + "%" : "—"}</td></tr>`
      ).join("");
      const html = `<html><head><style>body{margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;color:#111827;}</style></head><body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div><div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#f97316;">ELEMETRIC</div><div style="font-size:11px;opacity:0.6;">Team Analytics Report</div></div>
  <div style="text-align:right;font-size:12px;opacity:0.7;">${dateStr}</div>
</div>
<div style="background:#f97316;height:4px;"></div>
<div style="padding:24px;">
<h2 style="font-size:20px;margin:0 0 16px;">${teamName} — Compliance Summary</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
<tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Team Members</td><td style="padding:8px;">${members.length}</td></tr>
<tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Avg Compliance Score</td><td style="padding:8px;font-weight:bold;">${avgComp != null ? avgComp + "%" : "—"}</td></tr>
<tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Total Jobs Recorded</td><td style="padding:8px;">${allJobs.length}</td></tr>
</table>
${topFailures.length > 0 ? `<h3 style="font-size:16px;margin:0 0 10px;">Most Common Failures</h3><table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><thead><tr style="background:#f3f4f6;"><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left;">Item</th><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">Occurrences</th></tr></thead><tbody>${failureRows}</tbody></table>` : ""}
${members.length > 0 ? `<h3 style="font-size:16px;margin:0 0 10px;">Team Leaderboard</h3><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f3f4f6;"><th style="padding:6px 10px;border:1px solid #e5e7eb;">Rank</th><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left;">Name</th><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">Jobs</th><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">Compliance</th></tr></thead><tbody>${memberRows}</tbody></table>` : ""}
<p style="margin-top:24px;font-size:11px;color:#6b7280;">Generated by Elemetric · elemetric.com.au · ABN 19 377 661 368</p>
</div></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      const dest = `${FileSystem.cacheDirectory}elemetric-analytics-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: "Share Analytics PDF", UTI: "com.adobe.pdf" });
      }
    } catch (e: any) {
      Alert.alert("PDF Error", e?.message ?? "Could not generate PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
        <Text style={styles.loadingText}>Loading team data…</Text>
      </View>
    );
  }

  // ── Error / empty state ───────────────────────────────────────────────────────

  if (errorMsg) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>ELEMETRIC</Text>
          <Text style={styles.title}>Manage My Team</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{errorMsg}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Employer Portal</Text>
        {teamName ? <Text style={styles.teamName}>{teamName}</Text> : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Period selector ── */}
        <View style={styles.periodRow}>
          {(["week", "month", "year"] as Period[]).map((p) => (
            <Pressable
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Year"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Team Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{avgCompliance()}</Text>
            <Text style={styles.statLabel}>Avg Compliance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.reduce((s, m) => s + m.periodJobCount, 0)}</Text>
            <Text style={styles.statLabel}>Jobs This {period === "week" ? "Week" : period === "month" ? "Month" : "Year"}</Text>
          </View>
        </View>

        {/* ── Compliance distribution ── */}
        {members.length > 0 && (() => {
          const compliant = members.filter((m) => (m.complianceScore ?? 0) >= 80).length;
          const review = members.filter((m) => (m.complianceScore ?? 0) >= 60 && (m.complianceScore ?? 0) < 80).length;
          const nonCompliant = members.filter((m) => m.complianceScore !== null && (m.complianceScore ?? 0) < 60).length;
          const total = members.length;
          return (
            <View style={styles.distCard}>
              <Text style={styles.sectionLabel}>COMPLIANCE DISTRIBUTION</Text>
              {[
                { label: "Compliant (≥80%)", count: compliant, color: "#22c55e" },
                { label: "Review (60–79%)", count: review, color: "#f97316" },
                { label: "Non-Compliant (<60%)", count: nonCompliant, color: "#ef4444" },
              ].map((row) => (
                <View key={row.label} style={styles.distRow}>
                  <Text style={styles.distLabel}>{row.label}</Text>
                  <View style={styles.distBarWrap}>
                    <View style={[styles.distBar, { width: `${total > 0 ? (row.count / total) * 100 : 0}%` as any, backgroundColor: row.color }]} />
                  </View>
                  <Text style={[styles.distCount, { color: row.color }]}>{row.count}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* ── Create Your Team onboarding card (first-time employers) ── */}
        {members.length === 0 && (
          <View style={styles.onboardCard}>
            <Text style={styles.onboardTitle}>Create Your Team</Text>
            <Text style={styles.onboardBody}>
              Add your team members to get started. Tap "Invite Team Member" below to send email invitations. Each member will appear here once they join.
            </Text>
            <Pressable
              style={styles.onboardBtn}
              onPress={() => router.push("/employer/invite")}
            >
              <Text style={styles.onboardBtnText}>Invite Team Member →</Text>
            </Pressable>
          </View>
        )}

        {/* ── League table ── */}
        {members.length > 0 && <Text style={styles.sectionLabel}>LEAGUE TABLE — SORTED BY COMPLIANCE</Text>}
        {members
          .slice()
          .sort((a, b) => (b.complianceScore ?? -1) - (a.complianceScore ?? -1))
          .map((m, rank) => (
            <View key={m.userId} style={[styles.leagueRow, rank === 0 && styles.leagueRowFirst]}>
              <View style={styles.leagueRankWrap}>
                {rank === 0 ? (
                  <Text style={styles.leagueGold}>🥇</Text>
                ) : (
                  <Text style={[styles.leagueRank, rank === 0 && { color: "#f97316" }]}>#{rank + 1}</Text>
                )}
              </View>
              <View style={styles.leagueInfo}>
                <Text style={styles.leagueName}>{m.fullName}</Text>
                <Text style={styles.leagueMeta}>{m.periodJobCount} job{m.periodJobCount !== 1 ? "s" : ""} this {period} · {m.jobCount} total</Text>
              </View>
              <Text style={[styles.leagueScore, { color: complianceColor(m.complianceScore) }]}>
                {m.complianceScore != null ? `${m.complianceScore}%` : "—"}
              </Text>
            </View>
          ))
        }

        {/* ── Most common failures ── */}
        {topFailures.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>MOST COMMON FAILURES</Text>
            <View style={styles.failureCard}>
              {topFailures.map(([item, count], i) => (
                <View key={item} style={[styles.failureRow, i < topFailures.length - 1 && styles.failureRowBorder]}>
                  <Text style={styles.failureRank}>{i + 1}</Text>
                  <Text style={styles.failureItem} numberOfLines={2}>{item}</Text>
                  <View style={styles.failureCountBadge}>
                    <Text style={styles.failureCount}>{count}×</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Activity feed ── */}
        {activity.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            {activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <Text style={styles.activityIcon}>{JOB_TYPE_ICONS[a.jobType] ?? "📋"}</Text>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName} numberOfLines={1}>{a.jobName}</Text>
                  <Text style={styles.activityMeta}>{a.userName} · {new Date(a.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</Text>
                </View>
                <Text style={[styles.activityScore, { color: complianceColor(a.confidence) }]}>{a.confidence}%</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Members list ── */}
        <Text style={styles.sectionLabel}>TEAM MEMBERS</Text>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search team members…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search team members"
        />

        {members.filter((m) => !search.trim() || m.fullName.toLowerCase().includes(search.toLowerCase()) || m.licenceNumber.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.emptyText}>
              No members yet. Invite someone to get started.
            </Text>
          </View>
        ) : (
          members.filter((m) => !search.trim() || m.fullName.toLowerCase().includes(search.toLowerCase()) || m.licenceNumber.toLowerCase().includes(search.toLowerCase())).map((m) => (
            <View key={m.userId} style={styles.memberCard}>
              <View style={styles.memberCardTop}>
                <View style={styles.memberCardLeft}>
                  <Text style={styles.memberName}>{m.fullName}</Text>
                  <Text style={styles.memberLicence}>{m.licenceNumber}</Text>
                </View>
                <View
                  style={[
                    styles.roleBadge,
                    m.role.toLowerCase() === "owner" && styles.roleBadgeOwner,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      m.role.toLowerCase() === "owner" &&
                        styles.roleBadgeTextOwner,
                    ]}
                  >
                    {m.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.memberCardDivider} />

              <View style={styles.memberCardStats}>
                <View style={styles.memberStat}>
                  <Text style={styles.memberStatLabel}>Compliance</Text>
                  <Text
                    style={[
                      styles.memberStatValue,
                      { color: complianceColor(m.complianceScore) },
                    ]}
                  >
                    {m.complianceScore != null ? `${m.complianceScore}%` : "—"}
                  </Text>
                </View>
                <View style={styles.memberStat}>
                  <Text style={styles.memberStatLabel}>Jobs</Text>
                  <Text style={styles.memberStatValue}>
                    {m.jobCount} completed
                  </Text>
                </View>
                <View style={styles.memberStat}>
                  <Text style={styles.memberStatLabel}>Last Active</Text>
                  <Text style={styles.memberStatValue}>
                    {formatDate(m.lastActive)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* ── Export Analytics PDF ── */}
        <Pressable
          style={[styles.exportBtn, exportingPdf && { opacity: 0.6 }]}
          onPress={exportAnalyticsPdf}
          disabled={exportingPdf}
          accessibilityRole="button"
          accessibilityLabel="Export Analytics PDF"
        >
          {exportingPdf ? (
            <ActivityIndicator color="#f97316" size="small" />
          ) : (
            <Text style={styles.exportBtnText}>📊 Export Analytics PDF</Text>
          )}
        </Pressable>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionCard}
            onPress={() => router.push("/employer/job-planner")}
          >
            <Text style={styles.actionCardTitle}>Job Planner</Text>
            <Text style={styles.actionCardSub}>Weekly schedule view</Text>
          </Pressable>
          <Pressable
            style={styles.actionCard}
            onPress={() => router.push("/employer/team-report")}
          >
            <Text style={styles.actionCardTitle}>Team Report</Text>
            <Text style={styles.actionCardSub}>Monthly compliance PDF</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.assignBtn}
          onPress={() => router.push("/employer/assign-job")}
        >
          <Text style={styles.assignBtnText}>+ Assign New Job</Text>
        </Pressable>

        <Pressable
          style={styles.inviteBtn}
          onPress={() => router.push("/employer/invite")}
          accessibilityRole="button"
          accessibilityLabel="Invite a team member"
        >
          <Text style={styles.inviteBtnText}>+ Invite Member</Text>
        </Pressable>

        <Pressable
          style={styles.templatesBtn}
          onPress={() => router.push("/employer/job-templates")}
          accessibilityRole="button"
          accessibilityLabel="Job Templates"
        >
          <Text style={styles.templatesBtnText}>📋 Job Templates</Text>
        </Pressable>

        {/* Subcontractors — hidden until post-launch */}

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
    flex: 1,
    backgroundColor: "#07152b",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: "rgba(255,255,255,0.55)" },

  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  teamName: { marginTop: 4, color: "#f97316", fontSize: 13, fontWeight: "700" },

  body: { padding: 20, gap: 12, paddingBottom: 60 },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: -4 },
  periodBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "transparent",
  },
  periodBtnActive: { borderColor: "#f97316", backgroundColor: "#f97316" },
  periodBtnText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13 },
  periodBtnTextActive: { color: "#07152b" },

  distCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
    gap: 10,
  },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13, width: 130 },
  distBarWrap: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  distBar: { height: 8, borderRadius: 4 },
  distCount: { fontWeight: "900", fontSize: 14, width: 24, textAlign: "right" },

  leagueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  leagueRowFirst: { borderColor: "rgba(249,115,22,0.25)", backgroundColor: "rgba(249,115,22,0.05)" },
  leagueRankWrap: { width: 28, alignItems: "center" },
  leagueRank: { color: "rgba(255,255,255,0.35)", fontWeight: "900", fontSize: 15 },
  leagueGold: { fontSize: 20 },
  leagueInfo: { flex: 1 },
  leagueName: { color: "white", fontWeight: "700", fontSize: 15 },
  leagueMeta: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 1 },
  leagueScore: { fontWeight: "900", fontSize: 18 },

  failureCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    overflow: "hidden",
  },
  failureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  failureRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  failureRank: { color: "#f97316", fontWeight: "900", fontSize: 14, width: 20 },
  failureItem: { flex: 1, color: "white", fontSize: 14, fontWeight: "600" },
  failureCountBadge: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  failureCount: { color: "#f97316", fontWeight: "900", fontSize: 13 },

  exportBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    marginTop: 4,
  },
  exportBtnText: { color: "#f97316", fontWeight: "800", fontSize: 15 },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  activityIcon: { fontSize: 18, width: 24, textAlign: "center" },
  activityInfo: { flex: 1 },
  activityName: { color: "white", fontWeight: "700", fontSize: 15 },
  activityMeta: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  activityScore: { fontWeight: "900", fontSize: 14 },

  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: { color: "white", fontSize: 26, fontWeight: "900" },
  statLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: -2,
    marginLeft: 4,
  },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
  },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  memberCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
    gap: 12,
  },
  memberCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  memberCardLeft: { gap: 4, flex: 1 },
  memberName: { color: "white", fontSize: 15, fontWeight: "700" },
  memberLicence: { color: "rgba(255,255,255,0.55)", fontSize: 13 },

  roleBadge: {
    backgroundColor: "transparent",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    marginLeft: 10,
  },
  roleBadgeOwner: {
    borderColor: "rgba(249,115,22,0.40)",
  },
  roleBadgeText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "700",
  },
  roleBadgeTextOwner: { color: "#f97316" },

  memberCardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  memberCardStats: { flexDirection: "row", gap: 0, justifyContent: "space-between" },
  memberStat: { flex: 1, gap: 3, alignItems: "flex-start" },
  memberStatLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  memberStatValue: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },

  actionRow: { flexDirection: "row", gap: 10 },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 14,
    gap: 4,
  },
  actionCardTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  actionCardSub: { color: "rgba(255,255,255,0.55)", fontSize: 13 },

  assignBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
  },
  assignBtnText: { color: "#f97316", fontWeight: "900", fontSize: 15 },

  inviteBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  inviteBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
  templatesBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  templatesBtnText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 15 },
  searchInput: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 4,
  },

  onboardCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    backgroundColor: "rgba(249,115,22,0.06)",
    padding: 20,
    gap: 12,
  },
  onboardTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  onboardBody: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 21 },
  onboardBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  onboardBtnText: { color: "#07152b", fontWeight: "900", fontSize: 14 },
});
