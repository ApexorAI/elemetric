import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
ScrollView,
ActivityIndicator,
Alert,
TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import { sendLocalNotification } from "@/lib/notifications";
import * as Haptics from "expo-haptics";
import QRCode from "qrcode";

type AIResult = {
relevant?: boolean;
confidence?: number;
detected?: string[];
unclear?: string[];
missing?: string[];
action?: string;
analysis?: string;
};

type CurrentJob = {
type: string;
jobName: string;
jobAddr: string;
};

type ReviewPhoto = {
label: string;
uri: string;
base64: string;
mime: string;
};

const REVIEW_PHOTOS_FILE = `${FileSystem.documentDirectory}review-photos.json`;
const CHECKLIST_KEY = "elemetric_current_checklist";
const SIGNATURE_KEY = "elemetric_signature_svg";
const INSTALLER_NAME_KEY = "elemetric_installer_name";

export default function AIReview() {
const router = useRouter();
const params = useLocalSearchParams();

const decoded: AIResult | null = useMemo(() => {
try {
if (!params.result || typeof params.result !== "string") return null;
return JSON.parse(params.result);
} catch {
try {
if (!params.result || typeof params.result !== "string") return null;
return JSON.parse(decodeURIComponent(params.result));
} catch {
return null;
}
}
}, [params.result]);

const [jobLoaded, setJobLoaded] = useState(false);
const [currentJob, setCurrentJob] = useState<CurrentJob>({
type: "hotwater",
jobName: "Untitled Job",
jobAddr: "No address",
});

const [reviewPhotos, setReviewPhotos] = useState<ReviewPhoto[]>([]);
const [expanded, setExpanded] = useState(false);
const [saving, setSaving] = useState(false);
const [generatingPdf, setGeneratingPdf] = useState(false);
const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
const [signatureSvg, setSignatureSvg] = useState<string>("");
const [installerName, setInstallerName] = useState("");
const [profile, setProfile] = useState<{ licenceNumber: string; companyName: string }>({
licenceNumber: "",
companyName: "",
});
const [toast, setToast] = useState<string | null>(null);

useEffect(() => {
if (!toast) return;
const t = setTimeout(() => setToast(null), 3500);
return () => clearTimeout(t);
}, [toast]);

useFocusEffect(
useCallback(() => {
let active = true;

const loadData = async () => {
try {
const raw = await AsyncStorage.getItem("elemetric_current_job");
if (raw && active) {
const parsed = JSON.parse(raw);
setCurrentJob({
type: parsed.type || "hotwater",
jobName: parsed.jobName || "Untitled Job",
jobAddr: parsed.jobAddr || "No address",
});
}

const info = await FileSystem.getInfoAsync(REVIEW_PHOTOS_FILE);
if (info.exists && active) {
const rawPhotos = await FileSystem.readAsStringAsync(REVIEW_PHOTOS_FILE, {
encoding: FileSystem.EncodingType.UTF8,
});
const parsedPhotos = JSON.parse(rawPhotos);
setReviewPhotos(Array.isArray(parsedPhotos) ? parsedPhotos : []);
}

const rawChecklist = await AsyncStorage.getItem(CHECKLIST_KEY);
if (rawChecklist && active) {
const parsedChecklist = JSON.parse(rawChecklist);
setChecklistChecked(parsedChecklist?.checked || {});
}

const savedSignature = await AsyncStorage.getItem(SIGNATURE_KEY);
if (savedSignature && active) setSignatureSvg(savedSignature);

const savedInstallerName = await AsyncStorage.getItem(INSTALLER_NAME_KEY);
const finalInstallerName = savedInstallerName || "";
if (active) setInstallerName(finalInstallerName);

// Load profile for PDF data
try {
const { data: { user } } = await supabase.auth.getUser();
if (user && active) {
const { data: profileData } = await supabase
.from("profiles")
.select("full_name, licence_number, company_name")
.eq("user_id", user.id)
.single();
if (profileData && active) {
setProfile({
licenceNumber: profileData.licence_number || "",
companyName: profileData.company_name || "",
});
if (!finalInstallerName && profileData.full_name && active) {
setInstallerName(profileData.full_name);
}
}
}
} catch {
// profile load failed — continue
}
} catch {
// keep defaults
}

if (active) setJobLoaded(true);
};

loadData();

return () => {
active = false;
};
}, [])
);

const confidence = decoded?.confidence ?? 0;
const relevant = decoded?.relevant ?? false;
const detected = decoded?.detected ?? [];
const unclear = decoded?.unclear ?? [];
const missing = decoded?.missing ?? [];
const action = decoded?.action ?? "";
const showLegacyAnalysis = !!decoded?.analysis;

const checklistItems = [
{ id: "before", label: "Existing system (before)" },
{ id: "ptr", label: "PTR valve installed" },
{ id: "tempering", label: "Tempering valve" },
{ id: "plate", label: "Compliance plate / label" },
{ id: "isolation", label: "Isolation valve" },
];

const persistInstallerName = async (value: string) => {
setInstallerName(value);
try {
await AsyncStorage.setItem(INSTALLER_NAME_KEY, value);
} catch {
// ignore
}
};

const saveJob = async () => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
try {
setSaving(true);

const newJob = {
id: Date.now().toString(),
jobType: currentJob.type,
jobName: currentJob.jobName,
jobAddr: currentJob.jobAddr,
installerName,
confidence,
relevant,
detected,
unclear,
missing,
action,
createdAt: new Date().toISOString(),
};

// Save to AsyncStorage as offline fallback
const existing = await AsyncStorage.getItem("elemetric_jobs");
const jobs = existing ? JSON.parse(existing) : [];
jobs.unshift(newJob);
await AsyncStorage.setItem("elemetric_jobs", JSON.stringify(jobs));

// Save to Supabase (best-effort — local save already succeeded)
let cloudSaveFailed = false;
try {
const { data: { user } } = await supabase.auth.getUser();
if (user) {
await supabase.from("jobs").insert({
user_id: user.id,
job_type: newJob.jobType,
job_name: newJob.jobName,
job_addr: newJob.jobAddr,
installer_name: newJob.installerName,
confidence: newJob.confidence,
relevant: newJob.relevant,
detected: newJob.detected,
unclear: newJob.unclear,
missing: newJob.missing,
action: newJob.action,
created_at: newJob.createdAt,
});
}
} catch {
cloudSaveFailed = true;
}

if (cloudSaveFailed) {
setToast("No internet connection. Job saved locally and will sync when reconnected.");
sendLocalNotification("Job Saved", "Saved locally — will sync when back online.");
} else {
setToast("Job saved successfully.");
sendLocalNotification("Job Saved", "Your compliance report has been saved.");
}
} catch (e: any) {
Alert.alert("Save Error", e?.message ?? "Could not save job.");
} finally {
setSaving(false);
}
};

