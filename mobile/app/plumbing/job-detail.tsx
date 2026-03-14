import React, { useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

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

export default function JobDetailScreen() {
const router = useRouter();
const params = useLocalSearchParams();

const job: SavedJob | null = useMemo(() => {
try {
if (!params.job || typeof params.job !== "string") return null;
return JSON.parse(params.job);
} catch {
try {
if (!params.job || typeof params.job !== "string") return null;
return JSON.parse(decodeURIComponent(params.job));
} catch {
return null;
}
}
}, [params.job]);

const [expanded, setExpanded] = useState(false);

if (!job) {
return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Saved Job</Text>
</View>

<View style={styles.body}>
<View style={styles.card}>
<Text style={styles.dim}>Could not load saved job.</Text>
</View>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>
</View>
</View>
);
}

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Saved Job Review</Text>

<View style={styles.metaCard}>
<Text style={styles.metaLine}>Job type: {job.jobType}</Text>
<Text style={styles.metaLine}>Job: {job.jobName}</Text>
<Text style={styles.metaLine}>Address: {job.jobAddr}</Text>
<Text style={styles.metaLine}>
Date: {new Date(job.createdAt).toLocaleString()}
</Text>
</View>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
<View style={styles.card}>
<Text style={styles.h}>Documentation Confidence</Text>
<Text style={[styles.score, !job.relevant && styles.scoreLow]}>
{job.confidence}%
</Text>

<View style={[styles.badge, job.relevant ? styles.badgeOk : styles.badgeNo]}>
<Text style={styles.badgeText}>
{job.relevant ? "RELEVANT PHOTO" : "NOT A PLUMBING PHOTO"}
</Text>
</View>

<Text style={styles.section}>🟢 Visible</Text>
{job.detected.length === 0 ? (
<Text style={styles.itemDim}>• None</Text>
) : (
job.detected.map((x, i) => (
<Text key={`d-${i}`} style={styles.item}>
• {x}
</Text>
))
)}

<Text style={styles.section}>🟡 Unclear</Text>
{job.unclear.length === 0 ? (
<Text style={styles.itemDim}>• None</Text>
) : (
job.unclear.map((x, i) => (
<Text key={`u-${i}`} style={styles.item}>
• {x}
</Text>
))
)}

<Text style={styles.section}>🔴 Missing</Text>
{job.missing.length === 0 ? (
<Text style={styles.itemDim}>• None</Text>
) : (
job.missing.map((x, i) => (
<Text key={`m-${i}`} style={styles.item}>
• {x}
</Text>
))
)}

{!!job.action && (
<Text style={styles.action}>Suggested action: {job.action}</Text>
)}
</View>

<Pressable onPress={() => setExpanded((v) => !v)} style={styles.secondary}>
<Text style={styles.secondaryText}>
{expanded ? "Hide raw output" : "Show raw output"}
</Text>
</Pressable>

{expanded && (
<View style={styles.raw}>
<Text style={styles.rawText}>{JSON.stringify(job, null, 2)}</Text>
</View>
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
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
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

dim: { color: "rgba(255,255,255,0.6)" },
});