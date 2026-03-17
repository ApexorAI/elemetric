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
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import QRCode from "qrcode";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

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
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const openMapLink = () => {
    const q = encodeURIComponent(passport?.address || address);
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
  };

  const generatePdf = async () => {
    if (!passport) return;
    setPdfLoading(true);
    try {
      const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
      const scoreColor = complianceColor(passport.overallCompliance);
      const label = complianceLabel(passport.overallCompliance);

      // Extract unique tradies
      const tradiesMap: Record<string, { name: string; types: Set<string>; count: number }> = {};
      for (const j of passport.jobs) {
        if (j.installerName) {
          if (!tradiesMap[j.installerName]) tradiesMap[j.installerName] = { name: j.installerName, types: new Set(), count: 0 };
          tradiesMap[j.installerName].types.add(JOB_TYPE_LABELS[j.jobType] ?? j.jobType);
          tradiesMap[j.installerName].count++;
        }
      }
      const tradies = Object.values(tradiesMap);

      const trendRows = passport.trend.map((t) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${t.month}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${complianceColor(t.avgConfidence)};">${t.avgConfidence}%</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">${t.jobCount}</td>
        </tr>`).join("");

      const jobRows = passport.jobs.map((j) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${JOB_TYPE_ICONS[j.jobType] ?? "📋"} ${JOB_TYPE_LABELS[j.jobType] ?? j.jobType}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${j.jobName}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${new Date(j.createdAt).toLocaleDateString("en-AU")}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${j.installerName || "—"}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${complianceColor(j.confidence)};">${j.confidence}%</td>
        </tr>`).join("");

      const tradieRows = tradies.map((t) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;">${t.name}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${Array.from(t.types).join(", ")}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;">${t.count}</td>
        </tr>`).join("");

      const html = `<html><head><style>
@page { margin: 15mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; }
</style></head><body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div>
    <div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
    <div style="font-size:11px;opacity:0.6;margin-top:2px;">Property Compliance Passport</div>
  </div>
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="font-size:14px;font-weight:bold;">Property Passport — ${passport.address}</div>
  <div style="font-size:12px;">${dateStr}</div>
</div>
<div style="padding:22px;">

<div style="background:#f8fafc;border-left:4px solid #f97316;padding:16px;margin-bottom:20px;border-radius:0 6px 6px 0;">
  <div style="font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Overall Compliance Summary</div>
  <div style="font-size:48px;font-weight:900;color:${scoreColor};">${passport.overallCompliance !== null ? passport.overallCompliance + "%" : "—"}</div>
  <div style="font-size:14px;font-weight:bold;color:${scoreColor};margin-top:4px;">${label}</div>
  <div style="margin-top:8px;font-size:13px;">${passport.jobCount} compliance job${passport.jobCount !== 1 ? "s" : ""} on record</div>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

${passport.trend.length > 0 ? `
<div style="margin-bottom:20px;">
  <div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Compliance Trend</div>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="background:#f3f4f6;">
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Month</th>
      <th style="padding:6px 10px;text-align:center;border:1px solid #e5e7eb;">Avg. Score</th>
      <th style="padding:6px 10px;text-align:center;border:1px solid #e5e7eb;">Jobs</th>
    </tr></thead>
    <tbody>${trendRows}</tbody>
  </table>
</div>
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>` : ""}

${tradies.length > 0 ? `
<div style="margin-bottom:20px;">
  <div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Tradies on Record</div>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="background:#f3f4f6;">
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Name</th>
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Trades</th>
      <th style="padding:6px 10px;text-align:center;border:1px solid #e5e7eb;">Jobs</th>
    </tr></thead>
    <tbody>${tradieRows}</tbody>
  </table>
</div>
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>` : ""}

<div style="margin-bottom:20px;">
  <div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Full Job History</div>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="background:#f3f4f6;">
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Trade</th>
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Job Name</th>
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Date</th>
      <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb;">Tradesperson</th>
      <th style="padding:6px 10px;text-align:center;border:1px solid #e5e7eb;">Score</th>
    </tr></thead>
    <tbody>${jobRows}</tbody>
  </table>
</div>

<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;">
  <strong style="color:#374151;">Disclaimer:</strong> Generated by Elemetric on ${dateStr}. This document is a summary of recorded compliance jobs and does not constitute a formal compliance certificate.
</div>
</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const dest = `${FileSystem.cacheDirectory}elemetric-passport-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, { mimeType: "application/pdf", dialogTitle: "Share Property Passport", UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("PDF Created", `Saved to: ${dest}`);
      }
    } catch (e: any) {
      Alert.alert("PDF Error", e?.message ?? "Could not generate PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const getShareUrl = (addr: string): string => {
    const addrHash = btoa(addr.toLowerCase().trim()).replace(/[^a-z0-9]/gi, "").substring(0, 12);
    return `https://elemetric.com.au/property/${addrHash}`;
  };

  const sharePassport = async () => {
    const q = address.trim();
    const shareUrl = getShareUrl(q);
    try {
      // Copy to clipboard if available
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Clipboard = require("expo-clipboard");
        await Clipboard.setStringAsync(shareUrl);
        Alert.alert("Link copied", "Share this link with your client to show their property compliance history.");
        return;
      } catch {}
      // Fallback to native share
      await Share.share({
        title: `Property Compliance Passport — ${q}`,
        message: `Compliance history for ${q}: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {}
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Property History</Text>
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

            {/* ── Map link + actions ─────────────────────────────────────── */}
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={openMapLink}>
                <Text style={styles.actionBtnText}>📍 View on Map</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionBtnOrange, pdfLoading && { opacity: 0.5 }]} onPress={generatePdf} disabled={pdfLoading}>
                {pdfLoading
                  ? <ActivityIndicator size="small" color="#0b1220" />
                  : <Text style={[styles.actionBtnText, { color: "#0b1220" }]}>📄 Export PDF</Text>
                }
              </Pressable>
            </View>

            {/* ── Share & QR ───────────────────────────────────────── */}
            {(() => {
              const shareUrl = getShareUrl(passport.address);
              return (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Share Property Report</Text>
                  <Text style={styles.sectionSub}>
                    Share a compliance summary link with your client
                  </Text>
                  <View style={styles.shareUrlBox}>
                    <Text style={styles.shareUrlText} numberOfLines={1}>{shareUrl}</Text>
                  </View>
                  <Image
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}` }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                  <Pressable style={styles.shareBtn} onPress={sharePassport} accessibilityRole="button" accessibilityLabel="Share Property Report Link">
                    <Text style={styles.shareBtnText}>Copy & Share Link →</Text>
                  </Pressable>
                  <Text style={styles.privacyNote}>
                    🔒 Plumber names and personal details are not visible in the public view.
                  </Text>
                </View>
              );
            })()}

            {/* ── Tradies on record ─────────────────────────────────────── */}
            {(() => {
              const tradiesMap: Record<string, { name: string; types: string[]; count: number }> = {};
              for (const j of passport.jobs) {
                if (j.installerName) {
                  if (!tradiesMap[j.installerName]) tradiesMap[j.installerName] = { name: j.installerName, types: [], count: 0 };
                  const tLabel = JOB_TYPE_LABELS[j.jobType] ?? j.jobType;
                  if (!tradiesMap[j.installerName].types.includes(tLabel)) tradiesMap[j.installerName].types.push(tLabel);
                  tradiesMap[j.installerName].count++;
                }
              }
              const tradies = Object.values(tradiesMap);
              if (tradies.length === 0) return null;
              return (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Tradies on Record</Text>
                  <Text style={styles.sectionSub}>{tradies.length} tradie{tradies.length !== 1 ? "s" : ""} have worked at this property</Text>
                  {tradies.map((t) => (
                    <View key={t.name} style={styles.tradieRow}>
                      <View style={styles.tradieIcon}><Text style={styles.tradieIconText}>👷</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tradieName}>{t.name}</Text>
                        <Text style={styles.tradieMeta}>{t.types.join(" · ")} · {t.count} job{t.count !== 1 ? "s" : ""}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  searchWrap: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  searchBtnText: { color: "#07152b", fontWeight: "900", fontSize: 14 },

  body: { padding: 20, gap: 14, paddingBottom: 48 },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionBtnOrange: { backgroundColor: "#f97316", borderColor: "#f97316" },
  actionBtnText: { color: "white", fontWeight: "800", fontSize: 14 },

  tradieRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  tradieIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  tradieIconText: { fontSize: 18 },
  tradieName: { color: "white", fontWeight: "700", fontSize: 15 },
  tradieMeta: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 1 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
    gap: 6,
  },

  // Score card
  cardLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bigScore: { fontSize: 60, fontWeight: "900", lineHeight: 68 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
    backgroundColor: "transparent",
  },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  cardSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 6 },
  cardAddr: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "700" },

  // Section headings
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 15 },
  sectionSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 8 },

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
    color: "rgba(255,255,255,0.35)",
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: { color: "#f97316", fontWeight: "900" },
  shareUrlBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shareUrlText: { color: "#f97316", fontSize: 12, fontWeight: "600" },
  privacyNote: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  // Job history
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
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
  jobName: { color: "white", fontWeight: "700", fontSize: 15 },
  jobMeta: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  jobInstaller: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
  jobScore: { fontSize: 18, fontWeight: "900" },

  // Empty state
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  emptySub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // Hint
  hint: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  hintIcon: { fontSize: 32 },
  hintText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 22,
  },

  back: { marginTop: 8, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
