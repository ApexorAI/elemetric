import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function Login() {
const router = useRouter();
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);

const signIn = async () => {
if (!email || !password) {
Alert.alert("Missing fields", "Please enter your email and password.");
return;
}
setLoading(true);
try {
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
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
Alert.alert("Account created", "Check your email to confirm your account, then sign in.");
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
>
<Text style={styles.signUpText}>Create Account</Text>
</Pressable>

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

});
