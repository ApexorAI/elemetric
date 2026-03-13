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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

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

export default function JobsScreen() {
const router = useRouter();
const [jobs, setJobs] = useState<SavedJob[]>([]);
const [search, setSearch] = useState("");
const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
const [refreshing, setRefreshing] = useState(false);

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
<Pressable
key={job.id}
style={styles.card}
onPress={() => openJob(job)}
>
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
</View>

<Text style={styles.openText}>Open full review →</Text>
</Pressable>
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

openText: { color: "#f97316", fontWeight: "900", fontSize: 14 },

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
