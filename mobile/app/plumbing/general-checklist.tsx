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

// Maps job type keys → server-side type + subtype for AI prompt routing.
// Electrical subtypes route to per-trade prompts with 20 PASS + 20 FAIL examples.
// HVAC and carpentry subtypes map to their parent trade prompts.
const TYPE_API_MAP: Record<string, { apiType: string; apiSubtype?: string }> = {
  powerpoint:   { apiType: "electrical", apiSubtype: "power_point_installation" },
  lighting:     { apiType: "electrical", apiSubtype: "lighting_installation" },
  switchboard:  { apiType: "electrical", apiSubtype: "switchboard_upgrade" },
  circuit:      { apiType: "electrical", apiSubtype: "circuit_installation" },
  faultfinding: { apiType: "electrical", apiSubtype: "fault_finding" },
  appliance:    { apiType: "electrical", apiSubtype: "appliance_installation" },
  smokealarm:   { apiType: "electrical", apiSubtype: "smoke_alarm_installation" },
  splitsystem:  { apiType: "hvac" },
  ducted:       { apiType: "hvac" },
  refrigerant:  { apiType: "hvac" },
  hvacservice:  { apiType: "hvac" },
  ventilation:  { apiType: "hvac" },
  framing:      { apiType: "carpentry" },
  decking:      { apiType: "carpentry" },
  pergola:      { apiType: "carpentry" },
  door:         { apiType: "carpentry" },
  window:       { apiType: "carpentry" },
  flooring:     { apiType: "carpentry" },
  fixing:       { apiType: "carpentry" },
  woodheater:   { apiType: "carpentry" },
  gasheater:    { apiType: "gas" },
};

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
  const labels: Record<string, string> = {
    electrical: "Electrical", hvac: "HVAC", woodheater: "Wood Heater", gasheater: "Gas Heater",
    powerpoint: "Power Point Installation", lighting: "Lighting Installation",
    switchboard: "Switchboard Upgrade", circuit: "Circuit Installation",
    faultfinding: "Fault Finding", appliance: "Appliance Installation",
    smokealarm: "Smoke Alarm Installation",
    splitsystem: "Split System Installation", ducted: "Ducted System",
    refrigerant: "Refrigerant Piping", hvacservice: "HVAC Maintenance",
    ventilation: "Ventilation Installation",
    framing: "Structural Framing", decking: "Decking",
    pergola: "Pergola / Outdoor Structure", door: "Door Installation",
    window: "Window Installation", flooring: "Flooring", fixing: "Fixing and Finishing",
    carpentry: "Carpentry Documentation",
  };
  return labels[type] ?? (type.charAt(0).toUpperCase() + type.slice(1));
}

function tradeStandard(type: string): string {
  const standards: Record<string, string> = {
    electrical: "AS/NZS 3000", powerpoint: "AS/NZS 3000", lighting: "AS/NZS 3000",
    switchboard: "AS/NZS 3000", circuit: "AS/NZS 3000", faultfinding: "AS/NZS 3000",
    appliance: "AS/NZS 3000", smokealarm: "AS 3786",
    hvac: "AS/NZS 1668", splitsystem: "AS/NZS 5149", ducted: "AS/NZS 1668",
    refrigerant: "AS/NZS 5149", hvacservice: "AS/NZS 1668", ventilation: "AS 1668.2",
    woodheater: "AS/NZS 2918", gasheater: "AS/NZS 5601.1",
    carpentry: "AS 1684", framing: "AS 1684", decking: "AS 1684",
    pergola: "AS 1684", door: "AS 1684", window: "AS 1684",
    flooring: "AS 1684", fixing: "AS 1684",
  };
  return standards[type] ?? "";
}

const SECTION_HINTS: Record<string, string> = {
  overview:   "Wide photo showing the full job site — where you're working and the general condition.",
  work_area:  "Photos of the actual installation area before and after you start work.",
  equipment:  "Photos of the main materials and equipment you're using — brand labels visible if possible.",
  completion: "Photos showing the finished work, all tidy and ready for sign-off.",
  compliance: "Any stickers, certificates, or documentation labels on the installed equipment.",
};

