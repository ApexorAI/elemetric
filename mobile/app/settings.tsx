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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
const insets = useSafeAreaInsets();
const { isDark, toggleTheme } = useTheme();
const [email, setEmail] = useState("");
const [loading, setLoading] = useState(true);
const [toast, setToast] = useState<string | null>(null);
const [signingOut, setSigningOut] = useState(false);
const [fullName, setFullName] = useState("");
const [editingName, setEditingName] = useState(false);
const [editNameValue, setEditNameValue] = useState("");
const [savingName, setSavingName] = useState(false);
const [licenceNumber, setLicenceNumber] = useState("");
const [companyName, setCompanyName] = useState("");
const [phone, setPhone] = useState("");
const [editingCompany, setEditingCompany] = useState(false);
const [editCompanyValue, setEditCompanyValue] = useState("");
const [savingCompany, setSavingCompany] = useState(false);
const [role, setRole] = useState<"individual" | "employer" | "free">("individual");
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
.select("role, full_name, notification_preferences, trial_started_at, licence_number, company_name, phone")
.eq("user_id", user.id)
.single();
if (active && profile?.role) setRole(profile.role as "individual" | "employer");
if (active && profile?.full_name) { setFullName(profile.full_name); setEditNameValue(profile.full_name); }
if (active && (profile as any)?.licence_number) setLicenceNumber((profile as any).licence_number);
if (active && (profile as any)?.company_name) { setCompanyName((profile as any).company_name); setEditCompanyValue((profile as any).company_name); }
if (active && (profile as any)?.phone) setPhone((profile as any).phone);
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

const saveName = async () => {
const trimmed = editNameValue.trim();
if (!trimmed) return;
setSavingName(true);
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not signed in.");
await supabase.from("profiles").update({ full_name: trimmed }).eq("user_id", user.id);
setFullName(trimmed);
setEditingName(false);
showToast("Name updated.");
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not save name.");
} finally {
setSavingName(false);
}
};

