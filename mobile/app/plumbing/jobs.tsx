import React, { useCallback, useState } from "react";
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
} from "react-native";
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
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
unassigned: { label: "UNASSIGNED", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.25)", text: "#9ca3af" },
assigned:   { label: "ASSIGNED",   bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.30)",  text: "#60a5fa" },
in_progress:{ label: "IN PROGRESS",bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.30)",  text: "#f97316" },
completed:  { label: "COMPLETED",  bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.30)",   text: "#22c55e" },
};

function StatusBadge({ status }: { status?: string }) {
const cfg = STATUS_CONFIG[status ?? "unassigned"] ?? STATUS_CONFIG.unassigned;
return (
<View style={[statusBadgeStyles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
<Text style={[statusBadgeStyles.text, { color: cfg.text }]}>{cfg.label}</Text>
</View>
);
}

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

const openJob = (job: SavedJob) => {
router.push({
pathname: "/plumbing/job-detail",
params: { job: JSON.stringify(job) },
});
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

const html = `<html><head><style>@page{margin:15mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}@bottom-left{content:"ELEMETRIC \00B7 Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}}body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}</style></head>
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
const countFor = (key: FilterKey) =>
key === "all" ? jobs.length : jobs.filter((j) => j.jobType === key).length;

// Apply filter + search
const filtered = jobs.filter((job) => {
const matchesFilter = activeFilter === "all" || job.jobType === activeFilter;
const q = search.trim().toLowerCase();
const matchesSearch =
!q ||
job.jobName.toLowerCase().includes(q) ||
job.jobAddr.toLowerCase().includes(q) ||
(JOB_TYPE_LABELS[job.jobType] ?? job.jobType).toLowerCase().includes(q);
return matchesFilter && matchesSearch;
});

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Saved Jobs</Text>
</View>

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
{filtered.length === 0 ? (
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
<View key={job.id} style={styles.card}>
<Pressable onPress={() => openJob(job)}>
<View style={styles.cardTop}>
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

<View style={styles.cardActions}>
<Pressable style={styles.openBtn} onPress={() => openJob(job)}>
<Text style={styles.openBtnText}>Open review →</Text>
</Pressable>
<Pressable
style={[styles.shareBtn, sharingJobId === job.id && { opacity: 0.6 }]}
onPress={() => shareJob(job)}
disabled={sharingJobId === job.id}
>
{sharingJobId === job.id
? <ActivityIndicator size="small" color="#f97316" />
: <Text style={styles.shareBtnText}>Share PDF</Text>
}
</Pressable>
</View>
</View>
))
)}

{jobs.length > 0 && (
<Pressable style={styles.clearBtn} onPress={clearJobs}>
<Text style={styles.clearText}>Clear All Jobs</Text>
</Pressable>
)}

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>
</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 4, color: "white", fontSize: 22, fontWeight: "900" },

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
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 16,
gap: 10,
},
cardTop: {
flexDirection: "row",
alignItems: "flex-start",
justifyContent: "space-between",
gap: 10,
},
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
});
