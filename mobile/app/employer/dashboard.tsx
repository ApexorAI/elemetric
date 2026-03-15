import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

type MemberData = {
  userId: string;
  fullName: string;
  licenceNumber: string;
  complianceScore: number | null;
  jobCount: number;
  lastActive: string | null;
  role: string;
};

// ── Main screen ──────────────────────────────────────────────────────────────

export default function EmployerDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<MemberData[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

            try {
              const { data: jobs } = await supabase
                .from("jobs")
                .select("created_at")
                .eq("user_id", m.user_id)
                .order("created_at", { ascending: false });

              if (jobs) {
                jobCount = jobs.length;
                lastActive = jobs[0]?.created_at ?? null;
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
            });
          }

          if (active) setMembers(hydrated);
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
          <Text style={styles.title}>Employer Portal</Text>
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
        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Total Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{avgCompliance()}</Text>
            <Text style={styles.statLabel}>Avg Compliance</Text>
          </View>
        </View>

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
  loadingText: { color: "rgba(255,255,255,0.7)" },

  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  teamName: { marginTop: 4, color: "#f97316", fontSize: 14, fontWeight: "700" },

  body: { padding: 18, gap: 12, paddingBottom: 60 },

  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: { color: "white", fontSize: 26, fontWeight: "900" },
  statLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  sectionLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: -2,
    marginLeft: 4,
  },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  memberCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 12,
  },
  memberCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  memberCardLeft: { gap: 4, flex: 1 },
  memberName: { color: "white", fontSize: 16, fontWeight: "700" },
  memberLicence: { color: "rgba(255,255,255,0.45)", fontSize: 13 },

  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginLeft: 10,
  },
  roleBadgeOwner: {
    backgroundColor: "rgba(249,115,22,0.18)",
    borderColor: "rgba(249,115,22,0.40)",
  },
  roleBadgeText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  roleBadgeTextOwner: { color: "#f97316" },

  memberCardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  memberCardStats: { flexDirection: "row", gap: 0, justifyContent: "space-between" },
  memberStat: { flex: 1, gap: 3, alignItems: "flex-start" },
  memberStatLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  memberStatValue: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },

  actionRow: { flexDirection: "row", gap: 10 },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    gap: 4,
  },
  actionCardTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  actionCardSub: { color: "rgba(255,255,255,0.45)", fontSize: 11 },

  assignBtn: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
  },
  assignBtnText: { color: "#f97316", fontWeight: "900", fontSize: 15 },

  inviteBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  inviteBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
  templatesBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  templatesBtnText: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 15 },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 4,
  },
});
