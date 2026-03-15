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
  Share,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import QRCode from "qrcode";

const API_BASE = "https://elemetric-ai-production.up.railway.app";

type PassportJob = {
  id: string;
  jobType: string;
  jobName: string;
  jobAddr: string;
  confidence: number;
  createdAt: string;
  installerName?: string;
  status?: string;
};

type TrendEntry = {
  month: string;
  avgConfidence: number;
  jobCount: number;
};

type PassportData = {
  address: string;
  jobCount: number;
  overallCompliance: number | null;
  trend: TrendEntry[];
  jobs: PassportJob[];
};

const JOB_TYPE_LABELS: Record<string, string> = {
  hotwater: "Plumbing",
  gas: "Gas",
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

function complianceColor(score: number | null): string {
  if (score === null) return "#9ca3af";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f97316";
  return "#ef4444";
}

function complianceLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 80) return "Compliant";
  if (score >= 60) return "Review needed";
  return "Non-compliant";
}

export default function PropertyPassportScreen() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const search = async () => {
    const q = address.trim();
    if (q.length < 3) return;

    setLoading(true);
    setPassport(null);
    setQrDataUrl(null);

    try {
      const res = await fetch(
        `${API_BASE}/property-passport?address=${encodeURIComponent(q)}`,
        {
          headers: {
            "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Search failed");
      setPassport(json as PassportData);

      // Generate sharable QR code pointing to the live endpoint
      const shareUrl = `${API_BASE}/property-passport?address=${encodeURIComponent(q)}`;
      try {
        const qrSvg = await QRCode.toString(shareUrl, { type: "svg", width: 200, margin: 2 });
        setQrDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`);
      } catch {
        // QR generation failed — passport still shows
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load property passport.");
    } finally {
      setLoading(false);
    }
  };

  const sharePassport = async () => {
    const q = address.trim();
    const url = `${API_BASE}/property-passport?address=${encodeURIComponent(q)}`;
    try {
      await Share.share({
        title: `Property Compliance Passport — ${q}`,
        message: `Compliance history for ${q}: ${url}`,
        url,
      });
    } catch {}
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Property Passport</Text>
        <Text style={styles.subtitle}>Full compliance history at any address</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Enter address (e.g. 12 Smith St, Melbourne)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          returnKeyType="search"
          onSubmitEditing={search}
          autoCorrect={false}
        />
        <Pressable
          style={[styles.searchBtn, (loading || address.trim().length < 3) && { opacity: 0.5 }]}
          onPress={search}
          disabled={loading || address.trim().length < 3}
        >
          {loading
            ? <ActivityIndicator size="small" color="#0b1220" />
            : <Text style={styles.searchBtnText}>Search</Text>
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {passport && (
          <>
            {/* ── Overall score ─────────────────────────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>OVERALL COMPLIANCE</Text>
              <Text style={[styles.bigScore, { color: complianceColor(passport.overallCompliance) }]}>
                {passport.overallCompliance !== null ? `${passport.overallCompliance}%` : "—"}
              </Text>
              <View style={[styles.statusBadge, { borderColor: complianceColor(passport.overallCompliance) + "50", backgroundColor: complianceColor(passport.overallCompliance) + "18" }]}>
                <Text style={[styles.statusBadgeText, { color: complianceColor(passport.overallCompliance) }]}>
                  {complianceLabel(passport.overallCompliance)}
                </Text>
              </View>
              <Text style={styles.cardSub}>
                {passport.jobCount} job{passport.jobCount !== 1 ? "s" : ""} on record
              </Text>
              <Text style={styles.cardAddr} numberOfLines={3}>{passport.address}</Text>
            </View>

            {/* ── Compliance trend ──────────────────────────────────────── */}
            {passport.trend.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Compliance Trend</Text>
                <Text style={styles.sectionSub}>Average confidence score per month</Text>
                {passport.trend.map((t) => (
                  <View key={t.month} style={styles.trendRow}>
                    <Text style={styles.trendMonth}>{t.month}</Text>
                    <View style={styles.trendBarWrap}>
                      <View
                        style={[
                          styles.trendBar,
                          {
                            width: `${t.avgConfidence}%` as any,
                            backgroundColor: complianceColor(t.avgConfidence),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.trendScore, { color: complianceColor(t.avgConfidence) }]}>
                      {t.avgConfidence}%
                    </Text>
                    <Text style={styles.trendJobCount}>{t.jobCount}j</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── QR code + share ───────────────────────────────────────── */}
            {qrDataUrl && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Shareable Compliance QR</Text>
                <Text style={styles.sectionSub}>
                  Anyone can scan this code to view the live compliance record for this property
                </Text>
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                <Pressable style={styles.shareBtn} onPress={sharePassport}>
                  <Text style={styles.shareBtnText}>Share Link</Text>
                </Pressable>
              </View>
            )}

            {/* ── Job history ───────────────────────────────────────────── */}
            {passport.jobs.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Job History</Text>
                {passport.jobs.map((job, idx) => (
                  <View
                    key={job.id}
                    style={[
                      styles.jobRow,
                      idx === 0 && { borderTopWidth: 0 },
                    ]}
                  >
                    <View style={styles.jobIconWrap}>
                      <Text style={styles.jobIcon}>
                        {JOB_TYPE_ICONS[job.jobType] ?? "📋"}
                      </Text>
                    </View>
                    <View style={styles.jobInfo}>
                      <Text style={styles.jobName} numberOfLines={1}>
                        {job.jobName}
                      </Text>
                      <Text style={styles.jobMeta}>
                        {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                        {" · "}
                        {new Date(job.createdAt).toLocaleDateString("en-AU", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                      {job.installerName ? (
                        <Text style={styles.jobInstaller}>By {job.installerName}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.jobScore, { color: complianceColor(job.confidence) }]}>
                      {job.confidence}%
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🏠</Text>
                <Text style={styles.emptyTitle}>No records found</Text>
                <Text style={styles.emptySub}>
                  No compliance jobs have been logged for this address yet.
                </Text>
              </View>
            )}
          </>
        )}

        {!passport && !loading && (
          <View style={styles.hint}>
            <Text style={styles.hintIcon}>🔍</Text>
            <Text style={styles.hintText}>
              Enter a property address above to view its full compliance history, trend, and generate a shareable QR code.
            </Text>
          </View>
        )}

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  searchWrap: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  searchBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: "center",
    minWidth: 80,
    alignItems: "center",
  },
  searchBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 14 },

  body: { padding: 18, gap: 14, paddingBottom: 48 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18,
    gap: 6,
  },

  // Score card
  cardLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  bigScore: { fontSize: 60, fontWeight: "900", lineHeight: 68 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 6 },
  cardAddr: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "700" },

  // Section headings
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  sectionSub: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 8 },

  // Trend bars
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  trendMonth: { color: "rgba(255,255,255,0.55)", fontSize: 12, width: 60 },
  trendBarWrap: {
    flex: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 5,
    overflow: "hidden",
  },
  trendBar: { height: 10, borderRadius: 5 },
  trendScore: { fontSize: 13, fontWeight: "800", width: 38, textAlign: "right" },
  trendJobCount: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 11,
    width: 22,
    textAlign: "right",
  },

  // QR
  qrImage: {
    width: 180,
    height: 180,
    alignSelf: "center",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 6,
    marginVertical: 8,
  },
  shareBtn: {
    marginTop: 6,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  shareBtnText: { color: "#f97316", fontWeight: "900" },

  // Job history
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  jobIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  jobIcon: { fontSize: 18 },
  jobInfo: { flex: 1 },
  jobName: { color: "white", fontWeight: "800", fontSize: 14 },
  jobMeta: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
  jobInstaller: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
  jobScore: { fontSize: 18, fontWeight: "900" },

  // Empty state
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  emptySub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // Hint
  hint: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  hintIcon: { fontSize: 32 },
  hintText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },

  back: { marginTop: 8, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.45)", fontWeight: "700" },
});
