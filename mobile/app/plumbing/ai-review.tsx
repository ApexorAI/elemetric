import React, { useCallback, useState, useEffect, useRef } from "react";
import * as StoreReview from "expo-store-review";
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
import Svg, { Circle, G } from "react-native-svg";
import { useRouter, useFocusEffect } from "expo-router";
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
startTime?: string;
weather?: string;
};

type ReviewPhoto = {
label: string;
uri: string;
base64: string;
mime: string;
hash?: string;
capturedAt?: string;
role?: "before" | "after";
gps?: { lat: number; lng: number };
};

type Material = {
  id: string;
  name: string;
  qty: string;
  brand: string;
};

const REVIEW_PHOTOS_FILE = `${FileSystem.documentDirectory}review-photos.json`;
const AI_RESULT_FILE = `${FileSystem.documentDirectory}ai-result.json`;
const CHECKLIST_KEY = "elemetric_current_checklist";
const SIGNATURE_KEY = "elemetric_signature_svg";
const INSTALLER_NAME_KEY = "elemetric_installer_name";

const JOB_TYPE_META: Record<string, { label: string; standard: string }> = {
  hotwater:   { label: "Hot Water System Compliance Report",  standard: "AS/NZS 3500" },
  gas:        { label: "Gas Installation Compliance Report",  standard: "AS/NZS 5601" },
  drainage:   { label: "Drainage Compliance Report",          standard: "AS/NZS 3500.2" },
  newinstall: { label: "New Installation Compliance Report",  standard: "AS/NZS 3500" },
  electrical: { label: "Electrical Compliance Report",        standard: "AS/NZS 3000" },
  hvac:       { label: "HVAC Compliance Report",              standard: "AS/NZS 1668" },
  carpentry:  { label: "Carpentry Documentation Report",      standard: "AS 1684" },
};

// ── Coverage Ring ─────────────────────────────────────────────────────────────

