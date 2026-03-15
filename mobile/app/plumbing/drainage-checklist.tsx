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
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";
import QRCode from "qrcode";
import { hashBase64, captureTimestamp } from "@/lib/photoHash";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const SIGNATURE_KEY = "elemetric_signature_svg";

const CHECKS = [
{ id: "fall",       label: "Drain fall correct minimum 1 in 60" },
{ id: "joints",     label: "Pipe joints sealed and watertight" },
{ id: "bedding",    label: "Pipe bedding and support adequate" },
{ id: "inspection", label: "Inspection opening accessible" },
{ id: "trap",       label: "Trap installed where required" },
{ id: "vent",       label: "Vent pipe installed correctly" },
{ id: "water_test", label: "Drain tested with water test" },
{ id: "leaks",      label: "No evidence of leaks" },
{ id: "backflow",   label: "Backflow prevention installed where required" },
{ id: "overflow",   label: "Overflow relief gully installed correctly" },
] as const;

type CheckStatus = "pass" | "fail" | "na" | null;
type CheckEntry = { status: CheckStatus; notes: string; photoUris: string[] };
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

export default function DrainageChecklist() {
const router = useRouter();
const [loaded, setLoaded] = useState(false);
const [jobName, setJobName] = useState("Untitled Job");
const [jobAddr, setJobAddr] = useState("No address");
const [plumberName, setPlumberName] = useState("");
const [signatureSvg, setSignatureSvg] = useState("");
const [checks, setChecks] = useState<Record<string, CheckEntry>>(() =>
Object.fromEntries(CHECKS.map((c) => [c.id, { status: null, notes: "", photoUris: [] }]))
);
const [photoMeta, setPhotoMeta] = useState<Record<string, PhotoMeta[]>>({});
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult] = useState<AIResult | null>(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [showSuccess, setShowSuccess] = useState(false);
const [pdfUri,      setPdfUri]      = useState<string | null>(null);
const [pdfSharing,  setPdfSharing]  = useState(false);
const [licenceNumber, setLicenceNumber] = useState("");
const [companyName, setCompanyName] = useState("");
const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
const [gpsLoading, setGpsLoading] = useState(false);

// Drainage technical data
const [pipeMaterial,    setPipeMaterial]    = useState("");
const [pipeDiameter,    setPipeDiameter]    = useState("");
const [pipeGradient,    setPipeGradient]    = useState("");
const [testMethod,      setTestMethod]      = useState<"Water" | "Air" | "CCTV" | "">("");
const [testDuration,    setTestDuration]    = useState("");
const [testResult,      setTestResult]      = useState<"Pass" | "Fail" | "">("");
const [cctvOperator,    setCctvOperator]    = useState("");
const [cctvReportRef,   setCctvReportRef]   = useState("");
const [drainLength,     setDrainLength]     = useState("");

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

const captureGPS = async () => {
setGpsLoading(true);
try {
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== "granted") {
Alert.alert("Permission denied", "Location access is required to record GPS coordinates.");
return;
}
const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
try {
const [rev] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
if (rev) {
const formatted = [rev.streetNumber, rev.street, rev.suburb ?? rev.city, rev.region, rev.postalCode].filter(Boolean).join(" ");
if (formatted) setJobAddr((prev) => (prev === "No address" || !prev) ? formatted : prev);
}
} catch {}
} catch (e: any) {
Alert.alert("GPS Error", e?.message ?? "Could not get location.");
} finally {
setGpsLoading(false);
}
};

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
const ts = captureTimestamp();
let hash = "";
try {
const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
hash = await hashBase64(b64);
} catch {}
setPhotoMeta((prev) => ({ ...prev, [id]: [...(prev[id] || []), { uri, hash, capturedAt: ts }] }));
setChecks((prev) => ({ ...prev, [id]: { ...prev[id], photoUris: [...prev[id].photoUris, uri] } }));
} catch (e: any) {
Alert.alert("Photo error", e?.message ?? "Unknown error");
}
};

