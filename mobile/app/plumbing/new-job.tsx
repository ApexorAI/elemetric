import React, { useRef, useState } from "react";
import {
View,
Text,
StyleSheet,
TextInput,
Pressable,
ScrollView,
Alert,
FlatList,
ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Suggestion = { display: string; short: string };

export default function NewJob() {
const router = useRouter();
const params = useLocalSearchParams<{ type?: string }>();
const type = String(params.type || "hotwater");

const [jobName, setJobName] = useState("");
const [jobAddr, setJobAddr] = useState("");
const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
const [suggLoading, setSuggLoading] = useState(false);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const fetchSuggestions = (text: string) => {
if (debounceRef.current) clearTimeout(debounceRef.current);
if (text.trim().length < 4) { setSuggestions([]); return; }
debounceRef.current = setTimeout(async () => {
setSuggLoading(true);
try {
const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=au&addressdetails=1&limit=6&q=${encodeURIComponent(text)}`;
const res = await fetch(url, {
headers: { "User-Agent": "ElemetricApp/1.0 (plumbing compliance)" },
});
const data = await res.json();
const items: Suggestion[] = data.map((r: any) => {
// Build a short address from structured parts
const p = r.address ?? {};
const short = [
p.house_number,
p.road,
p.suburb ?? p.village ?? p.town ?? p.city,
p.state,
p.postcode,
].filter(Boolean).join(" ");
return { display: r.display_name, short: short || r.display_name };
});
setSuggestions(items);
} catch {
setSuggestions([]);
} finally {
setSuggLoading(false);
}
}, 450);
};

const onAddrChange = (text: string) => {
setJobAddr(text);
fetchSuggestions(text);
};

const pickSuggestion = (s: Suggestion) => {
setJobAddr(s.short);
setSuggestions([]);
};

const onContinue = async () => {
setSuggestions([]);
try {
const currentJob = {
type,
jobName: jobName.trim() || "Untitled Job",
jobAddr: jobAddr.trim() || "No address",
};
await AsyncStorage.setItem("elemetric_current_job", JSON.stringify(currentJob));

const dest =
type === "gas"         ? "/plumbing/gas-checklist"       :
type === "drainage"    ? "/plumbing/drainage-checklist"   :
type === "newinstall"  ? "/plumbing/newinstall-checklist" :
type === "electrical"  ? "/plumbing/general-checklist"   :
type === "hvac"        ? "/plumbing/general-checklist"   :
"/plumbing/checklist";
router.push(dest);
} catch (e: any) {
Alert.alert("Save Error", e?.message ?? "Could not save job");
}
};

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>New Job</Text>
<Text style={styles.subtitle}>
{type === "gas"        ? "Gas Rough-In" :
type === "drainage"   ? "Drainage" :
type === "newinstall" ? "New Installation" :
type === "electrical" ? "Electrical" :
type === "hvac"       ? "HVAC" :
"Hot Water System Install"}
</Text>
</View>

<ScrollView
contentContainerStyle={styles.body}
keyboardShouldPersistTaps="handled"
>
<Text style={styles.label}>Job Name</Text>
<TextInput
style={styles.input}
value={jobName}
onChangeText={setJobName}
placeholderTextColor="#777"
returnKeyType="next"
/>

<Text style={styles.label}>Job Address</Text>
<View style={styles.addrWrap}>
<TextInput
style={styles.input}
value={jobAddr}
onChangeText={onAddrChange}
placeholderTextColor="#777"
autoCorrect={false}
returnKeyType="done"
onSubmitEditing={() => setSuggestions([])}
/>
{suggLoading && (
<ActivityIndicator size="small" color="#f97316" style={styles.suggSpinner} />
)}
{suggestions.length > 0 && (
<View style={styles.suggBox}>
<FlatList
data={suggestions}
keyExtractor={(_, i) => String(i)}
keyboardShouldPersistTaps="always"
scrollEnabled={false}
ItemSeparatorComponent={() => <View style={styles.suggDivider} />}
renderItem={({ item, index }) => (
<Pressable
style={styles.suggItem}
onPress={() => pickSuggestion(item)}
>
<Text style={styles.suggPrimary} numberOfLines={1}>{item.short}</Text>
<Text style={styles.suggSecondary} numberOfLines={1}>{item.display}</Text>
</Pressable>
)}
/>
<Text style={styles.suggAttrib}>© OpenStreetMap contributors</Text>
</View>
)}
</View>

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
body: { padding: 18, paddingBottom: 60 },
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

addrWrap: { position: "relative" },

suggSpinner: {
position: "absolute",
right: 14,
top: 22,
},
suggBox: {
borderRadius: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
backgroundColor: "#0d1f3d",
marginTop: 4,
overflow: "hidden",
},
suggItem: {
paddingHorizontal: 14,
paddingVertical: 12,
},
suggPrimary: {
color: "white",
fontWeight: "700",
fontSize: 14,
},
suggSecondary: {
color: "rgba(255,255,255,0.45)",
fontSize: 11,
marginTop: 2,
},
suggDivider: {
height: 1,
backgroundColor: "rgba(255,255,255,0.07)",
marginHorizontal: 14,
},
suggAttrib: {
color: "rgba(255,255,255,0.25)",
fontSize: 10,
textAlign: "right",
paddingHorizontal: 12,
paddingVertical: 6,
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
