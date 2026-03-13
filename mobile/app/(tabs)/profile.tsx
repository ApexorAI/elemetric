import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

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
            const { data: jobs } = await supabase
              .from("jobs")
              .select("confidence")
              .eq("user_id", user.id);

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
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading profile…</Text>
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
  loadingText: { color: "rgba(255,255,255,0.7)" },
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  gearIcon: { color: "rgba(255,255,255,0.6)", fontSize: 22 },
  title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 14 },
  body: { padding: 18, paddingBottom: 50 },

  scoreCard: {
    borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", marginBottom: 8,
  },
  scoreLeft: { flex: 1, paddingRight: 16 },
  scoreTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  scoreSubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  scoreBadge: {
    marginTop: 10, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  scoreBadgeText: { fontWeight: "900", fontSize: 12 },
  scoreRight: {},
  scorePlaceholder: {
    borderRadius: SIZE / 2, borderWidth: 3,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  scorePlaceholderText: { color: "rgba(255,255,255,0.25)", fontSize: 20, fontWeight: "900" },

  licenceRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 16,
  },
  label: { color: "rgba(255,255,255,0.7)", marginTop: 16, fontWeight: "700" },

  verifiedBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(34,197,94,0.40)",
    paddingHorizontal: 10, paddingVertical: 4,
  },
  verifiedBadgeText: { color: "#22c55e", fontWeight: "900", fontSize: 12 },
  verifiedDate: {
    color: "rgba(34,197,94,0.65)", fontSize: 12,
    marginTop: 6, marginLeft: 2,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 12,
    color: "white", marginTop: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", fontSize: 15,
  },

  verifyBtn: {
    marginTop: 10, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.40)",
    backgroundColor: "rgba(34,197,94,0.10)",
    padding: 14, alignItems: "center", gap: 3,
  },
  verifyBtnText: { color: "#22c55e", fontWeight: "900", fontSize: 15 },
  verifyBtnSub: { color: "rgba(34,197,94,0.65)", fontSize: 11 },

  reverifyBtn: {
    marginTop: 8, alignItems: "center", paddingVertical: 8,
  },
  reverifyBtnText: { color: "rgba(34,197,94,0.6)", fontWeight: "700", fontSize: 13 },

  confirmCard: {
    marginTop: 14, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(34,197,94,0.30)",
    backgroundColor: "rgba(34,197,94,0.07)",
    padding: 16, gap: 12,
  },
  confirmTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  confirmDesc: { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 19 },
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkboxTick: { color: "white", fontWeight: "900", fontSize: 14 },
  checkLabel: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  confirmBtn: {
    backgroundColor: "#22c55e", borderRadius: 12,
    paddingVertical: 13, alignItems: "center",
  },
  confirmBtnDisabled: { backgroundColor: "rgba(34,197,94,0.30)" },
  confirmBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },
  confirmCancel: { alignItems: "center", paddingVertical: 4 },
  confirmCancelText: { color: "rgba(255,255,255,0.4)", fontWeight: "700", fontSize: 13 },

  button: {
    marginTop: 30, backgroundColor: "#f97316",
    padding: 16, borderRadius: 14, alignItems: "center",
  },
  buttonText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  toast: {
    position: "absolute", bottom: 40, left: 20, right: 20,
    backgroundColor: "#22c55e", borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  toastText: { color: "white", fontWeight: "900", fontSize: 15 },
});
