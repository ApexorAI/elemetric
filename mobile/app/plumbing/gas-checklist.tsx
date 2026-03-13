import React, { useState, useRef, useCallback, useMemo } from "react";
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
PanResponder,
LayoutChangeEvent,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/lib/supabase";

const API_BASE = "https://elemetric-ai-production.up.railway.app";

// ── Checklist data ─────────────────────────────────────────────────────────────

const INSTALLATION_CHECKS = [
{ id: "gastight",      label: "Gastight AS/NZS 5601.1" },
{ id: "accessible",    label: "Accessible for servicing" },
{ id: "isolation",     label: "Isolation valve present" },
{ id: "electrical",    label: "Electrically safe" },
{ id: "certification", label: "Evidence of certification" },
{ id: "restrained",    label: "Adequately restrained" },
{ id: "ventilation",   label: "Ventilation adequate" },
{ id: "clearances",    label: "Clearances OK" },
{ id: "cowl",          label: "Cowl and flue terminal OK" },
{ id: "flue",          label: "Flue supported and sealed" },
{ id: "scorching",     label: "Scorching and overheating check" },
{ id: "heat_exchanger","label": "Heat exchanger OK" },
{ id: "gas_tight",     label: "Gas fitting line tested and gas tight" },
{ id: "cleaned",       label: "Appliance cleaned of dust and debris" },
{ id: "pressures",     label: "Gas supply and appliance operating pressures correct" },
{ id: "flames",        label: "Burner flames normal" },
{ id: "operating",     label: "Appliance operating correctly including all safety devices" },
] as const;