const saveCompany = async () => {
const trimmed = editCompanyValue.trim();
setSavingCompany(true);
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not signed in.");
await supabase.from("profiles").update({ company_name: trimmed }).eq("user_id", user.id);
setCompanyName(trimmed);
setEditingCompany(false);
showToast("Company name updated.");
} catch (e: any) {
Alert.alert("Error", e?.message ?? "Could not save company.");
} finally {
setSavingCompany(false);
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
if (text === "ELEMETRIC DEMO") {
const demoJobs = [
{
id: "demo-001",
jobType: "hotwater",
jobName: "Rheem 315L Hot Water Service",
jobAddr: "14 Collins Street, Melbourne VIC 3000",
confidence: 92,
relevant: true,
detected: ["Existing system photographed", "PTR valve installed and tested", "Tempering valve set to 50°C", "Compliance plate visible", "Expansion control valve fitted", "Pipe insulation complete"],
unclear: [],
missing: [],
action: "All AS/NZS 3500.4:2025 requirements met. File documentation for 7-year liability record.",
createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-002",
jobType: "gas",
jobName: "Gas Rough-In — Kitchen Reno",
jobAddr: "52 Flinders Lane, Melbourne VIC 3000",
confidence: 84,
relevant: true,
detected: ["Gas line installation photographed", "Isolation valve present and labelled", "Flexible connector installed correctly", "Pressure test completed (1.5 kPa)"],
unclear: ["Leak test certificate legibility"],
missing: ["Gas compliance certificate photo (Type B)"],
action: "Photograph the gas compliance certificate before closing walls. Ensure Type B appliance certificate retained.",
createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-003",
jobType: "drainage",
jobName: "Sanitary Drainage — New Build",
jobAddr: "88 Bourke Street, Melbourne VIC 3000",
confidence: 95,
relevant: true,
detected: ["Drainage pipe grade 1:60 confirmed", "Junction connections solvent welded", "Inspection point accessible at ground level", "Floor waste installed per AS/NZS 3500.2:2025", "Vent stack photographed", "Hydraulic test passed"],
unclear: [],
missing: [],
action: "Outstanding documentation. All drainage items verified per AS/NZS 3500.2:2025.",
createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-004",
jobType: "electrical",
jobName: "Switchboard Upgrade — RCD Retro",
jobAddr: "220 Queen Street, Melbourne VIC 3000",
confidence: 81,
relevant: true,
detected: ["Switchboard upgrade complete", "RCD protection on all circuits", "Circuit labels present and legible", "Main switch 63A confirmed"],
unclear: ["Earth continuity test reading on photo 3"],
missing: ["Certificate of Electrical Safety (CES)"],
action: "Upload CES to complete documentation. Earth test reading should be re-photographed for clarity.",
createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-005",
jobType: "hvac",
jobName: "Daikin Split System — 7.1kW",
jobAddr: "1 Spring Street, Melbourne VIC 3000",
confidence: 87,
relevant: true,
detected: ["Indoor unit mounted level and secure", "Outdoor unit on anti-vibration pads", "Refrigerant lines insulated", "Condensate drain connected and tested", "Electrical disconnect fitted"],
unclear: [],
missing: ["Commissioning report with refrigerant charge weight"],
action: "Provide commissioning report including refrigerant type, quantity charged, and superheat/subcool readings.",
createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
{
id: "demo-006",
jobType: "newinstall",
jobName: "New Installation — Plumbing Fitout",
jobAddr: "120 Exhibition Street, Melbourne VIC 3000",
confidence: 89,
relevant: true,
detected: ["Pipe bedding 75mm compacted sand verified", "Depth of cover 300mm in traffic area", "Trench width DN100 + 150mm clearance", "Push-fit joints with ring seal", "Contamination zone sleeves fitted"],
unclear: [],
missing: [],
action: "AS/NZS 3500.4:2025 compliance confirmed. All rule-based criteria passed.",
createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
status: "completed",
},
];
await AsyncStorage.setItem("elemetric_jobs", JSON.stringify(demoJobs));
setSecretInput("");
showToast("Demo mode activated! 6 App Store screenshot jobs loaded.");
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
<View style={[styles.header, { paddingTop: Math.max(20, insets.top + 8) }]}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Settings</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

{/* Account */}
<Text style={styles.sectionLabel}>ACCOUNT</Text>

{/* Avatar row */}
<View style={styles.avatarRow}>
  <View style={styles.avatar}>
    <Text style={styles.avatarInitial}>
      {fullName ? fullName.trim()[0].toUpperCase() : (email ? email[0].toUpperCase() : "?")}
    </Text>
  </View>
  <View>
    <Text style={styles.avatarName}>{fullName || "Your Account"}</Text>
    <Text style={styles.avatarEmail} numberOfLines={1}>{email || "—"}</Text>
  </View>
</View>

<View style={styles.group}>
<Pressable style={styles.row} onPress={() => { setEditingName(true); setEditNameValue(fullName); }}>
<Text style={styles.rowLabel}>Name</Text>
{editingName ? (
<View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
<TextInput
style={[styles.rowValue, { flex: 1, borderBottomWidth: 1, borderBottomColor: "#f97316", paddingVertical: 2 }]}
value={editNameValue}
onChangeText={setEditNameValue}
autoFocus
autoCapitalize="words"
returnKeyType="done"
onSubmitEditing={saveName}
/>
<Pressable onPress={saveName} disabled={savingName} style={{ paddingHorizontal: 8 }}>
{savingName ? <ActivityIndicator size="small" color="#f97316" /> : <Text style={{ color: "#f97316", fontWeight: "700" }}>Save</Text>}
</Pressable>
<Pressable onPress={() => setEditingName(false)}>
<Text style={{ color: "rgba(255,255,255,0.40)", fontWeight: "700" }}>✕</Text>
</Pressable>
</View>
) : (
<Text style={styles.rowValue} numberOfLines={1}>{fullName || "Tap to set name"}</Text>
)}
</Pressable>
<View style={styles.divider} />
{licenceNumber ? (
<>
<View style={styles.row}>
<Text style={styles.rowLabel}>Licence No.</Text>
<Text style={styles.rowValue} numberOfLines={1}>{licenceNumber}</Text>
</View>
<View style={styles.divider} />
</>
) : null}
<Pressable style={styles.row} onPress={() => { setEditingCompany(true); setEditCompanyValue(companyName); }}>
<Text style={styles.rowLabel}>Company</Text>
{editingCompany ? (
<View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
<TextInput
style={[styles.rowValue, { flex: 1, borderBottomWidth: 1, borderBottomColor: "#f97316", paddingVertical: 2 }]}
value={editCompanyValue}
onChangeText={setEditCompanyValue}
autoFocus
autoCapitalize="words"
returnKeyType="done"
onSubmitEditing={saveCompany}
/>
<Pressable onPress={saveCompany} disabled={savingCompany} style={{ paddingHorizontal: 8 }}>
{savingCompany ? <ActivityIndicator size="small" color="#f97316" /> : <Text style={{ color: "#f97316", fontWeight: "700" }}>Save</Text>}
</Pressable>
<Pressable onPress={() => setEditingCompany(false)}>
<Text style={{ color: "rgba(255,255,255,0.40)", fontWeight: "700" }}>✕</Text>
</Pressable>
</View>
) : (
<Text style={styles.rowValue} numberOfLines={1}>{companyName || "Tap to set company"}</Text>
)}
</Pressable>
<View style={styles.divider} />
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
avatarRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 14,
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.06)",
},
avatar: {
  width: 52,
  height: 52,
  borderRadius: 26,
  backgroundColor: "#f97316",
  alignItems: "center",
  justifyContent: "center",
},
avatarInitial: { color: "#07152b", fontSize: 22, fontWeight: "900" },
avatarName: { color: "white", fontWeight: "700", fontSize: 16 },
avatarEmail: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2, maxWidth: 260 },

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