function CoverageRing({ score }: { score: number }) {
  const SIZE = 80;
  const SW_RING = 7;
  const R = (SIZE - SW_RING) / 2;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (score / 100) * CIRC;
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        <G rotation="-90" origin={`${SIZE / 2},${SIZE / 2}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={SW_RING} fill="none" />
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#f97316" strokeWidth={SW_RING} fill="none"
            strokeDasharray={`${CIRC}`} strokeDashoffset={offset} strokeLinecap="round" />
        </G>
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#f97316", fontWeight: "900", fontSize: 16 }}>{score}%</Text>
      </View>
    </View>
  );
}

export default function AIReview() {
const router = useRouter();

const [decoded, setDecoded] = useState<AIResult | null>(null);

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
const [materials, setMaterials] = useState<Material[]>([]);
const [clientSignatureSvg, setClientSignatureSvg] = useState<string>("");
const [feedbackRating, setFeedbackRating] = useState<"up" | "down" | null>(null);
const [feedbackComment, setFeedbackComment] = useState("");
const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
const [feedbackDone, setFeedbackDone] = useState(false);
const [result360, setResult360] = useState<{
  coverageScore: number;
  detected: string[];
  missingFromView: string[];
  recommendedPhotos: string[];
} | null>(null);
const [loading360, setLoading360] = useState(false);
const [floorPlanData, setFloorPlanData] = useState<{ uri: string; pins: any[] } | null>(null);
const [reviewPhotos360, setReviewPhotos360] = useState<ReviewPhoto[]>([]);
const [jobDays, setJobDays] = useState<string[]>([]);

// Plumbing technical data (hotwater/newinstall)
const [waterPressureMeter,   setWaterPressureMeter]   = useState("");
const [waterPressureFixture, setWaterPressureFixture] = useState("");
const [hotWaterTemp,         setHotWaterTemp]         = useState("");
const [coldWaterTemp,        setColdWaterTemp]        = useState("");
const [flowRate,             setFlowRate]             = useState("");
const [pipeMaterial,         setPipeMaterial]         = useState("");
const [pipeSize,             setPipeSize]             = useState("");
const [installationStandard, setInstallationStandard] = useState("AS/NZS 3500");

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
startTime: parsed.startTime,
weather: parsed.weather,
});
}

// Load AI result from file (written by photos.tsx runAI)
try {
  const resultInfo = await FileSystem.getInfoAsync(AI_RESULT_FILE);
  if (resultInfo.exists && active) {
    const rawResult = await FileSystem.readAsStringAsync(AI_RESULT_FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    setDecoded(JSON.parse(rawResult));
  }
} catch {}

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
try {
  const rawMaterials = await AsyncStorage.getItem("elemetric_materials");
  if (rawMaterials && active) {
    setMaterials(JSON.parse(rawMaterials));
  }
} catch {}

const savedClientSig = await AsyncStorage.getItem("elemetric_client_signature_svg");
if (savedClientSig && active) setClientSignatureSvg(savedClientSig);

// Load 360° review photos
try {
  const info360 = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}review-photos-360.json`);
  if (info360.exists && active) {
    const raw360 = await FileSystem.readAsStringAsync(`${FileSystem.documentDirectory}review-photos-360.json`, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed360 = JSON.parse(raw360);
    setReviewPhotos360(Array.isArray(parsed360) ? parsed360 : []);
  }
} catch {}

// Load floor plan + pins
try {
  const rawJob2 = await AsyncStorage.getItem("elemetric_current_job");
  if (rawJob2 && active) {
    const jobData = JSON.parse(rawJob2);
    if (jobData.floorPlanUri) {
      const rawPins = await AsyncStorage.getItem("elemetric_floor_plan_pins");
      const pins = rawPins ? JSON.parse(rawPins) : [];
      setFloorPlanData({ uri: jobData.floorPlanUri, pins });
    }
  }
} catch {}

// Compute job days from review photos capturedAt
try {
  const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}review-photos.json`);
  if (info.exists && active) {
    const rawP = await FileSystem.readAsStringAsync(`${FileSystem.documentDirectory}review-photos.json`, { encoding: FileSystem.EncodingType.UTF8 });
    const photos = JSON.parse(rawP) as ReviewPhoto[];
    const dates = new Set<string>();
    photos.forEach((p) => { if (p.capturedAt) dates.add(new Date(p.capturedAt).toDateString()); });
    if (active) setJobDays(Array.from(dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()));
  }
} catch {}

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

const gaugeColor = confidence >= 80 ? "#22c55e" : confidence >= 50 ? "#f97316" : "#ef4444";
const riskLabel = confidence >= 80 ? "LOW RISK" : confidence >= 50 ? "MEDIUM RISK" : "HIGH RISK";
const riskBg = confidence >= 80 ? "rgba(34,197,94,0.15)" : confidence >= 50 ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)";
const riskBorderColor = confidence >= 80 ? "rgba(34,197,94,0.40)" : confidence >= 50 ? "rgba(249,115,22,0.40)" : "rgba(239,68,68,0.40)";

const GAUGE_RADIUS = 70;
const GAUGE_SW = 14;
const GAUGE_C = 2 * Math.PI * GAUGE_RADIUS;
const gaugeDashOffset = GAUGE_C - (confidence / 100) * GAUGE_C;

const getWhatThisMeans = () => {
  if (confidence >= 80 && missing.length === 0 && unclear.length === 0) {
    return "Your documentation is strong. This report will hold up in a dispute or VBA inspection.";
  } else if (confidence >= 80) {
    return "Confidence is high, but some items still need attention. Address the flagged photos to make this report fully dispute-ready.";
  } else if (confidence >= 50) {
    return "Your documentation has gaps. Retaking the flagged photos will significantly strengthen this report before you proceed.";
  }
  return "This report is not yet compliance-ready. Multiple items need clearer photos before this will hold up to VBA scrutiny.";
};

const getItemAction = (item: string, status: "missing" | "unclear") => {
  if (status === "missing") {
    return `Photo not found. Retake ensuring "${item}" is clearly visible and fills most of the frame.`;
  }
  return `Photo was unclear. Move closer, improve lighting, and ensure nothing obstructs the view of "${item}".`;
};

const addMaterial = () => {
  const next: Material[] = [...materials, { id: Date.now().toString(), name: "", qty: "1", brand: "" }];
  setMaterials(next);
  AsyncStorage.setItem("elemetric_materials", JSON.stringify(next)).catch(() => {});
};

const updateMaterial = (id: string, field: keyof Material, value: string) => {
  const next = materials.map((m) => (m.id === id ? { ...m, [field]: value } : m));
  setMaterials(next);
  AsyncStorage.setItem("elemetric_materials", JSON.stringify(next)).catch(() => {});
};

const removeMaterial = (id: string) => {
  const next = materials.filter((m) => m.id !== id);
  setMaterials(next);
  AsyncStorage.setItem("elemetric_materials", JSON.stringify(next)).catch(() => {});
};

const submitFeedback = async (rating: "up" | "down") => {
  setFeedbackRating(rating);
  if (rating === "up") {
    // Submit immediately for thumbs-up; thumbs-down waits for comment
    setFeedbackSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("ai_feedback").insert({
        job_id: Date.now().toString(),
        user_id: user?.id ?? null,
        rating: "up",
        comment: null,
        job_type: currentJob.type,
        confidence_score: confidence,
      });
    } catch {
      // Best-effort — don't block the user
    } finally {
      setFeedbackSubmitting(false);
      setFeedbackDone(true);
    }
  }
};

const submitNegativeFeedback = async () => {
  if (!feedbackComment.trim()) return;
  setFeedbackSubmitting(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ai_feedback").insert({
      job_id: Date.now().toString(),
      user_id: user?.id ?? null,
      rating: "down",
      comment: feedbackComment.trim(),
      job_type: currentJob.type,
      confidence_score: confidence,
    });
  } catch {
    // Best-effort
  } finally {
    setFeedbackSubmitting(false);
    setFeedbackDone(true);
  }
};

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

// Send job completion email (best-effort)
try {
const { data: { user } } = await supabase.auth.getUser();
if (user?.email) {
await fetch("https://elemetric-ai-production.up.railway.app/send-job-complete", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
email: user.email,
jobName: currentJob.jobName,
jobAddr: currentJob.jobAddr,
jobType: (JOB_TYPE_META[currentJob.type] ?? JOB_TYPE_META.hotwater).label,
confidence,
installerName,
date: new Date().toLocaleDateString("en-AU"),
}),
});
}
} catch {}


// Check if this is the 5th completed job — show app review prompt
try {
const reviewShownKey = "elemetric_review_prompt_shown";
const alreadyShown = await AsyncStorage.getItem(reviewShownKey);
if (!alreadyShown) {
const existing = await AsyncStorage.getItem("elemetric_jobs");
const localJobs = existing ? JSON.parse(existing) : [];
if (localJobs.length >= 5) {
const isAvailable = await StoreReview.isAvailableAsync();
if (isAvailable) {
await StoreReview.requestReview();
await AsyncStorage.setItem(reviewShownKey, "true");
}
}
}
} catch {}
}
} catch (e: any) {
Alert.alert("Save Failed", e?.message ?? "Could not save job. Check your internet connection and try again — your analysis is not lost.");
} finally {
setSaving(false);
}
};

const clearSignature = async () => {
await AsyncStorage.removeItem(SIGNATURE_KEY);
setSignatureSvg("");
Alert.alert("Removed", "Saved signature removed.");
};

const analyze360 = async () => {
  if (reviewPhotos360.length === 0) {
    Alert.alert("No 360° Photos", "Add 360° photos in the photo step first.");
    return;
  }
  setLoading360(true);
  try {
    const images = reviewPhotos360.map((p) => ({ mime: p.mime, data: p.base64, label: p.label }));
    const res = await fetch("https://elemetric-ai-production.up.railway.app/process-360", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
      },
      body: JSON.stringify({ type: currentJob.type, images }),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`Invalid response: ${text.slice(0, 100)}`); }
    if (!res.ok) throw new Error(json?.error ?? "360° analysis failed");
    setResult360({
      coverageScore: json.coverageScore ?? json.coverage_score ?? 0,
      detected: json.detected ?? [],
      missingFromView: json.missing_from_view ?? json.missingFromView ?? [],
      recommendedPhotos: json.recommended_photos ?? json.recommendedPhotos ?? [],
    });
  } catch (e: any) {
    Alert.alert("360° Analysis Failed", e?.message ?? "Could not analyse 360° photo.");
  } finally {
    setLoading360(false);
  }
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

const beforePhotos = safePhotos.filter((p) => p.role === "before");
const afterPhotos  = safePhotos.filter((p) => p.role === "after");
const otherPhotos  = safePhotos.filter((p) => !p.role);

const photoCard = (photo: ReviewPhoto, borderColor = "#d1d5db") =>
  `<div style="box-sizing:border-box;margin-bottom:12px;page-break-inside:avoid;">
    <div style="font-weight:bold;font-size:11px;margin-bottom:5px;color:#374151;">${photo.label}</div>
    <img src="data:${photo.mime};base64,${photo.base64}" style="width:100%;height:150px;object-fit:cover;border:2px solid ${borderColor};border-radius:6px;"/>
  </div>`;

let photoHtml = "";

if (beforePhotos.length > 0 || afterPhotos.length > 0) {
  photoHtml += `
<div style="margin-bottom:16px;page-break-inside:avoid;">
  <div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#111827;border-bottom:2px solid #f97316;padding-bottom:6px;">Before &amp; After Comparison</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;padding-right:8px;vertical-align:top;">
        <div style="font-size:12px;font-weight:bold;color:#d97706;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Before</div>
        ${beforePhotos.length > 0 ? beforePhotos.map((p) => photoCard(p, "#d97706")).join("") : '<div style="color:#9ca3af;font-size:12px;">No before photos marked</div>'}
      </td>
      <td style="width:50%;padding-left:8px;vertical-align:top;">
        <div style="font-size:12px;font-weight:bold;color:#16a34a;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">After</div>
        ${afterPhotos.length > 0 ? afterPhotos.map((p) => photoCard(p, "#22c55e")).join("") : '<div style="color:#9ca3af;font-size:12px;">No after photos marked</div>'}
      </td>
    </tr>
  </table>
</div>`;
}

if (otherPhotos.length > 0) {
  photoHtml += `
<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;">
${otherPhotos.map((photo) => `
  <div style="width:48%;box-sizing:border-box;margin-bottom:12px;page-break-inside:avoid;">
    <div style="font-weight:bold;font-size:12px;margin-bottom:6px;color:#111827;">${photo.label}</div>
    <img src="data:${photo.mime};base64,${photo.base64}" style="width:100%;height:160px;object-fit:cover;border:1px solid #d1d5db;border-radius:6px;"/>
  </div>`).join("")}
</div>`;
}

if (!photoHtml) {
  photoHtml = `<div style="color:#6b7280;">No photos available for report.</div>`;
}

// 360° photos section
let photo360Html = "";
if (reviewPhotos360.length > 0) {
  photo360Html = `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:6px;">360° Room Documentation</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:12px;">Full-room panoramic photos captured for spatial context</div>
${result360 ? `
<div style="background:#fffbf5;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:bold;color:#92400e;margin-bottom:6px;">360° Coverage Score: ${result360.coverageScore}%</div>
  ${result360.detected.length > 0 ? `<div style="font-size:12px;color:#166534;margin-bottom:4px;"><strong>Detected in 360°:</strong> ${result360.detected.join(", ")}</div>` : ""}
  ${result360.missingFromView.length > 0 ? `<div style="font-size:12px;color:#991b1b;margin-bottom:4px;"><strong>Not visible in 360°:</strong> ${result360.missingFromView.join(", ")}</div>` : ""}
  ${result360.recommendedPhotos.length > 0 ? `<div style="font-size:12px;color:#1e40af;"><strong>Recommend additional photos of:</strong> ${result360.recommendedPhotos.join(", ")}</div>` : ""}
</div>` : ""}
<div style="display:flex;flex-wrap:wrap;gap:12px;">
${reviewPhotos360.map((p) => `
  <div style="width:48%;box-sizing:border-box;">
    <div style="font-weight:bold;font-size:11px;margin-bottom:5px;color:#7c3aed;">${p.label}</div>
    <img src="data:${p.mime};base64,${p.base64}" style="width:100%;height:160px;object-fit:cover;border:2px solid #7c3aed;border-radius:6px;"/>
  </div>`).join("")}
</div>
</div>`;
}

// Floor plan section
let floorPlanHtml = "";
if (floorPlanData?.uri) {
  try {
    const fpInfo = await FileSystem.getInfoAsync(floorPlanData.uri);
    if (fpInfo.exists) {
      const fpB64 = await FileSystem.readAsStringAsync(floorPlanData.uri, { encoding: FileSystem.EncodingType.Base64 });
      const pinsHtml = floorPlanData.pins.map((pin: any) => `
        <div style="position:absolute;left:${pin.x * 100}%;top:${pin.y * 100}%;transform:translate(-50%,-50%);">
          <div style="width:16px;height:16px;background:#f97316;border:2px solid white;border-radius:50%;"></div>
          <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);background:#f97316;color:white;font-size:9px;font-weight:bold;border-radius:4px;padding:2px 4px;white-space:nowrap;font-family:Helvetica,Arial,sans-serif;">${pin.label}</div>
        </div>`).join("");
      floorPlanHtml = `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:6px;">Floor Plan — Item Locations</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:12px;">${floorPlanData.pins.length} item${floorPlanData.pins.length !== 1 ? "s" : ""} marked on the floor plan</div>