const clearSignature = async () => {
await AsyncStorage.removeItem(SIGNATURE_KEY);
setSignatureSvg("");
Alert.alert("Removed", "Saved signature removed.");
};

const listToHtml = (items: string[]) => {
if (!items.length) return `<p style="margin: 0; color: #6b7280;">None</p>`;
return `<ul style="margin-top: 8px; margin-bottom: 0;">${items
.map((item) => `<li style="margin-bottom: 6px;">${item}</li>`)
.join("")}</ul>`;
};

const checklistToHtml = () => {
return `
<table style="width:100%; border-collapse: collapse; margin-top: 8px;">
<tr>
<th style="text-align:left; border:1px solid #d1d5db; padding:8px; background:#f3f4f6;">Checklist Item</th>
<th style="text-align:left; border:1px solid #d1d5db; padding:8px; background:#f3f4f6;">Status</th>
</tr>
${checklistItems
.map(
(item) => `
<tr>
<td style="border:1px solid #d1d5db; padding:8px;">${item.label}</td>
<td style="border:1px solid #d1d5db; padding:8px;">${
detected.includes(item.label)
? "Complete"
: missing.includes(item.label)
? "Incomplete \u2014 Retake Required"
: unclear.includes(item.label)
? "Unclear \u2014 Review Needed"
: "Not assessed"
}</td>
</tr>
`
)
.join("")}
</table>
`;
};

