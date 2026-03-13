import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export default function Home() {
const router = useRouter();

const [profileDone, setProfileDone]   = useState(false);
const [jobDone,     setJobDone]       = useState(false);
const [pdfDone,     setPdfDone]       = useState(false);
const [isEmployer,  setIsEmployer]    = useState(false);

useFocusEffect(
useCallback(() => {
let active = true;
(async () => {
// 1. Profile: check if full_name is set in Supabase
try {
const { data: { user } } = await supabase.auth.getUser();
if (user) {
const { data } = await supabase
.from("profiles")
.select("full_name, role")
.eq("user_id", user.id)
.single();
if (active && data?.full_name?.trim()) setProfileDone(true);
if (active && data?.role === "employer") setIsEmployer(true);
}
} catch {}

// 2. First job: check AsyncStorage or Supabase
try {
const raw = await AsyncStorage.getItem("elemetric_jobs");
if (active && raw) {
const jobs = JSON.parse(raw);
if (jobs.length > 0) setJobDone(true);
}
} catch {}

// 3. First PDF: check flag set by any PDF generator
try {
const flag = await AsyncStorage.getItem("elemetric_pdf_generated");
if (active && flag === "1") setPdfDone(true);
} catch {}
})();
return () => { active = false; };
}, [])
);

const allDone = profileDone && jobDone && pdfDone;
const completedCount = [profileDone, jobDone, pdfDone].filter(Boolean).length;

return (
<ScrollView style={styles.screen} contentContainerStyle={styles.body}>
<View style={styles.header}>
<Text style={styles.logo}>ELEMETRIC</Text>
<Text style={styles.greeting}>What would you like to do?</Text>
</View>

<Pressable style={styles.button} onPress={() => router.push("/trade")}>
<Text style={styles.buttonText}>New Job</Text>
<Text style={styles.buttonArrow}>→</Text>
</Pressable>

<Pressable style={styles.button} onPress={() => router.push("/plumbing/jobs")}>
<Text style={styles.buttonText}>Past Jobs</Text>
<Text style={styles.buttonArrow}>→</Text>
</Pressable>

<Pressable style={styles.nearMissButton} onPress={() => router.push("/near-miss")}>
<View>
<Text style={styles.nearMissTitle}>Report Near Miss</Text>
<Text style={styles.nearMissSubtitle}>Document pre-existing non-compliant work</Text>
</View>
<Text style={styles.buttonArrow}>→</Text>
</Pressable>

{isEmployer && (
<Pressable style={styles.employerBanner} onPress={() => router.push("/employer/dashboard")}>
<View>
<Text style={styles.employerTitle}>Employer Portal</Text>
<Text style={styles.employerSub}>View your team's compliance</Text>
</View>
<Text style={styles.buttonArrow}>→</Text>
</Pressable>
)}

{/* Onboarding checklist — hidden once all done */}
{!allDone && (
<View style={styles.checklistCard}>
<View style={styles.checklistHeader}>
<Text style={styles.checklistTitle}>Getting Started</Text>
<Text style={styles.checklistProgress}>{completedCount}/3</Text>
</View>
<Text style={styles.checklistSub}>Complete these steps to get the most out of Elemetric</Text>

<ChecklistItem
done={profileDone}
label="Add your profile details"
hint="Licence number and company appear in your reports"
onPress={() => router.push("/profile")}
/>
<ChecklistItem
done={jobDone}
label="Complete your first job"
hint="Run a checklist and AI analysis"
onPress={() => router.push("/trade")}
/>
<ChecklistItem
done={pdfDone}
label="Generate your first PDF report"
hint="Export a compliance report to share or store"
onPress={() => router.push("/plumbing/jobs")}
/>
</View>
)}

{allDone && (
<View style={styles.allDoneCard}>
<Text style={styles.allDoneText}>Setup complete — you're all set!</Text>
</View>
)}
</ScrollView>
);
}

function ChecklistItem({
done,
label,
hint,
onPress,
}: {
done: boolean;
label: string;
hint: string;
onPress: () => void;
}) {
return (
<Pressable style={styles.checkItem} onPress={!done ? onPress : undefined}>
<View style={[styles.checkBox, done && styles.checkBoxDone]}>
{done && <Text style={styles.checkTick}>✓</Text>}
</View>
<View style={styles.checkTextWrap}>
<Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{label}</Text>
{!done && <Text style={styles.checkHint}>{hint}</Text>}
</View>
{!done && <Text style={styles.checkArrow}>›</Text>}
</Pressable>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#07152b" },
body: { padding: 24, paddingTop: 40, paddingBottom: 60, gap: 14 },

header: { marginBottom: 8 },
logo: { fontSize: 34, fontWeight: "900", color: "#f97316", letterSpacing: 2 },
greeting: { color: "rgba(255,255,255,0.75)", fontSize: 17, marginTop: 8 },

button: {
backgroundColor: "rgba(255,255,255,0.05)",
borderRadius: 16,
padding: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
buttonText: { color: "white", fontSize: 18, fontWeight: "800" },
buttonArrow: { color: "rgba(255,255,255,0.4)", fontSize: 22, fontWeight: "300" },

employerBanner: {
backgroundColor: "rgba(249,115,22,0.08)",
borderRadius: 16,
padding: 18,
borderWidth: 1,
borderColor: "rgba(249,115,22,0.25)",
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
employerTitle: { color: "#f97316", fontSize: 17, fontWeight: "800" },
employerSub: { color: "rgba(249,115,22,0.65)", fontSize: 12, marginTop: 3 },

nearMissButton: {
backgroundColor: "rgba(239,68,68,0.08)",
borderRadius: 16,
padding: 18,
borderWidth: 1,
borderColor: "rgba(239,68,68,0.25)",
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
nearMissTitle: { color: "#f87171", fontSize: 17, fontWeight: "800" },
nearMissSubtitle: { color: "rgba(248,113,113,0.65)", fontSize: 12, marginTop: 3 },

checklistCard: {
marginTop: 8,
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(249,115,22,0.20)",
backgroundColor: "rgba(249,115,22,0.06)",
padding: 18,
},
checklistHeader: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 4,
},
checklistTitle: { color: "white", fontWeight: "900", fontSize: 16 },
checklistProgress: { color: "#f97316", fontWeight: "900", fontSize: 15 },
checklistSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 14 },

checkItem: {
flexDirection: "row",
alignItems: "center",
gap: 12,
paddingVertical: 12,
borderTopWidth: 1,
borderTopColor: "rgba(255,255,255,0.07)",
},
checkBox: {
width: 26,
height: 26,
borderRadius: 13,
borderWidth: 2,
borderColor: "rgba(255,255,255,0.25)",
alignItems: "center",
justifyContent: "center",
},
checkBoxDone: {
backgroundColor: "#22c55e",
borderColor: "#22c55e",
},
checkTick: { color: "white", fontSize: 14, fontWeight: "900" },
checkTextWrap: { flex: 1 },
checkLabel: { color: "white", fontWeight: "800", fontSize: 15 },
checkLabelDone: { color: "rgba(255,255,255,0.45)", textDecorationLine: "line-through" },
checkHint: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
checkArrow: { color: "rgba(255,255,255,0.35)", fontSize: 22, fontWeight: "300" },

allDoneCard: {
marginTop: 8,
borderRadius: 14,
padding: 14,
backgroundColor: "rgba(34,197,94,0.10)",
borderWidth: 1,
borderColor: "rgba(34,197,94,0.25)",
alignItems: "center",
},
allDoneText: { color: "#22c55e", fontWeight: "900", fontSize: 14 },
});