<div style="position:relative;display:inline-block;width:100%;">
  <img src="data:image/jpeg;base64,${fpB64}" style="width:100%;border-radius:8px;border:1px solid #e5e7eb;"/>
  ${pinsHtml}
</div>
${floorPlanData.pins.length > 0 ? `
<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:11px;">
<thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;">Item</th><th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;">Location</th></tr></thead>
<tbody>
${floorPlanData.pins.map((pin: any, i: number) => `<tr style="${i%2===0?"":"background:#f9fafb;"}"><td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:600;">${pin.label}</td><td style="padding:6px 8px;border:1px solid #e5e7eb;">${Math.round(pin.x*100)}% from left, ${Math.round(pin.y*100)}% from top</td></tr>`).join("")}
</tbody></table>` : ""}
</div>`;
    }
  } catch {}
}

// Multi-day photo grouping
const photosByDay = new Map<string, ReviewPhoto[]>();
safePhotos.forEach((p) => {
  const dayKey = p.capturedAt ? new Date(p.capturedAt).toDateString() : "Unknown";
  if (!photosByDay.has(dayKey)) photosByDay.set(dayKey, []);
  photosByDay.get(dayKey)!.push(p);
});

let timelineHtml = "";
if (jobDays.length > 1 || (jobDays.length === 1 && photosByDay.size > 1)) {
  const sortedDays = Array.from(photosByDay.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  timelineHtml = `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:10px;">Multi-Day Project Timeline</div>
<div style="display:flex;gap:0;margin-bottom:16px;align-items:center;">
${sortedDays.map((d, i) => `
  <div style="text-align:center;flex:1;">
    <div style="width:20px;height:20px;background:${i===sortedDays.length-1?"#f97316":"#22c55e"};border-radius:50%;margin:0 auto 4px;"></div>
    <div style="font-size:10px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;color:#374151;">Day ${i+1}</div>
    <div style="font-size:9px;color:#6b7280;font-family:Helvetica,Arial,sans-serif;">${new Date(d).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</div>
    <div style="font-size:9px;color:#6b7280;font-family:Helvetica,Arial,sans-serif;">${photosByDay.get(d)?.length ?? 0} photos</div>
  </div>
  ${i < sortedDays.length-1 ? '<div style="flex:1;height:2px;background:#e5e7eb;margin-top:10px;"></div>' : ""}
`).join("")}
</div>
${sortedDays.map((d, di) => `
<div style="margin-bottom:16px;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#07152b;border-left:3px solid #f97316;padding-left:10px;margin-bottom:8px;">
    Day ${di+1} — ${new Date(d).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})} (${photosByDay.get(d)?.length ?? 0} photos)
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;">
  ${(photosByDay.get(d) ?? []).map((p) => `
    <div style="width:30%;box-sizing:border-box;">
      <div style="font-size:9px;font-weight:bold;margin-bottom:3px;color:#374151;">${p.label}</div>
      <img src="data:${p.mime};base64,${p.base64}" style="width:100%;height:90px;object-fit:cover;border:1px solid #d1d5db;border-radius:4px;"/>
    </div>`).join("")}
  </div>
</div>`).join("")}
</div>`;
}

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