const generateReport = async () => {
if (!decoded) {
Alert.alert("No AI result", "There is no AI result to turn into a report.");
return;
}

Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
try {
setGeneratingPdf(true);

await AsyncStorage.setItem(INSTALLER_NAME_KEY, installerName);

const safePhotos = reviewPhotos.filter(
(photo) =>
photo &&
typeof photo.base64 === "string" &&
photo.base64.length > 50 &&
typeof photo.mime === "string" &&
photo.mime.startsWith("image/")
);

const photoHtml = safePhotos.length
? `
<div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:12px;">
${safePhotos
.map(
(photo) => `
<div style="width:48%; box-sizing:border-box; margin-bottom:12px; page-break-inside: avoid;">
<div style="font-weight:bold; font-size:12px; margin-bottom:6px; color:#111827;">
${photo.label}
</div>
<img
src="data:${photo.mime};base64,${photo.base64}"
style="width:100%; height:160px; object-fit:cover; border:1px solid #d1d5db; border-radius:6px;"
/>
</div>
`
)
.join("")}
</div>
`
: `<div style="color:#6b7280;">No photos available for report.</div>`;

const signatureHtml = signatureSvg
? `
<img
src="data:image/svg+xml;utf8,${encodeURIComponent(signatureSvg)}"
style="width:220px; height:70px; object-fit:contain; display:block;"
/>
`
: `<div style="width:220px; height:50px; border-bottom:1px solid #111827;"></div>`;

const reportDate = new Date().toLocaleString();
const reportDateShort = new Date().toLocaleDateString();
const statusText = relevant ? "Relevant plumbing photo set" : "Not a plumbing photo set";

// QR code — encodes report identity for verification
let qrHtml = "";
try {
const qrData = `ELM|${currentJob.type}|${currentJob.jobName}|${currentJob.jobAddr}|${reportDateShort}`;
const qrSvg = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
qrHtml = `<div style="text-align:center;">
<img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
<div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
</div>`;
} catch {
// QR generation failed — PDF still generates without it
}

const html = `
<html><head><style>@page{margin:15mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}@bottom-left{content:"ELEMETRIC \00B7 Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}}body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}</style></head>
<body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;">Hot Water System Compliance Report · AS/NZS 3500</div>
<div style="font-size:12px;">${reportDateShort}</div>
</div>

<div style="padding: 22px;">
<div style="margin-bottom: 18px;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">Job Summary</div>
<table style="width:100%; border-collapse: collapse;">
<tr>
<td style="padding: 6px 0; width: 150px;"><strong>Job Name</strong></td>
<td style="padding: 6px 0;">${currentJob.jobName}</td>
</tr>
<tr>
<td style="padding: 6px 0;"><strong>Address</strong></td>
<td style="padding: 6px 0;">${currentJob.jobAddr}</td>
</tr>
<tr>
<td style="padding: 6px 0;"><strong>Job Type</strong></td>
<td style="padding: 6px 0;">${currentJob.type}</td>
</tr>
<tr>
<td style="padding: 6px 0;"><strong>Installer</strong></td>
<td style="padding: 6px 0;">${installerName || "Not entered"}</td>
</tr>
<tr>
<td style="padding: 6px 0;"><strong>Licence No.</strong></td>
<td style="padding: 6px 0;">${profile.licenceNumber || "Not entered"}</td>
</tr>
<tr>
<td style="padding: 6px 0;"><strong>Company</strong></td>
<td style="padding: 6px 0;">${profile.companyName || "Not entered"}</td>
</tr>
<tr>
<td style="padding: 6px 0;"><strong>Report Date</strong></td>
<td style="padding: 6px 0;">${reportDate}</td>
</tr>
</table>
</div>

<div style="margin-bottom: 18px; border: 1px solid #e5e7eb; padding: 16px; background: #f9fafb;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">AI Review Summary</div>
<div style="font-size: 34px; font-weight: bold; color: #111827;">${confidence}%</div>
<div style="margin-top: 8px;"><strong>Status:</strong> ${statusText}</div>
<div style="margin-top: 8px;"><strong>Recommended Action:</strong> ${
action || "No action provided."
}</div>
</div>

<div style="margin-bottom: 18px;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">Checklist Status</div>
${checklistToHtml()}
</div>

<div style="margin-bottom: 18px;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">Visible Items</div>
${listToHtml(detected)}
</div>

<div style="margin-bottom: 18px;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">Unclear Items</div>
${listToHtml(unclear)}
</div>

<div style="margin-bottom: 18px;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">Missing Items</div>
${listToHtml(missing)}
</div>

${
decoded.analysis
? `
<div style="margin-bottom: 18px;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">AI Notes</div>
<div style="line-height: 1.45;">${decoded.analysis}</div>
</div>
`
: ""
}

<div style="margin-bottom: 18px; page-break-inside: avoid;">
<div style="font-size: 19px; font-weight: bold; margin-bottom: 10px;">Attached Photos</div>
${photoHtml}
</div>

<div style="margin-top: 18px; border-top: 1px solid #d1d5db; padding-top: 18px; page-break-inside: avoid;">
<div style="font-size: 18px; font-weight: bold; margin-bottom: 14px;">Installer Sign-Off</div>

<div style="margin-bottom: 14px;">
<strong>Installer Name:</strong> ${installerName || "Not entered"}
</div>

<div style="margin-bottom: 8px;">
<strong>Signature:</strong>
</div>

<div style="margin-bottom: 14px;">
${signatureHtml}
</div>

<div>
<strong>Date:</strong> ${reportDateShort}
</div>
</div>

<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;"><strong style="color:#374151;">Compliance Disclaimer:</strong> This report is generated from the photos provided and an AI-assisted review. It is a documentation aid only. Final compliance responsibility remains with the installer and relevant licensed professional.</div>
</div>
</body>
</html>
`;

const { uri } = await Print.printToFileAsync({ html });
try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}

const canShare = await Sharing.isAvailableAsync();
if (!canShare) {
Alert.alert("PDF Created", `Report saved to: ${uri}`);
return;
}

await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: "Share Compliance Report",
UTI: "com.adobe.pdf",
});
} catch (e: any) {
Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
} finally {
setGeneratingPdf(false);
}
};

