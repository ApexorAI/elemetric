import React, { useMemo, useRef, useState } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
Alert,
PanResponder,
LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";

const SIGNATURE_KEY = "elemetric_signature_svg";

type Point = { x: number; y: number };
type Stroke = Point[];

export default function SignatureScreen() {
const router = useRouter();

const [strokes, setStrokes] = useState<Stroke[]>([]);
const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
const [padWidth, setPadWidth] = useState(320);
const [padHeight, setPadHeight] = useState(180);

const drawingRef = useRef(false);
const strokeRef = useRef<Stroke>([]);

const onPadLayout = (e: LayoutChangeEvent) => {
setPadWidth(e.nativeEvent.layout.width);
setPadHeight(e.nativeEvent.layout.height);
};

const clampPoint = (x: number, y: number) => ({
x: Math.max(0, Math.min(padWidth, x)),
y: Math.max(0, Math.min(padHeight, y)),
});

const finishStroke = () => {
if (strokeRef.current.length === 0) return;

const finished = [...strokeRef.current]; // important: clone it
setStrokes((prev) => [...prev, finished]);
setCurrentStroke([]);
strokeRef.current = [];
drawingRef.current = false;
};

const panResponder = useMemo(
() =>
PanResponder.create({
onStartShouldSetPanResponder: () => true,
onMoveShouldSetPanResponder: () => true,

onPanResponderGrant: (evt) => {
const { locationX, locationY } = evt.nativeEvent;
const point = clampPoint(locationX, locationY);

drawingRef.current = true;
strokeRef.current = [point];
setCurrentStroke([point]);
},

onPanResponderMove: (evt) => {
if (!drawingRef.current) return;

const { locationX, locationY } = evt.nativeEvent;
const point = clampPoint(locationX, locationY);

const nextStroke = [...strokeRef.current, point];
strokeRef.current = nextStroke;
setCurrentStroke(nextStroke);
},

onPanResponderRelease: () => {
finishStroke();
},

onPanResponderTerminate: () => {
finishStroke();
},
}),
[padWidth, padHeight]
);

const allStrokes = [...strokes, ...(currentStroke.length ? [currentStroke] : [])];

const toSvgPath = (stroke: Stroke) => {
if (!stroke.length) return "";

if (stroke.length === 1) {
const p = stroke[0];
return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`;
}

return stroke.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
};

const clearSignature = () => {
setStrokes([]);
setCurrentStroke([]);
strokeRef.current = [];
drawingRef.current = false;
};

const saveSignature = async () => {
if (strokes.length === 0 && currentStroke.length === 0) {
Alert.alert("No signature", "Please sign before saving.");
return;
}

const finalStrokes = [...strokes, ...(currentStroke.length ? [currentStroke] : [])];

const pathMarkup = finalStrokes
.map(
(stroke) =>
`<path d="${toSvgPath(
stroke
)}" stroke="#111827" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
)
.join("");

const svgMarkup = `
<svg xmlns="http://www.w3.org/2000/svg" width="${padWidth}" height="${padHeight}" viewBox="0 0 ${padWidth} ${padHeight}">
<rect width="100%" height="100%" fill="white" />
${pathMarkup}
</svg>
`.trim();

await AsyncStorage.setItem(SIGNATURE_KEY, svgMarkup);
router.push("/plumbing/client-signature");
};

return (
<View style={styles.screen}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Add Signature</Text>
<Text style={styles.subtitle}>Sign inside the box, then save</Text>

<View style={styles.padWrap}>
<View style={styles.pad} onLayout={onPadLayout} {...panResponder.panHandlers}>
<Svg width="100%" height="100%">
{allStrokes.map((stroke, index) => (
<Path
key={index}
d={toSvgPath(stroke)}
stroke="#111827"
strokeWidth={3}
fill="none"
strokeLinecap="round"
strokeLinejoin="round"
/>
))}
</Svg>
</View>
</View>

<Pressable style={styles.primaryBtn} onPress={saveSignature}>
<Text style={styles.primaryBtnText}>Save Signature</Text>
</Pressable>

<Pressable style={styles.secondaryBtn} onPress={clearSignature}>
<Text style={styles.secondaryBtnText}>Clear</Text>
</Pressable>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>
</View>
);
}

const styles = StyleSheet.create({
screen: {
flex: 1,
backgroundColor: "#07152b",
padding: 18,
},
brand: {
color: "#f97316",
fontSize: 18,
fontWeight: "900",
letterSpacing: 2,
marginTop: 10,
},
title: {
color: "white",
fontSize: 28,
fontWeight: "900",
marginTop: 8,
},
subtitle: {
color: "rgba(255,255,255,0.7)",
marginTop: 6,
marginBottom: 18,
fontSize: 16,
},
padWrap: {
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 12,
},
pad: {
height: 220,
borderRadius: 12,
backgroundColor: "white",
overflow: "hidden",
},
primaryBtn: {
marginTop: 18,
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "#f97316",
},
primaryBtnText: {
color: "#0b1220",
fontWeight: "900",
fontSize: 16,
},
secondaryBtn: {
marginTop: 12,
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
secondaryBtnText: {
color: "white",
fontWeight: "900",
fontSize: 16,
},
back: {
marginTop: 16,
alignItems: "center",
},
backText: {
color: "rgba(255,255,255,0.7)",
fontWeight: "700",
},
});