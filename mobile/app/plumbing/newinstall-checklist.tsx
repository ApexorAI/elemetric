import React, { useState, useCallback } from "react";
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const SIGNATURE_KEY = "elemetric_signature_svg";

const CHECKS = [
{ id: "copper",       label: "Copper pipe joints brazed correctly" },
{ id: "isolation",    label: "Isolation valves installed at fixtures" },
{ id: "plv",          label: "Pressure limiting valve installed" },
{ id: "tempering",    label: "Tempering valve installed to AS 3500" },
{ id: "hws",          label: "Hot water system compliant with AS 3500" },
{ id: "hammer",       label: "Water hammer arrestors installed" },
{ id: "supports",     label: "Pipe supports at correct intervals" },
{ id: "penetrations", label: "All penetrations sealed" },
{ id: "pressure",     label: "System pressure tested" },
{ id: "leaks",        label: "No visible leaks on completion" },
] as const;

type CheckStatus = "pass" | "fail" | "na" | null;
type CheckEntry = { status: CheckStatus; notes: string; photoUris: string[] };
type AIResult = {
relevant?: boolean;
confidence?: number;
detected?: string[];
unclear?: string[];
missing?: string[];
action?: string;
analysis?: string;
};

const statusLabel = (s: CheckStatus) => {
if (s === "pass") return "Y";
if (s === "fail") return "N";
if (s === "na") return "N/A";
return "—";
};

const statusColor = (s: CheckStatus) => {
if (s === "pass") return "#16a34a";
if (s === "fail") return "#dc2626";
if (s === "na") return "#6b7280";
return "#374151";
};

function StatusButtons({
id,
status,
onSet,
}: {
id: string;
status: CheckStatus;
onSet: (id: string, s: CheckStatus) => void;
}) {
return (
<View style={styles.statusRow}>
{(["pass", "fail", "na"] as CheckStatus[]).map((s) => (
<Pressable
key={s}
style={[
styles.statusBtn,
status === s && (
s === "pass" ? styles.sBtnPass :
s === "fail" ? styles.sBtnFail :
styles.sBtnNA
),
]}
onPress={() => onSet(id, s)}
>
<Text style={[styles.statusBtnText, status === s && styles.statusBtnActive]}>
{s === "pass" ? "Pass" : s === "fail" ? "Fail" : "N/A"}
</Text>
</Pressable>
))}
</View>
);
}

export default function NewInstallChecklist() {
const router = useRouter();
const [loaded, setLoaded] = useState(false);
const [jobName, setJobName] = useState("Untitled Job");
const [jobAddr, setJobAddr] = useState("No address");
const [plumberName, setPlumberName] = useState("");
const [signatureSvg, setSignatureSvg] = useState("");
const [checks, setChecks] = useState<Record<string, CheckEntry>>(() =>
Object.fromEntries(CHECKS.map((c) => [c.id, { status: null, notes: "", photoUris: [] }]))
);
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult] = useState<AIResult | null>(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [licenceNumber, setLicenceNumber] = useState("");
const [companyName, setCompanyName] = useState("");

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
}
const sig = await AsyncStorage.getItem(SIGNATURE_KEY);
if (sig && active) setSignatureSvg(sig);
} catch {}
// Pre-fill plumber name from profile
try {
const { data: { user } } = await supabase.auth.getUser();
if (user && active) {
const { data } = await supabase
.from("profiles")
.select("full_name, licence_number, company_name")
.eq("user_id", user.id)
.single();
if (data?.full_name && active) setPlumberName(data.full_name);
if (data?.licence_number && active) setLicenceNumber(data.licence_number);
if (data?.company_name && active) setCompanyName(data.company_name);
}
} catch {}
if (active) setLoaded(true);
})();
return () => { active = false; };
}, [])
);

const setStatus = (id: string, s: CheckStatus) => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
setChecks((prev) => ({ ...prev, [id]: { ...prev[id], status: s } }));
};

const setNotes = (id: string, notes: string) =>
setChecks((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));

const addPhoto = async (id: string) => {
try {
const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access."); return; }
const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
if (result.canceled) return;
const uri = result.assets?.[0]?.uri;
if (!uri) return;
setChecks((prev) => ({ ...prev, [id]: { ...prev[id], photoUris: [...prev[id].photoUris, uri] } }));
} catch (e: any) {
Alert.alert("Photo error", e?.message ?? "Unknown error");
}
};

const removePhoto = (id: string, uri: string) =>
setChecks((prev) => ({ ...prev, [id]: { ...prev[id], photoUris: prev[id].photoUris.filter((u) => u !== uri) } }));

