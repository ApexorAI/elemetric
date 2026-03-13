import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function SignupConfirm() {
const router = useRouter();
const { email } = useLocalSearchParams<{ email?: string }>();

return (
<View style={styles.container}>
<Text style={styles.logo}>ELEMETRIC</Text>

<Text style={styles.heading}>Welcome to Elemetric.</Text>

<Text style={styles.body}>
Please check your email to confirm your account before signing in.
</Text>

{!!email && (
<Text style={styles.emailHint}>
Confirmation sent to{"\n"}
<Text style={styles.emailValue}>{email}</Text>
</Text>
)}

<Text style={styles.note}>
Didn't receive it? Check your spam folder or create a new account with a different address.
</Text>

<Pressable style={styles.button} onPress={() => router.replace("/login")}>
<Text style={styles.buttonText}>Back to Sign In</Text>
</Pressable>
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#07152b",
justifyContent: "center",
padding: 32,
},
logo: {
fontSize: 28,
fontWeight: "900",
color: "#f97316",
letterSpacing: 2,
marginBottom: 36,
},
heading: {
fontSize: 26,
fontWeight: "900",
color: "white",
marginBottom: 16,
lineHeight: 34,
},
body: {
fontSize: 17,
color: "rgba(255,255,255,0.85)",
lineHeight: 26,
marginBottom: 24,
},
emailHint: {
fontSize: 14,
color: "rgba(255,255,255,0.55)",
marginBottom: 20,
lineHeight: 22,
},
emailValue: {
color: "#f97316",
fontWeight: "800",
},
note: {
fontSize: 13,
color: "rgba(255,255,255,0.40)",
lineHeight: 20,
marginBottom: 48,
},
button: {
backgroundColor: "#f97316",
padding: 16,
borderRadius: 14,
alignItems: "center",
},
buttonText: {
color: "#07152b",
fontWeight: "900",
fontSize: 16,
},
});
