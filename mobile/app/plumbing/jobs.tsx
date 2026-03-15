import React, { useCallback, useState, useMemo } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
Alert,
TextInput,
RefreshControl,
ActivityIndicator,
Platform,
} from "react-native";
import { SkeletonJobCard } from "@/components/SkeletonLoader";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "qrcode";

type SavedJob = {
id: string;
jobType: string;
jobName: string;
jobAddr: string;
confidence: number;
relevant: boolean;
detected: string[];
unclear: string[];
missing: string[];
action: string;
createdAt: string;
status?: string;
};

type FilterKey = "all" | "hotwater" | "gas" | "drainage" | "newinstall" | "electrical" | "hvac";

const FILTERS: { key: FilterKey; label: string }[] = [
{ key: "all",        label: "All" },
{ key: "hotwater",   label: "Plumbing" },
{ key: "gas",        label: "Gas" },
{ key: "drainage",   label: "Drainage" },
{ key: "newinstall", label: "New Install" },
{ key: "electrical", label: "Electrical" },
{ key: "hvac",       label: "HVAC" },
];

const JOB_TYPE_LABELS: Record<string, string> = {
hotwater:   "Plumbing",
gas:        "Gas Rough-In",
drainage:   "Drainage",
newinstall: "New Install",
electrical: "Electrical",
hvac:       "HVAC",
carpentry:  "Carpentry",
};

const JOB_TYPE_ICONS: Record<string, string> = {
hotwater:   "🔧",
gas:        "🔥",
drainage:   "🚿",
newinstall: "🏗️",
electrical: "⚡",
hvac:       "❄️",
carpentry:  "🪚",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
unassigned: { label: "UNASSIGNED", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.25)", text: "#9ca3af" },
assigned:   { label: "ASSIGNED",   bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.30)",  text: "#60a5fa" },
in_progress:{ label: "IN PROGRESS",bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.30)",  text: "#f97316" },
completed:  { label: "COMPLETED",  bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.30)",   text: "#22c55e" },
};

