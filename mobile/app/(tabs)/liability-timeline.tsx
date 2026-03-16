import React, { useCallback, useState } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
ActivityIndicator,
TextInput,
} from "react-native";
import { SkeletonTimelineCard } from "@/components/SkeletonLoader";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

type Job = {
id: string;
jobType: string;
jobName: string;
jobAddr: string;
confidence: number;
createdAt: string;
};

const LIABILITY_YEARS = 7;

function calcDaysRemaining(createdAt: string): number {
const expiry = new Date(createdAt);
expiry.setFullYear(expiry.getFullYear() + LIABILITY_YEARS);
return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function expiryDate(createdAt: string): string {
const d = new Date(createdAt);
d.setFullYear(d.getFullYear() + LIABILITY_YEARS);
return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function statusColor(days: number): string {
if (days <= 0) return "#6b7280";        // expired — grey
if (days <= 365) return "#f97316";       // expiring soon — orange
return "#22c55e";                         // active — green
}

function statusLabel(days: number): string {
if (days <= 0) return "EXPIRED";
if (days <= 365) return "EXPIRING SOON";
return "ACTIVE";
}

function countdownText(days: number): string {
if (days <= 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
if (days <= 365) return `${days} day${days === 1 ? "" : "s"} remaining`;
const years = Math.floor(days / 365);
const months = Math.floor((days % 365) / 30);
if (months === 0) return `${years}y remaining`;
return `${years}y ${months}m remaining`;
}

function jobTypeLabel(type: string): string {
if (type === "gas") return "Gas Rough-In";
if (type === "drainage") return "Drainage";
if (type === "newinstall") return "New Install";
return "Hot Water";
}

export default function LiabilityTimeline() {
const router = useRouter();
const [jobs, setJobs] = useState<Job[]>([]);
const [loading, setLoading] = useState(true);
const [search, setSearch] = useState("");

useFocusEffect(
useCallback(() => {
let active = true;

const load = async () => {
setLoading(true);
try {
// Try Supabase first
const { data: { user } } = await supabase.auth.getUser();
if (user) {
const { data, error } = await supabase
.from("jobs")
.select("id, job_type, job_name, job_addr, confidence, created_at")
.eq("user_id", user.id)
.order("created_at", { ascending: true });

if (!error && data && active) {
const remoteJobs: Job[] = data.map((row: any) => ({
id: row.id,
jobType: row.job_type,
jobName: row.job_name,
jobAddr: row.job_addr,
confidence: row.confidence,
createdAt: row.created_at,
}));
setJobs(remoteJobs);
setLoading(false);
return;
}
}
} catch {
// Fall through to local
}

// Offline fallback
try {
const raw = await AsyncStorage.getItem("elemetric_jobs");
const parsed: any[] = raw ? JSON.parse(raw) : [];
if (active) {
setJobs(parsed.map((j) => ({
id: j.id,
jobType: j.jobType,
jobName: j.jobName,
jobAddr: j.jobAddr,
confidence: j.confidence,
createdAt: j.createdAt,
})));
}
} catch {}

if (active) setLoading(false);
};

load();
return () => { active = false; };
}, [])
);

// Filter by search then sort by days remaining
const filtered = jobs.filter((j) => {
if (!search.trim()) return true;
const q = search.toLowerCase();
return j.jobName.toLowerCase().includes(q) || j.jobAddr.toLowerCase().includes(q) || jobTypeLabel(j.jobType).toLowerCase().includes(q);
});

const sorted = [...filtered].sort(
(a, b) => calcDaysRemaining(a.createdAt) - calcDaysRemaining(b.createdAt)
);

const expired = jobs.filter((j) => calcDaysRemaining(j.createdAt) <= 0).length;
const expiringSoon = jobs.filter((j) => {
const d = calcDaysRemaining(j.createdAt);
return d > 0 && d <= 365;
}).length;
const active = jobs.filter((j) => calcDaysRemaining(j.createdAt) > 365).length;

if (loading) {
return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Liability Timeline</Text>
</View>
<ScrollView contentContainerStyle={[styles.body]}>
{[1,2,3].map((i) => <SkeletonTimelineCard key={i} />)}
</ScrollView>
</View>
);
}

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Liability Timeline</Text>
<Text style={styles.subtitle}>7-year compliance liability window</Text>
</View>

<View style={styles.searchWrap}>
<TextInput
style={styles.searchInput}
value={search}
onChangeText={setSearch}
placeholder="Search by name or address…"
placeholderTextColor="rgba(255,255,255,0.35)"
clearButtonMode="while-editing"
returnKeyType="search"
accessibilityLabel="Search jobs in liability timeline"
/>
</View>

{jobs.length > 0 && (
<View style={styles.statsRow}>
<View style={[styles.statBox, { borderColor: "rgba(34,197,94,0.35)" }]}>
<Text style={[styles.statNum, { color: "#22c55e" }]}>{active}</Text>
<Text style={styles.statLabel}>Active</Text>
</View>
<View style={[styles.statBox, { borderColor: "rgba(249,115,22,0.35)" }]}>
<Text style={[styles.statNum, { color: "#f97316" }]}>{expiringSoon}</Text>
<Text style={styles.statLabel}>Expiring</Text>
</View>
<View style={[styles.statBox, { borderColor: "rgba(107,114,128,0.35)" }]}>
<Text style={[styles.statNum, { color: "#6b7280" }]}>{expired}</Text>
<Text style={styles.statLabel}>Expired</Text>
</View>
</View>
)}

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
{sorted.length === 0 ? (
<View style={styles.emptyState}>
<Text style={styles.emptyLogo}>ELEMETRIC</Text>
<Text style={styles.emptyTitle}>No jobs yet</Text>
<Text style={styles.emptySubtitle}>
Saved jobs will appear here with their 7-year liability window
</Text>
<Pressable style={styles.emptyBtn} onPress={() => router.push("/plumbing/new-job")}>
<Text style={styles.emptyBtnText}>Start New Job →</Text>
</Pressable>
</View>
) : (
sorted.map((job) => {
const days = calcDaysRemaining(job.createdAt);
const color = statusColor(days);
const label = statusLabel(days);

return (
<View key={job.id} style={[styles.card, { borderLeftColor: color }]}>
<View style={styles.cardTop}>
<View style={styles.cardTitles}>
<Text style={styles.jobName} numberOfLines={1}>{job.jobName}</Text>
<Text style={styles.jobAddr} numberOfLines={1}>{job.jobAddr}</Text>
</View>
<View style={[styles.badge, { backgroundColor: color + "25", borderColor: color + "60" }]}>
<Text style={[styles.badgeText, { color }]}>{label}</Text>
</View>
</View>

<View style={styles.cardMeta}>
<View style={styles.metaItem}>
<Text style={styles.metaKey}>Type</Text>
<Text style={styles.metaVal}>{jobTypeLabel(job.jobType)}</Text>
</View>
<View style={styles.metaItem}>
<Text style={styles.metaKey}>Job date</Text>
<Text style={styles.metaVal}>
{new Date(job.createdAt).toLocaleDateString("en-AU", {
day: "2-digit", month: "short", year: "numeric",
})}
</Text>
</View>
<View style={styles.metaItem}>
<Text style={styles.metaKey}>Expires</Text>
<Text style={styles.metaVal}>{expiryDate(job.createdAt)}</Text>
</View>
</View>

<Text style={[styles.countdown, { color }]}>{countdownText(days)}</Text>
</View>
);
})
)}
</ScrollView>
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
loadingText: { color: "rgba(255,255,255,0.55)" },
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

statsRow: {
flexDirection: "row",
paddingHorizontal: 20,
gap: 12,
marginBottom: 8,
},
statBox: {
flex: 1,
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
padding: 12,
alignItems: "center",
},
statNum: { fontSize: 24, fontWeight: "900" },
statLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500", marginTop: 2 },

body: { padding: 20, gap: 12, paddingBottom: 40 },

card: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
borderLeftWidth: 4,
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
jobName: { color: "white", fontWeight: "700", fontSize: 15 },
jobAddr: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },

badge: {
borderRadius: 20,
paddingHorizontal: 10,
paddingVertical: 4,
borderWidth: 1,
},
badgeText: { fontWeight: "700", fontSize: 12 },

cardMeta: {
flexDirection: "row",
gap: 16,
},
metaItem: { gap: 2 },
metaKey: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
metaVal: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "500" },

countdown: {
fontWeight: "700",
fontSize: 15,
},

emptyState: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
padding: 36,
alignItems: "center",
gap: 10,
},
emptyLogo: { color: "#f97316", fontSize: 22, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
emptyTitle: { color: "white", fontSize: 22, fontWeight: "900" },
emptySubtitle: {
color: "rgba(255,255,255,0.55)",
fontSize: 13,
textAlign: "center",
lineHeight: 20,
},
emptyBtn: {
marginTop: 10,
backgroundColor: "#f97316",
height: 56,
paddingHorizontal: 28,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
emptyBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
searchInput: {
backgroundColor: "#0f2035",
borderRadius: 12,
paddingHorizontal: 14,
paddingVertical: 14,
color: "white",
fontSize: 15,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
});
