import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SkeletonBox, SkeletonProfileCard } from "@/components/SkeletonLoader";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { supabase } from "@/lib/supabase";

const R = 52;
const STROKE = 11;
const SIZE = (R + STROKE) * 2 + 4;
const CIRC = 2 * Math.PI * R;

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

function ComplianceCircle({ score }: { score: number | null }) {
  if (score === null) {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    return (
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={cx} cy={cy} r={R} stroke="rgba(255,255,255,0.10)" strokeWidth={STROKE} fill="none" />
        <SvgText x={cx} y={cy + 8} textAnchor="middle" fontSize="22" fontWeight="900" fill="rgba(255,255,255,0.25)">
          —
        </SvgText>
      </Svg>
    );
  }
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const offset = CIRC * (1 - pct / 100);
  const color = scoreColor(pct);
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={cx} cy={cy} r={R} stroke="rgba(255,255,255,0.10)" strokeWidth={STROKE} fill="none" />
      <Circle
        cx={cx} cy={cy} r={R}
        stroke={color} strokeWidth={STROKE} fill="none"
        strokeDasharray={`${CIRC}`} strokeDashoffset={`${offset}`}
        strokeLinecap="round"
        transform={`rotate(-90, ${cx}, ${cy})`}
      />
      <SvgText x={cx} y={cy + 8} textAnchor="middle" fontSize="26" fontWeight="900" fill={color}>
        {pct}
      </SvgText>
    </Svg>
  );
}

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [role, setRole] = useState<string>("individual");
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  const [showEmployerModal, setShowEmployerModal] = useState(false);
  const [switchingToEmployer, setSwitchingToEmployer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, licence_number, compliance_score, role, trial_started_at, subscription_status")
            .eq("user_id", user.id)
            .single();

          if (profile && active) {
            setFullName(profile.full_name || "");
            setLicenceNumber(profile.licence_number || "");
            setComplianceScore(profile.compliance_score ?? null);
            setRole(profile.role || "individual");
            setTrialStartedAt(profile.trial_started_at ?? null);
            setSubscriptionStatus(profile.subscription_status ?? null);
          }
        } catch {} finally {
          if (active) setLoading(false);
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  const switchToEmployer = async () => {
    setSwitchingToEmployer(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const { error } = await supabase.from("profiles").upsert(
        { user_id: user.id, role: "employer" },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setRole("employer");
      setShowEmployerModal(false);
      router.push("/employer/dashboard");
    } catch {} finally {
      setSwitchingToEmployer(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // Compute subscription status label
  const subscriptionLabel = (() => {
    if (subscriptionStatus === "pro" || subscriptionStatus === "active") {
      return "Pro — Active";
    }
    if (trialStartedAt) {
      const started = new Date(trialStartedAt);
      const trialDays = 14;
      const elapsed = Math.floor((Date.now() - started.getTime()) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(0, trialDays - elapsed);
      return `Free Trial — ${remaining} day${remaining === 1 ? "" : "s"} remaining`;
    }
    return "Free Trial";
  })();

  const isSubscriptionPro =
    subscriptionStatus === "pro" || subscriptionStatus === "active";

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>ELEMETRIC</Text>
          </View>
          <Text style={styles.title}>My Profile</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { gap: 12 }]}>
          <SkeletonProfileCard />
          {[1, 2].map((i) => (
            <View key={i} style={{ gap: 6 }}>
              <SkeletonBox width={120} height={12} />
              <SkeletonBox width="100%" height={44} borderRadius={12} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const scoreLabel =
    complianceScore === null ? "No jobs yet"
    : complianceScore >= 80 ? "Excellent"
    : complianceScore >= 50 ? "Good"
    : "Needs Attention";

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>ELEMETRIC</Text>
        </View>
        <Text style={styles.title}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Compliance Score Ring — centered */}
        <View style={styles.ringWrap}>
          <ComplianceCircle score={complianceScore} />
          <Text style={styles.ringLabel}>Compliance Score</Text>
          {complianceScore !== null && (
            <View style={[styles.scoreBadge, {
              borderColor: scoreColor(complianceScore) + "50",
              backgroundColor: scoreColor(complianceScore) + "18",
            }]}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor(complianceScore) }]}>
                {scoreLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Name & Licence display */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FULL NAME</Text>
            <Text style={styles.infoValue}>{fullName || "—"}</Text>
          </View>
          {licenceNumber ? (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", marginTop: 12, paddingTop: 12 }]}>
              <Text style={styles.infoLabel}>LICENCE NUMBER</Text>
              <Text style={styles.infoValue}>{licenceNumber}</Text>
            </View>
          ) : null}
        </View>

        {/* Subscription status */}
        <View style={[styles.subCard, isSubscriptionPro && styles.subCardPro]}>
          <Text style={[styles.subText, isSubscriptionPro && styles.subTextPro]}>
            {subscriptionLabel}
          </Text>
        </View>

        {/* Switch to Employer — only for individual accounts */}
        {role === "individual" && (
          <Pressable style={styles.employerBtn} onPress={() => setShowEmployerModal(true)}>
            <Text style={styles.employerBtnText}>Switch to Employer Account</Text>
            <Text style={styles.employerBtnSub}>Manage a team of tradespeople</Text>
          </Pressable>
        )}

        {/* Edit Profile */}
        <Pressable style={styles.editBtn} onPress={() => router.push("/settings")}>
          <Text style={styles.editBtnText}>Edit Profile →</Text>
        </Pressable>

        {/* Sign Out */}
        <Pressable style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

      </ScrollView>

      {/* Employer modal */}
      <Modal
        visible={showEmployerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmployerModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEmployerModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Employer Account</Text>
            <Text style={styles.modalBody}>
              Employer accounts let you manage your team, track compliance across multiple plumbers, assign jobs, and export team analytics reports.
            </Text>
            <Text style={styles.modalBody}>
              Plans start at $99/month. You can set up your team and explore the dashboard for free before subscribing.
            </Text>
            <Pressable
              style={[styles.modalPrimaryBtn, switchingToEmployer && { opacity: 0.6 }]}
              onPress={switchToEmployer}
              disabled={switchingToEmployer}
            >
              {switchingToEmployer
                ? <ActivityIndicator color="#07152b" size="small" />
                : <Text style={styles.modalPrimaryBtnText}>Set Up Team</Text>}
            </Pressable>
            <Pressable style={styles.modalSecondaryBtn} onPress={() => setShowEmployerModal(false)}>
              <Text style={styles.modalSecondaryBtnText}>Maybe Later</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  body: { padding: 20, paddingBottom: 60, gap: 12 },

  ringWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  ringLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scoreBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  scoreBadgeText: { fontWeight: "700", fontSize: 13 },

  infoCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  infoRow: { gap: 4 },
  infoLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  infoValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  subCard: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  subCardPro: {
    borderColor: "rgba(249,115,22,0.35)",
    backgroundColor: "rgba(249,115,22,0.07)",
  },
  subText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "600",
  },
  subTextPro: {
    color: "#f97316",
    fontWeight: "700",
  },

  employerBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  employerBtnText: { color: "rgba(255,255,255,0.70)", fontWeight: "700", fontSize: 14 },
  employerBtnSub: { color: "rgba(255,255,255,0.35)", fontSize: 12 },

  editBtn: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { color: "white", fontWeight: "700", fontSize: 15 },

  signOutBtn: {
    marginTop: 8,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { color: "#ef4444", fontWeight: "800", fontSize: 15 },

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
    gap: 14,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignSelf: "center", marginBottom: 4,
  },
  modalTitle: { color: "white", fontWeight: "900", fontSize: 20 },
  modalBody: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 21 },
  modalPrimaryBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalPrimaryBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
  modalSecondaryBtn: { alignItems: "center", paddingVertical: 8 },
  modalSecondaryBtnText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 },
});