const StatusBadge = React.memo(function StatusBadge({ status }: { status?: string }) {
const cfg = STATUS_CONFIG[status ?? "unassigned"] ?? STATUS_CONFIG.unassigned;
return (
<View style={[statusBadgeStyles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
<Text style={[statusBadgeStyles.text, { color: cfg.text }]}>{cfg.label}</Text>
</View>
);
});

const statusBadgeStyles = StyleSheet.create({
badge: {
alignSelf: "flex-start",
borderRadius: 8,
paddingHorizontal: 8,
paddingVertical: 3,
borderWidth: 1,
},
text: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
});

export default function JobsScreen() {
const router = useRouter();
const [jobs, setJobs] = useState<SavedJob[]>([]);
const [search, setSearch] = useState("");
const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
const [refreshing, setRefreshing] = useState(false);
const [sharingJobId, setSharingJobId] = useState<string | null>(null);
const [dateFrom, setDateFrom] = useState<Date | null>(null);
const [dateTo, setDateTo] = useState<Date | null>(null);
const [showFromPicker, setShowFromPicker] = useState(false);
const [showToPicker, setShowToPicker] = useState(false);
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkExporting, setBulkExporting] = useState(false);
const [loading, setLoading] = useState(true);

const loadJobs = async () => {
try {
const { data: { user } } = await supabase.auth.getUser();
if (user) {
const { data, error } = await supabase
.from("jobs")
.select("*")
.eq("user_id", user.id)
.order("created_at", { ascending: false });

if (!error && data) {
const remoteJobs: SavedJob[] = data.map((row: any) => ({
id: row.id,
jobType: row.job_type,
jobName: row.job_name,
jobAddr: row.job_addr,
confidence: row.confidence,
relevant: row.relevant,
detected: row.detected ?? [],
unclear: row.unclear ?? [],
missing: row.missing ?? [],
action: row.action ?? "",
createdAt: row.created_at,
status: row.status ?? "unassigned",
}));
setJobs(remoteJobs);
setLoading(false);
return;
}
}
} catch {
// Fall through to local fallback
}

try {
const existing = await AsyncStorage.getItem("elemetric_jobs");
const parsed = existing ? JSON.parse(existing) : [];
setJobs(parsed);
} catch {
setJobs([]);
}
setLoading(false);
};

useFocusEffect(
useCallback(() => {
loadJobs();
}, [])
);

const onRefresh = async () => {
setRefreshing(true);
await loadJobs();
setRefreshing(false);
};

const clearJobs = async () => {
Alert.alert("Clear Jobs", "Delete all saved jobs?", [
{ text: "Cancel", style: "cancel" },
{
text: "Delete",
style: "destructive",
onPress: async () => {
await AsyncStorage.removeItem("elemetric_jobs");
setJobs([]);
},
},
]);
};

const openJob = useCallback((job: SavedJob) => {
router.push({
pathname: "/plumbing/job-detail",
params: { job: JSON.stringify(job) },
});
}, [router]);

const toggleSelect = (id: string) => {
setSelectedIds((prev) => {
const next = new Set(prev);
if (next.has(id)) next.delete(id); else next.add(id);
return next;
});
};

const exportSelected = async () => {
const selected = jobs.filter((j) => selectedIds.has(j.id));
if (selected.length === 0) return;
setBulkExporting(true);
try {
const sections = selected.map((job) => {
const dateStr = new Date(job.createdAt).toLocaleString("en-AU");
const detectedRows = (job.detected ?? []).map((x) => `<tr><td style="padding:4px 6px;border:1px solid #e5e7eb;">✓ ${x}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">Verified</td></tr>`).join("");
const unclearRows = (job.unclear ?? []).map((x) => `<tr><td style="padding:4px 6px;border:1px solid #e5e7eb;">? ${x}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;color:#d97706;font-weight:bold;">Unclear</td></tr>`).join("");
const missingRows = (job.missing ?? []).map((x) => `<tr><td style="padding:4px 6px;border:1px solid #e5e7eb;">✗ ${x}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">Incomplete</td></tr>`).join("");
return `
<div style="page-break-before:always;padding:20px;">
<div style="background:#07152b;color:white;padding:14px 20px;margin-bottom:0;">
<span style="font-size:22px;font-weight:900;letter-spacing:3px;">ELEMETRIC</span>
</div>
<div style="background:#f97316;color:white;padding:8px 20px;margin-bottom:16px;font-size:13px;font-weight:bold;">
${JOB_TYPE_LABELS[job.jobType] ?? job.jobType} · ${new Date(job.createdAt).toLocaleDateString("en-AU")}
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
<tr><td style="padding:4px 0;width:160px;font-weight:bold;">Job Name</td><td>${job.jobName}</td></tr>
<tr><td style="padding:4px 0;font-weight:bold;">Address</td><td>${job.jobAddr}</td></tr>
<tr><td style="padding:4px 0;font-weight:bold;">AI Confidence</td><td style="font-size:18px;font-weight:bold;">${job.confidence}%</td></tr>
</table>
${(detectedRows || unclearRows || missingRows) ? `<table style="width:100%;border-collapse:collapse;"><tr><th style="padding:4px 6px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:left;">Item</th><th style="padding:4px 6px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:left;">Status</th></tr>${detectedRows}${unclearRows}${missingRows}</table>` : ""}
</div>`;
});

const html = `<html><head><style>body{margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;}</style></head><body>
<div style="padding:20px;text-align:center;background:#07152b;color:white;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;margin-bottom:8px;">ELEMETRIC</div>
<div style="font-size:14px;opacity:0.7;">Bulk Export — ${selected.length} Job${selected.length > 1 ? "s" : ""}</div>
<div style="font-size:12px;opacity:0.5;margin-top:4px;">${new Date().toLocaleDateString("en-AU")}</div>
</div>
${sections.join("")}
</body></html>`;

const { uri } = await Print.printToFileAsync({ html });
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Export ${selected.length} Jobs`, UTI: "com.adobe.pdf" });
} else {
Alert.alert("Exported", `PDF saved to: ${uri}`);
}
setSelectMode(false);
setSelectedIds(new Set());
} catch (e: any) {
Alert.alert("Export Error", e?.message ?? "Could not generate PDF.");
} finally {
setBulkExporting(false);
}
};

const duplicateJob = async (job: SavedJob) => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const newJob = {
type: job.jobType,
jobName: `${job.jobName} (Copy)`,
jobAddr: job.jobAddr,
startTime: new Date().toISOString(),
weather: "",
};
await AsyncStorage.setItem("elemetric_current_job", JSON.stringify(newJob));
router.push("/plumbing/new-job");
};

const shareJob = async (job: SavedJob) => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
setSharingJobId(job.id);
try {
const dateShort = new Date(job.createdAt).toLocaleDateString("en-AU");
const dateStr = new Date(job.createdAt).toLocaleString("en-AU");
const td = "border:1px solid #d1d5db;padding:8px;";
const th = `${td}background:#f3f4f6;text-align:left;`;

let qrHtml = "";
try {
const qrSvg = await QRCode.toString(
`ELM|${job.jobType}|${job.jobName}|${job.jobAddr}|${dateShort}`,
{ type: "svg", width: 100, margin: 1 }
);
const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
qrHtml = `<div style="text-align:center;"><img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/><div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div></div>`;
} catch {}

const detectedRows = (job.detected ?? []).map((x) =>
`<tr><td style="${td}">✓ ${x}</td><td style="${td}color:#16a34a;font-weight:bold;">Verified</td></tr>`
).join("");
const unclearRows = (job.unclear ?? []).map((x) =>
`<tr><td style="${td}">? ${x}</td><td style="${td}color:#d97706;font-weight:bold;">Unclear</td></tr>`
).join("");
const missingRows = (job.missing ?? []).map((x) =>
`<tr><td style="${td}">✗ ${x}</td><td style="${td}color:#dc2626;font-weight:bold;">Incomplete</td></tr>`
).join("");

const html = `<html><head><style>@page{margin:15mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}@bottom-left{content:"ELEMETRIC · Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}}body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}</style></head>
<body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;">Job Summary Report — ${JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</div>
<div style="font-size:12px;">${dateShort}</div>
</div>
<div style="padding:22px;">
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:160px;"><strong>Job Name</strong></td><td>${job.jobName}</td></tr>
<tr><td style="padding:5px 0;"><strong>Address</strong></td><td>${job.jobAddr}</td></tr>
<tr><td style="padding:5px 0;"><strong>Job Type</strong></td><td>${JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</td></tr>
<tr><td style="padding:5px 0;"><strong>Date</strong></td><td>${dateStr}</td></tr>
<tr><td style="padding:5px 0;"><strong>AI Confidence</strong></td><td><strong style="font-size:18px;">${job.confidence}%</strong></td></tr>
</table>
</div>
${(detectedRows || unclearRows || missingRows) ? `
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Checklist Status</div>
<table style="width:100%;border-collapse:collapse;">
<tr><th style="${th}width:75%;">Item</th><th style="${th}">Status</th></tr>
${detectedRows}${unclearRows}${missingRows}
</table>
</div>` : ""}
${job.action ? `<div style="margin-bottom:16px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;"><strong>Recommended Action:</strong> ${job.action}</div>` : ""}
<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;"><strong style="color:#374151;">Compliance Disclaimer:</strong> This is a summary report generated from AI-assisted photo review. It is a documentation aid only. Final compliance responsibility remains with the licensed tradesperson.</div>
</div>
</body></html>`;

const { uri } = await Print.printToFileAsync({ html });
const canShare = await Sharing.isAvailableAsync();
if (canShare) {
await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: `Share ${job.jobName} Summary`,
UTI: "com.adobe.pdf",
});
} else {
Alert.alert("PDF Created", `Saved to: ${uri}`);
}
} catch (e: any) {
Alert.alert("Share Error", e?.message ?? "Could not generate summary.");
} finally {
setSharingJobId(null);
}
};

