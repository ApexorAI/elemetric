import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";

const DECLARATIONS = [
"I confirm that the work described in this report was carried out in accordance with AS/NZS 3500 and the Plumbing Regulations 2018 (Vic).",
"I confirm that all materials and products used are compliant with relevant Australian Standards.",
"I confirm that the installation has been tested and is functioning correctly.",
"I confirm that this report accurately represents the work completed and the photographic evidence provided.",
"I acknowledge that this report may be inspected by the Victorian Building Authority or a relevant statutory body.",
];

export default function Declaration() {
const router = useRouter();
const [ticked, setTicked] = useState<Record<number, boolean>>({});

const toggle = (i: number) =>
setTicked((prev) => ({ ...prev, [i]: !prev[i] }));

const allTicked = DECLARATIONS.every((_, i) => ticked[i]);

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Declaration</Text>
<Text style={styles.subtitle}>Tick all boxes to proceed to signature</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
{DECLARATIONS.map((text, i) => (
<Pressable key={i} style={styles.row} onPress={() => toggle(i)}>
<View style={[styles.checkbox, ticked[i] && styles.checkboxTicked]}>
{ticked[i] && <Text style={styles.tick}>✓</Text>}
</View>
<Text style={styles.declText}>{text}</Text>
</Pressable>
))}

<Pressable
style={[styles.continueBtn, !allTicked && styles.continueBtnDisabled]}
onPress={() => router.push("/plumbing/signature")}
disabled={!allTicked}
>
<Text style={[styles.continueBtnText, !allTicked && styles.continueBtnTextDisabled]}>
Continue to Signature →
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
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 14 },
body: { padding: 18, gap: 14, paddingBottom: 40 },
row: {
flexDirection: "row",
alignItems: "flex-start",
gap: 14,
borderRadius: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 14,
},
checkbox: {
width: 26,
height: 26,
borderRadius: 6,
borderWidth: 2,
borderColor: "rgba(255,255,255,0.30)",
alignItems: "center",
justifyContent: "center",
marginTop: 1,
flexShrink: 0,
},
checkboxTicked: {
backgroundColor: "#f97316",
borderColor: "#f97316",
},
tick: { color: "white", fontWeight: "900", fontSize: 14 },
declText: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 22 },
continueBtn: {
marginTop: 8,
backgroundColor: "#f97316",
padding: 16,
borderRadius: 14,
alignItems: "center",
},
continueBtnDisabled: {
backgroundColor: "rgba(249,115,22,0.25)",
},
continueBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
continueBtnTextDisabled: { color: "rgba(255,255,255,0.40)" },
back: { marginTop: 10, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
});
