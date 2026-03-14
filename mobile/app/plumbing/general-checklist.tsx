import React, { useState, useCallback } from "react";
import PDFSuccessModal from "@/components/PDFSuccessModal";
import {
View,
Text,
StyleSheet,
TextInput,
Pressable,
ScrollView,
Image,
Alert,
ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { hashBase64, captureTimestamp } from "@/lib/photoHash";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const SIGNATURE_KEY = "elemetric_signature_svg";

const SECTIONS = [
{ id: "overview",     label: "Site Overview" },
{ id: "work_area",    label: "Work Area / Installation" },
{ id: "equipment",    label: "Equipment / Materials" },
{ id: "completion",   label: "Completed Work" },
{ id: "compliance",   label: "Labels / Documentation" },
] as const;

type Section = { photoUris: string[]; notes: string };
type PhotoMeta = { uri: string; hash: string; capturedAt: string };

type AIResult = {
  relevant?: boolean;
  confidence?: number;
  detected?: string[];
  unclear?: string[];
  missing?: string[];
  action?: string;
  analysis?: string;
};

function tradeLabel(type: string): string {
if (type === "electrical") return "Electrical";
if (type === "hvac") return "HVAC";
return type.charAt(0).toUpperCase() + type.slice(1);
}

function tradeStandard(type: string): string {
if (type === "electrical") return "AS/NZS 3000";
if (type === "hvac") return "AS/NZS 1668";
return "";
}

export default function GeneralChecklist() {
const router = useRouter();
const [loaded, setLoaded] = useState(false);
const [jobName, setJobName] = useState("Untitled Job");
const [jobAddr, setJobAddr] = useState("No address");
const [jobType, setJobType] = useState("electrical");
const [tradesperson, setTradesperson] = useState("");
const [signatureSvg, setSignatureSvg] = useState("");
const [sections, setSections] = useState<Record<string, Section>>(() =>
Object.fromEntries(SECTIONS.map((s) => [s.id, { photoUris: [], notes: "" }]))
);
const [photoMeta, setPhotoMeta] = useState<Record<string, PhotoMeta[]>>({});
const [generalNotes, setGeneralNotes] = useState("");
const [pdfLoading, setPdfLoading] = useState(false);
const [showSuccess, setShowSuccess] = useState(false);
const [pdfUri,      setPdfUri]      = useState<string | null>(null);
const [pdfSharing,  setPdfSharing]  = useState(false);
const [licenceNumber, setLicenceNumber] = useState("");
const [companyName, setCompanyName] = useState("");
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult] = useState<AIResult | null>(null);

useFocusEffect(
useCallback(() => {
let active = true;
(async () => {
try {
const raw = await AsyncStorage.getItem("elemetric_current_job");
if (raw && active) {
const j = JSON.parse(raw);
setJobName(j.jobName || "Untitled Job");
setJobAddr(j.jobAddr || "No address");
setJobType(j.type || "electrical");
}
const sig = await AsyncStorage.getItem(SIGNATURE_KEY);
if (sig && active) setSignatureSvg(sig);
} catch {}
try {
const { data: { user } } = await supabase.auth.getUser();
if (user && active) {
const { data } = await supabase
.from("profiles")
.select("full_name, licence_number, company_name")
.eq("user_id", user.id)
.single();
if (data?.full_name && active) setTradesperson(data.full_name);
if (data?.licence_number && active) setLicenceNumber(data.licence_number);
if (data?.company_name && active) setCompanyName(data.company_name);
}
} catch {}
if (active) setLoaded(true);
})();
return () => { active = false; };
}, [])
);

const addPhoto = async (sectionId: string) => {
try {
const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!perm.granted) {
Alert.alert("Permission needed", "Please allow photo access.");
return;
}
const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
quality: 1,
});
if (result.canceled) return;
const uri = result.assets?.[0]?.uri;
if (!uri) return;
const ts = captureTimestamp();
let hash = "";
try {
const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
hash = await hashBase64(b64);
} catch {}
setPhotoMeta((prev) => ({ ...prev, [sectionId]: [...(prev[sectionId] || []), { uri, hash, capturedAt: ts }] }));
setSections((prev) => ({
...prev,
[sectionId]: { ...prev[sectionId], photoUris: [...prev[sectionId].photoUris, uri] },
}));
} catch (e: any) {
Alert.alert("Photo error", e?.message ?? "Unknown error");
}
};

