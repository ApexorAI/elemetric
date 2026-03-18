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
Switch,
TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useTheme } from "@/lib/theme";

const version = Constants.expoConfig?.version ?? "1.0.0";

const NOTIF_TYPES = [
{ key: "job_assigned", label: "Job Assigned", desc: "When an employer assigns you a job" },
{ key: "job_completed", label: "Job Completed", desc: "When a job is saved successfully" },
{ key: "compliance_alert", label: "Compliance Alerts", desc: "Liability expiry warnings" },
{ key: "licence_expiry", label: "Licence Expiry", desc: "Reminders before your licence expires" },
{ key: "near_miss", label: "Near Miss Reports", desc: "Near miss submission confirmations" },
];

export default function Settings() {
const router = useRouter();
const { isDark, toggleTheme } = useTheme();
const [email, setEmail] = useState("");
const [loading, setLoading] = useState(true);
const [toast, setToast] = useState<string | null>(null);
const [signingOut, setSigningOut] = useState(false);
const [fullName, setFullName] = useState("");
const [role, setRole] = useState<"individual" | "employer">("individual");
const [switchingRole, setSwitchingRole] = useState(false);
const [secretInput, setSecretInput] = useState("");
const [betaUnlocked, setBetaUnlocked] = useState(false);
const [activatingBeta, setActivatingBeta] = useState(false);
const [deletingAccount, setDeletingAccount] = useState(false);
const [exportingData, setExportingData] = useState(false);
const [prefs, setPrefs] = useState<Record<string, boolean>>({});
const [userId, setUserId] = useState<string | null>(null);
const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

useFocusEffect(
useCallback(() => {
let active = true;
(async () => {
try {
const { data: { user } } = await supabase.auth.getUser();
if (user && active) {
setEmail(user.email ?? "");
setUserId(user.id);
const { data: profile } = await supabase
.from("profiles")
.select("role, full_name, notification_preferences, trial_started_at")
.eq("user_id", user.id)
.single();
if (active && profile?.role) setRole(profile.role as "individual" | "employer");
if (active && profile?.full_name) setFullName(profile.full_name);
if (active && profile?.notification_preferences) {
setPrefs(profile.notification_preferences as Record<string, boolean>);
}
if (active && profile?.trial_started_at && (profile?.role ?? "free") === "free") {
const daysSince = Math.floor((Date.now() - new Date(profile.trial_started_at).getTime()) / (1000 * 60 * 60 * 24));
setTrialDaysRemaining(Math.max(0, 14 - daysSince));
}
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

const onSecretChange = async (text: string) => {
setSecretInput(text);
if (text === "ELEMETRIC BETA") setBetaUnlocked(true);
if (text === "DEMO MODE") {
const demoJobs = [
{
id: "demo-001",
jobType: "hotwater",
jobName: "Hot Water Service",
jobAddr: "14 Collins Street, Melbourne VIC 3000",
confidence: 88,
relevant: true,
detected: ["Existing system photographed", "PTR valve installed correctly", "Tempering valve present", "Compliance plate visible"],
unclear: ["Pressure test value unclear"],
missing: [],
action: "All major items detected. Ensure pressure test documentation is retained on site.",
createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-002",
jobType: "gas",
jobName: "Gas Rough-In",
jobAddr: "52 Flinders Lane, Melbourne VIC 3000",
confidence: 82,
relevant: true,
detected: ["Gas line installation", "Isolation valve present", "Flexible connector installed"],
unclear: ["Leak test result not visible"],
missing: ["Gas compliance certificate photo"],
action: "Photograph the gas compliance certificate before closing walls.",
createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-003",
jobType: "drainage",
jobName: "Drainage Inspection",
jobAddr: "88 Bourke Street, Melbourne VIC 3000",
confidence: 91,
relevant: true,
detected: ["Drainage pipe grade correct", "Junction connections complete", "Inspection point accessible", "Floor waste installed"],
unclear: [],
missing: [],
action: "All drainage items verified. Excellent documentation.",
createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-004",
jobType: "electrical",
jobName: "Electrical Switchboard",
jobAddr: "220 Queen Street, Melbourne VIC 3000",
confidence: 79,
relevant: true,
detected: ["Switchboard upgrade complete", "RCD protection installed", "Circuit labels present"],
unclear: ["Earth continuity test result"],
missing: ["Certificate of Electrical Safety"],
action: "Obtain Certificate of Electrical Safety before handover.",
createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-005",
jobType: "hvac",
jobName: "HVAC Installation",
jobAddr: "1 Spring Street, Melbourne VIC 3000",
confidence: 85,
relevant: true,
detected: ["Unit installed per manufacturer specs", "Refrigerant lines insulated", "Condensate drain connected"],
unclear: [],
missing: ["Commissioning report"],
action: "Provide commissioning report with refrigerant charge amount.",
createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
];
await AsyncStorage.setItem("elemetric_jobs", JSON.stringify(demoJobs));
setSecretInput("");
showToast("Demo mode activated! 5 sample jobs loaded.");
}
};

const exportData = async () => {
setExportingData(true);
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not signed in.");
const { data: jobs } = await supabase
.from("jobs")
.select("*")
.eq("user_id", user.id);
const localJobs = await AsyncStorage.getItem("elemetric_jobs");
const exportObj = {
exportedAt: new Date().toISOString(),
email,
supabaseJobs: jobs ?? [],
localJobs: localJobs ? JSON.parse(localJobs) : [],
};
await AsyncStorage.setItem("elemetric_data_export", JSON.stringify(exportObj));
showToast("Data exported to app storage. Use Files to access elemetric_data_export.");
} catch (e: any) {
Alert.alert("Export Failed", e?.message ?? "Could not export data.");
} finally {
setExportingData(false);
}
};

const requestAccountDeletion = () => {
Alert.alert(
"Request Account Deletion",
"We'll send a deletion request to our team. Your data will be removed within 30 days as per our privacy policy.",
[
{ text: "Cancel", style: "cancel" },
{
text: "Submit Request",
style: "destructive",
onPress: () => {
const subject = encodeURIComponent("Account Deletion Request");
const body = encodeURIComponent(`Please delete the account associated with: ${email}`);
Linking.openURL(`mailto:cayde@elemetric.com.au?subject=${subject}&body=${body}`).catch(() => {});
showToast("Deletion request opened in Mail app.");
},
},
]
);
};

const togglePref = async (key: string, value: boolean) => {
const updated = { ...prefs, [key]: value };
setPrefs(updated);
if (userId) {
await supabase.from("profiles").update({ notification_preferences: updated }).eq("user_id", userId);
}
};

const activateBeta = async () => {
setActivatingBeta(true);
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not signed in.");
const { error } = await supabase
.from("profiles")
.update({ beta_tester: true })
.eq("user_id", user.id);
if (error) throw error;
setSecretInput("");
setBetaUnlocked(false);
showToast("Beta access activated! Job limit removed.");
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not activate beta access.");
} finally {
setActivatingBeta(false);
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
{fullName ? (
<>
<View style={styles.row}>
<Text style={styles.rowLabel}>Name</Text>
<Text style={styles.rowValue} numberOfLines={1}>{fullName}</Text>
</View>
<View style={styles.divider} />
</>
) : null}
<View style={styles.row}>
<Text style={styles.rowLabel}>Email</Text>
<Text style={styles.rowValue} numberOfLines={1}>{email || "—"}</Text>
</View>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={changePassword}>
<Text style={styles.rowAction}>Change Password</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={() => router.push("/referral")}>
<Text style={styles.rowAction}>Refer a Friend →</Text>
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
<Text style={styles.rowAction}>Manage My Team</Text>
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

{/* Appearance */}
<Text style={styles.sectionLabel}>APPEARANCE</Text>
<View style={styles.group}>
<View style={styles.row}>
<Text style={styles.rowAction}>Dark Mode</Text>
<Switch
value={isDark}
onValueChange={toggleTheme}
trackColor={{ false: "rgba(255,255,255,0.15)", true: "#f97316" }}
thumbColor="white"
ios_backgroundColor="rgba(255,255,255,0.15)"
/>
</View>
</View>

{/* Subscription */}
<Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
<View style={styles.group}>
{role === "free" && trialDaysRemaining !== null && (
<>
<View style={styles.row}>
<Text style={styles.rowLabel}>Current Plan</Text>
<Text style={[styles.rowValue, { color: trialDaysRemaining <= 1 ? "#ef4444" : "#f97316" }]}>
Free Trial — {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} left
</Text>
</View>
<View style={styles.divider} />
</>
)}
{role !== "free" && (
<>
<View style={styles.row}>
<Text style={styles.rowLabel}>Current Plan</Text>
<Text style={[styles.rowValue, { color: "#22c55e" }]}>Pro — Active</Text>
</View>
<View style={styles.divider} />
</>
)}
<Pressable style={styles.row} onPress={() => router.push("/subscription")}>
<Text style={styles.rowAction}>Manage Subscription</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</View>

{/* Notifications */}
<Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
<View style={styles.group}>
<Pressable style={styles.row} onPress={() => router.push("/notifications")}>
<Text style={styles.rowAction}>Notification Centre</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</View>

{/* Notification Preferences */}
<Text style={styles.sectionLabel}>NOTIFICATION PREFERENCES</Text>
<View style={styles.group}>
{NOTIF_TYPES.map((nt, i) => (
<React.Fragment key={nt.key}>
{i > 0 && <View style={styles.divider} />}
<View style={[styles.row, { alignItems: "flex-start", paddingVertical: 14 }]}>
<View style={{ flex: 1 }}>
<Text style={styles.rowAction}>{nt.label}</Text>
<Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>{nt.desc}</Text>
</View>
<Switch
value={prefs[nt.key] !== false}
onValueChange={(v) => togglePref(nt.key, v)}
trackColor={{ false: "rgba(255,255,255,0.15)", true: "#f97316" }}
thumbColor="white"
ios_backgroundColor="rgba(255,255,255,0.15)"
/>
</View>
</React.Fragment>
))}
</View>

{/* Privacy & Data */}
<Text style={styles.sectionLabel}>PRIVACY & DATA</Text>
<View style={styles.group}>
<Pressable style={styles.row} onPress={() => router.push("/data-export")}>
<Text style={styles.rowAction}>Export My Data</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={requestAccountDeletion}>
<Text style={[styles.rowAction, { color: "#ef4444" }]}>Request Account Deletion</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
</View>

{/* Help */}
<Text style={styles.sectionLabel}>SUPPORT</Text>
<View style={styles.group}>
<Pressable style={styles.row} onPress={() => router.push("/help")}>
<Text style={styles.rowAction}>Help & FAQ</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={() => {
const subject = encodeURIComponent("Elemetric Support Request");
Linking.openURL(`mailto:cayde@elemetric.com.au?subject=${subject}`).catch(() => {});
}}>
<Text style={styles.rowAction}>Contact Support</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
<View style={styles.divider} />
<Pressable style={styles.row} onPress={() => router.push("/about")}>
<Text style={styles.rowAction}>About Elemetric</Text>
<Text style={styles.rowChevron}>›</Text>
</Pressable>
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
accessibilityRole="button"
accessibilityLabel="Sign Out"
accessibilityHint="Signs you out of your Elemetric account"
>
{signingOut
? <ActivityIndicator color="white" />
: <Text style={styles.signOutText}>Sign Out</Text>
}
</Pressable>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>

<TextInput
style={styles.secretField}
value={secretInput}
onChangeText={onSecretChange}
placeholder="v"
placeholderTextColor="rgba(255,255,255,0.10)"
autoCapitalize="characters"
autoCorrect={false}
/>

{betaUnlocked && (
<Pressable
style={[styles.betaBtn, activatingBeta && { opacity: 0.6 }]}
onPress={activateBeta}
disabled={activatingBeta}
>
{activatingBeta
? <ActivityIndicator color="#f97316" size="small" />
: <Text style={styles.betaBtnText}>Activate Beta Access</Text>
}
</Pressable>
)}

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
header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 12 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
body: { paddingHorizontal: 20, paddingBottom: 60 },

sectionLabel: {
color: "#f97316",
fontSize: 11,
fontWeight: "800",
letterSpacing: 1,
marginTop: 28,
marginBottom: 8,
marginLeft: 4,
textTransform: "uppercase",
},
group: {
backgroundColor: "#0f2035",
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
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
color: "rgba(255,255,255,0.55)",
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
fontWeight: "400",
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
borderRadius: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.06)",
paddingVertical: 8,
alignItems: "center",
},
roleBtnActive: {
backgroundColor: "rgba(249,115,22,0.10)",
borderColor: "#f97316",
},
roleBtnText: {
color: "rgba(255,255,255,0.55)",
fontSize: 13,
fontWeight: "500",
},
roleBtnTextActive: {
color: "#f97316",
fontWeight: "700",
},
signOutBtn: {
marginTop: 32,
borderRadius: 14,
height: 52,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(239,68,68,0.30)",
},
signOutText: {
color: "#ef4444",
fontWeight: "700",
fontSize: 15,
},
back: { marginTop: 20, alignItems: "center" },
backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
secretField: {
marginTop: 24,
color: "rgba(255,255,255,0.10)",
fontSize: 11,
textAlign: "center",
backgroundColor: "transparent",
paddingVertical: 6,
},
betaBtn: {
marginTop: 8,
marginHorizontal: 40,
borderRadius: 14,
height: 52,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(249,115,22,0.10)",
borderWidth: 1,
borderColor: "#f97316",
},
betaBtnText: {
color: "#f97316",
fontWeight: "700",
fontSize: 15,
},
versionText: {
marginTop: 16,
textAlign: "center",
color: "rgba(255,255,255,0.35)",
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