const runAI = async () => {
const photos: { label: string; uri: string }[] = [];
for (const c of CHECKS) {
for (const uri of checks[c.id]?.photoUris ?? []) {
photos.push({ label: c.label, uri });
}
}
if (!photos.length) { Alert.alert("No photos", "Add at least one photo to run AI analysis."); return; }
setAiLoading(true);
try {
const images: { mime: string; data: string; label: string }[] = [];
for (const p of photos) {
const r = await ImageManipulator.manipulateAsync(p.uri, [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
if (r.base64) images.push({ mime: "image/jpeg", data: r.base64, label: p.label });
}
const res = await fetch(`${API_BASE}/review`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "newinstall", images }),
});
const json = await res.json();
if (!res.ok) throw new Error(json?.error ?? "AI request failed");
setAiResult(json);
} catch (e: any) {
Alert.alert("AI Error", e?.message ?? "Unknown error");
} finally {
setAiLoading(false);
}
};

const generateReport = async () => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
setPdfLoading(true);
try {
const now = new Date();
const dateStr = now.toLocaleString();
const dateShort = now.toLocaleDateString();
const td = "border:1px solid #d1d5db;padding:8px;";
const th = `${td}background:#f3f4f6;text-align:left;`;

// QR code — encodes report identity for verification
let qrHtml = "";
try {
const qrData = `ELM|newinstall|${jobName}|${jobAddr}|${dateShort}`;
const qrSvg = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
qrHtml = `<div style="text-align:center;">
<img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
<div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
</div>`;
} catch {}

const checkRows = CHECKS.map((c) => {
const e = checks[c.id];
const lbl = statusLabel(e?.status ?? null);
const col = statusColor(e?.status ?? null);
return `<tr>
<td style="${td}">${c.label}</td>
<td style="${td}font-weight:bold;color:${col};">${lbl}</td>
<td style="${td}">${e?.notes || ""}</td>
</tr>`;
}).join("");

const aiSection = aiResult ? `
<div style="margin-bottom:16px;border:1px solid #e5e7eb;padding:16px;background:#f9fafb;">
<div style="font-size:17px;font-weight:bold;margin-bottom:8px;">AI Analysis</div>
<div style="font-size:30px;font-weight:bold;">${aiResult.confidence ?? 0}%</div>
<div style="margin-top:6px;"><strong>Action:</strong> ${aiResult.action || "—"}</div>
<div style="margin-top:4px;">${aiResult.analysis || ""}</div>
</div>` : "";

const sigHtml = signatureSvg
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(signatureSvg)}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
: `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

const html = `<html><head><style>@page{margin:15mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}@bottom-left{content:"ELEMETRIC · Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}}body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}</style></head>
<body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;">New Installation Compliance Report · AS/NZS 3500</div>
<div style="font-size:12px;">${dateShort}</div>
</div>
<div style="padding:22px;">
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:160px;"><strong>Job Name</strong></td><td>${jobName}</td></tr>
<tr><td style="padding:5px 0;"><strong>Address</strong></td><td>${jobAddr}</td></tr>
<tr><td style="padding:5px 0;"><strong>Plumber</strong></td><td>${plumberName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Licence Number</strong></td><td>${licenceNumber || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Company</strong></td><td>${companyName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Report Date</strong></td><td>${dateStr}</td></tr>
</table>
</div>
${aiSection}
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Installation Checks</div>
<table style="width:100%;border-collapse:collapse;">
<tr>
<th style="${th}width:60%;">Check Item</th>
<th style="${th}width:8%;">Result</th>
<th style="${th}">Notes</th>
</tr>
${checkRows}
</table>
</div>
<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;">
<div style="font-size:18px;font-weight:bold;margin-bottom:12px;">Sign-Off</div>
<div style="margin-bottom:8px;"><strong>Plumber:</strong> ${plumberName || "Not entered"}</div>
${sigHtml}
<div style="margin-top:6px;font-size:13px;"><strong>Date:</strong> ${dateShort}</div>
</div>
<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;"><strong style="color:#374151;">Compliance Disclaimer:</strong> This report is a documentation aid only. Final compliance responsibility rests with the licensed plumber. Elemetric AI analysis does not replace statutory obligations under AS/NZS 3500.</div>
</div>
</body>
</html>`;

const { uri } = await Print.printToFileAsync({ html });
try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Installation Report", UTI: "com.adobe.pdf" });
} else {
Alert.alert("PDF Created", `Saved to: ${uri}`);
}
} catch (e: any) {
Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
} finally {
setPdfLoading(false);
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

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>New Installation Checklist</Text>
<Text style={styles.meta}>{jobName} • {jobAddr}</Text>
<Text style={styles.standard}>AS/NZS 3500</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

<View style={styles.section}>
<Text style={styles.sectionTitle}>Plumber Details</Text>
<Text style={styles.fieldLabel}>Plumber Name</Text>
<TextInput
style={styles.input}
value={plumberName}
onChangeText={setPlumberName}
placeholderTextColor="#555"
/>
</View>

{CHECKS.map((check) => {
const entry = checks[check.id];
return (
<View key={check.id} style={styles.checkCard}>
<Text style={styles.checkLabel}>{check.label}</Text>
<StatusButtons id={check.id} status={entry.status} onSet={setStatus} />
<TextInput
style={styles.notesInput}
value={entry.notes}
onChangeText={(t) => setNotes(check.id, t)}
placeholder="Notes"
placeholderTextColor="#555"
multiline
/>
<Pressable style={styles.addPhotoBtn} onPress={() => addPhoto(check.id)}>
<Text style={styles.addPhotoBtnText}>+ Add Photo</Text>
</Pressable>
{entry.photoUris.length > 0 && (
<View style={styles.photoGrid}>
{entry.photoUris.map((uri, i) => (
<View key={`${check.id}-${i}`} style={styles.photoWrap}>
<Image source={{ uri }} style={styles.photo} />
<Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(check.id, uri)}>
<Text style={styles.removePhotoText}>×</Text>
</Pressable>
</View>
))}
</View>
)}
</View>
);
})}

<Pressable
style={[styles.aiBtn, aiLoading && { opacity: 0.6 }]}
onPress={runAI}
disabled={aiLoading}
>
{aiLoading ? (
<View style={styles.loadingRow}>
<ActivityIndicator />
<Text style={styles.aiBtnText}> Analysing photos against Victorian compliance standards...</Text>
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
<Text style={styles.aiListGreen}>Verified</Text>
{aiResult.detected.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
</>
)}
{!!aiResult.missing?.length && (
<>
<Text style={styles.aiListRed}>Missing / Failed</Text>
{aiResult.missing.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
</>
)}
</View>
)}

<Pressable
style={styles.signatureBtn}
onPress={() => router.push("/plumbing/declaration")}
>
<Text style={styles.signatureBtnText}>
{signatureSvg ? "Edit Signature" : "Add Signature"}
</Text>
</Pressable>

<Pressable
style={[styles.reportBtn, pdfLoading && { opacity: 0.6 }]}
onPress={generateReport}
disabled={pdfLoading}
>
<Text style={styles.reportBtnText}>
{pdfLoading ? "Generating…" : "Generate Compliance Report"}
</Text>
</Pressable>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>

</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
loadingScreen: { flex: 1, backgroundColor: "#07152b", alignItems: "center", justifyContent: "center", gap: 10 },
loadingText: { color: "rgba(255,255,255,0.7)" },
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
meta: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 13 },
standard: { marginTop: 2, color: "rgba(255,255,255,0.45)", fontSize: 12 },
body: { padding: 18, gap: 12, paddingBottom: 40 },
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
checkCard: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
backgroundColor: "rgba(255,255,255,0.03)",
padding: 14,
gap: 10,
},
checkLabel: { color: "white", fontWeight: "800", fontSize: 14, lineHeight: 20 },
statusRow: { flexDirection: "row", gap: 8 },
statusBtn: {
flex: 1,
paddingVertical: 8,
borderRadius: 8,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
sBtnPass: { backgroundColor: "rgba(22,163,74,0.25)", borderColor: "rgba(22,163,74,0.5)" },
sBtnFail: { backgroundColor: "rgba(220,38,38,0.25)", borderColor: "rgba(220,38,38,0.5)" },
sBtnNA: { backgroundColor: "rgba(107,114,128,0.25)", borderColor: "rgba(107,114,128,0.5)" },
statusBtnText: { color: "rgba(255,255,255,0.5)", fontWeight: "800", fontSize: 13 },
statusBtnActive: { color: "white" },
notesInput: {
backgroundColor: "rgba(255,255,255,0.04)",
borderRadius: 8,
padding: 10,
color: "white",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
fontSize: 13,
minHeight: 38,
},
addPhotoBtn: { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
addPhotoBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 13 },
photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
photoWrap: { position: "relative" },
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
aiBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(249,115,22,0.20)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
},
aiBtnText: { color: "white", fontWeight: "900", fontSize: 15 },
loadingRow: { flexDirection: "row", alignItems: "center" },
aiCard: {
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 16,
gap: 8,
},
aiCardLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 13 },
aiScore: { color: "#22c55e", fontSize: 44, fontWeight: "900" },
aiAction: { color: "#f97316", fontWeight: "900", fontSize: 15 },
aiListGreen: { color: "#22c55e", fontWeight: "900", fontSize: 14, marginTop: 4 },
aiListRed: { color: "#f87171", fontWeight: "900", fontSize: 14, marginTop: 4 },
aiItem: { color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 20 },
signatureBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
signatureBtnText: { color: "white", fontWeight: "900", fontSize: 16 },
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