const removePhoto = (id: string, uri: string) => {
setPhotoMeta((prev) => ({ ...prev, [id]: (prev[id] || []).filter((m) => m.uri !== uri) }));
setChecks((prev) => ({ ...prev, [id]: { ...prev[id], photoUris: prev[id].photoUris.filter((u) => u !== uri) } }));
};

const runAI = async () => {
const photos: { label: string; uri: string }[] = [];
for (const c of CHECKS) {
for (const uri of checks[c.id]?.photoUris ?? []) {
photos.push({ label: c.label, uri });
}
}
if (photos.length < 2) {
Alert.alert("More photos needed", "Please add at least 2 photos before running AI analysis.");
return;
}
setAiLoading(true);
try {
const images: { mime: string; data: string; label: string }[] = [];
for (const p of photos) {
const r = await ImageManipulator.manipulateAsync(p.uri, [{ resize: { width: 1200 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
if (r.base64) images.push({ mime: "image/jpeg", data: r.base64, label: p.label });
}
const res = await fetch(`${API_BASE}/review`, {
method: "POST",
headers: { "Content-Type": "application/json",
        "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "", },
body: JSON.stringify({ type: "drainage", images }),
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

// QR code — encodes report identity for verification
let qrHtml = "";
try {
const qrData = `ELM|drainage|${jobName}|${jobAddr}|${dateShort}`;
const qrSvg = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
qrHtml = `<div style="text-align:center;">
<img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
<div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
</div>`;
} catch {}

const sigHtml = signatureSvg
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(signatureSvg)}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
: `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

const td = "border:1px solid #d1d5db;padding:8px;font-family:Helvetica,Arial,sans-serif;";
const th = `${td}background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;font-weight:bold;text-align:left;`;

const rowBg = (s: CheckStatus) => {
if (s === "pass") return "background:#dcfce7;";
if (s === "fail") return "background:#fee2e2;";
if (s === "na") return "background:#f3f4f6;";
return "";
};

const passCount = Object.values(checks).filter(e => e.status === "pass").length;
const failCount = Object.values(checks).filter(e => e.status === "fail").length;
const overallResult = failCount === 0 && passCount > 0 ? "PASS" : failCount > 0 ? "FAIL" : "INCOMPLETE";
const resultColor = overallResult === "PASS" ? "#16a34a" : overallResult === "FAIL" ? "#dc2626" : "#d97706";

const checkRows = CHECKS.map((c) => {
const e = checks[c.id];
const lbl = statusLabel(e?.status ?? null);
const col = statusColor(e?.status ?? null);
return `<tr style="${rowBg(e?.status ?? null)}">
<td style="${td}">${c.label}</td>
<td style="${td}font-weight:bold;color:${col};">${lbl}</td>
<td style="${td}">${e?.notes || ""}</td>
</tr>`;
}).join("");

const aiSection = aiResult ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;border:1px solid #e5e7eb;padding:16px;background:#f9fafb;border-radius:6px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:bold;margin-bottom:8px;">AI Analysis</div>
<div style="font-size:30px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${aiResult.confidence ?? 0}%</div>
<div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;"><strong>Action:</strong> ${aiResult.action || "—"}</div>
<div style="margin-top:4px;font-family:Helvetica,Arial,sans-serif;">${aiResult.analysis || ""}</div>
</div>` : "";

const photoHashes = Object.values(photoMeta).flat();
const tamperSection = photoHashes.length ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:bold;margin-bottom:6px;">🛡 Tamper-Evident Photo Record</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;margin-bottom:10px;">Each SHA-256 hash verifies the photo has not been modified since capture.</div>
<table style="width:100%;border-collapse:collapse;font-size:11px;">
<thead><tr style="background:#f3f4f6;">
<th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">Photo Label</th>
<th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">Captured At</th>
<th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;word-break:break-all;">SHA-256 Hash</th>
</tr></thead>
<tbody>
${photoHashes.map(m => `<tr>
<td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">${m.uri.split("/").pop()?.slice(0, 20) || "photo"}</td>
<td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;white-space:nowrap;">${m.capturedAt ? new Date(m.capturedAt).toLocaleString("en-AU") : "—"}</td>
<td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace;word-break:break-all;font-size:9px;">${m.hash || "—"}</td>
</tr>`).join("")}
</tbody>
</table>
</div>` : "";

const gpsLine = gpsCoords
? `${gpsCoords.lat.toFixed(6)}° N, ${gpsCoords.lng.toFixed(6)}° E`
: "Not recorded";

const html = `<html><head><style>
@page {
margin: 15mm;
@bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; }
@bottom-left { content: "ELEMETRIC · Confidential"; font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; }
}
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 80pt; font-family: Helvetica,Arial,sans-serif; font-weight: bold; color: rgba(7,21,43,0.04); white-space: nowrap; pointer-events: none; z-index: -1; letter-spacing: 8px; }
</style></head>
<body>
<div class="watermark">ELEMETRIC</div>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;opacity:0.6;margin-top:2px;">AI-Powered Compliance Documentation</div>
</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;">Drainage Compliance Report · AS/NZS 3500</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;">${dateShort}</div>
</div>
<div style="padding:22px;">

<div style="background:#f8fafc;border-left:4px solid #f97316;padding:16px;margin-bottom:20px;border-radius:0 6px 6px 0;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Executive Summary</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:4px 0;width:180px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Job Type</td><td style="font-family:Helvetica,Arial,sans-serif;">Drainage · AS/NZS 3500</td></tr>
<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Date</td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Address</td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">GPS</td><td style="font-family:Helvetica,Arial,sans-serif;">${gpsLine}</td></tr>
<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Plumber</td><td style="font-family:Helvetica,Arial,sans-serif;">${plumberName || "Not entered"}</td></tr>
<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">AI Confidence</td><td style="font-family:Helvetica,Arial,sans-serif;">${aiResult ? `${aiResult.confidence ?? 0}%` : "Not analysed"}</td></tr>
<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Overall Result</td><td style="font-family:Helvetica,Arial,sans-serif;font-weight:bold;color:${resultColor};">${overallResult}</td></tr>
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom:16px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:10px;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:160px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Job Name</td><td style="font-family:Helvetica,Arial,sans-serif;">${jobName}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Address</td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Plumber</td><td style="font-family:Helvetica,Arial,sans-serif;">${plumberName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Licence Number</td><td style="font-family:Helvetica,Arial,sans-serif;">${licenceNumber || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Company</td><td style="font-family:Helvetica,Arial,sans-serif;">${companyName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Report Date</td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Drainage Test Data -->
<div style="margin-bottom:16px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:6px;">Drainage Test Data</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;margin-bottom:12px;">AS/NZS 3500.2 — Sanitary Plumbing &amp; Drainage</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
<thead>
<tr style="background:#f8fafc;">
<th style="padding:7px 10px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Parameter</th>
<th style="padding:7px 10px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Recorded Value</th>
<th style="padding:7px 10px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Reference (AS/NZS 3500.2)</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Pipe Material</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${pipeMaterial || "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">AS/NZS 3500.2 Table 1.1</td></tr>
<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Pipe Diameter</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${pipeDiameter ? pipeDiameter + " mm" : "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Min. 100 mm for stormwater</td></tr>
<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Pipe Gradient</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${pipeGradient ? "1 in " + pipeGradient : "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Min. 1 in 60 (cl. 3.3.2)</td></tr>
<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Drain Length</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${drainLength ? drainLength + " m" : "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;"></td></tr>
<tr style="background:#fafafa;"><td colspan="3" style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Pressure / Performance Test</td></tr>
<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Test Method</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${testMethod || "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Water, Air, or CCTV inspection</td></tr>
<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Test Duration</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${testDuration ? testDuration + " min" : "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Min 15 min for water test</td></tr>
<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Test Result</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:bold;color:${testResult === "Pass" ? "#16a34a" : testResult === "Fail" ? "#dc2626" : "#374151"};">${testResult || "Not recorded"}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Pass / Fail</td></tr>
${cctvOperator ? `<tr style="background:#fafafa;"><td colspan="3" style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">CCTV Inspection</td></tr>
<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">CCTV Operator</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;" colspan="2">${cctvOperator}</td></tr>` : ""}
${cctvReportRef ? `<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">CCTV Report Ref.</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;" colspan="2">${cctvReportRef}</td></tr>` : ""}
</tbody>
</table>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#166534;line-height:1.5;">
  <strong>Test Methodology Note:</strong> Drainage testing conducted per AS/NZS 3500.2 Section 3.8. Water test: system filled and pressure maintained for minimum 15 minutes with no measurable loss. All pipes bedded and supported per cl. 3.5 prior to testing.
</div>
</div>

${aiSection}

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom:16px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:10px;">Drainage Checks</div>
<table style="width:100%;border-collapse:collapse;">
<tr>
<th style="${th}width:60%;">Check Item</th>
<th style="${th}width:8%;">Result</th>
<th style="${th}">Notes</th>
</tr>
${checkRows}
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;margin-bottom:12px;">Sign-Off</div>
<div style="font-family:Helvetica,Arial,sans-serif;margin-bottom:8px;"><strong>Plumber:</strong> ${plumberName || "Not entered"}</div>
${sigHtml}
<div style="margin-top:6px;font-size:13px;font-family:Helvetica,Arial,sans-serif;"><strong>Date:</strong> ${dateShort}</div>
</div>

${tamperSection}

<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
<strong style="color:#374151;">Compliance Disclaimer:</strong> Generated by Elemetric on ${dateStr}. This report is a documentation aid only. Elemetric Pty Ltd accepts no liability for the accuracy of work described herein. Compliance responsibility rests solely with the licensed tradesperson.
</div>
</div></body></html>`;

const { uri: printUri } = await Print.printToFileAsync({ html });
try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}

      // Save job to Supabase for free tier tracking and timeline
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("jobs").insert({
            user_id: user.id,
            job_type: "drainage",
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

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Drainage Checklist</Text>
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

{/* ── GPS ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>GPS Location (Optional)</Text>
<Pressable style={styles.gpsBtn} onPress={captureGPS} disabled={gpsLoading}>
{gpsLoading
? <ActivityIndicator color="white" />
: <Text style={styles.gpsBtnText}>Capture GPS Location</Text>
}
</Pressable>
{gpsCoords && (
<Text style={styles.gpsResult}>
{gpsCoords.lat.toFixed(6)}°, {gpsCoords.lng.toFixed(6)}°
</Text>
)}
</View>

{/* ── Drainage Technical Data ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Drainage Test Data</Text>
<Text style={styles.sectionSub}>AS/NZS 3500.2 — Pipe specs and test results</Text>
<View style={styles.techGrid}>
  <View style={styles.techCell}>
    <Text style={styles.fieldLabel}>Pipe Diameter (mm)</Text>
    <TextInput style={styles.input} value={pipeDiameter} onChangeText={setPipeDiameter} keyboardType="decimal-pad" placeholder="e.g. 100" placeholderTextColor="#555" />
  </View>
  <View style={styles.techCell}>
    <Text style={styles.fieldLabel}>Gradient (1 in X)</Text>
    <TextInput style={styles.input} value={pipeGradient} onChangeText={setPipeGradient} keyboardType="decimal-pad" placeholder="e.g. 60" placeholderTextColor="#555" />
  </View>
  <View style={styles.techCell}>
    <Text style={styles.fieldLabel}>Drain Length (m)</Text>
    <TextInput style={styles.input} value={drainLength} onChangeText={setDrainLength} keyboardType="decimal-pad" placeholder="e.g. 12.5" placeholderTextColor="#555" />
  </View>
  <View style={styles.techCell}>
    <Text style={styles.fieldLabel}>Test Duration (min)</Text>
    <TextInput style={styles.input} value={testDuration} onChangeText={setTestDuration} keyboardType="decimal-pad" placeholder="e.g. 15" placeholderTextColor="#555" />
  </View>
</View>
<Text style={styles.fieldLabel}>Pipe Material</Text>
<TextInput style={styles.input} value={pipeMaterial} onChangeText={setPipeMaterial} placeholder="e.g. PVC, Ductile Iron, Vitrified Clay" placeholderTextColor="#555" />
<Text style={styles.fieldLabel}>Test Method</Text>
<View style={styles.chipRow}>
{(["Water", "Air", "CCTV"] as const).map((t) => (
  <Pressable key={t} style={[styles.chip, testMethod === t && styles.chipActive]} onPress={() => setTestMethod(testMethod === t ? "" : t)}>
    <Text style={[styles.chipText, testMethod === t && styles.chipTextActive]}>{t} Test</Text>
  </Pressable>
))}
</View>
<Text style={styles.fieldLabel}>Test Result</Text>
<View style={styles.chipRow}>
{(["Pass", "Fail"] as const).map((t) => (
  <Pressable key={t} style={[styles.chip, testResult === t && (t === "Pass" ? styles.chipPass : styles.chipFail)]} onPress={() => setTestResult(testResult === t ? "" : t)}>
    <Text style={[styles.chipText, testResult === t && (t === "Pass" ? styles.chipPassText : styles.chipFailText)]}>{t}</Text>
  </Pressable>
))}
</View>
{testMethod === "CCTV" && <>
  <Text style={styles.fieldLabel}>CCTV Operator</Text>
  <TextInput style={styles.input} value={cctvOperator} onChangeText={setCctvOperator} placeholder="Operator name or company" placeholderTextColor="#555" />
  <Text style={styles.fieldLabel}>CCTV Report Reference</Text>
  <TextInput style={styles.input} value={cctvReportRef} onChangeText={setCctvReportRef} placeholder="Report number / reference" placeholderTextColor="#555" />
</>}
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
{entry.photoUris.map((uri, i) => {
const meta = (photoMeta[check.id] || []).find((m) => m.uri === uri);
return (
<View key={`${check.id}-${i}`} style={styles.photoWrap}>
<Image source={{ uri }} style={styles.photo} />
{meta?.hash ? <View style={styles.shieldBadge}><Text style={styles.shieldBadgeText}>🛡</Text></View> : null}
<Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(check.id, uri)}>
<Text style={styles.removePhotoText}>×</Text>
</Pressable>
</View>
);
})}
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
section: {
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 16,
gap: 10,
},
sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
sectionSub:   { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: -4 },
fieldLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
techGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
techCell: { width: "47%" },
chipRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)" },
chipActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.15)" },
chipPass: { borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.12)" },
chipFail: { borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.12)" },
chipText: { color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 13 },
chipTextActive: { color: "#f97316" },
chipPassText: { color: "#22c55e" },
chipFailText: { color: "#ef4444" },
input: {
backgroundColor: "rgba(255,255,255,0.06)",
borderRadius: 10,
padding: 12,
color: "white",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
fontSize: 14,
},
gpsBtn: {
backgroundColor: "rgba(249,115,22,0.18)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
borderRadius: 12,
paddingVertical: 14,
alignItems: "center",
},
gpsBtnText: { color: "white", fontWeight: "900" },
gpsResult: { color: "#22c55e", fontSize: 13, fontWeight: "700" },
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
