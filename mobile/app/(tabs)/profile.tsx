import React, { useState, useCallback } from "react";
import {
View,
Text,
StyleSheet,
TextInput,
Pressable,
ScrollView,
ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { supabase } from "@/lib/supabase";

const R = 38;
const STROKE = 9;
const SIZE = (R + STROKE) * 2 + 4;
const CIRC = 2 * Math.PI * R;

function scoreColor(score: number): string {
if (score >= 80) return "#22c55e";
if (score >= 50) return "#f97316";
return "#ef4444";
}

function ComplianceCircle({ score }: { score: number | null }) {
if (score === null) return null;
const pct = Math.max(0, Math.min(100, Math.round(score)));
const offset = CIRC * (1 - pct / 100);
const color = scoreColor(pct);
const cx = SIZE / 2;
const cy = SIZE / 2;

return (
<Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
<Circle cx={cx} cy={cy} r={R} stroke="rgba(255,255,255,0.10)" strokeWidth={STROKE} fill="none" />
<Circle
cx={cx} cy={cy} r={R}
stroke={color}
strokeWidth={STROKE}
fill="none"
strokeDasharray={`${CIRC}`}
strokeDashoffset={`${offset}`}
strokeLinecap="round"
transform={`rotate(-90, ${cx}, ${cy})`}
/>
<SvgText
x={cx} y={cy + 8}
textAnchor="middle"
fontSize="22"
fontWeight="900"
fill={color}
>
{pct}
</SvgText>
</Svg>
);
}

export default function Profile() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [toast, setToast] = useState<string | null>(null);

const [fullName, setFullName] = useState("");
const [licenceNumber, setLicenceNumber] = useState("");
const [companyName, setCompanyName] = useState("");
const [phone, setPhone] = useState("");
const [complianceScore, setComplianceScore] = useState<number | null>(null);
const [jobCount, setJobCount] = useState(0);

useFocusEffect(
useCallback(() => {
let active = true;
const load = async () => {
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

// Load profile fields
const { data: profile } = await supabase
.from("profiles")
.select("full_name, licence_number, company_name, phone")
.eq("user_id", user.id)
.single();
if (profile && active) {
setFullName(profile.full_name || "");
setLicenceNumber(profile.licence_number || "");
setCompanyName(profile.company_name || "");
setPhone(profile.phone || "");
}

// Calculate compliance score from job history
try {
const { data: jobs } = await supabase
.from("jobs")
.select("confidence")
.eq("user_id", user.id);

if (jobs && jobs.length > 0 && active) {
const avg = Math.round(
jobs.reduce((sum, j) => sum + (j.confidence ?? 0), 0) / jobs.length
);
setComplianceScore(avg);
setJobCount(jobs.length);

// Best-effort: update compliance_score in Supabase
// (requires compliance_score column to exist in profiles table)
try {
await supabase.from("profiles").upsert(
{ user_id: user.id, compliance_score: avg },
{ onConflict: "user_id" }
);
} catch {}
} else if (active) {
setComplianceScore(null);
setJobCount(0);
}
} catch {}
} catch {
// keep defaults
} finally {
if (active) setLoading(false);
}
};
load();
return () => { active = false; };
}, [])
);

const save = async () => {
setSaving(true);
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not signed in.");
const { error } = await supabase.from("profiles").upsert({
user_id: user.id,
full_name: fullName.trim(),
licence_number: licenceNumber.trim(),
company_name: companyName.trim(),
phone: phone.trim(),
}, { onConflict: "user_id" });
if (error) throw error;
setToast("Profile saved.");
setTimeout(() => setToast(null), 3000);
} catch (e: any) {
setToast(e?.message ?? "Could not save profile.");
setTimeout(() => setToast(null), 4000);
} finally {
setSaving(false);
}
};

if (loading) {
return (
<View style={styles.loadingScreen}>
<ActivityIndicator />
<Text style={styles.loadingText}>Loading profile…</Text>
</View>
);
}

const labelText =
complianceScore === null
? "No jobs yet"
: complianceScore >= 80
? "Excellent"
: complianceScore >= 50
? "Good"
: "Needs Attention";

