import React, { useState, useCallback } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
ScrollView,
ActivityIndicator,
Linking,
Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import Constants from "expo-constants";

const version = Constants.expoConfig?.version ?? "1.0.0";

export default function Settings() {
const router = useRouter();
const [email, setEmail] = useState("");
const [loading, setLoading] = useState(true);
const [toast, setToast] = useState<string | null>(null);
const [signingOut, setSigningOut] = useState(false);
const [role, setRole] = useState<"individual" | "employer">("individual");
const [switchingRole, setSwitchingRole] = useState(false);

useFocusEffect(
useCallback(() => {
let active = true;
(async () => {
try {
const { data: { user } } = await supabase.auth.getUser();
if (user && active) {
setEmail(user.email ?? "");
const { data: profile } = await supabase
.from("profiles")
.select("role")
.eq("user_id", user.id)
.single();
if (active && profile?.role) setRole(profile.role as "individual" | "employer");
}
} catch {}
if (active) setLoading(false);
})();
return () => { active = false; };
}, [])
);

const showToast = (msg: string, duration = 3000) => {
setToast(msg);
setTimeout(() => setToast(null), duration);
};

const changePassword = async () => {
if (!email) {
Alert.alert("Not signed in", "No email address found.");
return;
}
try {
const { error } = await supabase.auth.resetPasswordForEmail(email);
if (error) throw error;
showToast("Password reset email sent.");
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not send reset email.");
}
};

const openLink = async (url: string) => {
const supported = await Linking.canOpenURL(url);
if (supported) {
await Linking.openURL(url);
} else {
Alert.alert("Cannot open link", url);
}
};

const signOut = async () => {
Alert.alert("Sign Out", "Are you sure you want to sign out?", [
{ text: "Cancel", style: "cancel" },
{
text: "Sign Out",
style: "destructive",
onPress: async () => {
setSigningOut(true);
try {
await supabase.auth.signOut();
router.replace("/login");
} catch {
setSigningOut(false);
}
},
},
]);
};

const switchRole = async (newRole: "individual" | "employer") => {
if (newRole === role) return;
setSwitchingRole(true);
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not signed in.");
await supabase.from("profiles").upsert(
{ user_id: user.id, role: newRole },
{ onConflict: "user_id" }
);
if (newRole === "employer") {
const { data: existingTeam } = await supabase
.from("teams")
.select("id")
.eq("owner_id", user.id)
.single();
if (!existingTeam) {
const teamName = email.split("@")[0] + "'s Team";
await supabase.from("teams").insert({ owner_id: user.id, team_name: teamName });
}
}
setRole(newRole);
showToast(newRole === "employer" ? "Switched to Employer account." : "Switched to Individual account.");
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not switch role.");
} finally {
setSwitchingRole(false);
}
};

if (loading) {
return (
<View style={styles.loadingScreen}>
<ActivityIndicator />
</View>
);
}

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Settings</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

{/* Account */}
<Text style={styles.sectionLabel}>ACCOUNT</Text>
<View style={styles.group}>
<View style={styles.row}>
<Text style={styles.rowLabel}>Email</Text>
<Text style={styles.rowValue} numberOfLines={1}>{email || "—"}</Text>
</View>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={changePassword}>
<Text style={styles.rowAction}>Change Password</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</View>

{/* View / Role */}
<Text style={styles.sectionLabel}>VIEW</Text>
<View style={styles.group}>
<View style={styles.row}>
<Text style={styles.rowLabel}>Account Type</Text>
</View>
<View style={styles.divider} />
<View style={[styles.row, { gap: 10 }]}>
<Pressable
style={[styles.roleBtn, role === "individual" && styles.roleBtnActive]}
onPress={() => switchRole("individual")}
disabled={switchingRole}
>
<Text style={[styles.roleBtnText, role === "individual" && styles.roleBtnTextActive]}>
Individual Plumber
</Text>
</Pressable>
<Pressable
style={[styles.roleBtn, role === "employer" && styles.roleBtnActive]}
onPress={() => switchRole("employer")}
disabled={switchingRole}
>
{switchingRole && role !== "employer" ? (
<ActivityIndicator color="#f97316" size="small" />
) : (
<Text style={[styles.roleBtnText, role === "employer" && styles.roleBtnTextActive]}>
Employer
</Text>
)}
</Pressable>
</View>
{role === "employer" && (
<>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={() => router.push("/employer/dashboard")}>
<Text style={styles.rowAction}>Employer Portal</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</>
)}
{role === "individual" && (
<>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={() => router.push("/employer/join-team")}>
<Text style={styles.rowAction}>Join a Team</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</>
)}
</View>

{/* Legal */}
<Text style={styles.sectionLabel}>LEGAL</Text>
<View style={styles.group}>
<Pressable style={styles.row} onPress={() => openLink("https://elemetric.com.au/privacy")}>
<Text style={styles.rowAction}>Privacy Policy</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={() => openLink("https://elemetric.com.au/terms")}>
<Text style={styles.rowAction}>Terms & Conditions</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</View>

{/* Sign Out */}
<Pressable
style={[styles.signOutBtn, signingOut && { opacity: 0.6 }]}
onPress={signOut}
disabled={signingOut}
>
{signingOut
? <ActivityIndicator color="white" />
: <Text style={styles.signOutText}>Sign Out</Text>
}
</Pressable>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>

<Text style={styles.versionText}>Elemetric v{version}</Text>
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
},
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
body: { paddingHorizontal: 18, paddingBottom: 60 },

sectionLabel: {
color: "rgba(255,255,255,0.40)",
fontSize: 12,
fontWeight: "800",
letterSpacing: 1,
marginTop: 28,
marginBottom: 8,
marginLeft: 4,
},
group: {
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
backgroundColor: "rgba(255,255,255,0.04)",
overflow: "hidden",
},
row: {
flexDirection: "row",
alignItems: "center",
paddingHorizontal: 16,
paddingVertical: 16,
},
rowLabel: {
flex: 1,
color: "rgba(255,255,255,0.6)",
fontSize: 15,
},
rowValue: {
color: "rgba(255,255,255,0.85)",
fontSize: 15,
maxWidth: "60%",
},
rowAction: {
flex: 1,
color: "white",
fontSize: 15,
fontWeight: "600",
},
rowChevron: {
color: "rgba(255,255,255,0.35)",
fontSize: 22,
fontWeight: "300",
},
divider: {
height: 1,
backgroundColor: "rgba(255,255,255,0.07)",
marginHorizontal: 16,
},
roleBtn: {
flex: 1,
borderRadius: 10,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
backgroundColor: "rgba(255,255,255,0.04)",
paddingVertical: 10,
alignItems: "center",
},
roleBtnActive: {
backgroundColor: "rgba(249,115,22,0.15)",
borderColor: "rgba(249,115,22,0.50)",
},
roleBtnText: {
color: "rgba(255,255,255,0.55)",
fontSize: 13,
fontWeight: "700",
},
roleBtnTextActive: {
color: "#f97316",
},
signOutBtn: {
marginTop: 32,
backgroundColor: "rgba(239,68,68,0.18)",
borderWidth: 1,
borderColor: "rgba(239,68,68,0.35)",
borderRadius: 16,
padding: 16,
alignItems: "center",
},
signOutText: {
color: "#ef4444",
fontWeight: "900",
fontSize: 16,
},
back: { marginTop: 20, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
versionText: {
marginTop: 32,
textAlign: "center",
color: "rgba(255,255,255,0.25)",
fontSize: 12,
},
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