const SERVICING_CHECKS = [
{ id: "serviced",       label: "Serviced this visit" },
{ id: "operating_test", label: "Operating test" },
{ id: "spillage",       label: "Spillage test" },
{ id: "co_test",        label: "CO test" },
{ id: "pressure_test",  label: "Pressure test" },
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "na" | null;
type Point = { x: number; y: number };
type Stroke = Point[];

type InstallEntry = {
status: CheckStatus;
notes: string;
photoUris: string[];
};

type ServiceEntry = {
status: CheckStatus;
reading: string;
};

type AIResult = {
relevant?: boolean;
confidence?: number;
detected?: string[];
unclear?: string[];
missing?: string[];
action?: string;
analysis?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusLabel = (s: CheckStatus) => {
if (s === "pass") return "Y";
if (s === "fail") return "N";
if (s === "na")   return "N/A";
return "—";
};

const statusHtmlColor = (s: CheckStatus) => {
if (s === "pass") return "#16a34a";
if (s === "fail") return "#dc2626";
if (s === "na")   return "#6b7280";
return "#374151";
};

const strokesToSvg = (strokes: Stroke[], w: number, h: number): string => {
const paths = strokes
.map((stroke) => {
if (!stroke.length) return "";
const d = stroke.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
return `<path d="${d}" stroke="#111827" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
})
.join("");
return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="white"/>${paths}</svg>`;
};

// ── SignaturePad ───────────────────────────────────────────────────────────────

function SignaturePad({
strokes,
setStrokes,
onScrollLock,
}: {
strokes: Stroke[];
setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
onScrollLock: (enabled: boolean) => void;
}) {
const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
const [padW, setPadW] = useState(300);
const [padH, setPadH] = useState(160);
const drawingRef   = useRef(false);
const strokeRef    = useRef<Point[]>([]);
const padWRef      = useRef(300);
const padHRef      = useRef(160);
const lockRef      = useRef(onScrollLock);
lockRef.current    = onScrollLock;

const panResponder = useMemo(
() =>
PanResponder.create({
onStartShouldSetPanResponder: () => true,
onMoveShouldSetPanResponder:  () => true,
onPanResponderGrant: (evt) => {
const { locationX, locationY } = evt.nativeEvent;
const pt = {
x: Math.max(0, Math.min(padWRef.current, locationX)),
y: Math.max(0, Math.min(padHRef.current, locationY)),
};
drawingRef.current  = true;
strokeRef.current   = [pt];
setCurrentStroke([pt]);
lockRef.current(false);
},
onPanResponderMove: (evt) => {
if (!drawingRef.current) return;
const { locationX, locationY } = evt.nativeEvent;
const pt = {
x: Math.max(0, Math.min(padWRef.current, locationX)),
y: Math.max(0, Math.min(padHRef.current, locationY)),
};
strokeRef.current = [...strokeRef.current, pt];
setCurrentStroke([...strokeRef.current]);
},
onPanResponderRelease: () => {
if (strokeRef.current.length) {
setStrokes((prev) => [...prev, [...strokeRef.current]]);
}
strokeRef.current  = [];
setCurrentStroke([]);
drawingRef.current = false;
lockRef.current(true);
},
onPanResponderTerminate: () => {
strokeRef.current  = [];
setCurrentStroke([]);
drawingRef.current = false;
lockRef.current(true);
},
}),
// eslint-disable-next-line react-hooks/exhaustive-deps
[]
);

const toPath = (stroke: Stroke) => {
if (!stroke.length) return "";
if (stroke.length === 1)
return `M ${stroke[0].x} ${stroke[0].y} L ${stroke[0].x + 0.1} ${stroke[0].y + 0.1}`;
return stroke.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
};

const allStrokes = [...strokes, ...(currentStroke.length ? [currentStroke] : [])];

return (
<View style={sigStyles.wrap}>
<View
style={sigStyles.pad}
onLayout={(e: LayoutChangeEvent) => {
padWRef.current = e.nativeEvent.layout.width;
padHRef.current = e.nativeEvent.layout.height;
setPadW(e.nativeEvent.layout.width);
setPadH(e.nativeEvent.layout.height);
}}
{...panResponder.panHandlers}
>
<Svg width="100%" height="100%">
{allStrokes.map((s, i) => (
<Path
key={i}
d={toPath(s)}
stroke="#111827"
strokeWidth={2.5}
fill="none"
strokeLinecap="round"
strokeLinejoin="round"
/>
))}
</Svg>
</View>
<Pressable
style={sigStyles.clearBtn}
onPress={() => { setStrokes([]); setCurrentStroke([]); }}
>
<Text style={sigStyles.clearText}>Clear</Text>
</Pressable>
</View>
);
}

const sigStyles = StyleSheet.create({
wrap: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
overflow: "hidden",
},
pad: {
height: 160,
backgroundColor: "white",
},
clearBtn: {
padding: 10,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
},
clearText: {
color: "rgba(255,255,255,0.55)",
fontWeight: "700",
fontSize: 13,
},
});

// ── Status button row ──────────────────────────────────────────────────────────

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

// ── Main screen ────────────────────────────────────────────────────────────────

export default function GasChecklist() {
const router      = useRouter();
const scrollRef   = useRef<ScrollView>(null);
const [scrollEnabled, setScrollEnabled] = useState(true);
const [loaded,        setLoaded]        = useState(false);

// Job
const [jobName, setJobNameState] = useState("Untitled Job");
const [jobAddr, setJobAddrState] = useState("No address");

// Gas fitter details
const [licenceNumber,     setLicenceNumber]     = useState("");
const [supervisingName,   setSupervisingName]   = useState("");
const [registrationNumber,setRegistrationNumber]= useState("");

// Appliance details
const [applianceLocation, setApplianceLocation] = useState("");
const [applianceType,     setApplianceType]     = useState("");
const [applianceMakeModel,setApplianceMakeModel]= useState("");
const [nextServiceDate,   setNextServiceDate]   = useState("");

// GPS
const [gpsCoords,  setGpsCoords]  = useState<{ lat: number; lng: number } | null>(null);
const [gpsLoading, setGpsLoading] = useState(false);

// Profile (for PDF)
const [profileCompany, setProfileCompany] = useState("");

// Checklist state
const [installChecks, setInstallChecks] = useState<Record<string, InstallEntry>>(() =>
Object.fromEntries(
INSTALLATION_CHECKS.map((c) => [c.id, { status: null, notes: "", photoUris: [] }])
)
);
const [serviceChecks, setServiceChecks] = useState<Record<string, ServiceEntry>>(() =>
Object.fromEntries(
SERVICING_CHECKS.map((c) => [c.id, { status: null, reading: "" }])
)
);

// Signatures
const [gasFitterStrokes, setGasFitterStrokes]   = useState<Stroke[]>([]);
const [supervisorStrokes,setSupervisorStrokes]  = useState<Stroke[]>([]);
const [sigW, setSigW] = useState(300);

// AI
const [aiLoading, setAiLoading] = useState(false);
const [aiResult,  setAiResult]  = useState<AIResult | null>(null);

// PDF
const [pdfLoading, setPdfLoading] = useState(false);

// ── Load job ─────────────────────────────────────────────────────────────────

useFocusEffect(
useCallback(() => {
let active = true;
(async () => {
try {
const raw = await AsyncStorage.getItem("elemetric_current_job");
if (raw && active) {
const j = JSON.parse(raw);
setJobNameState(j.jobName || "Untitled Job");
setJobAddrState(j.jobAddr  || "No address");
}
} catch {}

// Load profile to pre-fill gas fitter details and PDF
try {
const { data: { user } } = await supabase.auth.getUser();
if (user && active) {
const { data } = await supabase
.from("profiles")
.select("full_name, licence_number, company_name")
.eq("user_id", user.id)
.single();
if (data && active) {
if (data.company_name) setProfileCompany(data.company_name);
if (data.licence_number) setLicenceNumber((prev) => prev || data.licence_number);
}
}
} catch {}

if (active) setLoaded(true);
})();
return () => { active = false; };
}, [])
);

// ── GPS ───────────────────────────────────────────────────────────────────────

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
} catch (e: any) {
Alert.alert("GPS Error", e?.message ?? "Could not get location.");
} finally {
setGpsLoading(false);
}
};

// ── Photos ────────────────────────────────────────────────────────────────────

const addPhoto = async (checkId: string) => {
try {
const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access."); return; }
const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
quality: 1,
});
if (result.canceled) return;
const uri = result.assets?.[0]?.uri;
if (!uri) return;
setInstallChecks((prev) => ({
...prev,
[checkId]: { ...prev[checkId], photoUris: [...prev[checkId].photoUris, uri] },
}));
} catch (e: any) {
Alert.alert("Photo error", e?.message ?? "Unknown error");
}
};

