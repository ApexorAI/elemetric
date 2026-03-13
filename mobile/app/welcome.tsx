import React, { useRef, useState } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
ScrollView,
Dimensions,
NativeSyntheticEvent,
NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_KEY = "elemetric_onboarding_seen";

const SLIDES = [
{
title: "Stop worrying about\nthe 7-year liability",
subtitle: "Elemetric documents every job with AI-powered compliance reports",
},
{
title: "Photo. Analyse.\nSign. Done.",
subtitle: "Complete a compliance report in under 5 minutes on any job site",
},
{
title: "Your licence.\nProtected.",
subtitle: "Every job saved to the cloud. Pull up any report, any time.",
},
];

export default function Onboarding() {
const router = useRouter();
const scrollRef = useRef<ScrollView>(null);
const [activeIndex, setActiveIndex] = useState(0);

const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
setActiveIndex(index);
};

const goToSlide = (index: number) => {
scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
};

const finish = async () => {
await AsyncStorage.setItem(ONBOARDING_KEY, "true");
router.replace("/login");
};

const isLast = activeIndex === SLIDES.length - 1;

return (
<View style={styles.screen}>
<ScrollView
ref={scrollRef}
horizontal
pagingEnabled
showsHorizontalScrollIndicator={false}
onMomentumScrollEnd={onScroll}
scrollEventThrottle={16}
>
{SLIDES.map((slide, i) => (
<View key={i} style={styles.slide}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>{slide.title}</Text>
<Text style={styles.subtitle}>{slide.subtitle}</Text>
</View>
))}
</ScrollView>

<View style={styles.footer}>
<View style={styles.dots}>
{SLIDES.map((_, i) => (
<Pressable key={i} onPress={() => goToSlide(i)}>
<View style={[styles.dot, i === activeIndex && styles.dotActive]} />
</Pressable>
))}
</View>

{isLast ? (
<Pressable style={styles.getStartedBtn} onPress={finish}>
<Text style={styles.getStartedText}>Get Started</Text>
</Pressable>
) : (
<Pressable style={styles.nextBtn} onPress={() => goToSlide(activeIndex + 1)}>
<Text style={styles.nextText}>Next →</Text>
</Pressable>
)}
</View>
</View>
);
}

const styles = StyleSheet.create({
screen: {
flex: 1,
backgroundColor: "#07152b",
},
slide: {
width: SCREEN_WIDTH,
flex: 1,
justifyContent: "center",
paddingHorizontal: 36,
paddingBottom: 160,
},
brand: {
color: "#f97316",
fontSize: 16,
fontWeight: "900",
letterSpacing: 3,
marginBottom: 48,
},
title: {
color: "white",
fontSize: 36,
fontWeight: "900",
lineHeight: 44,
marginBottom: 20,
},
subtitle: {
color: "rgba(255,255,255,0.70)",
fontSize: 18,
lineHeight: 28,
},
footer: {
position: "absolute",
bottom: 0,
left: 0,
right: 0,
paddingHorizontal: 36,
paddingBottom: 52,
paddingTop: 24,
backgroundColor: "#07152b",
gap: 28,
},
dots: {
flexDirection: "row",
gap: 8,
},
dot: {
width: 8,
height: 8,
borderRadius: 4,
backgroundColor: "rgba(255,255,255,0.22)",
},
dotActive: {
width: 24,
backgroundColor: "#f97316",
},
getStartedBtn: {
backgroundColor: "#f97316",
paddingVertical: 16,
borderRadius: 14,
alignItems: "center",
},
getStartedText: {
color: "#07152b",
fontSize: 18,
fontWeight: "900",
},
nextBtn: {
backgroundColor: "rgba(255,255,255,0.07)",
paddingVertical: 16,
borderRadius: 14,
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
nextText: {
color: "white",
fontSize: 16,
fontWeight: "900",
},
});
