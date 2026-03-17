import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SkeletonBox, SkeletonProfileCard } from "@/components/SkeletonLoader";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle, Text as SvgText, Polyline, Line, G } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

const SCREEN_WIDTH = Dimensions.get("window").width;

const VBA_URL = "https://www.vba.vic.gov.au/licence-check";

const R = 38;
const STROKE = 9;
const SIZE = (R + STROKE) * 2 + 4;
const CIRC = 2 * Math.PI * R;

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

function ComplianceCircle({ score }: { score: number | null }) {
  if (score === null) return null;
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
      <SvgText x={cx} y={cy + 8} textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>
        {pct}
      </SvgText>
    </Svg>
  );
}

// ── Compliance trend chart ────────────────────────────────────────────────────

type MonthlyScore = { month: string; score: number };

function ComplianceTrendChart({ data }: { data: MonthlyScore[] }) {
  if (data.length < 2) return null;
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 80;
  const pad = { left: 32, right: 8, top: 8, bottom: 20 };
  const plotW = chartWidth - pad.left - pad.right;
  const plotH = chartHeight - pad.top - pad.bottom;
  const scores = data.map((d) => d.score);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 1;

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * plotW,
    y: pad.top + plotH - ((d.score - minScore) / range) * plotH,
  }));

  const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const isImproving = scores[scores.length - 1] >= scores[0];
  const lineColor = isImproving ? "#22c55e" : "#ef4444";

  return (
    <View style={styles.chartCard}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={styles.chartTitle}>Compliance Trend</Text>
        <View style={[styles.trendBadge, { backgroundColor: isImproving ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", borderColor: isImproving ? "rgba(34,197,94,0.40)" : "rgba(239,68,68,0.40)" }]}>
          <Text style={[styles.trendBadgeText, { color: isImproving ? "#22c55e" : "#ef4444" }]}>
            {isImproving ? "▲ Improving" : "▼ Declining"}
          </Text>
        </View>
      </View>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((f, i) => (
          <Line
            key={i}
            x1={pad.left} y1={pad.top + plotH * (1 - f)}
            x2={pad.left + plotW} y2={pad.top + plotH * (1 - f)}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1}
          />
        ))}
        {/* Line */}
        <Polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={4} fill={lineColor} />
            <SvgText x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill={lineColor} fontWeight="700">{data[i].score}</SvgText>
          </G>
        ))}
        {/* Month labels */}
        {data.map((d, i) => (
          <SvgText
            key={i}
            x={pad.left + (i / (data.length - 1)) * plotW}
            y={chartHeight - 4}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.35)"
          >
            {d.month}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName]             = useState("");
  const [licenceNumber, setLicenceNumber]   = useState("");
  const [companyName, setCompanyName]       = useState("");
  const [phone, setPhone]                   = useState("");
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [jobCount, setJobCount]             = useState(0);
  const [trendData, setTrendData]           = useState<MonthlyScore[]>([]);
  const [percentile, setPercentile]         = useState<number | null>(null);
  const [benchBadge, setBenchBadge]         = useState<string | null>(null);

  // Licence verification
  const [licenceVerified, setLicenceVerified]     = useState(false);
  const [licenceVerifiedAt, setLicenceVerifiedAt] = useState<string | null>(null);
  const [licenceExpiryDate, setLicenceExpiryDate] = useState("");
  const [showConfirm, setShowConfirm]             = useState(false);
  const [confirmChecked, setConfirmChecked]       = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, licence_number, company_name, phone, licence_verified, licence_verified_at, licence_expiry_date")
            .eq("user_id", user.id)
            .single();

          if (profile && active) {
            setFullName(profile.full_name || "");
            setLicenceNumber(profile.licence_number || "");
            setCompanyName(profile.company_name || "");
            setPhone(profile.phone || "");
            setLicenceVerified(profile.licence_verified ?? false);
            setLicenceVerifiedAt(profile.licence_verified_at ?? null);
            setLicenceExpiryDate(profile.licence_expiry_date || "");
          }

          try {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const { data: jobs } = await supabase
              .from("jobs")
              .select("confidence, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: true });

            if (jobs && jobs.length > 0 && active) {
              const avg = Math.round(
                jobs.reduce((sum, j) => sum + (j.confidence ?? 0), 0) / jobs.length
              );
              setComplianceScore(avg);
              setJobCount(jobs.length);
              try {
                await supabase.from("profiles").upsert(
                  { user_id: user.id, compliance_score: avg },
                  { onConflict: "user_id" }
                );
              } catch {}

              // Build monthly trend data (last 6 months)
              const monthMap: Record<string, number[]> = {};
              for (const j of jobs) {
                const d = new Date(j.created_at);
                if (d < sixMonthsAgo) continue;
                const key = d.toLocaleDateString("en-AU", { month: "short" });
                if (!monthMap[key]) monthMap[key] = [];
                monthMap[key].push(j.confidence ?? 0);
              }
              const trend: MonthlyScore[] = Object.entries(monthMap).map(([month, scores]) => ({
                month,
                score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              }));
              if (active && trend.length >= 2) setTrendData(trend);

              // Benchmarking: fetch all compliance scores from profiles
              try {
                const { data: allProfiles } = await supabase
                  .from("profiles")
                  .select("compliance_score")
                  .not("compliance_score", "is", null);
                if (allProfiles && allProfiles.length > 1 && active) {
                  const scores = allProfiles
                    .map((p: any) => p.compliance_score as number)
                    .filter((s: number) => typeof s === "number");
                  const below = scores.filter((s: number) => s < avg).length;
                  const pct = Math.round((below / scores.length) * 100);
                  setPercentile(pct);
                  let badge: string;
                  if (pct >= 90) badge = "🏆 Top 10%";
                  else if (pct >= 75) badge = "⭐ Top 25%";
                  else if (pct >= 50) badge = "👍 Above Average";
                  else if (pct >= 25) badge = "📈 Below Average";
                  else badge = "🔧 Needs Improvement";
                  setBenchBadge(badge);
                }
              } catch {}
            } else if (active) {
              setComplianceScore(null);
              setJobCount(0);
            }
          } catch {}
        } catch {} finally {
          if (active) setLoading(false);
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: fullName.trim(),
        licence_number: licenceNumber.trim(),
        company_name: companyName.trim(),
        phone: phone.trim(),
        licence_expiry_date: licenceExpiryDate.trim() || null,
      }, { onConflict: "user_id" });
      if (error) throw error;
      showToast("Profile saved.");
    } catch (e: any) {
      showToast(e?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  // ── VBA Verification ─────────────────────────────────────────────────────────

  const openVBA = async () => {
    setVerifying(true);
    try {
      await WebBrowser.openBrowserAsync(VBA_URL, {
        toolbarColor: "#07152b",
        controlsColor: "#f97316",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });
      // After browser closes: show confirmation prompt
      setShowConfirm(true);
      setConfirmChecked(false);
    } catch {}
    setVerifying(false);
  };

  const confirmVerification = async () => {
    if (!confirmChecked) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        licence_verified: true,
        licence_verified_at: now,
      }, { onConflict: "user_id" });
      if (error) throw error;
      setLicenceVerified(true);
      setLicenceVerifiedAt(now);
      setShowConfirm(false);
      setConfirmChecked(false);
      showToast("Licence verified successfully.");
    } catch (e: any) {
      showToast(e?.message ?? "Could not save verification.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>ELEMETRIC</Text>
          </View>
          <Text style={styles.title}>Profile</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { gap: 12 }]}>
          <SkeletonProfileCard />
          {[1,2,3,4].map((i) => (
            <View key={i} style={{ gap: 6 }}>
              <SkeletonBox width={100} height={12} />
              <SkeletonBox width="100%" height={44} borderRadius={12} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const labelText =
    complianceScore === null ? "No jobs yet"
    : complianceScore >= 80 ? "Excellent"
    : complianceScore >= 50 ? "Good"
    : "Needs Attention";

  const verifiedDate = licenceVerifiedAt
    ? new Date(licenceVerifiedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>ELEMETRIC</Text>
          <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
            <Text style={styles.gearIcon}>⚙</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your details appear in compliance reports</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Compliance Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreLeft}>
            <Text style={styles.scoreTitle}>Compliance Score</Text>
            <Text style={styles.scoreSubtitle}>
              {complianceScore === null
                ? "Complete jobs to generate your score"
                : `Based on ${jobCount} job${jobCount === 1 ? "" : "s"}`}
            </Text>
            {complianceScore !== null && (
              <View style={[styles.scoreBadge, {
                borderColor: scoreColor(complianceScore) + "50",
                backgroundColor: scoreColor(complianceScore) + "18",
              }]}>
                <Text style={[styles.scoreBadgeText, { color: scoreColor(complianceScore) }]}>
                  {labelText}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.scoreRight}>
            {complianceScore !== null ? (
              <ComplianceCircle score={complianceScore} />
            ) : (
              <View style={[styles.scorePlaceholder, { width: SIZE, height: SIZE }]}>
                <Text style={styles.scorePlaceholderText}>—</Text>
              </View>
            )}
          </View>
        </View>

        {/* Compliance trend chart */}
        {trendData.length >= 2 && <ComplianceTrendChart data={trendData} />}

        {/* Benchmarking card — hidden until real data available */}
        <View style={styles.benchCard}>
          <Text style={styles.benchTitle}>Industry Benchmark</Text>
          <Text style={styles.benchSub}>Benchmarking unlocks when more plumbers join Elemetric.</Text>
        </View>

        {/* Profile fields */}
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholderTextColor="#777"
        />

        {/* Licence Number + verified badge */}
        <View style={styles.licenceRow}>
          <Text style={styles.label}>Licence Number</Text>
          {licenceVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ VBA Verified</Text>
            </View>
          )}
        </View>
        <TextInput
          style={styles.input}
          value={licenceNumber}
          onChangeText={setLicenceNumber}
          placeholderTextColor="#777"
          autoCapitalize="characters"
        />

        {/* Verification date */}
        {licenceVerified && verifiedDate && (
          <Text style={styles.verifiedDate}>Verified on {verifiedDate}</Text>
        )}

        {/* Licence Expiry Date */}
        <Text style={styles.label}>Licence Expiry Date</Text>
        <TextInput
          style={styles.input}
          value={licenceExpiryDate}
          onChangeText={setLicenceExpiryDate}
          placeholder="DD/MM/YYYY"
          placeholderTextColor="#777"
          keyboardType="numbers-and-punctuation"
        />

        {/* VBA Verify button */}
        {!licenceVerified && (
          <Pressable
            style={[styles.verifyBtn, verifying && { opacity: 0.6 }]}
            onPress={openVBA}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#22c55e" />
            ) : (
              <>
                <Text style={styles.verifyBtnText}>Verify Licence via VBA</Text>
                <Text style={styles.verifyBtnSub}>Opens vba.vic.gov.au licence check</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Re-verify option when already verified */}
        {licenceVerified && (
          <Pressable
            style={[styles.reverifyBtn, verifying && { opacity: 0.6 }]}
            onPress={openVBA}
            disabled={verifying}
          >
            <Text style={styles.reverifyBtnText}>Re-verify Licence →</Text>
          </Pressable>
        )}

        {/* Confirmation section (shown after browser closes) */}
        {showConfirm && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Verification</Text>
            <Text style={styles.confirmDesc}>
              After checking your licence on the VBA website, tick the box below to confirm it is current and valid.
            </Text>
            <Pressable
              style={styles.checkRow}
              onPress={() => setConfirmChecked((v) => !v)}
            >
              <View style={[styles.checkbox, confirmChecked && styles.checkboxChecked]}>
                {confirmChecked && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                I confirm my licence is current and valid
              </Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !confirmChecked && styles.confirmBtnDisabled]}
              onPress={confirmVerification}
              disabled={!confirmChecked}
            >
              <Text style={styles.confirmBtnText}>Save Verification</Text>
            </Pressable>
            <Pressable onPress={() => setShowConfirm(false)} style={styles.confirmCancel}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Company Name</Text>
        <TextInput
          style={styles.input}
          value={companyName}
          onChangeText={setCompanyName}
          placeholderTextColor="#777"
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor="#777"
          keyboardType="phone-pad"
        />

        <Pressable
          style={[styles.button, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.buttonText}>Save Profile</Text>
          }
        </Pressable>

        {/* Unlock More Tools */}
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeLabel}>UNLOCK MORE TOOLS</Text>
          <Text style={styles.upgradeTitle}>Built for professional tradespeople</Text>
          <Text style={styles.upgradeBody}>
            Referral rewards, invoice generator, timesheet tracking, and training mode are all included in Elemetric Pro.
          </Text>
          <Pressable style={styles.upgradeBtn} onPress={() => router.push("/subscription")}>
            <Text style={styles.upgradeBtnText}>See What's Included →</Text>
          </Pressable>
        </View>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1, backgroundColor: "#07152b",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  loadingText: { color: "rgba(255,255,255,0.55)" },
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  gearIcon: { color: "rgba(255,255,255,0.55)", fontSize: 22 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
  body: { padding: 20, paddingBottom: 50, gap: 0 },

  scoreCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  scoreLeft: { flex: 1, paddingRight: 16 },
  scoreTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  scoreSubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  scoreBadge: {
    marginTop: 10, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  scoreBadgeText: { fontWeight: "700", fontSize: 12 },
  scoreRight: {},
  scorePlaceholder: {
    borderRadius: SIZE / 2, borderWidth: 3,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  scorePlaceholderText: { color: "rgba(255,255,255,0.35)", fontSize: 20, fontWeight: "900" },

  licenceRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 20,
  },
  label: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 20,
    textTransform: "uppercase",
  },

  verifiedBadge: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, borderWidth: 1,
    borderColor: "#22c55e",
    paddingHorizontal: 10, paddingVertical: 4,
  },
  verifiedBadgeText: { color: "#22c55e", fontWeight: "700", fontSize: 12 },
  verifiedDate: {
    color: "rgba(34,197,94,0.65)", fontSize: 12,
    marginTop: 6, marginLeft: 2,
  },

  input: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    padding: 14,
    color: "white",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 15,
  },

  verifyBtn: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.06)",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  verifyBtnText: { color: "#22c55e", fontWeight: "700", fontSize: 15 },
  verifyBtnSub: { color: "rgba(34,197,94,0.65)", fontSize: 11 },

  reverifyBtn: {
    marginTop: 8, alignItems: "center", paddingVertical: 8,
  },
  reverifyBtnText: { color: "rgba(34,197,94,0.6)", fontWeight: "700", fontSize: 13 },

  confirmCard: {
    marginTop: 14,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.30)",
    padding: 16,
    gap: 12,
  },
  confirmTitle: { color: "white", fontWeight: "900", fontSize: 15 },
  confirmDesc: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 19 },
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkboxTick: { color: "white", fontWeight: "900", fontSize: 14 },
  checkLabel: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  confirmBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: { backgroundColor: "rgba(34,197,94,0.25)" },
  confirmBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
  confirmCancel: { alignItems: "center", paddingVertical: 4 },
  confirmCancelText: { color: "rgba(255,255,255,0.35)", fontWeight: "700", fontSize: 13 },

  button: {
    marginTop: 32,
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  upgradeCard: {
    backgroundColor: "rgba(249,115,22,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  upgradeLabel: { color: "#f97316", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  upgradeTitle: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  upgradeBody: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeBtnText: { color: "#07152b", fontSize: 15, fontWeight: "900" },

  toast: {
    position: "absolute", bottom: 40, left: 20, right: 20,
    backgroundColor: "#22c55e", borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  toastText: { color: "white", fontWeight: "900", fontSize: 15 },

  chartCard: {
    marginBottom: 12,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  chartTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  trendBadge: {
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  trendBadgeText: { fontWeight: "700", fontSize: 12 },

  benchCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  benchRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  benchLeft: { flex: 1, gap: 4 },
  benchTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  benchSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  benchBadgeWrap: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    alignSelf: "flex-start",
  },
  benchBadgeText: { color: "#f97316", fontWeight: "800", fontSize: 13 },
  benchBarWrap: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  benchBar: { height: 6, borderRadius: 3, backgroundColor: "#f97316" },
  benchPercentile: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700", textAlign: "right" },
});
