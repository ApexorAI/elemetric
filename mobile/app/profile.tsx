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
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function Profile() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [toast, setToast] = useState<string | null>(null);

const [fullName, setFullName] = useState("");
const [licenceNumber, setLicenceNumber] = useState("");
const [companyName, setCompanyName] = useState("");
const [phone, setPhone] = useState("");

useFocusEffect(
useCallback(() => {
let active = true;
const load = async () => {
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;
const { data } = await supabase
.from("profiles")
.select("full_name, licence_number, company_name, phone")
.eq("user_id", user.id)
.single();
if (data && active) {
setFullName(data.full_name || "");
setLicenceNumber(data.licence_number || "");
setCompanyName(data.company_name || "");
setPhone(data.phone || "");
}
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

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Profile</Text>
<Text style={styles.subtitle}>Your details appear in compliance reports</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
<Text style={styles.label}>Full Name</Text>
<TextInput
style={styles.input}
value={fullName}
onChangeText={setFullName}
placeholder=""
placeholderTextColor="#777"
/>

<Text style={styles.label}>Licence Number</Text>
<TextInput
style={styles.input}
value={licenceNumber}
onChangeText={setLicenceNumber}
placeholder=""
placeholderTextColor="#777"
autoCapitalize="characters"
/>

<Text style={styles.label}>Company Name</Text>
<TextInput
style={styles.input}
value={companyName}
onChangeText={setCompanyName}
placeholder=""
placeholderTextColor="#777"
/>

<Text style={styles.label}>Phone</Text>
<TextInput
style={styles.input}
value={phone}
onChangeText={setPhone}
placeholder=""
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

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
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
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 14 },
body: { padding: 18, paddingBottom: 40 },
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
back: { marginTop: 16, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
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
