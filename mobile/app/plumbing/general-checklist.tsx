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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

const SIGNATURE_KEY = "elemetric_signature_svg";

const SECTIONS = [
{ id: "overview",     label: "Site Overview" },
{ id: "work_area",    label: "Work Area / Installation" },
{ id: "equipment",    label: "Equipment / Materials" },
{ id: "completion",   label: "Completed Work" },
{ id: "compliance",   label: "Labels / Documentation" },
] as const;

type Section = { photoUris: string[]; notes: string };

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
const [generalNotes, setGeneralNotes] = useState("");
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
setSections((prev) => ({
...prev,
[sectionId]: { ...prev[sectionId], photoUris: [...prev[sectionId].photoUris, uri] },
}));
} catch (e: any) {
Alert.alert("Photo error", e?.message ?? "Unknown error");
}
};

const removePhoto = (sectionId: string, uri: string) =>
setSections((prev) => ({
...prev,
[sectionId]: {
...prev[sectionId],
photoUris: prev[sectionId].photoUris.filter((u) => u !== uri),
},
}));

const setNotes = (sectionId: string, notes: string) =>
setSections((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], notes } }));

const generateReport = async () => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
setPdfLoading(true);
try {
const now = new Date();
const dateStr = now.toLocaleString();
const dateShort = now.toLocaleDateString();
const label = tradeLabel(jobType);
const standard = tradeStandard(jobType);

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
<div style="font-size:15px;font-weight:bold;margin-bottom:8px;color:#111827;">${sec.label}</div>
${photoImgs ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">${photoImgs}</div>` : ""}
${notes ? `<div style="font-size:13px;color:#374151;line-height:1.5;">${notes}</div>` : ""}
</div>`;
}).filter(Boolean).join("");

const sigHtml = signatureSvg
? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(signatureSvg)}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
: `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

const html = `<html><head><style>@page{margin:15mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}@bottom-left{content:"ELEMETRIC \00B7 Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}}body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}</style></head>
<body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;">${label} Documentation Report${standard ? " · " + standard : ""}</div>
<div style="font-size:12px;">${dateShort}</div>
</div>

<div style="padding:22px;">

<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:160px;"><strong>Job Name</strong></td><td>${jobName}</td></tr>
<tr><td style="padding:5px 0;"><strong>Address</strong></td><td>${jobAddr}</td></tr>
<tr><td style="padding:5px 0;"><strong>Trade</strong></td><td>${label}</td></tr>
<tr><td style="padding:5px 0;"><strong>Tradesperson</strong></td><td>${tradesperson || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Licence Number</strong></td><td>${licenceNumber || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Company</strong></td><td>${companyName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;"><strong>Report Date</strong></td><td>${dateStr}</td></tr>
</table>
</div>

${sectionHtml ? `
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:12px;">Documentation Photos</div>
${sectionHtml}
</div>` : ""}

${generalNotes ? `
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:8px;">General Notes</div>
<div style="font-size:14px;line-height:1.6;color:#374151;">${generalNotes}</div>
</div>` : ""}

<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;">
<div style="font-size:18px;font-weight:bold;margin-bottom:12px;">Sign-Off</div>
<div style="margin-bottom:8px;"><strong>Tradesperson:</strong> ${tradesperson || "Not entered"}</div>
${sigHtml}
<div style="margin-top:6px;font-size:13px;"><strong>Date:</strong> ${dateShort}</div>
</div>

<div style="margin-top:24px;font-size:11px;color:#6b7280;line-height:1.6;background:#fef3c7;padding:12px;border-radius:6px;border:1px solid #fcd34d;">
<strong style="color:#92400e;">IMPORTANT:</strong> This report is a general documentation record only. AI compliance validation is not available for this trade type. Always consult the relevant Australian standard.
</div>

</div>
</body>
</html>`;

const { uri } = await Print.printToFileAsync({ html });
try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: `Share ${label} Documentation Report`,
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
{entry.photoUris.map((uri, i) => (
<View key={`${sec.id}-${i}`} style={styles.photoWrap}>
<Image source={{ uri }} style={styles.photo} />
<Pressable
style={styles.removePhotoBtn}
onPress={() => removePhoto(sec.id, uri)}
>
<Text style={styles.removePhotoText}>×</Text>
</Pressable>
</View>
))}
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
