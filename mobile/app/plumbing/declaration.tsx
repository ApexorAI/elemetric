import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";

const DECLARATIONS = [
  "I confirm this work was completed to the best of my knowledge.",
  "I accept full responsibility for the compliance of this work.",
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
<Text style={styles.subtitle}>Tick both boxes to proceed to signature</Text>
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
header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
body: { padding: 20, gap: 12, paddingBottom: 40 },
row: {
flexDirection: "row",
alignItems: "flex-start",
gap: 14,
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
padding: 16,
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
declText: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22 },
continueBtn: {
marginTop: 8,
backgroundColor: "#f97316",
borderRadius: 14,
height: 56,
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 20,
},
continueBtnDisabled: {
backgroundColor: "rgba(249,115,22,0.25)",
},
continueBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
continueBtnTextDisabled: { color: "rgba(255,255,255,0.40)" },
back: { marginTop: 12, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