// Filter counts
const countFor = useCallback((key: FilterKey) =>
key === "all" ? jobs.length : jobs.filter((j) => j.jobType === key).length,
[jobs]);

// Apply filter + search + date range
const filtered = useMemo(() => jobs.filter((job) => {
const matchesFilter = activeFilter === "all" || job.jobType === activeFilter;
const q = search.trim().toLowerCase();
const matchesSearch =
!q ||
job.jobName.toLowerCase().includes(q) ||
job.jobAddr.toLowerCase().includes(q) ||
(JOB_TYPE_LABELS[job.jobType] ?? job.jobType).toLowerCase().includes(q);
const jobDate = new Date(job.createdAt);
const matchesFrom = !dateFrom || jobDate >= dateFrom;
const matchesTo = !dateTo || jobDate <= new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59);
return matchesFilter && matchesSearch && matchesFrom && matchesTo;
}), [jobs, activeFilter, search, dateFrom, dateTo]);

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
<Text style={styles.title}>Saved Jobs</Text>
<Pressable
style={[styles.selectModeBtn, selectMode && styles.selectModeBtnActive]}
onPress={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
accessibilityRole="button"
accessibilityLabel={selectMode ? "Exit select mode" : "Enter select mode"}
>
<Text style={[styles.selectModeBtnText, selectMode && styles.selectModeBtnTextActive]}>
{selectMode ? "Cancel" : "Select"}
</Text>
</Pressable>
</View>
</View>

{selectMode && selectedIds.size > 0 && (
<Pressable
style={[styles.exportSelectedBtn, bulkExporting && { opacity: 0.6 }]}
onPress={exportSelected}
disabled={bulkExporting}
accessibilityRole="button"
accessibilityLabel={`Export ${selectedIds.size} selected jobs as PDF`}
>
{bulkExporting
? <ActivityIndicator color="white" size="small" />
: <Text style={styles.exportSelectedText}>Export {selectedIds.size} Job{selectedIds.size > 1 ? "s" : ""} as PDF</Text>
}
</Pressable>
)}

{/* Search bar */}
<View style={styles.searchWrap}>
<TextInput
style={styles.searchInput}
value={search}
onChangeText={setSearch}
placeholder="Search by name, address or type…"
placeholderTextColor="rgba(255,255,255,0.35)"
clearButtonMode="while-editing"
returnKeyType="search"
/>
</View>

{/* Date range pickers */}
<View style={styles.dateRow}>
<Pressable
style={[styles.datePill, dateFrom && styles.datePillActive]}
onPress={() => { setShowFromPicker(true); setShowToPicker(false); }}
>
<Text style={[styles.datePillText, dateFrom && styles.datePillTextActive]}>
{dateFrom ? `From: ${dateFrom.toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" })}` : "From date"}
</Text>
{dateFrom && (
<Pressable onPress={() => setDateFrom(null)} hitSlop={8}>
<Text style={styles.dateClear}> ✕</Text>
</Pressable>
)}
</Pressable>
<Pressable
style={[styles.datePill, dateTo && styles.datePillActive]}
onPress={() => { setShowToPicker(true); setShowFromPicker(false); }}
>
<Text style={[styles.datePillText, dateTo && styles.datePillTextActive]}>
{dateTo ? `To: ${dateTo.toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" })}` : "To date"}
</Text>
{dateTo && (
<Pressable onPress={() => setDateTo(null)} hitSlop={8}>
<Text style={styles.dateClear}> ✕</Text>
</Pressable>
)}
</Pressable>
</View>

{showFromPicker && (
<DateTimePicker
value={dateFrom ?? new Date()}
mode="date"
display={Platform.OS === "ios" ? "inline" : "default"}
maximumDate={dateTo ?? new Date()}
onChange={(_, date) => {
setShowFromPicker(Platform.OS === "ios");
if (date) setDateFrom(date);
}}
/>
)}
{showToPicker && (
<DateTimePicker
value={dateTo ?? new Date()}
mode="date"
display={Platform.OS === "ios" ? "inline" : "default"}
minimumDate={dateFrom ?? undefined}
maximumDate={new Date()}
onChange={(_, date) => {
setShowToPicker(Platform.OS === "ios");
if (date) setDateTo(date);
}}
/>
)}

{/* Filter chips */}
<ScrollView
horizontal
showsHorizontalScrollIndicator={false}
contentContainerStyle={styles.filterRow}
>
{FILTERS.map((f) => {
const count = countFor(f.key);
const active = activeFilter === f.key;
return (
<Pressable
key={f.key}
style={[styles.filterChip, active && styles.filterChipActive]}
onPress={() => setActiveFilter(f.key)}
>
<Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
{f.label}
</Text>
<View style={[styles.filterCount, active && styles.filterCountActive]}>
<Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
{count}
</Text>
</View>
</Pressable>
);
})}
</ScrollView>

<ScrollView
contentContainerStyle={styles.body}
showsVerticalScrollIndicator={false}
refreshControl={
<RefreshControl
refreshing={refreshing}
onRefresh={onRefresh}
tintColor="#f97316"
colors={["#f97316"]}
/>
}
>
{loading ? (
[1,2,3].map((i) => <SkeletonJobCard key={i} />)
) : filtered.length === 0 ? (
jobs.length === 0 ? (
<View style={styles.emptyState}>
<Text style={styles.emptyLogo}>ELEMETRIC</Text>
<Text style={styles.emptyTitle}>No jobs yet</Text>
<Text style={styles.emptySubtitle}>Start a new job to see it here</Text>
<Pressable style={styles.emptyBtn} onPress={() => router.push("/plumbing/new-job")}>
<Text style={styles.emptyBtnText}>Start New Job →</Text>
</Pressable>
</View>
) : (
<View style={styles.emptyState}>
<Text style={styles.emptyTitle}>No results</Text>
<Text style={styles.emptySubtitle}>Try a different search or filter</Text>
</View>
)
) : (
filtered.map((job) => (
<Pressable key={job.id} onPress={() => selectMode ? toggleSelect(job.id) : openJob(job)} accessibilityRole="button" accessibilityLabel={`Job: ${job.jobName}`}>
<View style={[styles.card, selectMode && selectedIds.has(job.id) && styles.cardSelected]}>
{selectMode && (
<View style={[styles.checkbox, selectedIds.has(job.id) && styles.checkboxChecked]}>
{selectedIds.has(job.id) && <Text style={styles.checkboxTick}>✓</Text>}
</View>
)}
<View style={styles.cardTop}>
<View style={styles.tradeIconWrap}>
<Text style={styles.tradeIcon}>{JOB_TYPE_ICONS[job.jobType] ?? "📋"}</Text>
</View>
<View style={styles.cardTitles}>
<Text style={styles.jobTitle} numberOfLines={1}>{job.jobName}</Text>
<Text style={styles.jobAddr} numberOfLines={1}>{job.jobAddr}</Text>
</View>
<View style={styles.confidenceBadge}>
<Text style={styles.confidenceText}>{job.confidence}%</Text>
</View>
</View>

<View style={styles.cardMeta}>
<View style={styles.metaItem}>
<Text style={styles.metaKey}>TYPE</Text>
<Text style={styles.metaVal}>{JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</Text>
</View>
<View style={styles.metaItem}>
<Text style={styles.metaKey}>DATE</Text>
<Text style={styles.metaVal}>
{new Date(job.createdAt).toLocaleDateString("en-AU", {
day: "2-digit", month: "short", year: "numeric",
})}
</Text>
</View>
<StatusBadge status={job.status} />
</View>
</Pressable>

{!selectMode && (
<View style={styles.cardActions}>
<Pressable style={styles.openBtn} onPress={() => openJob(job)} accessibilityRole="button" accessibilityLabel="Open job review">
<Text style={styles.openBtnText}>Open →</Text>
</Pressable>
<Pressable style={styles.dupBtn} onPress={() => duplicateJob(job)} accessibilityRole="button" accessibilityLabel="Duplicate this job">
<Text style={styles.dupBtnText}>Duplicate</Text>
</Pressable>
<Pressable
style={[styles.shareBtn, sharingJobId === job.id && { opacity: 0.6 }]}
onPress={() => shareJob(job)}
disabled={sharingJobId === job.id}
accessibilityRole="button"
accessibilityLabel="Share job as PDF"
>
{sharingJobId === job.id
? <ActivityIndicator size="small" color="#f97316" />
: <Text style={styles.shareBtnText}>Share PDF</Text>
}
</Pressable>
</View>
)}
</View>
</Pressable>
))
)}

{jobs.length > 0 && !loading && (
<Pressable style={styles.clearBtn} onPress={clearJobs}>
<Text style={styles.clearText}>Clear All Jobs</Text>
</Pressable>
)}

</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 4, color: "white", fontSize: 28, fontWeight: "900" },

searchWrap: {
paddingHorizontal: 18,
paddingBottom: 10,
},
searchInput: {
backgroundColor: "rgba(255,255,255,0.07)",
borderRadius: 12,
paddingHorizontal: 14,
paddingVertical: 11,
color: "white",
fontSize: 15,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},

dateRow: {
flexDirection: "row",
gap: 8,
paddingHorizontal: 18,
paddingBottom: 10,
},
datePill: {
flex: 1,
flexDirection: "row",
alignItems: "center",
paddingHorizontal: 12,
paddingVertical: 9,
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.15)",
backgroundColor: "rgba(255,255,255,0.05)",
},
datePillActive: {
borderColor: "rgba(249,115,22,0.50)",
backgroundColor: "rgba(249,115,22,0.10)",
},
datePillText: {
flex: 1,
color: "rgba(255,255,255,0.55)",
fontWeight: "700",
fontSize: 12,
},
datePillTextActive: {
color: "#f97316",
},
dateClear: {
color: "rgba(249,115,22,0.70)",
fontWeight: "800",
fontSize: 13,
},