return (
<View style={styles.screen}>
<View style={styles.header}>
<View style={styles.headerRow}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Pressable onPress={() => router.push("/settings")} hitSlop={8}>
<Text style={styles.gearIcon}>⚙</Text>
</Pressable>
</View>
<Text style={styles.title}>Profile</Text>
<Text style={styles.subtitle}>Your details appear in compliance reports</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

{/* Compliance Score Card */}
<View style={styles.scoreCard}>
<View style={styles.scoreLeft}>
<Text style={styles.scoreTitle}>Compliance Score</Text>
<Text style={styles.scoreSubtitle}>
{complianceScore === null
? "Complete jobs to generate your score"
: `Based on ${jobCount} job${jobCount === 1 ? "" : "s"}`}
</Text>
{complianceScore !== null && (
<View style={[styles.scoreBadge, { borderColor: scoreColor(complianceScore) + "50", backgroundColor: scoreColor(complianceScore) + "18" }]}>
<Text style={[styles.scoreBadgeText, { color: scoreColor(complianceScore) }]}>{labelText}</Text>
</View>
)}
</View>
<View style={styles.scoreRight}>
{complianceScore !== null ? (
<ComplianceCircle score={complianceScore} />
) : (
<View style={[styles.scorePlaceholder, { width: SIZE, height: SIZE }]}>
<Text style={styles.scorePlaceholderText}>—</Text>
</View>
)}
</View>
</View>

<Text style={styles.label}>Full Name</Text>
<TextInput
style={styles.input}
value={fullName}
onChangeText={setFullName}
placeholderTextColor="#777"
/>

<Text style={styles.label}>Licence Number</Text>
<TextInput
style={styles.input}
value={licenceNumber}
onChangeText={setLicenceNumber}
placeholderTextColor="#777"
autoCapitalize="characters"
/>

<Text style={styles.label}>Company Name</Text>
<TextInput
style={styles.input}
value={companyName}
onChangeText={setCompanyName}
placeholderTextColor="#777"
/>

<Text style={styles.label}>Phone</Text>
<TextInput
style={styles.input}
value={phone}
onChangeText={setPhone}
placeholderTextColor="#777"
keyboardType="phone-pad"
/>

<Pressable
style={[styles.button, saving && { opacity: 0.6 }]}
onPress={save}
disabled={saving}
>
{saving
? <ActivityIndicator color="#0b1220" />
: <Text style={styles.buttonText}>Save Profile</Text>
}
</Pressable>
</ScrollView>

{toast && (
<View style={styles.toast}>
<Text style={styles.toastText}>{toast}</Text>
</View>
)}
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
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 4 },
headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
gearIcon: { color: "rgba(255,255,255,0.6)", fontSize: 22 },
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 14 },
body: { padding: 18, paddingBottom: 40 },

scoreCard: {
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 18,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginBottom: 8,
},
scoreLeft: { flex: 1, paddingRight: 16 },
scoreTitle: { color: "white", fontWeight: "900", fontSize: 16 },
scoreSubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4, lineHeight: 18 },
scoreBadge: {
marginTop: 10,
borderRadius: 10,
borderWidth: 1,
paddingHorizontal: 10,
paddingVertical: 4,
alignSelf: "flex-start",
},
scoreBadgeText: { fontWeight: "900", fontSize: 12 },
scoreRight: {},
scorePlaceholder: {
borderRadius: SIZE / 2,
borderWidth: 3,
borderColor: "rgba(255,255,255,0.10)",
alignItems: "center",
justifyContent: "center",
},
scorePlaceholderText: { color: "rgba(255,255,255,0.25)", fontSize: 20, fontWeight: "900" },

label: { color: "rgba(255,255,255,0.7)", marginTop: 16, fontWeight: "700" },
input: {
backgroundColor: "rgba(255,255,255,0.05)",
borderRadius: 12,
padding: 12,
color: "white",
marginTop: 6,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
fontSize: 15,
},
button: {
marginTop: 30,
backgroundColor: "#f97316",
padding: 16,
borderRadius: 14,
alignItems: "center",
},
buttonText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
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
});