// Cover page — compliance result badge
const coverBadgeColor = confidence >= 80 ? "#22c55e" : confidence >= 50 ? "#f97316" : "#ef4444";
const coverBadgeLabel = confidence >= 80 ? "COMPLIANT" : confidence >= 50 ? "REVIEW REQUIRED" : "NON-COMPLIANT";
const jobMeta = JOB_TYPE_META[currentJob.type] ?? JOB_TYPE_META.hotwater;

const html = `
<html><head><style>@page { margin: 15mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } @bottom-left { content: "ELEMETRIC · Confidential"; font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 80pt; font-family: Helvetica,Arial,sans-serif; font-weight: bold; color: rgba(7,21,43,0.04); white-space: nowrap; pointer-events: none; z-index: -1; letter-spacing: 8px; }
.cover-page { background: #07152b; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px 40px; box-sizing: border-box; page-break-after: always; }
</style></head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div style="letter-spacing:6px;font-size:38px;font-weight:900;color:#f97316;margin-bottom:60px;font-family:Helvetica,Arial,sans-serif;">ELEMETRIC</div>
  <div style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;font-family:Helvetica,Arial,sans-serif;">${jobMeta.standard}</div>
  <div style="color:white;font-size:24px;font-weight:900;text-align:center;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">${jobMeta.label}</div>
  <div style="width:50px;height:3px;background:#f97316;margin:20px auto 40px;"></div>
  <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:28px 36px;text-align:center;width:100%;max-width:400px;box-sizing:border-box;">
    <div style="color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">Property Address</div>
    <div style="color:white;font-size:16px;font-weight:700;margin-bottom:20px;font-family:Helvetica,Arial,sans-serif;">${currentJob.jobAddr}</div>
    <div style="color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">Plumber</div>
    <div style="color:white;font-size:15px;font-weight:700;margin-bottom:20px;font-family:Helvetica,Arial,sans-serif;">${installerName || "Not entered"}</div>
    <div style="color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">Date</div>
    <div style="color:white;font-size:15px;font-weight:700;font-family:Helvetica,Arial,sans-serif;">${reportDateShort}</div>
  </div>
  <div style="margin-top:36px;background:${coverBadgeColor}22;border:2px solid ${coverBadgeColor};border-radius:50px;padding:14px 36px;text-align:center;">
    <div style="color:${coverBadgeColor};font-size:18px;font-weight:900;letter-spacing:2px;font-family:Helvetica,Arial,sans-serif;">${coverBadgeLabel}</div>
    <div style="color:${coverBadgeColor};font-size:28px;font-weight:900;font-family:Helvetica,Arial,sans-serif;margin-top:4px;">${confidence}%</div>
    <div style="color:${coverBadgeColor};opacity:0.7;font-size:10px;font-family:Helvetica,Arial,sans-serif;margin-top:2px;">AI Confidence Score</div>
  </div>
  <div style="margin-top:60px;color:rgba(255,255,255,0.20);font-size:10px;font-family:Helvetica,Arial,sans-serif;text-align:center;">This report was generated by Elemetric · elemetric.com.au<br/>Designed for licensed Australian tradespeople</div>
</div>

<!-- REPORT CONTENT -->
<div class="watermark">ELEMETRIC</div>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;">${(JOB_TYPE_META[currentJob.type] ?? JOB_TYPE_META.hotwater).label} · ${(JOB_TYPE_META[currentJob.type] ?? JOB_TYPE_META.hotwater).standard}</div>
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
    ${currentJob.weather ? `<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Weather</td><td style="font-family:Helvetica,Arial,sans-serif;">${currentJob.weather}</td></tr>` : ""}
    ${currentJob.startTime ? `<tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Time on Site</td><td style="font-family:Helvetica,Arial,sans-serif;">${(() => { const diff = Math.floor((Date.now() - new Date(currentJob.startTime).getTime()) / 1000); const h = Math.floor(diff/3600); const m = Math.floor((diff%3600)/60); const s = diff%60; return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`; })()}</td></tr>` : ""}
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

${(currentJob.type === "hotwater" || currentJob.type === "newinstall") && (waterPressureMeter || waterPressureFixture || hotWaterTemp || coldWaterTemp || flowRate || pipeMaterial || pipeSize) ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<!-- Plumbing Technical Data -->
<div style="margin-bottom:16px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:19px;font-weight:bold;margin-bottom:6px;">Plumbing Technical Data</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;margin-bottom:12px;">${installationStandard || "AS/NZS 3500"} — Recorded site measurements</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
<thead>
<tr style="background:#f8fafc;">
<th style="padding:7px 10px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Parameter</th>
<th style="padding:7px 10px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Recorded Value</th>
<th style="padding:7px 10px;text-align:left;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Reference (AS/NZS 3500)</th>
</tr>
</thead>
<tbody>
${waterPressureMeter ? `<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Water Pressure at Meter</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${waterPressureMeter} kPa</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Max 500 kPa (cl. 3.3.1)</td></tr>` : ""}
${waterPressureFixture ? `<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Water Pressure at Fixture</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${waterPressureFixture} kPa</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Min 50 kPa (cl. 3.3.3)</td></tr>` : ""}
${hotWaterTemp ? `<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Hot Water Temperature</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${hotWaterTemp} °C</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≥ 60°C at storage, ≤ 50°C delivery</td></tr>` : ""}
${coldWaterTemp ? `<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Cold Water Temperature</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${coldWaterTemp} °C</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Ambient supply temperature</td></tr>` : ""}
${flowRate ? `<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Flow Rate</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${flowRate} L/min</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Per fixture rating requirements</td></tr>` : ""}
${pipeMaterial ? `<tr style="background:#fafafa;"><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Pipe Material</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${pipeMaterial}</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">AS/NZS 3500.1 compliant</td></tr>` : ""}
${pipeSize ? `<tr><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Pipe Size / Diameter</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;">${pipeSize} mm</td><td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Sized per Appendix A flow tables</td></tr>` : ""}
</tbody>
</table>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#166534;line-height:1.5;">
  <strong>Measurement Note:</strong> All pressures measured with calibrated gauge at specified test points. Temperatures measured with calibrated thermometer after system stabilised. Flow rates measured at rated outlet conditions per AS/NZS 3500.1.
</div>
</div>
` : ""}

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

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<div style="margin-bottom: 18px;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size: 19px; font-weight: bold; margin-bottom: 10px;">Materials Used</div>
${materials.length === 0 ? '<p style="margin:0;color:#6b7280;">No materials recorded.</p>' : `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f3f4f6;"><th style="padding:7px 10px;text-align:left;border:1px solid #d1d5db;font-family:Helvetica,Arial,sans-serif;">Material</th><th style="padding:7px 10px;text-align:left;border:1px solid #d1d5db;font-family:Helvetica,Arial,sans-serif;">Qty</th><th style="padding:7px 10px;text-align:left;border:1px solid #d1d5db;font-family:Helvetica,Arial,sans-serif;">Brand</th></tr></thead><tbody>${materials.map((m) => `<tr><td style="padding:7px 10px;border:1px solid #d1d5db;font-family:Helvetica,Arial,sans-serif;">${m.name || "—"}</td><td style="padding:7px 10px;border:1px solid #d1d5db;font-family:Helvetica,Arial,sans-serif;">${m.qty || "1"}</td><td style="padding:7px 10px;border:1px solid #d1d5db;font-family:Helvetica,Arial,sans-serif;">${m.brand || "—"}</td></tr>`).join("")}</tbody></table>`}
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

${photo360Html}${floorPlanHtml}${timelineHtml}

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

${clientSignatureSvg ? `
<div style="margin-top: 24px; padding-top: 18px; border-top: 1px dashed #d1d5db; page-break-inside: avoid;">
  <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Client Acknowledgement</div>
  <div style="font-size: 13px; color: #6b7280; margin-bottom: 10px;">The client acknowledges that the work described in this report has been completed to their satisfaction.</div>
  <div style="margin-bottom: 8px;"><strong>Client Signature:</strong></div>
  <img src="data:image/svg+xml;utf8,${encodeURIComponent(clientSignatureSvg)}" style="width:220px; height:70px; object-fit:contain; display:block;" />
  <div style="margin-top: 8px;"><strong>Date:</strong> ${reportDateShort}</div>
</div>
` : ""}

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

// Stage 2 unlock: first-ever report triggers celebration screen
const STAGE2_KEY = "elemetric_stage2_unlocked";
const alreadyUnlocked = await AsyncStorage.getItem(STAGE2_KEY);
if (!alreadyUnlocked) {
  await AsyncStorage.setItem(STAGE2_KEY, "true");
  router.push({
    pathname: "/celebration",
    params: {
      jobAddr: currentJob?.jobAddr ?? "",
      confidence: String(decoded?.confidence ?? 0),
      reportUri: uri,
    },
  });
  setGeneratingPdf(false);
  return;
}

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
Alert.alert("Report Generation Failed", e?.message ?? "Could not generate the PDF report. Ensure all photos are loaded and try again. If this persists, restart the app and regenerate.");
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
Alert.alert("Certificate Failed", e?.message ?? "Could not generate the certificate. Make sure your installer name and licence number are filled in before trying again.");
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
{/* Multi-day timeline — hidden until post-launch */}

{/* ── Confidence Gauge ── */}
<View style={styles.gaugeCard}>
  <View style={{ position: "relative", alignSelf: "center" }}>
    <Svg width={180} height={180}>
      <Circle
        cx={90} cy={90} r={GAUGE_RADIUS}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={GAUGE_SW}
        fill="none"
      />
      <Circle
        cx={90} cy={90} r={GAUGE_RADIUS}
        stroke={gaugeColor}
        strokeWidth={GAUGE_SW}
        fill="none"
        strokeDasharray={`${GAUGE_C} ${GAUGE_C}`}
        strokeDashoffset={gaugeDashOffset}
        strokeLinecap="round"
        rotation="-90"
        originX={90}
        originY={90}
      />
    </Svg>
    <View style={styles.gaugeCenter}>
      <Text style={[styles.gaugeScore, { color: gaugeColor }]}>{confidence}%</Text>
      <Text style={styles.gaugeLabel}>confidence</Text>
    </View>
  </View>

  {/* Risk Banner */}
  <View style={[styles.riskBanner, { backgroundColor: riskBg, borderColor: riskBorderColor }]}>
    <Text style={[styles.riskText, { color: gaugeColor }]}>{riskLabel}</Text>
  </View>

  {/* What this means */}
  <View style={styles.meansCard}>
    <Text style={styles.meansTitle}>What this means</Text>
    <Text style={styles.meansBody}>{getWhatThisMeans()}</Text>
  </View>
</View>

{/* ── Detected Items ── */}
{detected.length > 0 && (
  <View style={styles.breakdownCard}>
    <Text style={[styles.breakdownTitle, { color: "#22c55e" }]}>Detected Items</Text>
    {detected.map((x, i) => (
      <View key={`d-${i}`} style={styles.breakdownRow}>
        <View style={styles.breakdownIconGreen}>
          <Text style={styles.breakdownIconText}>✓</Text>
        </View>
        <Text style={styles.breakdownItemText}>{x}</Text>
      </View>
    ))}
  </View>
)}

{/* ── Missing Items ── */}
{missing.length > 0 && (
  <View style={styles.breakdownCard}>
    <Text style={[styles.breakdownTitle, { color: "#ef4444" }]}>Missing Items</Text>
    {missing.map((x, i) => (
      <View key={`m-${i}`} style={styles.issueRow}>
        <View style={styles.breakdownIconRed}>
          <Text style={styles.breakdownIconText}>✗</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.breakdownItemText}>{x}</Text>
          <Text style={styles.actionHint}>{getItemAction(x, "missing")}</Text>
          <Pressable
            style={styles.retakeBtn}
            onPress={() => router.push({ pathname: "/plumbing/photos", params: { focusItem: x } })}
          >
            <Text style={styles.retakeBtnText}>Retake Photo →</Text>
          </Pressable>
        </View>
      </View>
    ))}
  </View>
)}

{/* ── Unclear Items ── */}
{unclear.length > 0 && (
  <View style={styles.breakdownCard}>
    <Text style={[styles.breakdownTitle, { color: "#f97316" }]}>Unclear Items</Text>
    {unclear.map((x, i) => (
      <View key={`u-${i}`} style={styles.issueRow}>
        <View style={styles.breakdownIconOrange}>
          <Text style={styles.breakdownIconText}>!</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.breakdownItemText}>{x}</Text>
          <Text style={styles.actionHint}>{getItemAction(x, "unclear")}</Text>
          <Pressable
            style={styles.retakeBtn}
            onPress={() => router.push({ pathname: "/plumbing/photos", params: { focusItem: x } })}
          >
            <Text style={styles.retakeBtnText}>Retake Photo →</Text>
          </Pressable>
        </View>
      </View>
    ))}
  </View>
)}

{/* ── Overall Recommended Action ── */}
{!!action && (
  <View style={styles.overallActionCard}>
    <Text style={styles.overallActionLabel}>RECOMMENDED ACTION</Text>
    <Text style={styles.overallActionText}>{action}</Text>
  </View>
)}

{showLegacyAnalysis && (
  <View style={styles.card}>
    <Text style={styles.section}>Analysis</Text>
    <Text style={styles.item}>{decoded!.analysis}</Text>
  </View>
)}

{/* ── 360° Analysis ── */}
{reviewPhotos360.length > 0 && (
  <View style={styles.analysis360Card}>
    <Text style={styles.analysis360Title}>360° Room Analysis</Text>
    {result360 ? (
      <>
        <View style={styles.coverageRow}>
          <CoverageRing score={result360.coverageScore} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.coverageLabel}>Coverage Score</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4 }}>
              Your 360° photo covered {result360.detected.length} of {result360.detected.length + result360.missingFromView.length} checklist items
            </Text>
          </View>
        </View>
        {result360.detected.length > 0 && (
          <View style={styles.analysis360Section}>
            <Text style={styles.analysis360SectionLabel}>Detected in 360° shot</Text>
            {result360.detected.map((x, i) => (
              <Text key={i} style={styles.analysis360Item}>✓ {x}</Text>
            ))}
          </View>
        )}
        {result360.missingFromView.length > 0 && (
          <View style={styles.analysis360Section}>
            <Text style={[styles.analysis360SectionLabel, { color: "#f97316" }]}>Not visible — needs individual photo</Text>
            {result360.missingFromView.map((x, i) => (
              <Text key={i} style={[styles.analysis360Item, { color: "rgba(255,255,255,0.55)" }]}>⚠ {x}</Text>
            ))}
          </View>
        )}
        {result360.recommendedPhotos.length > 0 && (
          <View style={styles.analysis360Section}>
            <Text style={[styles.analysis360SectionLabel, { color: "#f97316" }]}>Recommend additional photos of</Text>
            {result360.recommendedPhotos.map((x, i) => (
              <Text key={i} style={[styles.analysis360Item, { color: "#f97316" }]}>→ {x}</Text>
            ))}
          </View>
        )}
      </>
    ) : (
      <Pressable
        style={[styles.analyze360Btn, loading360 && { opacity: 0.6 }]}
        onPress={analyze360}
        disabled={loading360}
      >
        {loading360
          ? <ActivityIndicator color="#7c3aed" size="small" />
          : <Text style={styles.analyze360BtnText}>Analyse 360° Photos ({reviewPhotos360.length})</Text>
        }
      </Pressable>
    )}
    <Text style={styles.analysis360Hint}>
      360° photos are analysed separately for spatial coverage
    </Text>
  </View>
)}

