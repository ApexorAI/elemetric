import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {
const router = useRouter();
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);

const REVIEWER_EMAIL = "reviewer@elemetric.com.au";
const REVIEWER_PASSWORD = "ElemetricReview2026";

const signIn = async () => {
if (!email || !password) {
Alert.alert("Missing fields", "Please enter your email and password.");
return;
}

// App Store review account bypass — skip verification, load demo data
if (email.trim().toLowerCase() === REVIEWER_EMAIL && password === REVIEWER_PASSWORD) {
setLoading(true);
try {
const demoJobs = [
{ id: "rev-001", jobType: "hotwater", jobName: "Hot Water Service", jobAddr: "14 Collins Street, Melbourne VIC 3000", confidence: 88, relevant: true, detected: ["Existing system photographed", "PTR valve installed", "Tempering valve present", "Compliance plate visible"], unclear: ["Pressure test value unclear"], missing: [], action: "All major items detected.", createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), status: "completed" },
{ id: "rev-002", jobType: "gas", jobName: "Gas Rough-In", jobAddr: "52 Flinders Lane, Melbourne VIC 3000", confidence: 82, relevant: true, detected: ["Gas line installation", "Isolation valve present", "Flexible connector installed"], unclear: [], missing: [], action: "Documentation complete.", createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), status: "completed" },
{ id: "rev-003", jobType: "drainage", jobName: "Drainage Inspection", jobAddr: "88 Bourke Street, Melbourne VIC 3000", confidence: 91, relevant: true, detected: ["Drainage pipe grade correct", "Junction connections complete", "Inspection point accessible"], unclear: [], missing: [], action: "Excellent documentation.", createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), status: "completed" },
{ id: "rev-004", jobType: "electrical", jobName: "Electrical Switchboard", jobAddr: "220 Queen Street, Melbourne VIC 3000", confidence: 79, relevant: true, detected: ["Switchboard upgrade complete", "RCD protection installed"], unclear: [], missing: [], action: "Certificate of Electrical Safety obtained.", createdAt: new Date(Date.now() - 15 * 86400000).toISOString(), status: "completed" },
{ id: "rev-005", jobType: "hvac", jobName: "HVAC Installation", jobAddr: "1 Spring Street, Melbourne VIC 3000", confidence: 85, relevant: true, detected: ["Unit installed per manufacturer specs", "Refrigerant lines insulated", "Condensate drain connected"], unclear: [], missing: [], action: "Commissioning report provided.", createdAt: new Date(Date.now() - 20 * 86400000).toISOString(), status: "completed" },
];
await AsyncStorage.setItem("elemetric_jobs", JSON.stringify(demoJobs));
await AsyncStorage.setItem("elemetric_installer_name", "James Mitchell");
await AsyncStorage.setItem("elemetric_onboarding_seen", "true");
router.replace("/home");
return;
} catch {
// Fall through to normal sign in
} finally {
setLoading(false);
}
}

setLoading(true);
try {
const { error, data } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
// Check if post-signup onboarding is complete
try {
const { data: profile } = await supabase
.from("profiles")
.select("onboarding_complete")
.eq("user_id", data.user.id)
.single();
if (!profile?.onboarding_complete) {
router.replace("/onboarding");
return;
}
} catch {}
router.replace("/home");
} catch (e: any) {
Alert.alert("Sign In Failed", e?.message ?? "Could not sign in.");
} finally {
setLoading(false);
}
};

const signUp = async () => {
if (!email || !password) {
Alert.alert("Missing fields", "Please enter your email and password.");
return;
}
setLoading(true);
try {
const { error } = await supabase.auth.signUp({ email, password });
if (error) throw error;

// Send branded welcome email via Railway server (best-effort)
try {
await fetch("https://elemetric-ai-production.up.railway.app/send-welcome", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ email }),
});
} catch {}

router.replace({ pathname: "/signup-confirm", params: { email } });
} catch (e: any) {
Alert.alert("Sign Up Failed", e?.message ?? "Could not create account.");
} finally {
setLoading(false);
}
};

return (
<View style={styles.container}>

<Text style={styles.logo}>ELEMETRIC</Text>

<Text style={styles.title}>Login</Text>

<TextInput
style={styles.input}
placeholder="Email"
placeholderTextColor="#888"
value={email}
onChangeText={setEmail}
autoCapitalize="none"
keyboardType="email-address"
/>

<TextInput
style={styles.input}
placeholder="Password"
placeholderTextColor="#888"
secureTextEntry
value={password}
onChangeText={setPassword}
autoCapitalize="none"
/>

<Pressable
style={[styles.button, loading && { opacity: 0.6 }]}
onPress={signIn}
disabled={loading}
accessibilityRole="button"
accessibilityLabel="Sign In"
accessibilityHint="Sign in to your Elemetric account"
>
{loading ? (
<ActivityIndicator color="#07152b" />
) : (
<Text style={styles.buttonText}>Sign In</Text>
)}
</Pressable>

<Pressable
style={[styles.signUpButton, loading && { opacity: 0.6 }]}
onPress={signUp}
disabled={loading}
accessibilityRole="button"
accessibilityLabel="Create Account"
accessibilityHint="Create a new Elemetric account"
>
<Text style={styles.signUpText}>Create Account</Text>
</Pressable>

<Pressable
style={styles.forgotBtn}
onPress={() => router.push("/forgot-password")}
accessibilityRole="button"
accessibilityLabel="Forgot Password"
accessibilityHint="Send a password reset email"
>
<Text style={styles.forgotText}>Forgot Password?</Text>
</Pressable>

{__DEV__ && (
<Pressable
style={styles.resetBtn}
onPress={async () => {
await AsyncStorage.removeItem("elemetric_onboarding_seen");
router.replace("/onboarding");
}}
>
<Text style={styles.resetText}>Reset Onboarding</Text>
</Pressable>
)}

</View>
);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#07152b",
justifyContent:"center",
padding:30
},

logo:{
fontSize:32,
fontWeight:"900",
color:"#f97316",
marginBottom:30
},

title:{
fontSize:28,
fontWeight:"800",
color:"white",
marginBottom:20
},

input:{
backgroundColor:"#0d1f3d",
padding:16,
borderRadius:10,
marginBottom:16,
color:"white"
},

button:{
backgroundColor:"#f97316",
padding:16,
borderRadius:10,
alignItems:"center"
},

buttonText:{
fontSize:18,
fontWeight:"800",
color:"#07152b"
},

signUpButton:{
marginTop:12,
padding:16,
borderRadius:10,
alignItems:"center",
borderWidth:1,
borderColor:"rgba(255,255,255,0.18)",
backgroundColor:"rgba(255,255,255,0.06)",
},

signUpText:{
fontSize:16,
fontWeight:"800",
color:"white",
},

forgotBtn:{
marginTop:18,
alignItems:"center",
},

forgotText:{
fontSize:14,
color:"rgba(255,255,255,0.45)",
fontWeight:"600",
},

resetBtn:{
marginTop:40,
alignItems:"center",
},

resetText:{
fontSize:13,
color:"#444e60",
},

});
