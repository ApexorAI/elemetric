import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  PanResponder,
  LayoutChangeEvent,
  TextInput,
  Switch,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";

const SIGNATURE_KEY = "elemetric_signature_svg";
const SIGNATURE_NAME_KEY = "elemetric_signature_name";
const SIGNATURE_DEFAULT_KEY = "elemetric_signature_default";

type Point = { x: number; y: number };
type Stroke = Point[];

function todayLabel(): string {
  return new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function SignatureScreen() {
  const router = useRouter();

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [padWidth, setPadWidth] = useState(320);
  const [padHeight, setPadHeight] = useState(220);
  const [signedName, setSignedName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [savedPreview, setSavedPreview] = useState<string | null>(null);
  const [showingPreview, setShowingPreview] = useState(false);

  const drawingRef = useRef(false);
  const strokeRef = useRef<Stroke>([]);

  // Load saved name + preview on mount
  useEffect(() => {
    AsyncStorage.multiGet([SIGNATURE_NAME_KEY, SIGNATURE_DEFAULT_KEY, SIGNATURE_KEY]).then(
      (pairs) => {
        const nameVal = pairs.find((p) => p[0] === SIGNATURE_NAME_KEY)?.[1];
        const isDefault = pairs.find((p) => p[0] === SIGNATURE_DEFAULT_KEY)?.[1];
        const saved = pairs.find((p) => p[0] === SIGNATURE_KEY)?.[1];
        if (nameVal) setSignedName(nameVal);
        if (isDefault === "true") setSaveAsDefault(true);
        if (saved) setSavedPreview(saved);
      }
    );
  }, []);

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

  const undoLastStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
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

        onPanResponderRelease: finishStroke,
        onPanResponderTerminate: finishStroke,
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

  // Minimum size validation: at least 5 strokes covering >10% of pad width
  const isSignatureLargeEnough = (): boolean => {
    if (strokes.length < 2) return false;
    const allPts = strokes.flat();
    if (allPts.length < 10) return false;
    const xs = allPts.map((p) => p.x);
    const span = Math.max(...xs) - Math.min(...xs);
    return span >= padWidth * 0.15;
  };

  const saveSignature = async () => {
    if (strokes.length === 0 && currentStroke.length === 0) {
      Alert.alert("No Signature", "Please draw your signature before saving.");
      return;
    }
    if (!isSignatureLargeEnough()) {
      Alert.alert(
        "Signature Too Small",
        "Please draw a larger signature spanning more of the signing area."
      );
      return;
    }
    if (!signedName.trim()) {
      Alert.alert("Name Required", "Please type your full name below the signature.");
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

    const storageItems: [string, string][] = [[SIGNATURE_KEY, svgMarkup]];
    if (saveAsDefault) {
      storageItems.push([SIGNATURE_NAME_KEY, signedName.trim()]);
      storageItems.push([SIGNATURE_DEFAULT_KEY, "true"]);
    } else {
      storageItems.push([SIGNATURE_DEFAULT_KEY, "false"]);
    }

    await AsyncStorage.multiSet(storageItems);
    router.push("/plumbing/client-signature");
  };

  const totalPoints = strokes.reduce((acc, s) => acc + s.length, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.brand}>ELEMETRIC</Text>
      <Text style={styles.title}>Add Signature</Text>
      <Text style={styles.subtitle}>Draw your signature, enter your full name, then save</Text>

      {/* Saved preview banner */}
      {savedPreview && !showingPreview && (
        <Pressable style={styles.previewBanner} onPress={() => setShowingPreview(true)}>
          <Text style={styles.previewBannerText}>Tap to preview saved signature</Text>
        </Pressable>
      )}
      {showingPreview && (
        <View style={styles.previewCard}>
          <Text style={styles.previewCardLabel}>SAVED SIGNATURE</Text>
          <View style={styles.previewPadWrap}>
            <Text style={styles.previewSvgNote}>SVG on file — draw new or continue</Text>
          </View>
          <Pressable onPress={() => setShowingPreview(false)}>
            <Text style={styles.previewClose}>Hide preview</Text>
          </Pressable>
        </View>
      )}

      {/* Signing pad */}
      <View style={styles.padWrap}>
        <Text style={styles.padLabel}>SIGNATURE</Text>
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
          {strokes.length === 0 && currentStroke.length === 0 && (
            <View style={styles.padPlaceholder} pointerEvents="none">
              <Text style={styles.padPlaceholderText}>Sign here</Text>
            </View>
          )}
        </View>
        <View style={styles.padFooter}>
          <Text style={styles.padDate}>{todayLabel()}</Text>
          <Text style={styles.padStrokeCount}>
            {totalPoints > 0 ? `${strokes.length} stroke${strokes.length !== 1 ? "s" : ""}` : ""}
          </Text>
        </View>
      </View>

      {/* Pad actions */}
      <View style={styles.padActions}>
        <Pressable
          style={[styles.padActionBtn, strokes.length === 0 && { opacity: 0.4 }]}
          onPress={undoLastStroke}
          disabled={strokes.length === 0}
        >
          <Text style={styles.padActionText}>↩ Undo</Text>
        </Pressable>
        <Pressable
          style={[styles.padActionBtn, allStrokes.length === 0 && { opacity: 0.4 }]}
          onPress={clearSignature}
          disabled={allStrokes.length === 0}
        >
          <Text style={styles.padActionText}>✕ Clear All</Text>
        </Pressable>
      </View>

      {/* Name field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={signedName}
          onChangeText={setSignedName}
          placeholder="Type your full name"
          placeholderTextColor="rgba(255,255,255,0.30)"
          autoCapitalize="words"
        />
      </View>

      {/* Date display */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Date</Text>
        <View style={styles.dateDisplay}>
          <Text style={styles.dateDisplayText}>{todayLabel()}</Text>
          <Text style={styles.dateAuto}>Auto-filled</Text>
        </View>
      </View>

      {/* Save as default toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Save as default signature</Text>
          <Text style={styles.toggleSub}>Pre-fill name on future jobs</Text>
        </View>
        <Switch
          value={saveAsDefault}
          onValueChange={setSaveAsDefault}
          trackColor={{ false: "rgba(255,255,255,0.12)", true: "#f97316" }}
          thumbColor="white"
        />
      </View>

      {/* Validation hint */}
      {strokes.length > 0 && !isSignatureLargeEnough() && (
        <View style={styles.hintWrap}>
          <Text style={styles.hintText}>
            Signature appears small — please draw across more of the signing area
          </Text>
        </View>
      )}

      {/* Actions */}
      <Pressable
        style={[
          styles.primaryBtn,
          (!isSignatureLargeEnough() || !signedName.trim()) && { opacity: 0.5 },
        ]}
        onPress={saveSignature}
      >
        <Text style={styles.primaryBtnText}>Save Signature →</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2, marginTop: 10 },
  title: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 },

  previewBanner: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBannerText: { color: "#f97316", fontWeight: "700", fontSize: 13 },

  previewCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
  },
  previewCardLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  previewPadWrap: {
    height: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  previewSvgNote: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  previewClose: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13, textAlign: "center" },

  padWrap: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
  },
  padLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pad: {
    height: 220,
    borderRadius: 12,
    backgroundColor: "white",
    overflow: "hidden",
  },
  padPlaceholder: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  padPlaceholderText: { color: "rgba(0,0,0,0.20)", fontSize: 16, fontStyle: "italic" },
  padFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  padDate: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  padStrokeCount: { color: "rgba(255,255,255,0.35)", fontSize: 12 },

  padActions: { flexDirection: "row", gap: 10 },
  padActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  padActionText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13 },

  fieldGroup: { gap: 8 },
  fieldLabel: {
    color: "rgba(255,255,255,0.35)",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  dateDisplayText: { color: "white", fontSize: 15 },
  dateAuto: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontWeight: "500",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { color: "white", fontWeight: "700", fontSize: 15 },
  toggleSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },

  hintWrap: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    padding: 14,
  },
  hintText: { color: "#f97316", fontSize: 13, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  back: { alignItems: "center", paddingVertical: 8 },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
