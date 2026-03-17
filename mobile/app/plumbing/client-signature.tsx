import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  PanResponder,
  LayoutChangeEvent,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";

const CLIENT_SIGNATURE_KEY = "elemetric_client_signature_svg";

type Point = { x: number; y: number };
type Stroke = Point[];

export default function ClientSignatureScreen() {
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
    const finished = [...strokeRef.current];
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
        onPanResponderRelease: () => finishStroke(),
        onPanResponderTerminate: () => finishStroke(),
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
      Alert.alert("No signature", "Please have the client sign before saving.");
      return;
    }
    const finalStrokes = [...strokes, ...(currentStroke.length ? [currentStroke] : [])];
    const pathMarkup = finalStrokes
      .map(
        (stroke) =>
          `<path d="${toSvgPath(stroke)}" stroke="#111827" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
      )
      .join("");
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${padWidth}" height="${padHeight}" viewBox="0 0 ${padWidth} ${padHeight}"><rect width="100%" height="100%" fill="white" />${pathMarkup}</svg>`;
    await AsyncStorage.setItem(CLIENT_SIGNATURE_KEY, svgMarkup);
    Alert.alert("Saved", "Client signature saved.", [{ text: "OK", onPress: () => router.back() }]);
  };

  const skip = async () => {
    await AsyncStorage.removeItem(CLIENT_SIGNATURE_KEY);
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.brand}>ELEMETRIC</Text>
      <Text style={styles.title}>Client Signature</Text>
      <Text style={styles.subtitle}>
        Optional — have the client sign to acknowledge the work completed
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          By signing, the client acknowledges that the work described in the compliance report has been completed to their satisfaction.
        </Text>
      </View>

      <View style={styles.padWrap}>
        <View
          style={styles.pad}
          onLayout={onPadLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          {...panResponder.panHandlers}
        >
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
        <Text style={styles.padLabel}>Client signs here</Text>
      </View>

      <Pressable style={styles.saveBtn} onPress={saveSignature}>
        <Text style={styles.saveBtnText}>Save Client Signature</Text>
      </Pressable>

      <Pressable style={styles.clearBtn} onPress={clearSignature}>
        <Text style={styles.clearBtnText}>Clear</Text>
      </Pressable>

      <Pressable style={styles.skipBtn} onPress={skip}>
        <Text style={styles.skipBtnText}>Skip — No Client Signature</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  body: { padding: 18, paddingBottom: 40 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2, marginTop: 10 },
  title: { color: "white", fontSize: 28, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "rgba(255,255,255,0.65)", marginTop: 6, marginBottom: 18, fontSize: 14, lineHeight: 20 },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    backgroundColor: "rgba(249,115,22,0.08)",
    padding: 14,
    marginBottom: 20,
  },
  infoText: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 19 },
  padWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    marginBottom: 6,
  },
  pad: {
    height: 220,
    borderRadius: 12,
    backgroundColor: "white",
    overflow: "hidden",
  },
  padLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f97316",
  },
  saveBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
  clearBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  clearBtnText: { color: "white", fontWeight: "900", fontSize: 16 },
  skipBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  skipBtnText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 },
});
