import React from "react";
import {
View,
Text,
StyleSheet,
Pressable,
ScrollView,
ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";

export default function TradeScreen() {
const router = useRouter();

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.subtitle}>Select your trade to start a new job</Text>
</View>

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
<Pressable onPress={() => router.push("/plumbing/new-job")}>
<ImageBackground
source={require("../assets/trades/plumbing.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.overlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>PLUMBING</Text>
<Text style={styles.activeText}>● ACTIVE</Text>
</View>

<View style={styles.arrowCircle}>
<Text style={styles.arrowText}>→</Text>
</View>
</ImageBackground>
</Pressable>

<Pressable onPress={() => router.push({ pathname: "/plumbing/new-job", params: { type: "gas" } })}>
<ImageBackground
source={require("../assets/trades/hvac.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.overlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>GAS ROUGH-IN</Text>
<Text style={styles.activeText}>● ACTIVE</Text>
</View>

<View style={styles.arrowCircle}>
<Text style={styles.arrowText}>→</Text>
</View>
</ImageBackground>
</Pressable>

<Pressable onPress={() => router.push({ pathname: "/plumbing/new-job", params: { type: "drainage" } })}>
<ImageBackground
source={require("../assets/trades/plumbing.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.overlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>DRAINAGE</Text>
<Text style={styles.activeText}>● ACTIVE</Text>
</View>

<View style={styles.arrowCircle}>
<Text style={styles.arrowText}>→</Text>
</View>
</ImageBackground>
</Pressable>

<Pressable onPress={() => router.push({ pathname: "/plumbing/new-job", params: { type: "newinstall" } })}>
<ImageBackground
source={require("../assets/trades/carpentry.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.overlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>NEW INSTALL</Text>
<Text style={styles.activeText}>● ACTIVE</Text>
</View>

<View style={styles.arrowCircle}>
<Text style={styles.arrowText}>→</Text>
</View>
</ImageBackground>
</Pressable>

<View style={styles.lockedCard}>
<ImageBackground
source={require("../assets/trades/electrical.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.lockedOverlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>ELECTRICAL</Text>
<Text style={styles.lockedText}>🔒 COMING SOON</Text>
</View>
</ImageBackground>
</View>

<View style={styles.lockedCard}>
<ImageBackground
source={require("../assets/trades/carpentry.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.lockedOverlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>CARPENTRY</Text>
<Text style={styles.lockedText}>🔒 COMING SOON</Text>
</View>
</ImageBackground>
</View>

<View style={styles.lockedCard}>
<ImageBackground
source={require("../assets/trades/hvac.jpg")}
imageStyle={styles.cardImage}
style={styles.tradeCard}
>
<View style={styles.lockedOverlay} />
<View style={styles.cardContent}>
<Text style={styles.tradeTitle}>HVAC</Text>
<Text style={styles.lockedText}>🔒 COMING SOON</Text>
</View>
</ImageBackground>
</View>
</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
screen: {
flex: 1,
backgroundColor: "#07152b",
},
header: {
paddingTop: 18,
paddingHorizontal: 18,
paddingBottom: 8,
},
brand: {
color: "#f97316",
fontSize: 20,
fontWeight: "900",
letterSpacing: 2,
},
subtitle: {
color: "rgba(255,255,255,0.8)",
fontSize: 16,
marginTop: 8,
},
body: {
padding: 18,
gap: 16,
paddingBottom: 40,
},
tradeCard: {
height: 170,
borderRadius: 22,
overflow: "hidden",
justifyContent: "space-between",
padding: 20,
flexDirection: "row",
alignItems: "center",
},
cardImage: {
borderRadius: 22,
},
overlay: {
...StyleSheet.absoluteFillObject,
backgroundColor: "rgba(0,0,0,0.38)",
borderRadius: 22,
},
lockedOverlay: {
...StyleSheet.absoluteFillObject,
backgroundColor: "rgba(0,0,0,0.58)",
borderRadius: 22,
},
cardContent: {
zIndex: 2,
},
tradeTitle: {
color: "white",
fontSize: 28,
fontWeight: "900",
letterSpacing: 1,
},
activeText: {
color: "#22c55e",
fontSize: 16,
fontWeight: "900",
marginTop: 8,
},
lockedText: {
color: "rgba(255,255,255,0.82)",
fontSize: 16,
fontWeight: "800",
marginTop: 8,
},
arrowCircle: {
zIndex: 2,
width: 64,
height: 64,
borderRadius: 32,
backgroundColor: "rgba(249,115,22,0.40)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.15)",
alignItems: "center",
justifyContent: "center",
},
arrowText: {
color: "white",
fontSize: 34,
fontWeight: "900",
marginTop: -2,
},
lockedCard: {
opacity: 0.9,
},
});