filterRow: {
paddingHorizontal: 18,
paddingBottom: 12,
gap: 8,
},
filterChip: {
flexDirection: "row",
alignItems: "center",
gap: 6,
paddingHorizontal: 12,
paddingVertical: 8,
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.15)",
backgroundColor: "rgba(255,255,255,0.05)",
},
filterChipActive: {
backgroundColor: "#f97316",
borderColor: "#f97316",
},
filterChipText: {
color: "rgba(255,255,255,0.7)",
fontWeight: "700",
fontSize: 13,
},
filterChipTextActive: {
color: "white",
},
filterCount: {
backgroundColor: "rgba(255,255,255,0.12)",
borderRadius: 10,
minWidth: 20,
paddingHorizontal: 5,
paddingVertical: 1,
alignItems: "center",
},
filterCountActive: {
backgroundColor: "rgba(0,0,0,0.25)",
},
filterCountText: {
color: "rgba(255,255,255,0.6)",
fontSize: 11,
fontWeight: "800",
},
filterCountTextActive: {
color: "white",
},

body: { padding: 18, gap: 12, paddingBottom: 40 },

emptyState: {
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 36,
alignItems: "center",
gap: 10,
},
emptyLogo: { color: "#f97316", fontSize: 22, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
emptyTitle: { color: "white", fontSize: 20, fontWeight: "900" },
emptySubtitle: { color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center" },
emptyBtn: {
marginTop: 10,
backgroundColor: "#f97316",
paddingVertical: 14,
paddingHorizontal: 28,
borderRadius: 14,
},
emptyBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },

card: {
borderRadius: 16,
borderWidth: 1,
borderColor: "#1e3a5f",
backgroundColor: "#0d1f3c",
padding: 16,
gap: 10,
},
cardTop: {
flexDirection: "row",
alignItems: "flex-start",
justifyContent: "space-between",
gap: 10,
},
tradeIconWrap: {
width: 40,
height: 40,
borderRadius: 12,
backgroundColor: "rgba(249,115,22,0.12)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.25)",
alignItems: "center",
justifyContent: "center",
flexShrink: 0,
},
tradeIcon: { fontSize: 20 },
cardTitles: { flex: 1 },
jobTitle: { color: "white", fontWeight: "900", fontSize: 17 },
jobAddr: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 2 },
confidenceBadge: {
backgroundColor: "rgba(249,115,22,0.18)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
borderRadius: 10,
paddingHorizontal: 10,
paddingVertical: 4,
},
confidenceText: { color: "#f97316", fontWeight: "900", fontSize: 13 },

