import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function Welcome() {
const router = useRouter();

return (
<View style={styles.container}>
<Text style={styles.logo}>ELEMETRIC</Text>
<Text style={styles.title}>AI Compliance Documentation for Trades</Text>

<Pressable style={styles.button} onPress={() => router.push("/login")}>
<Text style={styles.buttonText}>Continue</Text>
</Pressable>
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#07152b",
justifyContent: "center",
alignItems: "center",
padding: 30,
},
logo: {
fontSize: 42,
fontWeight: "900",
color: "#f97316",
letterSpacing: 4,
},
title: {
color: "white",
fontSize: 20,
textAlign: "center",
marginTop: 20,
marginBottom: 50,
},
button: {
backgroundColor: "#f97316",
paddingVertical: 16,
paddingHorizontal: 40,
borderRadius: 12,
},
buttonText: {
fontSize: 18,
fontWeight: "800",
color: "#07152b",
},
});