const COMPLIANCE_ITEMS_BY_TYPE: Record<string, string[]> = {
  woodheater: [
    "Clearances to combustibles correct per AS/NZS 2918",
    "Flue system installed correctly — joints sealed",
    "Hearth protection adequate — non-combustible material",
    "Air supply adequate for combustion",
    "Manufacturer installation instructions followed",
    "Smoke test completed — no visible leaks",
    "Carbon monoxide test completed",
  ],
  gasheater: [
    "Gas connection tested and gas tight — no leaks",
    "Flue installed correctly — correct diameter and fall",
    "Clearances adequate to combustibles",
    "Ventilation sufficient for appliance rating",
    "Appliance operating correctly — all burners",
    "Safety devices functional — flame failure, thermostat",
    "Installation complies with AS/NZS 5601.1",
  ],
  electrical: [
    "RCD protection installed and tested — all circuits",
    "All circuit breakers correctly rated",
    "Earth continuity verified on all circuits",
    "Insulation resistance test completed — >1MΩ",
    "Polarity correct on all outlets",
    "Switchboard labelling complete — all circuits identified",
    "Cable support and protection adequate",
  ],
  hvac: [
    "Unit installed per manufacturer specifications",
    "Refrigerant charge documented — weight recorded",
    "Condensate drain falls minimum 1:50 to waste",
    "Electrical disconnect within sight of unit",
    "Commissioning data sheet completed",
    "Airflow measured and recorded",
    "All diffusers and grilles fitted correctly",
  ],
  // ── Electrical subtypes ──────────────────────────────────────────────────────
  powerpoint: [
    "RCD protection installed on circuit — test button confirmed functional (AS/NZS 3000 Cl.2.6)",
    "Correct cable size and type for circuit load (AS/NZS 3000 Table C5)",
    "GPO mounting height compliant — standard outlets 200-400mm from floor (AS/NZS 3000)",
    "Earth continuity tested — green/yellow conductor present (AS/NZS 3000 Cl.5.4)",
    "Correct polarity confirmed — active/neutral not reversed (AS/NZS 3000)",
    "No exposed conductors — all terminations in outlet body (AS/NZS 3000 Cl.3.9)",
    "Circuit labelled in switchboard — outlet location identified (AS/NZS 3000 Cl.8.3)",
  ],
  lighting: [
    "Circuit protective device rated correctly for lighting load (AS/NZS 3000 Cl.2.5)",
    "RCD protection provided for all lighting circuits in wet areas (AS/NZS 3000 Cl.2.6)",
    "Correct cable type for environment — TPS or screened in ceiling (AS/NZS 3000 Cl.3.9)",
    "Earth continuity verified to all fittings (AS/NZS 3000 Cl.5.4)",
    "Switching arrangement correct — single/two-way/multiple as designed (AS/NZS 3000)",
    "Light fittings rated for lamp type installed (AS/NZS 3000 Cl.4.4)",
    "Insulation resistance tested — all circuits above 1 MΩ (AS/NZS 3000 Cl.8.3.7)",
  ],
  switchboard: [
    "All circuits individually labelled — clear and legible (AS/NZS 3000 Cl.8.3)",
    "RCD protection on all final subcircuits — test results recorded (AS/NZS 3000 Cl.2.6)",
    "Neutral and earth bars correctly installed and labelled (AS/NZS 3000 Cl.5.3)",
    "Main switch rated correctly for installation demand (AS/NZS 3000 Cl.2.2)",
    "No live parts accessible — enclosure rating adequate for location (AS/NZS 3000 Cl.2.10)",
    "Earth fault loop impedance tested and recorded (AS/NZS 3000 Cl.8.3.6)",
    "Certificate of Electrical Safety (CES) issued and attached (Energy Safe Victoria)",
  ],
  circuit: [
    "Circuit correctly rated — breaker ampacity matches cable ampacity (AS/NZS 3000 Cl.2.5)",
    "RCD protection installed on new circuit (AS/NZS 3000 Cl.2.6)",
    "Cable route identified — correct support intervals maintained (AS/NZS 3000 Cl.3.9)",
    "Insulation resistance tested — above 1 MΩ (AS/NZS 3000 Cl.8.3.7)",
    "Earth continuity verified throughout circuit (AS/NZS 3000 Cl.5.4)",
    "Circuit clearly labelled in switchboard (AS/NZS 3000 Cl.8.3)",
    "Load test completed — circuit operates correctly under design load (AS/NZS 3000)",
  ],
  faultfinding: [
    "Fault correctly diagnosed — documented in notes",
    "Isolation confirmed before work commenced",
    "Repair carried out — faulty components replaced",
    "All connections remade correctly — no loose terminations",
    "Test after repair — circuit operates correctly",
    "Insulation resistance test post-repair — >1MΩ",
    "RCD tested after repair",
  ],
  appliance: [
    "Appliance correctly connected — dedicated circuit where required (AS/NZS 3000 Cl.4.4)",
    "Isolation switch within sight of appliance — lockable if required (AS/NZS 3000 Cl.4.4)",
    "Earth continuity verified to appliance body (AS/NZS 3000 Cl.5.4)",
    "RCD protection on circuit (AS/NZS 3000 Cl.2.6)",
    "Appliance rated for supply voltage — nameplate confirmed (AS/NZS 3000)",
    "Cable entry protected — no sharp edges on cable entry point (AS/NZS 3000 Cl.3.9)",
    "Appliance complies with AS/NZS equipment standard and has RCM mark",
  ],
  smokealarm: [
    "Smoke alarms positioned per AS 3786 — not within 300mm of wall/corner",
    "Hardwired interconnected alarms on dedicated or lighting circuit (AS 3786)",
    "Alarm placement: every level, each sleeping area, hallway (Residential Tenancies Act 2021 Vic)",
    "Alarm tested — audible alarm confirmed functional (AS 3786 Cl.4.6)",
    "Interconnection tested — triggering one alarm activates all interconnected alarms (AS 3786)",
    "Backup battery present and tested — 9V or sealed 10-year battery (AS 3786)",
    "Installation within 10 years of manufacture date — date code visible (AS 3786)",
  ],
  // ── HVAC subtypes ────────────────────────────────────────────────────────────
  splitsystem: [
    "Indoor unit installed level — condensate drain falls minimum 1:100 toward drain (AS/NZS 5149)",
    "Outdoor unit clearances maintained — minimum 300mm service access all sides (AS/NZS 5149)",
    "Refrigerant line insulation complete — UV-resistant on outdoor sections (AS/NZS 5149)",
    "Condensate drain connected to suitable drain point — no blockages (AS/NZS 5149)",
    "Electrical connection via dedicated circuit with correct isolating switch (AS/NZS 3000)",
    "System commissioned — refrigerant charge checked, operating pressures recorded (AS/NZS 5149)",
    "ARCtick licence number recorded — licence valid for refrigerant handling",
  ],
  ducted: [
    "All supply and return air ducts correctly sized for airflow requirements (AS 1668.1)",
    "Duct insulation R-value adequate — minimum R1.0 in conditioned space (NCC Sec.J)",
    "Diffusers and grilles correctly installed — no obstructions to airflow (AS 1668.1)",
    "Return air path clear — no blocked return air grilles (AS 1668.1)",
    "System commissioned — airflow balanced across all zones (AS 1668.1)",
    "Condensate drain system installed correctly — all units drain freely (AS/NZS 5149)",
    "Filter access panels accessible — filter replacement possible without tools (AS 1668.1)",
  ],
  refrigerant: [
    "Pipe sized correctly for refrigerant circuit",
    "Insulation complete — no gaps, joints taped",
    "Pipe support at correct intervals — max 1.2m horizontal",
    "Leak test completed — pressure held for 30 minutes",
    "Triple evacuation completed before charge",
    "Refrigerant type and charge weight documented",
    "No visible damage to pipe or insulation",
  ],
  hvacservice: [
    "Filters cleaned or replaced — condition recorded in service record (AS 1668.1)",
    "Coils cleaned — evaporator and condenser coil fins undamaged and clear (AS/NZS 5149)",
    "Condensate drain tested — pan drains correctly, no blockages (AS/NZS 5149)",
    "Refrigerant charge checked — operating pressures within manufacturer range (AS/NZS 5149)",
    "Electrical connections checked — no loose terminals or damaged wiring (AS/NZS 3000)",
    "System performance tested — temperature differential recorded at supply/return (AS 1668.1)",
    "Service report completed — signed with ARCtick licence number (AS/NZS 5149)",
  ],
  ventilation: [
    "Fan capacity adequate — minimum airflow rates met for room area (AS 1668.2)",
    "Ductwork correctly sized — velocity within range to avoid excessive noise (AS 1668.2)",
    "External discharge point correctly located — away from openings, bird guard fitted (AS 1668.2)",
    "Fan wired correctly — switched with bathroom/kitchen light or timer (AS/NZS 3000)",
    "Duct insulated where passing through unconditioned space (NCC Sec.J)",
    "System tested — airflow measured and meets minimum 25L/s for bathroom (AS 1668.2)",
    "Backdraft damper installed — prevents reverse airflow when fan is off (AS 1668.2)",
  ],
  // ── Carpentry subtypes ───────────────────────────────────────────────────────
  framing: [
    "Stud spacing correct — max 450mm centres for standard 90x45mm studs (AS 1684)",
    "Bottom plate fixed to slab — anchor bolts or DynaBolts at 1200mm max centres (AS 1684)",
    "Noggins installed at mid-height — correctly nailed with skew nails (AS 1684)",
    "Wall bracing — diagonal strap or plywood sheathing to engineer's spec (AS 1684 Sec.8)",
    "Lintel size correct for opening width — refer to span tables (AS 1684 Table 8.19)",
    "Trimmers and cripples installed correctly around all openings (AS 1684)",
    "Frame plumb, square, and straight — tolerance ≤3mm in 3000mm (AS 1684)",
  ],
  decking: [
    "Joist span within allowable limit for decking species and size (AS 1684 Table H2.2)",
    "Decking boards gapped correctly — 3-5mm gaps for drainage (AS 1684)",
    "Fixings correctly sized — hot-dipped galvanised or stainless steel (AS 1684 Sec.9)",
    "Bearer supports correctly spaced and fixed to posts (AS 1684)",
    "Posts embedded or fixed to footings to engineer's detail (AS 1684)",
    "Handrail height ≥1000mm where deck is ≥1000mm above ground (NCC Sec.3.9.2)",
    "Balustrade infill gaps <125mm — no climbable handholds (NCC Sec.3.9.2)",
  ],
  pergola: [
    "Post footings adequate depth and diameter — minimum 300mm wide × 450mm deep (AS 1684)",
    "Post to beam connection with structural bracket — correctly bolted (AS 1684 Sec.9)",
    "Roof member spans within allowable limits for species and size (AS 1684 span tables)",
    "Diagonal bracing installed to prevent racking — minimum one brace per bay (AS 1684)",
    "Fixings corrosion resistant — hot-dipped galvanised or stainless in outdoor exposure (AS 1684)",
    "Roof purlins or battens correctly spaced for roofing material specified (AS 1684)",
    "Structure plumb and square — checked before fixing roof material (AS 1684)",
  ],
  door: [
    "Door frame plumb — ≤2mm deviation over full height (AS 1684)",
    "Door clearances correct — 3mm sides, 3mm top, 10mm bottom (standard fit-out)",
    "Hinges correctly sized for door weight — three hinges for doors over 40kg (AS 1684)",
    "Door latch and strike plate correctly aligned — latch engages fully (AS 1684)",
    "Frame correctly fixed to trimmer studs — minimum 3 fixings per jamb (AS 1684)",
    "Weatherstrip or door seal installed on external doors (NCC Sec.3.12.1)",
    "Fire door rating correct if required — FRL marked on door and frame",
  ],
  window: [
    "Window flashing correctly installed — head flashing over frame, sill flashing under (AS 1684)",
    "Window frame square and plumb — diagonals equal within 3mm (AS 1684)",
    "Reveals and packing adequate to transfer wind load to structure (AS 1684)",
    "Glazing type correct — safety glass in hazardous locations (AS 1288)",
    "Opening restrictors fitted — child safety restrictor if window >2m from ground (NCC)",
    "Weepholes clear at sill for drainage — minimum 2 weepholes per window (AS 4284)",
    "Frame fixings to structure adequate for wind load — engineer's spec followed (AS 1684)",
  ],
  flooring: [
    "Substrate level and flat — maximum 3mm variation in 1800mm (AS 1884)",
    "Expansion gap maintained around all fixed elements — minimum 10mm (AS 1884)",
    "Correct adhesive or fixing system for flooring product (manufacturer spec)",
    "Subfloor moisture barrier installed where required (AS 1884)",
    "Flooring fixed at correct centres — nail or screw to every joist (AS 1684)",
    "Threshold strip installed at changes of floor level (AS 1884)",
    "Flooring direction correct — perpendicular to joists for structural floors (AS 1684)",
  ],
  fixing: [
    "Architraves mitred and fitted — gaps at mitres <1mm (standard fit-out)",
    "Skirting boards correctly fixed — nail into studs at 600mm max centres (AS 1684)",
    "Door stops correctly positioned — prevents door handle damaging wall (standard)",
    "Reveals and linings flush — tolerance <1mm step between lining and frame (standard)",
    "All hardware (handles, hinges, locks) correctly installed per manufacturer spec",
    "Plasterboard joins taped and set — correct number of coats to trade standard",
    "Paint or stain preparation correct — all knots sealed, surfaces primed (standard)",
  ],
  carpentry: [
    "Wall framing plumb, square and true",
    "Stud spacing correct per engineer / plans",
    "Structural connections and fixings correct",
    "Blocking and nogging installed as required",
    "Bracing adequate and compliant — AS 1684",
    "Roof framing / truss installation correct",
    "Lintels correct size and bearing length",
  ],
};

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
const [complianceChecked, setComplianceChecked] = useState<Record<string, boolean>>({});

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
const { apiType, apiSubtype } = TYPE_API_MAP[jobType] ?? { apiType: jobType };
const res = await fetch(`${API_BASE}/review`, {
method: "POST",
headers: { "Content-Type": "application/json",
        "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "", },
body: JSON.stringify({ type: apiType, ...(apiSubtype ? { subtype: apiSubtype } : {}), images }),
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

${complianceItems.length > 0 ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:12px;font-family:Helvetica,Arial,sans-serif;">Compliance Checklist</div>
<table style="width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;">
${complianceItems.map((item) => `
<tr style="border-bottom:1px solid #e5e7eb;">
  <td style="padding:8px 4px;width:32px;text-align:center;font-size:16px;">${complianceChecked[item] ? "☑" : "☐"}</td>
  <td style="padding:8px;font-size:13px;color:${complianceChecked[item] ? "#111827" : "#6b7280"};">${item}</td>
  <td style="padding:8px;font-size:12px;color:${complianceChecked[item] ? "#16a34a" : "#d97706"};font-weight:bold;text-align:right;">${complianceChecked[item] ? "PASS" : "PENDING"}</td>
</tr>`).join("")}
</table>
</div>` : ""}

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
const complianceItems = COMPLIANCE_ITEMS_BY_TYPE[jobType] ?? [];

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

{complianceItems.length > 0 && (
<View style={styles.section}>
<Text style={styles.sectionTitle}>Compliance Checklist</Text>
<Text style={styles.fieldLabel}>{standard}</Text>
{complianceItems.map((item) => (
<Pressable
key={item}
style={styles.checkRow}
onPress={() => setComplianceChecked((prev) => ({ ...prev, [item]: !prev[item] }))}
>
<View style={[styles.checkbox, complianceChecked[item] && styles.checkboxChecked]}>
{complianceChecked[item] && <Text style={styles.checkMark}>✓</Text>}
</View>
<Text style={styles.checkLabel}>{item}</Text>
</Pressable>
))}
</View>
)}

{SECTIONS.map((sec) => {
const entry = sections[sec.id];
return (
<View key={sec.id} style={styles.sectionCard}>
<Text style={styles.sectionCardTitle}>{sec.label}</Text>
{SECTION_HINTS[sec.id] && <Text style={styles.itemHint}>{SECTION_HINTS[sec.id]}</Text>}

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
{pdfLoading ? "Generating…" : "Get My Report"}
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
loadingText: { color: "rgba(255,255,255,0.55)" },
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
meta: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
standard: { marginTop: 2, color: "rgba(255,255,255,0.35)", fontSize: 12 },
body: { padding: 20, gap: 12, paddingBottom: 40 },
disclaimer: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(249,115,22,0.20)",
padding: 14,
},
disclaimerText: {
color: "#f97316",
fontSize: 13,
fontWeight: "700",
lineHeight: 20,
},
section: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
padding: 16,
gap: 10,
},
sectionTitle: { color: "white", fontWeight: "700", fontSize: 15 },
itemHint: { color: "rgba(255,255,255,0.35)", fontSize: 12, fontStyle: "italic", marginTop: 2, lineHeight: 16 },
fieldLabel: {
color: "rgba(255,255,255,0.35)",
fontWeight: "800",
fontSize: 11,
letterSpacing: 1,
textTransform: "uppercase",
},
checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
checkbox: {
  width: 24, height: 24, borderRadius: 6, borderWidth: 2,
  borderColor: "rgba(255,255,255,0.30)",
  alignItems: "center", justifyContent: "center",
},
checkboxChecked: { borderColor: "#22c55e", backgroundColor: "#22c55e" },
checkMark: { color: "white", fontSize: 14, fontWeight: "900" },
checkLabel: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22 },
input: {
backgroundColor: "#0f2035",
borderRadius: 12,
padding: 14,
color: "white",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
fontSize: 15,
},
bigInput: {
minHeight: 90,
textAlignVertical: "top",
},
sectionCard: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
padding: 14,
gap: 10,
},
sectionCardTitle: { color: "white", fontWeight: "700", fontSize: 15 },
addPhotoBtn: {
backgroundColor: "#f97316",
borderRadius: 14,
height: 52,
alignItems: "center",
justifyContent: "center",
},
addPhotoBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
photoWrap: { position: "relative" },
shieldBadge: { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(34,197,94,0.85)", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
shieldBadgeText: { fontSize: 11 },
photo: { width: 80, height: 80, borderRadius: 12 },
removePhotoBtn: {
position: "absolute",
top: 4, right: 4,
width: 20, height: 20,
borderRadius: 10,
backgroundColor: "rgba(0,0,0,0.7)",
alignItems: "center",
justifyContent: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.20)",
},
removePhotoText: { color: "white", fontSize: 14, fontWeight: "900", marginTop: -1 },
notesInput: {
backgroundColor: "#0f2035",
borderRadius: 12,
padding: 14,
color: "white",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
fontSize: 15,
minHeight: 44,
textAlignVertical: "top",
},
signatureBtn: {
backgroundColor: "rgba(255,255,255,0.06)",
borderRadius: 14,
height: 52,
alignItems: "center",
justifyContent: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
signatureBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
aiBtn: {
backgroundColor: "#f97316",
borderRadius: 14,
height: 56,
alignItems: "center",
justifyContent: "center",
},
aiBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
aiCard: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
padding: 16,
gap: 6,
},
aiCardLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },
aiScore: { color: "#22c55e", fontSize: 44, fontWeight: "900" },
aiAction: { color: "#f97316", fontSize: 15, fontWeight: "700", marginTop: 4 },
aiListTitle: { color: "#22c55e", fontWeight: "700", fontSize: 13, marginTop: 8 },
aiListTitleAmber: { color: "#f97316", fontWeight: "700", fontSize: 13, marginTop: 8 },
aiListTitleRed: { color: "#ef4444", fontWeight: "700", fontSize: 13, marginTop: 8 },
aiItem: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22 },
reportBtn: {
backgroundColor: "#f97316",
borderRadius: 14,
height: 56,
alignItems: "center",
justifyContent: "center",
},
reportBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
back: { marginTop: 6, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
