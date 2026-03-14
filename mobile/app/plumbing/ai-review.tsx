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
Modal,
Share,
Linking,
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
hash?: string;
capturedAt?: string;
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
const [showShareModal, setShowShareModal] = useState(false);
const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);
const [generatingCert, setGeneratingCert] = useState(false);

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
<th style="text-align:left; border:1px solid #d1d5db; padding:8px; background:#f3f4f6; font-family:Helvetica,Arial,sans-serif;">Checklist Item</th>
<th style="text-align:left; border:1px solid #d1d5db; padding:8px; background:#f3f4f6; font-family:Helvetica,Arial,sans-serif;">Status</th>
</tr>
${checklistItems
.map((item) => {
const isDetected = detected.includes(item.label);
const isMissing = missing.includes(item.label);
const isUnclear = unclear.includes(item.label);
const bg = isDetected ? "background:#dcfce7;" : isMissing ? "background:#fee2e2;" : isUnclear ? "background:#fef9c3;" : "";
const statusText = isDetected ? "Complete" : isMissing ? "Incomplete — Retake Required" : isUnclear ? "Unclear — Review Needed" : "Not assessed";
return `<tr style="${bg}"><td style="border:1px solid #d1d5db; padding:8px; font-family:Helvetica,Arial,sans-serif;">${item.label}</td><td style="border:1px solid #d1d5db; padding:8px; font-family:Helvetica,Arial,sans-serif;">${statusText}</td></tr>`;
})
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
<html><head><style>@page { margin: 15mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } @bottom-left { content: "ELEMETRIC · Confidential"; font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 80pt; font-family: Helvetica,Arial,sans-serif; font-weight: bold; color: rgba(7,21,43,0.04); white-space: nowrap; pointer-events: none; z-index: -1; letter-spacing: 8px; }
</style></head>
<body>
<div class="watermark">ELEMETRIC</div>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;">Hot Water System Compliance Report · AS/NZS 3500</div>
<div style="font-size:12px;">${reportDateShort}</div>
</div>

<div style="padding: 22px;">

<div style="background:#f8fafc;border-left:4px solid #f97316;padding:16px;margin-bottom:20px;border-radius:0 6px 6px 0;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Executive Summary</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:4px 0;width:180px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Job Type</td><td style="font-family:Helvetica,Arial,sans-serif;">${currentJob.type}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Date</td><td style="font-family:Helvetica,Arial,sans-serif;">${reportDate}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Address</td><td style="font-family:Helvetica,Arial,sans-serif;">${currentJob.jobAddr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Plumber</td><td style="font-family:Helvetica,Arial,sans-serif;">${installerName || "Not entered"}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">AI Confidence</td><td style="font-family:Helvetica,Arial,sans-serif;">${confidence}%</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Overall Status</td><td style="font-family:Helvetica,Arial,sans-serif;font-weight:bold;color:${relevant ? "#16a34a" : "#d97706"};">${relevant ? "RELEVANT PHOTO SET" : "REVIEW REQUIRED"}</td></tr>
  </table>
</div>
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Job Summary</div>
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

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px; border: 1px solid #e5e7eb; padding: 16px; background: #f9fafb;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">AI Review Summary</div>
<div style="font-size: 34px; font-weight: bold; color: #111827;">${confidence}%</div>
<div style="margin-top: 8px;"><strong>Status:</strong> ${statusText}</div>
<div style="margin-top: 8px;"><strong>Recommended Action:</strong> ${
action || "No action provided."
}</div>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Checklist Status</div>
${checklistToHtml()}
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Visible Items</div>
${listToHtml(detected)}
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Unclear Items</div>
${listToHtml(unclear)}
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Missing Items</div>
${listToHtml(missing)}
</div>

${
decoded.analysis
? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">AI Notes</div>
<div style="line-height: 1.45;">${decoded.analysis}</div>
</div>
`
: ""
}

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px; page-break-inside: avoid;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Attached Photos</div>
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

<div style="margin-bottom:18px;page-break-inside:avoid;">
<div style="font-size:19px;font-weight:bold;margin-bottom:6px;">Tamper-Evident Photo Record</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:10px;">Each photo hash can be used to verify this image has not been modified since capture.</div>
<table style="width:100%;border-collapse:collapse;font-size:11px;">
<thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;">Photo Label</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;">Captured At</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;word-break:break-all;">SHA-256 Hash</th></tr></thead>
<tbody>
${reviewPhotos.map((p) => `<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:600;">${p.label}</td><td style="padding:6px 8px;border:1px solid #e5e7eb;white-space:nowrap;">${p.capturedAt ? new Date(p.capturedAt).toLocaleString("en-AU") : "—"}</td><td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace;word-break:break-all;font-size:9px;">${p.hash || "—"}</td></tr>`).join("")}
</tbody>
</table>
</div>

<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;font-family:Helvetica,Arial,sans-serif;"><strong style="color:#374151;">Compliance Disclaimer:</strong> Generated by Elemetric on ${reportDate}. This report is a documentation aid only. Elemetric Pty Ltd accepts no liability for the accuracy of work described herein. Compliance responsibility rests solely with the licensed tradesperson.</div>
</div>
</body>
</html>
`;

const { uri } = await Print.printToFileAsync({ html });
try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}

// Mark any in_progress job at this address as completed
try {
const { data: { user } } = await supabase.auth.getUser();
if (user) {
await supabase
.from("jobs")
.update({ status: "completed" })
.eq("assigned_to", user.id)
.eq("job_addr", currentJob.jobAddr)
.eq("status", "in_progress");
}
} catch {}

setGeneratedPdfUri(uri);
setShowShareModal(true);
} catch (e: any) {
Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
} finally {
setGeneratingPdf(false);
}
};

// ── Certificate of Compliance ──────────────────────────────────────────────

const generateCertificate = async () => {
setGeneratingCert(true);
try {
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
const certDate = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" });
const certNumber = `ELM-${currentJob.jobAddr.replace(/\s+/g, "").slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;

const signatureHtml = signatureSvg
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(signatureSvg)}" style="width:180px;height:55px;object-fit:contain;display:block;"/>`
: `<div style="width:180px;height:40px;border-bottom:2px solid #07152b;"></div>`;

const certHtml = `
<html><head><style>
@page { margin: 20mm; }
body { margin:0; padding:0; font-family: Georgia, serif; color: #07152b; background: #ffffff; }
.outer { border: 6px solid #07152b; border-radius: 4px; padding: 40px; min-height: 90vh; display: flex; flex-direction: column; }
.header { text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 24px; margin-bottom: 28px; }
.brand { font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #07152b; }
.cert-title { font-size: 22px; margin-top: 10px; font-style: italic; color: #374151; }
.cert-number { font-size: 12px; color: #6b7280; margin-top: 6px; letter-spacing: 1px; }
.section { margin-bottom: 20px; }
.label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.value { font-size: 15px; color: #07152b; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
.statement { margin: 28px 0; padding: 20px; border-left: 4px solid #f97316; background: #fffbf5; font-size: 14px; line-height: 1.7; font-style: italic; color: #07152b; }
.sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
.sig-block { flex: 1; }
.sig-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
.footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
.orange { color: #f97316; }
</style></head>
<body>
<div class="outer">
  <div class="header">
    <div class="brand">ELEMETRIC</div>
    <div class="cert-title">Certificate of Compliance</div>
    <div class="cert-number">Certificate No: ${certNumber}</div>
  </div>

  <div class="section">
    <div class="label">Property Address</div>
    <div class="value">${currentJob.jobAddr}</div>
  </div>

  <div class="section">
    <div class="label">Work Description</div>
    <div class="value">${currentJob.jobName} — ${currentJob.type}</div>
  </div>

  <div class="section">
    <div class="label">Licensed Tradesperson</div>
    <div class="value">${installerName || "Not specified"}</div>
  </div>

  <div class="section">
    <div class="label">Licence Number</div>
    <div class="value">${profile.licenceNumber || "Not specified"}</div>
  </div>

  ${profile.companyName ? `<div class="section"><div class="label">Company</div><div class="value">${profile.companyName}</div></div>` : ""}

  <div class="section">
    <div class="label">Date of Completion</div>
    <div class="value">${certDate}</div>
  </div>

  <div class="statement">
    "I certify that the work described herein has been carried out in accordance with the relevant Australian Standards and Victorian plumbing regulations. All materials used are of the required standard and the installation has been inspected and found to be satisfactory."
  </div>

  <div class="sig-row">
    <div class="sig-block">
      ${signatureHtml}
      <div class="sig-label">Signature of Licensed Tradesperson</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:bold;">${certDate}</div>
      <div class="sig-label">Date</div>
    </div>
  </div>

  <div class="footer">
    Generated by Elemetric. This certificate is a documentation aid only. Elemetric Pty Ltd accepts no liability for the accuracy of work described herein. Compliance responsibility rests solely with the licensed tradesperson.<br/>
    Certificate No: ${certNumber} · AI Confidence: ${confidence}%
  </div>
</div>
</body>
</html>
`;

const { uri: certUri } = await Print.printToFileAsync({ html: certHtml });
const filename = `elemetric-cert-${Date.now()}.pdf`;
const dest = FileSystem.cacheDirectory + filename;
await FileSystem.copyAsync({ from: certUri, to: dest });
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(dest, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Certificate of Compliance" });
}
} catch (e: any) {
Alert.alert("Certificate Error", e?.message ?? "Could not generate certificate.");
} finally {
setGeneratingCert(false);
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

{confidence < 35 && decoded && (
  <View style={styles.lowConfidenceWarning}>
    <Text style={styles.lowConfidenceText}>
      ⚠️ Low confidence score. We recommend retaking photos with better lighting and angles before generating your report.
    </Text>
  </View>
)}

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

<Pressable
style={[styles.certBtn, generatingCert && { opacity: 0.6 }]}
onPress={generateCertificate}
disabled={generatingCert}
>
<Text style={styles.certText}>
{generatingCert ? "Generating Certificate..." : "Generate Certificate of Compliance"}
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

{/* ── Share options modal ── */}
<Modal
visible={showShareModal}
transparent
animationType="slide"
onRequestClose={() => setShowShareModal(false)}
>
<Pressable style={shareStyles.overlay} onPress={() => setShowShareModal(false)}>
<Pressable style={shareStyles.sheet} onPress={() => {}}>
<View style={shareStyles.handle} />
<Text style={shareStyles.sheetTitle}>Share Report</Text>
<Text style={shareStyles.sheetSubtitle}>{currentJob.jobName} · {currentJob.jobAddr}</Text>

{/* Share PDF */}
<Pressable
style={shareStyles.option}
onPress={async () => {
if (!generatedPdfUri) return;
setShowShareModal(false);
try {
const filename = `elemetric-report-${Date.now()}.pdf`;
const dest = FileSystem.cacheDirectory + filename;
await FileSystem.copyAsync({ from: generatedPdfUri, to: dest });
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(dest, {
mimeType: "application/pdf",
dialogTitle: "Share Compliance Report",
UTI: "com.adobe.pdf",
});
} else {
Alert.alert("PDF Created", `Saved to: ${dest}`);
}
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not share PDF.");
}
}}
>
<View style={shareStyles.optionIcon}><Text style={shareStyles.optionEmoji}>📄</Text></View>
<View style={shareStyles.optionText}>
<Text style={shareStyles.optionTitle}>Share PDF</Text>
<Text style={shareStyles.optionDesc}>Send via AirDrop, Messages, Files & more</Text>
</View>
<Text style={shareStyles.optionChevron}>›</Text>
</Pressable>

{/* Email to Client */}
<Pressable
style={shareStyles.option}
onPress={() => {
setShowShareModal(false);
const subject = encodeURIComponent(`Compliance Report — ${currentJob.jobName}`);
const body = encodeURIComponent(
`Hi,\n\nPlease find attached the compliance report for the recent work completed at ${currentJob.jobAddr}.\n\nJob Details:\n• Job: ${currentJob.jobName}\n• Address: ${currentJob.jobAddr}\n• Type: ${currentJob.type}\n• AI Confidence: ${confidence}%\n${action ? `\nRecommended Action: ${action}\n` : ""}\nThis report was generated using Elemetric — AI-powered compliance reporting for Australian tradespeople.\n\nRegards,\n${installerName || "Your Tradesperson"}`
);
Linking.openURL(`mailto:?subject=${subject}&body=${body}`).catch(() =>
Alert.alert("Cannot open email", "No email client found on this device.")
);
}}
>
<View style={shareStyles.optionIcon}><Text style={shareStyles.optionEmoji}>✉️</Text></View>
<View style={shareStyles.optionText}>
<Text style={shareStyles.optionTitle}>Email to Client</Text>
<Text style={shareStyles.optionDesc}>Pre-filled professional email template</Text>
</View>
<Text style={shareStyles.optionChevron}>›</Text>
</Pressable>

{/* Save to Files */}
<Pressable
style={shareStyles.option}
onPress={async () => {
if (!generatedPdfUri) return;
setShowShareModal(false);
try {
const filename = `elemetric-report-${Date.now()}.pdf`;
const dest = FileSystem.cacheDirectory + filename;
await FileSystem.copyAsync({ from: generatedPdfUri, to: dest });
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(dest, {
mimeType: "application/pdf",
UTI: "com.adobe.pdf",
});
}
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not save PDF.");
}
}}
>
<View style={shareStyles.optionIcon}><Text style={shareStyles.optionEmoji}>🗂️</Text></View>
<View style={shareStyles.optionText}>
<Text style={shareStyles.optionTitle}>Save to Files</Text>
<Text style={shareStyles.optionDesc}>Save PDF to your device storage</Text>
</View>
<Text style={shareStyles.optionChevron}>›</Text>
</Pressable>