const removePhoto = (checkId: string, uri: string) => {
setInstallChecks((prev) => ({
...prev,
[checkId]: {
...prev[checkId],
photoUris: prev[checkId].photoUris.filter((u) => u !== uri),
},
}));
};

const setInstallStatus = (id: string, s: CheckStatus) =>
setInstallChecks((prev) => ({ ...prev, [id]: { ...prev[id], status: s } }));

const setInstallNotes = (id: string, notes: string) =>
setInstallChecks((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));

const setServiceStatus = (id: string, s: CheckStatus) =>
setServiceChecks((prev) => ({ ...prev, [id]: { ...prev[id], status: s } }));

const setServiceReading = (id: string, reading: string) =>
setServiceChecks((prev) => ({ ...prev, [id]: { ...prev[id], reading } }));

// ── AI analysis ───────────────────────────────────────────────────────────────

const runAI = async () => {
const allPhotos: { label: string; uri: string }[] = [];
for (const c of INSTALLATION_CHECKS) {
for (const uri of installChecks[c.id]?.photoUris ?? []) {
allPhotos.push({ label: c.label, uri });
}
}
if (!allPhotos.length) {
Alert.alert("No photos", "Add at least one photo to run AI analysis.");
return;
}
setAiLoading(true);
try {
const images: { mime: string; data: string; label: string }[] = [];
for (const p of allPhotos) {
const r = await ImageManipulator.manipulateAsync(p.uri, [], {
compress: 0.8,
format: ImageManipulator.SaveFormat.JPEG,
base64: true,
});
if (r.base64) images.push({ mime: "image/jpeg", data: r.base64, label: p.label });
}
const res = await fetch(`${API_BASE}/review`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: "gas", images }),
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

// ── PDF ───────────────────────────────────────────────────────────────────────

const generateReport = async () => {
setPdfLoading(true);
try {
const now        = new Date();
const dateStr    = now.toLocaleString();
const dateShort  = now.toLocaleDateString();
const td = `border:1px solid #d1d5db;padding:8px;`;
const th = `${td}background:#f3f4f6;text-align:left;`;

const gasSvg = gasFitterStrokes.length
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(strokesToSvg(gasFitterStrokes, sigW, 160))}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
: `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

const supSvg = supervisorStrokes.length
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(strokesToSvg(supervisorStrokes, sigW, 160))}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
: `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

const installRows = INSTALLATION_CHECKS.map((c) => {
const e = installChecks[c.id];
const lbl = statusLabel(e?.status ?? null);
const col = statusHtmlColor(e?.status ?? null);
return `<tr>
<td style="${td}">${c.label}</td>
<td style="${td}font-weight:bold;color:${col};">${lbl}</td>
<td style="${td}">${e?.notes || ""}</td>
</tr>`;
}).join("");

const serviceRows = SERVICING_CHECKS.map((c) => {
const e = serviceChecks[c.id];
const lbl = statusLabel(e?.status ?? null);
const col = statusHtmlColor(e?.status ?? null);
return `<tr>
<td style="${td}">${c.label}</td>
<td style="${td}font-weight:bold;color:${col};">${lbl}</td>
<td style="${td}">${e?.reading || ""}</td>
</tr>`;
}).join("");

const aiSection = aiResult ? `
<div style="margin-bottom:16px;border:1px solid #e5e7eb;padding:16px;background:#f9fafb;">
<div style="font-size:17px;font-weight:bold;margin-bottom:8px;">AI Analysis</div>
<div style="font-size:30px;font-weight:bold;">${aiResult.confidence ?? 0}%</div>
<div style="margin-top:6px;"><strong>Action:</strong> ${aiResult.action || "—"}</div>
<div style="margin-top:4px;">${aiResult.analysis || ""}</div>
</div>` : "";

const html = `<html>
<body style="font-family:Arial,sans-serif;padding:0;margin:0;color:#111827;background:#fff;">

<div style="background:#f97316;color:white;padding:20px 24px;">
<div style="font-size:24px;font-weight:bold;letter-spacing:1px;">ELEMETRIC</div>
<div style="font-size:13px;margin-top:4px;">Gas Rough-In Compliance Report — AS/NZS 5601.1:2013 &amp; AS 4575:2019</div>
</div>

<div style="padding:22px;">

<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:180px;"><strong>Job Name</strong></td><td>${jobName}</td></tr>
<tr><td style="padding:5px 0;"><strong>Address</strong></td><td>${jobAddr}</td></tr>
<tr><td style="padding:5px 0;"><strong>Report Date</strong></td><td>${dateStr}</td></tr>
<tr><td style="padding:5px 0;"><strong>GPS Coordinates</strong></td><td>${gpsCoords ? `${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}` : "Not recorded"}</td></tr>
</table>
</div>

<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Gas Fitter Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:180px;"><strong>Licence Number</strong></td><td>${licenceNumber || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Company</strong></td><td>${profileCompany || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Supervising Gas Fitter</strong></td><td>${supervisingName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Registration Number</strong></td><td>${registrationNumber || "Not entered"}</td></tr>
</table>
</div>

<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Appliance Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:180px;"><strong>Location</strong></td><td>${applianceLocation || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Type</strong></td><td>${applianceType || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Make / Model</strong></td><td>${applianceMakeModel || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Next Service Due</strong></td><td>${nextServiceDate || "Not entered"}</td></tr>
</table>
</div>

${aiSection}

<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Installation Checks — AS/NZS 5601.1:2013</div>
<table style="width:100%;border-collapse:collapse;">
<tr>
<th style="${th}width:55%;">Check Item</th>
<th style="${th}width:8%;">Result</th>
<th style="${th}">Notes / Reading</th>
</tr>
${installRows}
</table>
</div>

<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Servicing Checks — AS 4575:2019</div>
<table style="width:100%;border-collapse:collapse;">
<tr>
<th style="${th}width:45%;">Check Item</th>
<th style="${th}width:8%;">Result</th>
<th style="${th}">Reading / Notes</th>
</tr>
${serviceRows}
</table>
</div>

<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;page-break-inside:avoid;">
<div style="font-size:18px;font-weight:bold;margin-bottom:16px;">Signatures</div>
<div style="display:flex;gap:48px;flex-wrap:wrap;">
<div>
<div style="margin-bottom:8px;"><strong>Gas Fitter</strong></div>
${gasSvg}
<div style="margin-top:6px;font-size:12px;color:#6b7280;">Licence: ${licenceNumber || "Not entered"}</div>
<div style="margin-top:4px;font-size:13px;"><strong>Date:</strong> ${dateShort}</div>
</div>
<div>
<div style="margin-bottom:8px;"><strong>Supervising Gas Fitter</strong></div>
${supSvg}
<div style="margin-top:6px;font-size:12px;color:#6b7280;">${supervisingName || "Name not entered"}</div>
<div style="margin-top:4px;font-size:13px;"><strong>Date:</strong> ${dateShort}</div>
</div>
</div>
</div>

<div style="margin-top:24px;font-size:11px;color:#6b7280;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:12px;">
This report is a documentation aid only. Final compliance responsibility rests with the licensed gas fitter. Elemetric AI analysis does not replace statutory obligations under AS/NZS 5601.1:2013.
</div>

</div>
</body>
</html>`;

const { uri } = await Print.printToFileAsync({ html });
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: "Share Gas Compliance Report",
UTI: "com.adobe.pdf",
});
} else {
Alert.alert("PDF Created", `Saved to: ${uri}`);
}
} catch (e: any) {
Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
} finally {
setPdfLoading(false);
}
};