cardMeta: { flexDirection: "row", gap: 20 },
metaItem: { gap: 2 },
metaKey: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
metaVal: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },

cardActions: {
flexDirection: "row",
gap: 8,
marginTop: 10,
paddingTop: 10,
borderTopWidth: 1,
borderTopColor: "rgba(255,255,255,0.07)",
},
openBtn: {
flex: 1,
paddingVertical: 9,
borderRadius: 10,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
openBtnText: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 13 },
dupBtn: {
flex: 1,
paddingVertical: 9,
borderRadius: 10,
alignItems: "center",
backgroundColor: "rgba(59,130,246,0.12)",
borderWidth: 1,
borderColor: "rgba(59,130,246,0.30)",
},
dupBtnText: { color: "#60a5fa", fontWeight: "800", fontSize: 12 },
shareBtn: {
flex: 1,
paddingVertical: 9,
borderRadius: 10,
alignItems: "center",
backgroundColor: "rgba(249,115,22,0.15)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
},
shareBtnText: { color: "#f97316", fontWeight: "900", fontSize: 13 },

clearBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
clearText: { color: "rgba(255,255,255,0.6)", fontWeight: "800" },

back: { marginTop: 6, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },

selectModeBtn: {
paddingHorizontal: 14,
paddingVertical: 7,
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.15)",
backgroundColor: "rgba(255,255,255,0.05)",
},
selectModeBtnActive: {
borderColor: "rgba(249,115,22,0.50)",
backgroundColor: "rgba(249,115,22,0.12)",
},
selectModeBtnText: { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 13 },
selectModeBtnTextActive: { color: "#f97316" },

exportSelectedBtn: {
marginHorizontal: 18,
marginBottom: 8,
backgroundColor: "#f97316",
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
},
exportSelectedText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },

cardSelected: {
borderColor: "rgba(249,115,22,0.50)",
backgroundColor: "rgba(249,115,22,0.07)",
},
checkbox: {
width: 22, height: 22, borderRadius: 6, borderWidth: 2,
borderColor: "rgba(255,255,255,0.30)",
alignItems: "center", justifyContent: "center", marginBottom: 8,
},
checkboxChecked: { backgroundColor: "#f97316", borderColor: "#f97316" },
checkboxTick: { color: "white", fontWeight: "900", fontSize: 13 },
});