{/* Share Summary Text */}
<Pressable
style={shareStyles.option}
onPress={async () => {
const summary = [
`Elemetric Compliance Report`,
`Job: ${currentJob.jobName}`,
`Address: ${currentJob.jobAddr}`,
`Type: ${currentJob.type}`,
`AI Confidence: ${confidence}%`,
action ? `Action: ${action}` : null,
detected.length ? `Verified: ${detected.join(", ")}` : null,
missing.length ? `Incomplete: ${missing.join(", ")}` : null,
`Generated: ${new Date().toLocaleString("en-AU")}`,
].filter(Boolean).join("\n");
setShowShareModal(false);
try {
await Share.share({ message: summary });
} catch {}
}}
>
<View style={shareStyles.optionIcon}><Text style={shareStyles.optionEmoji}>📋</Text></View>
<View style={shareStyles.optionText}>
<Text style={shareStyles.optionTitle}>Share Summary Text</Text>
<Text style={shareStyles.optionDesc}>Copy or send a plain text job summary</Text>
</View>
<Text style={shareStyles.optionChevron}>›</Text>
</Pressable>

<Pressable style={shareStyles.cancelBtn} onPress={() => setShowShareModal(false)}>
<Text style={shareStyles.cancelText}>Cancel</Text>
</Pressable>
</Pressable>
</Pressable>
</Modal>
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
title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
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
lowConfidenceWarning: {
backgroundColor: "rgba(220,38,38,0.12)",
borderRadius: 10,
borderWidth: 1,
borderColor: "rgba(220,38,38,0.30)",
padding: 12,
},
lowConfidenceText: {
color: "#fca5a5",
fontWeight: "700",
fontSize: 13,
lineHeight: 18,
},
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
certBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(59,130,246,0.15)",
borderWidth: 1,
borderColor: "rgba(59,130,246,0.35)",
},
certText: { color: "#93c5fd", fontWeight: "900", fontSize: 15 },
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

