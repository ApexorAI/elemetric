import React, { useCallback, useState } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
Alert,
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

export default function JobsScreen() {
const router = useRouter();
const [jobs, setJobs] = useState<SavedJob[]>([]);

const loadJobs = async () => {
try {
// Try Supabase first
const { data: { user } } = await supabase.auth.getUser();
if (user) {
const { data, error } = await supabase
.from("jobs")
.select("*")
.eq("user_id", user.id)
.order("created_at", { ascending: false });

if (!error && data) {
// Normalise Supabase column names to match the local SavedJob shape
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

// Offline fallback — load from AsyncStorage
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
params: {
job: JSON.stringify(job),
},
});
};

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Saved Jobs</Text>
<Text style={styles.subtitle}>Your previous AI scans</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
{jobs.length === 0 ? (
<View style={styles.emptyState}>
<Text style={styles.emptyLogo}>ELEMETRIC</Text>
<Text style={styles.emptyTitle}>No jobs yet</Text>
<Text style={styles.emptySubtitle}>Start a new job to see it here</Text>
<Pressable style={styles.emptyBtn} onPress={() => router.push("/plumbing/new-job")}>
<Text style={styles.emptyBtnText}>Start New Job →</Text>
</Pressable>
</View>
) : (
jobs.map((job) => (
<Pressable
key={job.id}
style={styles.card}
onPress={() => openJob(job)}
>
<Text style={styles.jobTitle}>{job.jobName}</Text>
<Text style={styles.jobMeta}>Type: {job.jobType}</Text>
<Text style={styles.jobMeta}>Address: {job.jobAddr}</Text>
<Text style={styles.jobMeta}>Confidence: {job.confidence}%</Text>
<Text style={styles.jobMeta}>
Date: {new Date(job.createdAt).toLocaleString()}
</Text>

<View style={styles.openRow}>
<Text style={styles.openText}>Open full review →</Text>
</View>
</Pressable>
))
)}

<Pressable style={styles.clearBtn} onPress={clearJobs}>
<Text style={styles.clearText}>Clear All Jobs</Text>
</Pressable>

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
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.75)" },
body: { padding: 18, gap: 12 },

emptyState: {
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 36,
alignItems: "center",
gap: 10,
},
emptyLogo: {
color: "#f97316",
fontSize: 22,
fontWeight: "900",
letterSpacing: 2,
marginBottom: 4,
},
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
gap: 6,
},
jobTitle: { color: "white", fontWeight: "900", fontSize: 18 },
jobMeta: { color: "rgba(255,255,255,0.75)" },

openRow: {
marginTop: 8,
},
openText: {
color: "#f97316",
fontWeight: "900",
},

clearBtn: {
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
clearText: { color: "white", fontWeight: "900" },

back: { marginTop: 6, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
});