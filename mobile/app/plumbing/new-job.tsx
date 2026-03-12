import React, { useState } from "react";
import {
View,
Text,
StyleSheet,
TextInput,
Pressable,
ScrollView,
Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function NewJob() {
const router = useRouter();
const params = useLocalSearchParams<{ type?: string }>();

const type = String(params.type || "hotwater");

const [jobName, setJobName] = useState("");
const [jobAddr, setJobAddr] = useState("");

const onContinue = async () => {
try {
const currentJob = {
type,
jobName: jobName.trim() || "Untitled Job",
jobAddr: jobAddr.trim() || "No address",
};

await AsyncStorage.setItem(
"elemetric_current_job",
JSON.stringify(currentJob)
);

router.push("/plumbing/checklist");
} catch (e: any) {
Alert.alert("Save Error", e?.message ?? "Could not save job");
}
};

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>New Job</Text>
<Text style={styles.subtitle}>Hot Water System Install</Text>
</View>

<ScrollView contentContainerStyle={styles.body}>
<Text style={styles.label}>Job Name</Text>
<TextInput
style={styles.input}
value={jobName}
onChangeText={setJobName}
placeholder=""
placeholderTextColor="#777"
/>

<Text style={styles.label}>Job Address</Text>
<TextInput
style={styles.input}
value={jobAddr}
onChangeText={setJobAddr}
placeholder=""
placeholderTextColor="#777"
/>

<Pressable style={styles.button} onPress={onContinue}>
<Text style={styles.buttonText}>Continue →</Text>
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
header: { paddingTop: 18, paddingHorizontal: 18 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.7)" },
body: { padding: 18 },
label: { color: "rgba(255,255,255,0.7)", marginTop: 16, fontWeight: "700" },
input: {
backgroundColor: "rgba(255,255,255,0.05)",
borderRadius: 12,
padding: 12,
color: "white",
marginTop: 6,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
button: {
marginTop: 30,
backgroundColor: "#f97316",
padding: 16,
borderRadius: 14,
alignItems: "center",
},
buttonText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
back: { marginTop: 16, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
});