const shareStyles = StyleSheet.create({
overlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.65)",
justifyContent: "flex-end",
},
sheet: {
backgroundColor: "#0d1e38",
borderTopLeftRadius: 24,
borderTopRightRadius: 24,
padding: 20,
paddingBottom: 40,
gap: 4,
},
handle: {
width: 40, height: 4, borderRadius: 2,
backgroundColor: "rgba(255,255,255,0.2)",
alignSelf: "center",
marginBottom: 12,
},
sheetTitle: { color: "white", fontWeight: "900", fontSize: 20, marginBottom: 2 },
sheetSubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 12 },
option: {
flexDirection: "row",
alignItems: "center",
gap: 14,
paddingVertical: 14,
borderBottomWidth: 1,
borderBottomColor: "rgba(255,255,255,0.07)",
},
optionIcon: {
width: 44, height: 44, borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.08)",
alignItems: "center", justifyContent: "center",
},
optionEmoji: { fontSize: 22 },
optionText: { flex: 1 },
optionTitle: { color: "white", fontWeight: "800", fontSize: 15 },
optionDesc: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
optionChevron: { color: "rgba(255,255,255,0.35)", fontSize: 22, fontWeight: "300" },
cancelBtn: {
marginTop: 10,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderRadius: 14,
},
cancelText: { color: "rgba(255,255,255,0.6)", fontWeight: "800", fontSize: 15 },
});