{/* ── AI Feedback ── */}
<View style={styles.feedbackCard}>
  <Text style={styles.feedbackTitle}>Was this analysis accurate?</Text>

  {feedbackDone ? (
    <View style={styles.feedbackThanks}>
      <Text style={styles.feedbackThanksText}>Thanks for your feedback — it helps improve the AI.</Text>
    </View>
  ) : (
    <>
      <View style={styles.feedbackBtnRow}>
        <Pressable
          style={[styles.feedbackBtn, feedbackRating === "up" && styles.feedbackBtnUpActive]}
          onPress={() => submitFeedback("up")}
          disabled={feedbackSubmitting || feedbackRating !== null}
        >
          <Text style={styles.feedbackBtnEmoji}>👍</Text>
          <Text style={[styles.feedbackBtnText, feedbackRating === "up" && styles.feedbackBtnTextActive]}>
            AI got this right
          </Text>
        </Pressable>

        <Pressable
          style={[styles.feedbackBtn, feedbackRating === "down" && styles.feedbackBtnDownActive]}
          onPress={() => submitFeedback("down")}
          disabled={feedbackSubmitting || feedbackDone}
        >
          <Text style={styles.feedbackBtnEmoji}>👎</Text>
          <Text style={[styles.feedbackBtnText, feedbackRating === "down" && styles.feedbackBtnTextActive]}>
            AI missed something
          </Text>
        </Pressable>
      </View>

      {feedbackRating === "down" && !feedbackDone && (
        <View style={styles.feedbackCommentWrap}>
          <TextInput
            style={styles.feedbackInput}
            placeholder="What did the AI miss? (required)"
            placeholderTextColor="rgba(255,255,255,0.30)"
            value={feedbackComment}
            onChangeText={setFeedbackComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.feedbackSubmitBtn, (!feedbackComment.trim() || feedbackSubmitting) && { opacity: 0.5 }]}
            onPress={submitNegativeFeedback}
            disabled={!feedbackComment.trim() || feedbackSubmitting}
          >
            <Text style={styles.feedbackSubmitText}>
              {feedbackSubmitting ? "Sending…" : "Send Feedback"}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  )}
</View>

{/* ── Plumbing Technical Data (hotwater / newinstall only) ── */}
{(currentJob.type === "hotwater" || currentJob.type === "newinstall") && (
<View style={styles.card}>
  <Text style={styles.fieldLabel}>Plumbing Technical Data</Text>
  <Text style={styles.fieldSub}>AS/NZS 3500 — Record site measurements for the report</Text>
  <View style={styles.techGrid}>
    <View style={styles.techCell}>
      <Text style={styles.techLabel}>Pressure at Meter (kPa)</Text>
      <TextInput style={styles.input} value={waterPressureMeter} onChangeText={setWaterPressureMeter} keyboardType="decimal-pad" placeholder="e.g. 350" placeholderTextColor="rgba(255,255,255,0.30)" />
    </View>
    <View style={styles.techCell}>
      <Text style={styles.techLabel}>Pressure at Fixture (kPa)</Text>
      <TextInput style={styles.input} value={waterPressureFixture} onChangeText={setWaterPressureFixture} keyboardType="decimal-pad" placeholder="e.g. 200" placeholderTextColor="rgba(255,255,255,0.30)" />
    </View>
    <View style={styles.techCell}>
      <Text style={styles.techLabel}>Hot Water Temp (°C)</Text>
      <TextInput style={styles.input} value={hotWaterTemp} onChangeText={setHotWaterTemp} keyboardType="decimal-pad" placeholder="e.g. 65" placeholderTextColor="rgba(255,255,255,0.30)" />
    </View>
    <View style={styles.techCell}>
      <Text style={styles.techLabel}>Cold Water Temp (°C)</Text>
      <TextInput style={styles.input} value={coldWaterTemp} onChangeText={setColdWaterTemp} keyboardType="decimal-pad" placeholder="e.g. 18" placeholderTextColor="rgba(255,255,255,0.30)" />
    </View>
    <View style={styles.techCell}>
      <Text style={styles.techLabel}>Flow Rate (L/min)</Text>
      <TextInput style={styles.input} value={flowRate} onChangeText={setFlowRate} keyboardType="decimal-pad" placeholder="e.g. 12" placeholderTextColor="rgba(255,255,255,0.30)" />
    </View>
    <View style={styles.techCell}>
      <Text style={styles.techLabel}>Pipe Size (mm)</Text>
      <TextInput style={styles.input} value={pipeSize} onChangeText={setPipeSize} keyboardType="decimal-pad" placeholder="e.g. 20" placeholderTextColor="rgba(255,255,255,0.30)" />
    </View>
  </View>
  <Text style={styles.techLabel}>Pipe Material</Text>
  <TextInput style={styles.input} value={pipeMaterial} onChangeText={setPipeMaterial} placeholder="e.g. Copper, PEX, CPVC" placeholderTextColor="rgba(255,255,255,0.30)" />
  <Text style={styles.techLabel}>Installation Standard</Text>
  <TextInput style={styles.input} value={installationStandard} onChangeText={setInstallationStandard} placeholder="e.g. AS/NZS 3500" placeholderTextColor="rgba(255,255,255,0.30)" />
</View>
)}

{/* ── Materials List ── */}
<View style={styles.card}>
  <Text style={styles.fieldLabel}>Materials Used</Text>
  <Text style={styles.fieldSub}>Add materials, quantities, and brands for the report</Text>
  {materials.map((mat) => (
    <View key={mat.id} style={styles.materialRow}>
      <TextInput
        style={[styles.matInput, { flex: 2 }]}
        placeholder="Material name"
        placeholderTextColor="rgba(255,255,255,0.30)"
        value={mat.name}
        onChangeText={(v) => updateMaterial(mat.id, "name", v)}
      />
      <TextInput
        style={[styles.matInput, { width: 52 }]}
        placeholder="Qty"
        placeholderTextColor="rgba(255,255,255,0.30)"
        value={mat.qty}
        onChangeText={(v) => updateMaterial(mat.id, "qty", v)}
        keyboardType="numeric"
      />
      <TextInput
        style={[styles.matInput, { flex: 1.5 }]}
        placeholder="Brand"
        placeholderTextColor="rgba(255,255,255,0.30)"
        value={mat.brand}
        onChangeText={(v) => updateMaterial(mat.id, "brand", v)}
      />
      <Pressable style={styles.matRemove} onPress={() => removeMaterial(mat.id)}>
        <Text style={styles.matRemoveText}>×</Text>
      </Pressable>
    </View>
  ))}
  <Pressable style={styles.matAddBtn} onPress={addMaterial}>
    <Text style={styles.matAddBtnText}>+ Add Material</Text>
  </Pressable>
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

<Pressable style={styles.signatureBtn} onPress={() => router.push({ pathname: "/plumbing/job-summary" })}>
<Text style={styles.signatureText}>Review Summary & Sign →</Text>
</Pressable>

{signatureSvg ? (
<Pressable style={styles.clearBtn} onPress={clearSignature}>
<Text style={styles.clearText}>Remove Saved Signature</Text>
</Pressable>
) : null}

<Pressable
  style={styles.clientSigBtn}
  onPress={() => router.push("/plumbing/client-signature")}
>
  <Text style={styles.clientSigText}>
    {clientSignatureSvg ? "✓ Client Signed — Update" : "Get Client Signature (Optional)"}
  </Text>
</Pressable>

<Pressable
style={styles.reportBtn}
onPress={generateReport}
disabled={generatingPdf}
>
<Text style={styles.reportText}>
{generatingPdf ? "Generating Report..." : "Get My Report"}
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
header: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 8 },
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
gaugeCard: {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.04)",
  padding: 18,
  gap: 14,
  alignItems: "center",
},
gaugeCenter: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: "center",
  justifyContent: "center",
},
gaugeScore: {
  fontSize: 40,
  fontWeight: "900" as const,
},
gaugeLabel: {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  marginTop: 2,
},
riskBanner: {
  borderRadius: 12,
  borderWidth: 1,
  paddingVertical: 10,
  paddingHorizontal: 24,
  alignItems: "center" as const,
  alignSelf: "stretch" as const,
},
riskText: {
  fontWeight: "900" as const,
  fontSize: 18,
  letterSpacing: 2,
},
meansCard: {
  backgroundColor: "rgba(255,255,255,0.04)",
  borderRadius: 12,
  padding: 14,
  gap: 6,
  alignSelf: "stretch" as const,
},
meansTitle: {
  color: "white",
  fontWeight: "800" as const,
  fontSize: 14,
},
meansBody: {
  color: "rgba(255,255,255,0.75)",
  fontSize: 14,
  lineHeight: 20,
},
breakdownCard: {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.04)",
  padding: 18,
  gap: 12,
},
breakdownTitle: {
  fontWeight: "900" as const,
  fontSize: 16,
  marginBottom: 2,
},
breakdownRow: {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
},
issueRow: {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 12,
},
breakdownIconGreen: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "rgba(34,197,94,0.20)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexShrink: 0,
},
breakdownIconRed: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "rgba(239,68,68,0.20)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexShrink: 0,
  marginTop: 2,
},
breakdownIconOrange: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "rgba(249,115,22,0.20)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexShrink: 0,
  marginTop: 2,
},
breakdownIconText: {
  color: "white",
  fontWeight: "900" as const,
  fontSize: 13,
},
breakdownItemText: {
  color: "rgba(255,255,255,0.85)",
  fontSize: 15,
  fontWeight: "700" as const,
},
actionHint: {
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
  lineHeight: 18,
},
retakeBtn: {
  backgroundColor: "rgba(249,115,22,0.20)",
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 14,
  alignSelf: "flex-start" as const,
  borderWidth: 1,
  borderColor: "rgba(249,115,22,0.35)",
},
retakeBtnText: {
  color: "#f97316",
  fontWeight: "900" as const,
  fontSize: 13,
},
overallActionCard: {
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(249,115,22,0.35)",
  backgroundColor: "rgba(249,115,22,0.10)",
  padding: 16,
  gap: 6,
},
overallActionLabel: {
  color: "#f97316",
  fontWeight: "900" as const,
  fontSize: 11,
  letterSpacing: 1,
},
overallActionText: {
  color: "rgba(255,255,255,0.85)",
  fontSize: 15,
  lineHeight: 22,
},
fieldSub: {
  color: "rgba(255,255,255,0.45)",
  fontSize: 12,
  marginTop: -4,
  marginBottom: 4,
},
techGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
techCell: { width: "47%" },
techLabel: { color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 12, marginBottom: 4 },
materialRow: {
  flexDirection: "row",
  gap: 6,
  alignItems: "center",
  marginBottom: 8,
},
matInput: {
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "white",
  paddingHorizontal: 10,
  paddingVertical: 9,
  fontSize: 13,
},
matRemove: {
  width: 32,
  height: 32,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(239,68,68,0.15)",
  borderWidth: 1,
  borderColor: "rgba(239,68,68,0.25)",
},
matRemoveText: {
  color: "#fca5a5",
  fontSize: 18,
  fontWeight: "900",
  marginTop: -1,
},
matAddBtn: {
  borderRadius: 10,
  paddingVertical: 10,
  alignItems: "center",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.05)",
  marginTop: 4,
},
matAddBtnText: {
  color: "rgba(255,255,255,0.75)",
  fontWeight: "800",
  fontSize: 14,
},
clientSigBtn: {
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: "center",
  backgroundColor: "rgba(139,92,246,0.15)",
  borderWidth: 1,
  borderColor: "rgba(139,92,246,0.30)",
},
clientSigText: {
  color: "#c4b5fd",
  fontWeight: "900",
  fontSize: 15,
},
feedbackCard: {
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 18,
gap: 12,
},
feedbackTitle: {
color: "white",
fontWeight: "800",
fontSize: 15,
},
feedbackBtnRow: {
flexDirection: "row",
gap: 10,
},
feedbackBtn: {
flex: 1,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 8,
borderRadius: 12,
paddingVertical: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
backgroundColor: "rgba(255,255,255,0.05)",
},
feedbackBtnUpActive: {
backgroundColor: "rgba(34,197,94,0.18)",
borderColor: "rgba(34,197,94,0.45)",
},
feedbackBtnDownActive: {
backgroundColor: "rgba(239,68,68,0.18)",
borderColor: "rgba(239,68,68,0.45)",
},
feedbackBtnEmoji: {
fontSize: 18,
},
feedbackBtnText: {
color: "rgba(255,255,255,0.65)",
fontWeight: "700",
fontSize: 13,
},
feedbackBtnTextActive: {
color: "white",
},
feedbackCommentWrap: {
gap: 10,
},
feedbackInput: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
backgroundColor: "rgba(255,255,255,0.06)",
color: "white",
paddingHorizontal: 14,
paddingVertical: 12,
fontSize: 14,
minHeight: 80,
},
feedbackSubmitBtn: {
borderRadius: 12,
paddingVertical: 12,
alignItems: "center",
backgroundColor: "#f97316",
},
feedbackSubmitText: {
color: "#0b1220",
fontWeight: "900",
fontSize: 15,
},
feedbackThanks: {
borderRadius: 10,
padding: 14,
backgroundColor: "rgba(34,197,94,0.12)",
borderWidth: 1,
borderColor: "rgba(34,197,94,0.25)",
},
feedbackThanksText: {
color: "#86efac",
fontWeight: "700",
fontSize: 14,
textAlign: "center",
},
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
  analysis360Card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.30)",
    backgroundColor: "rgba(124,58,237,0.08)",
    padding: 18,
    gap: 12,
  },
  analysis360Title: { color: "white", fontWeight: "900", fontSize: 17 },
  coverageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coverageLabel: { color: "rgba(255,255,255,0.65)", fontWeight: "700", fontSize: 14 },
  coverageScore: { fontSize: 28, fontWeight: "900" },
  analysis360Section: { gap: 4 },
  analysis360SectionLabel: { color: "#22c55e", fontWeight: "800", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  analysis360Item: { color: "rgba(255,255,255,0.70)", fontSize: 13 },
  analyze360Btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.40)",
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  analyze360BtnText: { color: "#a78bfa", fontWeight: "900", fontSize: 14 },
  analysis360Hint: { color: "rgba(255,255,255,0.30)", fontSize: 11 },
  dayTimelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    gap: 10,
  },
  dayTimelineTitle: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  dayTimelineRow: { gap: 0, alignItems: "center" },
  dayTimelineItem: { alignItems: "center", position: "relative" },
  dayTimelineConnector: { position: "absolute", left: -12, top: 9, width: 24, height: 2, backgroundColor: "rgba(255,255,255,0.12)" },
  dayTimelineDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  dayTimelineDotLast: { backgroundColor: "#f97316", borderColor: "#f97316" },
  dayTimelineLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", marginTop: 4 },
  dayTimelineDate: { color: "rgba(255,255,255,0.30)", fontSize: 9 },
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