// ── Render ────────────────────────────────────────────────────────────────────

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
<Text style={styles.title}>Gas Rough-In Checklist</Text>
<Text style={styles.meta}>{jobName} • {jobAddr}</Text>
<Text style={styles.standard}>AS/NZS 5601.1:2013 &amp; AS 4575:2019</Text>
</View>

<ScrollView
ref={scrollRef}
scrollEnabled={scrollEnabled}
contentContainerStyle={styles.body}
showsVerticalScrollIndicator={false}
>

{/* ── Gas Fitter Details ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Gas Fitter Details</Text>
<Text style={styles.fieldLabel}>Licence Number</Text>
<TextInput style={styles.input} value={licenceNumber} onChangeText={setLicenceNumber} placeholderTextColor="#555" />
<Text style={styles.fieldLabel}>Supervising Gas Fitter Name</Text>
<TextInput style={styles.input} value={supervisingName} onChangeText={setSupervisingName} placeholderTextColor="#555" />
<Text style={styles.fieldLabel}>Registration Number</Text>
<TextInput style={styles.input} value={registrationNumber} onChangeText={setRegistrationNumber} placeholderTextColor="#555" />
</View>

{/* ── Appliance Details ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Appliance Details</Text>
<Text style={styles.fieldLabel}>Location</Text>
<TextInput style={styles.input} value={applianceLocation} onChangeText={setApplianceLocation} placeholderTextColor="#555" />
<Text style={styles.fieldLabel}>Type</Text>
<TextInput style={styles.input} value={applianceType} onChangeText={setApplianceType} placeholderTextColor="#555" />
<Text style={styles.fieldLabel}>Make / Model</Text>
<TextInput style={styles.input} value={applianceMakeModel} onChangeText={setApplianceMakeModel} placeholderTextColor="#555" />
<Text style={styles.fieldLabel}>Next Service Due</Text>
<TextInput style={styles.input} value={nextServiceDate} onChangeText={setNextServiceDate} placeholder="DD/MM/YYYY" placeholderTextColor="#555" />
</View>

{/* ── GPS ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>GPS Location</Text>
<Pressable style={styles.gpsBtn} onPress={captureGPS} disabled={gpsLoading}>
{gpsLoading
? <ActivityIndicator color="white" />
: <Text style={styles.gpsBtnText}>Capture GPS Location</Text>
}
</Pressable>
{gpsCoords && (
<Text style={styles.gpsResult}>
{gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
</Text>
)}
</View>

{/* ── Installation Checks ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Installation Checks</Text>
<Text style={styles.sectionSub}>AS/NZS 5601.1:2013</Text>
{INSTALLATION_CHECKS.map((check) => {
const entry = installChecks[check.id];
return (
<View key={check.id} style={styles.checkCard}>
<Text style={styles.checkLabel}>{check.label}</Text>
<StatusButtons id={check.id} status={entry.status} onSet={setInstallStatus} />
<TextInput
style={styles.notesInput}
value={entry.notes}
onChangeText={(t) => setInstallNotes(check.id, t)}
placeholder="Notes / reading"
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
</View>

{/* ── Servicing Checks ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Servicing Checks</Text>
<Text style={styles.sectionSub}>AS 4575:2019</Text>
{SERVICING_CHECKS.map((check) => {
const entry = serviceChecks[check.id];
return (
<View key={check.id} style={styles.checkCard}>
<Text style={styles.checkLabel}>{check.label}</Text>
<StatusButtons id={check.id} status={entry.status} onSet={setServiceStatus} />
<TextInput
style={styles.notesInput}
value={entry.reading}
onChangeText={(t) => setServiceReading(check.id, t)}
placeholder="Reading / notes"
placeholderTextColor="#555"
multiline
/>
</View>
);
})}
</View>

{/* ── Gas Fitter Signature ── */}
<View
style={styles.section}
onLayout={(e) => setSigW(e.nativeEvent.layout.width - 32)}
>
<Text style={styles.sectionTitle}>Gas Fitter Signature</Text>
<SignaturePad
strokes={gasFitterStrokes}
setStrokes={setGasFitterStrokes}
onScrollLock={setScrollEnabled}
/>
</View>