const removePhoto = (sectionId: string, uri: string) => {
setPhotoMeta((prev) => ({ ...prev, [sectionId]: (prev[sectionId] || []).filter((m) => m.uri !== uri) }));
setSections((prev) => ({
...prev,
[sectionId]: {
...prev[sectionId],
photoUris: prev[sectionId].photoUris.filter((u) => u !== uri),
},
}));
};

const setNotes = (sectionId: string, notes: string) =>
setSections((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], notes } }));

// ── AI analysis ───────────────────────────────────────────────────────────────

const runAI = async () => {
const allPhotos: { label: string; uri: string }[] = [];
for (const sec of SECTIONS) {
for (const uri of sections[sec.id]?.photoUris ?? []) {
allPhotos.push({ label: sec.label, uri });
}
}
if (allPhotos.length < 2) {
Alert.alert("More photos needed", "Please add at least 2 photos before running AI analysis.");
return;
}
setAiLoading(true);
try {
const images: { mime: string; data: string; label: string }[] = [];
for (const p of allPhotos) {
const r = await ImageManipulator.manipulateAsync(p.uri, [{ resize: { width: 1200 } }], {
compress: 0.8,
format: ImageManipulator.SaveFormat.JPEG,
base64: true,
});
if (r.base64) images.push({ mime: "image/jpeg", data: r.base64, label: p.label });
}
const res = await fetch(`${API_BASE}/review`, {
method: "POST",
headers: { "Content-Type": "application/json",
        "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "", },
body: JSON.stringify({ type: jobType, images }),
});
const json = await res.json();
if (!res.ok) throw new Error(json?.error ?? "AI request failed");
setAiResult(json);
if ((json.confidence ?? 0) < 35) {
Alert.alert(
"Low Confidence Score",
"Low confidence score. We recommend retaking photos with better lighting and angles before generating your report."
);
}
} catch (e: any) {
Alert.alert("AI Error", e?.message ?? "Unknown error");
} finally {
setAiLoading(false);
}
};

// ── PDF ───────────────────────────────────────────────────────────────────────

const generateReport = async () => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
setPdfLoading(true);
try {
let dateStr = new Date().toLocaleString("en-AU");
let dateShort = new Date().toLocaleDateString("en-AU");
try {
const tsRes = await fetch(`${API_BASE}/timestamp`, { headers: { "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "" } });
const tsJson = await tsRes.json();
if (tsJson?.formatted) dateStr = tsJson.formatted;
if (tsJson?.timestamp) dateShort = new Date(tsJson.timestamp).toLocaleDateString("en-AU");
} catch {}

const label = tradeLabel(jobType);
const standard = tradeStandard(jobType);
const td = `border:1px solid #d1d5db;padding:8px;`;
const th = `${td}background:#f3f4f6;text-align:left;font-weight:bold;font-family:Helvetica,Arial,sans-serif;`;

// QR code
let qrHtml = "";
try {
const qrData = `ELM|${jobType}|${jobName}|${jobAddr}|${dateShort}`;
const qrSvg = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
qrHtml = `<div style="text-align:center;">
<img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
<div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
</div>`;
} catch {}

// Photo sections HTML
const sectionHtml = SECTIONS.map((sec) => {
const entry = sections[sec.id];
const photos = entry.photoUris;
const notes = entry.notes;
if (!photos.length && !notes) return "";

const photoImgs = photos.map((uri) => `
<div style="display:inline-block;width:48%;margin-bottom:8px;vertical-align:top;">
<img src="${uri}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;border:1px solid #d1d5db;"/>
</div>`).join("");

return `
<div style="margin-bottom:16px;">
<div style="font-size:15px;font-weight:bold;margin-bottom:8px;color:#111827;font-family:Helvetica,Arial,sans-serif;">${sec.label}</div>
${photoImgs ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">${photoImgs}</div>` : ""}
${notes ? `<div style="font-size:13px;color:#374151;line-height:1.5;font-family:Helvetica,Arial,sans-serif;">${notes}</div>` : ""}
</div>`;
}).filter(Boolean).join(`<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>`);

const sigHtml = signatureSvg
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(signatureSvg)}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
: `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

// AI section
const aiSection = aiResult ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;border:1px solid #e5e7eb;padding:16px;background:#f9fafb;">
<div style="font-size:17px;font-weight:bold;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">AI Documentation Analysis</div>
<div style="font-size:30px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${aiResult.confidence ?? 0}%</div>
<div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;"><strong>Action:</strong> ${aiResult.action || "—"}</div>
<div style="margin-top:4px;font-family:Helvetica,Arial,sans-serif;">${aiResult.analysis || ""}</div>
</div>` : "";

const html = `<html><head><style>
@page { margin: 15mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } @bottom-left { content: "ELEMETRIC · Confidential"; font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 80pt; font-family: Helvetica,Arial,sans-serif; font-weight: bold; color: rgba(7,21,43,0.04); white-space: nowrap; pointer-events: none; z-index: -1; letter-spacing: 8px; }
</style></head>
<body>
<div class="watermark">ELEMETRIC</div>

<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div>
<div style="font-size:28px;font-weight:900;letter-spacing:3px;font-family:Helvetica,Arial,sans-serif;">ELEMETRIC</div>
<div style="font-size:13px;opacity:0.7;margin-top:4px;font-family:Helvetica,Arial,sans-serif;">${label} Documentation</div>
</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${label} Documentation Report${standard ? " · " + standard : ""}</div>
<div style="font-size:12px;font-family:Helvetica,Arial,sans-serif;">${dateShort}</div>
</div>

<div style="padding:22px;">

<!-- Executive Summary -->
<div style="background:#f8fafc;border-left:4px solid #f97316;padding:16px;margin-bottom:20px;border-radius:0 6px 6px 0;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Executive Summary</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:4px 0;width:180px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Job Type</td><td style="font-family:Helvetica,Arial,sans-serif;">${label}${standard ? " · " + standard : ""}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Date</td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Address</td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Licence Number</td><td style="font-family:Helvetica,Arial,sans-serif;">${licenceNumber || "Not entered"}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">AI Confidence</td><td style="font-family:Helvetica,Arial,sans-serif;">${aiResult ? `${aiResult.confidence ?? 0}%` : "Not analysed"}</td></tr>
  </table>
</div>
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Job Details -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:160px;font-family:Helvetica,Arial,sans-serif;"><strong>Job Name</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${jobName}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Address</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Trade</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${label}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Tradesperson</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${tradesperson || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Licence Number</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${licenceNumber || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Company</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${companyName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Report Date</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
</table>
</div>

${aiSection}

${sectionHtml ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:12px;font-family:Helvetica,Arial,sans-serif;">Documentation Photos</div>
${sectionHtml}
</div>` : ""}

${generalNotes ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">General Notes</div>
<div style="font-size:14px;line-height:1.6;color:#374151;font-family:Helvetica,Arial,sans-serif;">${generalNotes}</div>
</div>` : ""}

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;">
<div style="font-size:18px;font-weight:bold;margin-bottom:12px;font-family:Helvetica,Arial,sans-serif;">Sign-Off</div>
<div style="margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;"><strong>Tradesperson:</strong> ${tradesperson || "Not entered"}</div>
${sigHtml}
<div style="margin-top:6px;font-size:13px;font-family:Helvetica,Arial,sans-serif;"><strong>Date:</strong> ${dateShort}</div>
</div>

<!-- Disclaimer -->
<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;font-family:Helvetica,Arial,sans-serif;"><strong style="color:#374151;">Compliance Disclaimer:</strong> Generated by Elemetric on ${dateStr}. This report is a documentation aid only. Elemetric Pty Ltd accepts no liability for the accuracy of work described herein. Compliance responsibility rests solely with the licensed tradesperson.</div>

</div>
</body>
</html>`;

const { uri: printUri } = await Print.printToFileAsync({ html });
try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}

      // Save job to Supabase for free tier tracking and timeline
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("jobs").insert({
            user_id: user.id,
            job_type: jobType,
            job_name: jobName,
            job_addr: jobAddr,
            confidence: aiResult?.confidence ?? 0,
            relevant: true,
            detected: aiResult?.detected ?? [],
            unclear: aiResult?.unclear ?? [],
            missing: aiResult?.missing ?? [],
            action: aiResult?.action ?? "",
          });
        }
      } catch {}

      const filename = `elemetric-report-${Date.now()}.pdf`;
const dest = `${FileSystem.cacheDirectory}${filename}`;
await FileSystem.copyAsync({ from: printUri, to: dest });
setPdfUri(dest);
setShowSuccess(true);
} catch (e: any) {
Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
} finally {
setPdfLoading(false);
}
};

const sharePdf = async () => {
if (!pdfUri) return;
setPdfSharing(true);
try {
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(pdfUri, {
mimeType: "application/pdf",
dialogTitle: "Share Compliance Report",
UTI: "com.adobe.pdf",
});
} else {
Alert.alert("PDF Created", `Saved to: ${pdfUri}`);
}
} catch (e: any) {
Alert.alert("Share Error", e?.message ?? "Could not share report.");
} finally {
setPdfSharing(false);
}
};

if (!loaded) {
return (
<View style={styles.loadingScreen}>
<ActivityIndicator />
<Text style={styles.loadingText}>Loading…</Text>
</View>
);
}

const label = tradeLabel(jobType);
const standard = tradeStandard(jobType);

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>{label} Documentation</Text>
<Text style={styles.meta}>{jobName} • {jobAddr}</Text>
{!!standard && <Text style={styles.standard}>{standard}</Text>}
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

<View style={styles.disclaimer}>
<Text style={styles.disclaimerText}>
General documentation only — AI compliance validation is not available for this trade type.
</Text>
</View>

<View style={styles.section}>
<Text style={styles.sectionTitle}>Tradesperson Details</Text>
<Text style={styles.fieldLabel}>Name</Text>
<TextInput
style={styles.input}
value={tradesperson}
onChangeText={setTradesperson}
placeholderTextColor="#555"
/>
</View>

{SECTIONS.map((sec) => {
const entry = sections[sec.id];
return (
<View key={sec.id} style={styles.sectionCard}>
<Text style={styles.sectionCardTitle}>{sec.label}</Text>

<Pressable style={styles.addPhotoBtn} onPress={() => addPhoto(sec.id)}>
<Text style={styles.addPhotoBtnText}>+ Add Photo</Text>
</Pressable>

{entry.photoUris.length > 0 && (
<View style={styles.photoGrid}>
{entry.photoUris.map((uri, i) => {
const meta = (photoMeta[sec.id] || []).find((m) => m.uri === uri);
return (
<View key={`${sec.id}-${i}`} style={styles.photoWrap}>
<Image source={{ uri }} style={styles.photo} />
{meta?.hash ? <View style={styles.shieldBadge}><Text style={styles.shieldBadgeText}>🛡</Text></View> : null}
<Pressable
style={styles.removePhotoBtn}
onPress={() => removePhoto(sec.id, uri)}
>
<Text style={styles.removePhotoText}>×</Text>
</Pressable>
</View>
);
})}
</View>
)}

<TextInput
style={styles.notesInput}
value={entry.notes}
onChangeText={(t) => setNotes(sec.id, t)}
placeholder="Notes for this section"
placeholderTextColor="#555"
multiline
/>
</View>
);
})}

<View style={styles.section}>
<Text style={styles.sectionTitle}>General Notes</Text>
<TextInput
style={[styles.input, styles.bigInput]}
value={generalNotes}
onChangeText={setGeneralNotes}
placeholder="Any additional notes about the job..."
placeholderTextColor="#555"
multiline
/>
</View>

<Pressable
style={styles.signatureBtn}
onPress={() => router.push("/plumbing/declaration")}
>
<Text style={styles.signatureBtnText}>
{signatureSvg ? "Edit Signature" : "Add Signature"}
</Text>
</Pressable>

{/* ── AI Analysis ── */}
<Pressable
style={[styles.aiBtn, aiLoading && { opacity: 0.6 }]}
onPress={runAI}
disabled={aiLoading}
>
{aiLoading ? (
<View style={styles.loadingRow}>
<ActivityIndicator />
<Text style={styles.aiBtnText}> Analysing photos…</Text>
</View>
) : (
<Text style={styles.aiBtnText}>Run AI Analysis →</Text>
)}
</Pressable>

{aiResult && (
<View style={styles.aiCard}>
<Text style={styles.aiCardLabel}>AI Analysis</Text>
<Text style={styles.aiScore}>{aiResult.confidence ?? 0}%</Text>
{!!aiResult.action && <Text style={styles.aiAction}>{aiResult.action}</Text>}
{!!aiResult.detected?.length && (
<>
<Text style={styles.aiListTitle}>Verified</Text>
{aiResult.detected.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
</>
)}
{!!aiResult.unclear?.length && (
<>
<Text style={styles.aiListTitleAmber}>Unclear</Text>
{aiResult.unclear.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
</>
)}
{!!aiResult.missing?.length && (
<>
<Text style={styles.aiListTitleRed}>Missing / Failed</Text>
{aiResult.missing.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
</>
)}
</View>
)}

<Pressable
style={[styles.reportBtn, pdfLoading && { opacity: 0.6 }]}
onPress={generateReport}
disabled={pdfLoading}
>
<Text style={styles.reportBtnText}>
{pdfLoading ? "Generating…" : "Generate Documentation Report"}
</Text>
</Pressable>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>
</ScrollView>
<PDFSuccessModal
visible={showSuccess}
jobName={jobName}
onShare={sharePdf}
onDone={() => { setShowSuccess(false); router.push("/plumbing/jobs"); }}
sharing={pdfSharing}
/>
</View>
);
}

const styles = StyleSheet.create({
loadingScreen: { flex: 1, backgroundColor: "#07152b", alignItems: "center", justifyContent: "center", gap: 10 },
loadingText: { color: "rgba(255,255,255,0.7)" },
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
meta: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 13 },
standard: { marginTop: 2, color: "rgba(255,255,255,0.45)", fontSize: 12 },
body: { padding: 18, gap: 12, paddingBottom: 40 },
disclaimer: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(249,199,63,0.35)",
backgroundColor: "rgba(249,199,63,0.10)",
padding: 14,
},
disclaimerText: {
color: "rgba(249,199,63,0.9)",
fontSize: 13,
fontWeight: "700",
lineHeight: 20,
},
section: {
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 16,
gap: 10,
},
sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
fieldLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
input: {
backgroundColor: "rgba(255,255,255,0.06)",
borderRadius: 10,
padding: 12,
color: "white",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
fontSize: 14,
},
bigInput: {
minHeight: 90,
textAlignVertical: "top",
},
sectionCard: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
backgroundColor: "rgba(255,255,255,0.03)",
padding: 14,
gap: 10,
},
sectionCardTitle: { color: "white", fontWeight: "800", fontSize: 14 },
addPhotoBtn: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
addPhotoBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 13 },
photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
photoWrap: { position: "relative" },
shieldBadge: { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(34,197,94,0.85)", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
shieldBadgeText: { fontSize: 11 },
photo: { width: 80, height: 80, borderRadius: 8 },
removePhotoBtn: {
position: "absolute",
top: 4, right: 4,
width: 20, height: 20,
borderRadius: 10,
backgroundColor: "rgba(0,0,0,0.6)",
alignItems: "center",
justifyContent: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.2)",
},
removePhotoText: { color: "white", fontSize: 14, fontWeight: "900", marginTop: -1 },
notesInput: {
backgroundColor: "rgba(255,255,255,0.04)",
borderRadius: 8,
padding: 10,
color: "white",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
fontSize: 13,
minHeight: 38,
textAlignVertical: "top",
},
signatureBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
signatureBtnText: { color: "white", fontWeight: "900", fontSize: 16 },
aiBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(249,115,22,0.15)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
},
aiBtnText: { color: "white", fontWeight: "900" },
loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
aiCard: {
borderRadius: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 16,
gap: 6,
},
aiCardLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
aiScore: { color: "white", fontSize: 34, fontWeight: "900" },
aiAction: { color: "#f97316", fontSize: 13, fontWeight: "700", marginTop: 4 },
aiListTitle: { color: "#22c55e", fontWeight: "900", fontSize: 13, marginTop: 8 },
aiListTitleAmber: { color: "#f97316", fontWeight: "900", fontSize: 13, marginTop: 8 },
aiListTitleRed: { color: "#ef4444", fontWeight: "900", fontSize: 13, marginTop: 8 },
aiItem: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
reportBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(34,197,94,0.18)",
borderWidth: 1,
borderColor: "rgba(34,197,94,0.40)",
},
reportBtnText: { color: "white", fontWeight: "900", fontSize: 16 },
back: { marginTop: 6, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
});