if (!jobLoaded) {
return (
<View style={styles.loadingScreen}>
<ActivityIndicator />
<Text style={styles.loadingText}>Loading job…</Text>
</View>
);
}

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>AI Overview</Text>

<View style={styles.metaCard}>
<Text style={styles.metaLine}>Job type: {currentJob.type}</Text>
<Text style={styles.metaLine}>Job: {currentJob.jobName}</Text>
<Text style={styles.metaLine}>Address: {currentJob.jobAddr}</Text>
</View>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
{!decoded ? (
<View style={styles.card}>
<Text style={styles.dim}>No AI result found.</Text>
</View>
) : (
<>
<View style={styles.card}>
<Text style={styles.h}>Documentation Confidence</Text>
<Text style={[styles.score, !relevant && styles.scoreLow]}>{confidence}%</Text>

<View style={[styles.badge, relevant ? styles.badgeOk : styles.badgeNo]}>
<Text style={styles.badgeText}>
{relevant ? "RELEVANT PHOTO" : "NOT A PLUMBING PHOTO"}
</Text>
</View>

<Text style={styles.section}>🟢 Visible</Text>
{detected.length === 0 ? (
<Text style={styles.itemDim}>• None</Text>
) : (
detected.map((x, i) => (
<Text key={`d-${i}`} style={styles.item}>
• {x}
</Text>
))
)}

<Text style={styles.section}>🟡 Unclear</Text>
{unclear.length === 0 ? (
<Text style={styles.itemDim}>• None</Text>
) : (
unclear.map((x, i) => (
<Text key={`u-${i}`} style={styles.item}>
• {x}
</Text>
))
)}

<Text style={styles.section}>🔴 Missing</Text>
{missing.length === 0 ? (
<Text style={styles.itemDim}>• None</Text>
) : (
missing.map((x, i) => (
<Text key={`m-${i}`} style={styles.item}>
• {x}
</Text>
))
)}

{!!action && <Text style={styles.action}>Suggested action: {action}</Text>}

{showLegacyAnalysis && (
<>
<Text style={styles.section}>📝 Analysis</Text>
<Text style={styles.item}>{decoded.analysis}</Text>
</>
)}
</View>

<View style={styles.card}>
<Text style={styles.fieldLabel}>Installer Name</Text>
<TextInput
value={installerName}
onChangeText={persistInstallerName}
placeholder="e.g. John Smith"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
/>
</View>

<Pressable style={styles.saveBtn} onPress={saveJob} disabled={saving}>
<Text style={styles.saveText}>{saving ? "Saving..." : "Save Job"}</Text>
</Pressable>

<Pressable style={styles.signatureBtn} onPress={() => router.push("/plumbing/declaration")}>
<Text style={styles.signatureText}>
{signatureSvg ? "Edit Signature" : "Add Signature"}
</Text>
</Pressable>

{signatureSvg ? (
<Pressable style={styles.clearBtn} onPress={clearSignature}>
<Text style={styles.clearText}>Remove Saved Signature</Text>
</Pressable>
) : null}

<Pressable
style={styles.reportBtn}
onPress={generateReport}
disabled={generatingPdf}
>
<Text style={styles.reportText}>
{generatingPdf ? "Generating Report..." : "Generate Compliance Report"}
</Text>
</Pressable>

<Pressable style={styles.jobsBtn} onPress={() => router.push("/plumbing/jobs")}>
<Text style={styles.jobsText}>View Saved Jobs</Text>
</Pressable>

<Pressable onPress={() => setExpanded((v) => !v)} style={styles.secondary}>
<Text style={styles.secondaryText}>
{expanded ? "Hide raw output" : "Show raw output"}
</Text>
</Pressable>

{expanded && (
<View style={styles.raw}>
<Text style={styles.rawText}>{JSON.stringify(decoded, null, 2)}</Text>
</View>
)}
</>
)}

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
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
flex: 1,
backgroundColor: "#07152b",
alignItems: "center",
justifyContent: "center",
gap: 10,
},
loadingText: { color: "rgba(255,255,255,0.7)" },
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
metaCard: {
marginTop: 12,
borderRadius: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 12,
gap: 4,
},
metaLine: { color: "rgba(255,255,255,0.82)", fontSize: 13 },
body: { padding: 18, gap: 12 },
card: {
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 18,
gap: 8,
},
h: { color: "rgba(255,255,255,0.75)", fontWeight: "800", fontSize: 14 },
score: { color: "#22c55e", fontSize: 48, fontWeight: "900" },
scoreLow: { color: "rgba(255,255,255,0.55)" },
badge: {
alignSelf: "flex-start",
marginTop: 4,
paddingVertical: 7,
paddingHorizontal: 12,
borderRadius: 999,
borderWidth: 1,
},
badgeOk: {
backgroundColor: "rgba(34,197,94,0.18)",
borderColor: "rgba(34,197,94,0.40)",
},
badgeNo: {
backgroundColor: "rgba(255,255,255,0.08)",
borderColor: "rgba(255,255,255,0.14)",
},
badgeText: { color: "white", fontWeight: "900", fontSize: 12 },
section: { marginTop: 12, color: "white", fontWeight: "900", fontSize: 16 },
item: { color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 22 },
itemDim: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
action: { marginTop: 14, color: "#f97316", fontWeight: "900", fontSize: 16 },
fieldLabel: {
color: "white",
fontWeight: "800",
fontSize: 15,
marginBottom: 8,
},
input: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.06)",
color: "white",
paddingHorizontal: 14,
paddingVertical: 12,
fontSize: 16,
},
saveBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "#f97316",
},
saveText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
signatureBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
signatureText: { color: "white", fontWeight: "900", fontSize: 16 },
clearBtn: {
borderRadius: 14,
paddingVertical: 12,
alignItems: "center",
backgroundColor: "rgba(239,68,68,0.14)",
borderWidth: 1,
borderColor: "rgba(239,68,68,0.28)",
},
clearText: { color: "white", fontWeight: "900", fontSize: 15 },
reportBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(34,197,94,0.18)",
borderWidth: 1,
borderColor: "rgba(34,197,94,0.40)",
},
reportText: { color: "white", fontWeight: "900", fontSize: 16 },
jobsBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(249,115,22,0.18)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
},
jobsText: { color: "white", fontWeight: "900", fontSize: 16 },
secondary: {
borderRadius: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
backgroundColor: "rgba(255,255,255,0.06)",
paddingVertical: 12,
alignItems: "center",
},
secondaryText: { color: "white", fontWeight: "900" },
raw: {
borderRadius: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(0,0,0,0.35)",
padding: 12,
},
rawText: {
color: "rgba(255,255,255,0.75)",
fontFamily: "monospace",
fontSize: 12,
},
back: { marginTop: 6, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
dim: { color: "rgba(255,255,255,0.6)", marginTop: 10, textAlign: "center" },
toast: {
position: "absolute",
bottom: 40,
left: 20,
right: 20,
backgroundColor: "#22c55e",
borderRadius: 12,
padding: 14,
alignItems: "center",
},
toastText: { color: "white", fontWeight: "900", fontSize: 15 },
});