{/* ── Supervising Gas Fitter Signature ── */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Supervising Gas Fitter Signature</Text>
<SignaturePad
strokes={supervisorStrokes}
setStrokes={setSupervisorStrokes}
onScrollLock={setScrollEnabled}
/>
</View>

{/* ── AI Analysis ── */}
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
<Text style={styles.aiListTitle}>Verified</Text>
{aiResult.detected.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
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

{/* ── Generate Report ── */}
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

// ── Styles ─────────────────────────────────────────────────────────────────────

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

header: {
paddingTop: 18,
paddingHorizontal: 18,
paddingBottom: 8,
},
brand:    { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title:    { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
meta:     { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 13 },
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
gpsResult:  { color: "#22c55e", fontSize: 13, fontWeight: "700" },

checkCard: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
backgroundColor: "rgba(255,255,255,0.03)",
padding: 14,
gap: 10,
},
checkLabel: { color: "white", fontWeight: "800", fontSize: 14, lineHeight: 20 },

statusRow:       { flexDirection: "row", gap: 8 },
statusBtn: {
flex: 1,
paddingVertical: 8,
borderRadius: 8,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
sBtnPass:        { backgroundColor: "rgba(22,163,74,0.25)", borderColor: "rgba(22,163,74,0.5)" },
sBtnFail:        { backgroundColor: "rgba(220,38,38,0.25)", borderColor: "rgba(220,38,38,0.5)" },
sBtnNA:          { backgroundColor: "rgba(107,114,128,0.25)", borderColor: "rgba(107,114,128,0.5)" },
statusBtnText:   { color: "rgba(255,255,255,0.5)", fontWeight: "800", fontSize: 13 },
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

addPhotoBtn:     { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
addPhotoBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 13 },

photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
photoWrap: { position: "relative" },
photo:     { width: 80, height: 80, borderRadius: 8 },
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
aiBtnText:  { color: "white", fontWeight: "900", fontSize: 15 },
loadingRow: { flexDirection: "row", alignItems: "center" },

aiCard: {
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 16,
gap: 8,
},
aiCardLabel:    { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 13 },
aiScore:        { color: "#22c55e", fontSize: 44, fontWeight: "900" },
aiAction:       { color: "#f97316", fontWeight: "900", fontSize: 15 },
aiListTitle:    { color: "#22c55e", fontWeight: "900", fontSize: 14, marginTop: 4 },
aiListTitleRed: { color: "#f87171", fontWeight: "900", fontSize: 14, marginTop: 4 },
aiItem:         { color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 20 },

reportBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(34,197,94,0.18)",
borderWidth: 1,
borderColor: "rgba(34,197,94,0.40)",
},
reportBtnText: { color: "white", fontWeight: "900", fontSize: 16 },

back:     { marginTop: 6, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
});
