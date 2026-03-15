import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const { width: SW, height: SH } = Dimensions.get("window");

// ── Brand data ─────────────────────────────────────────────────────────────────

type Category = "Split System" | "Ducted" | "Wood Heater" | "Gas Heater";

const CATEGORIES: Category[] = ["Split System", "Ducted", "Wood Heater", "Gas Heater"];

const BRANDS: Record<Category, string[]> = {
  "Split System": [
    "Mitsubishi Electric", "Daikin", "Fujitsu", "Panasonic",
    "LG", "Samsung", "Hitachi", "Toshiba", "Carrier", "Actron",
  ],
  "Ducted": [
    "Daikin", "Mitsubishi Electric", "Fujitsu", "Panasonic",
    "Carrier", "Actron", "Rinnai", "Brivis", "Braemar", "Pyrox",
  ],
  "Wood Heater": ["Regency", "Archer", "Cheminees Philippe", "Pyrox"],
  "Gas Heater": ["Rinnai", "Brivis", "Braemar", "Pyrox", "Regency"],
};

// ── Full-screen image viewer ───────────────────────────────────────────────────

function FullscreenViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.max(1, savedScale.value * e.scale); })
    .onEnd(() => { savedScale.value = scale.value; });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: tx.value },
      { translateY: ty.value },
    ],
  }));

  return (
    <Modal visible statusBarTranslucent animationType="fade">
      <View style={fs.bg}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
          <Animated.View style={[fs.imgWrap, animStyle]}>
            <Image source={{ uri }} style={fs.img} resizeMode="contain" />
          </Animated.View>
        </GestureDetector>
        <TouchableOpacity style={fs.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={fs.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function VisualiserScreen() {
  const [wallUri, setWallUri] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("Split System");
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const filteredBrands = BRANDS[category].filter((b) =>
    query.length === 0 || b.toLowerCase().includes(query.toLowerCase())
  );

  const pickWallPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1,
    });
    if (!result.canceled) {
      setWallUri(result.assets?.[0]?.uri ?? null);
      setResultUrl(null); setResultBase64(null);
    }
  };

  const takeWallPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) {
      setWallUri(result.assets?.[0]?.uri ?? null);
      setResultUrl(null); setResultBase64(null);
    }
  };

  const generate = async () => {
    if (!wallUri) { Alert.alert("No photo", "Please take or select a wall photo first."); return; }
    if (!query.trim()) { Alert.alert("No product", "Please enter or select a brand and model."); return; }

    setShowDropdown(false);
    setLoading(true);
    setResultUrl(null);
    setResultBase64(null);

    try {
      const r = await ImageManipulator.manipulateAsync(
        wallUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!r.base64) throw new Error("Could not read photo.");

      const res = await fetch(`${API_BASE}/visualise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
        },
        body: JSON.stringify({
          wallImage: r.base64,
          mime: "image/jpeg",
          modelNumber: `${category} ${query.trim()}`,
        }),
      });

      const json = await res.json();
      console.log("[visualiser] server response status:", res.status);
      console.log("[visualiser] server response body:", JSON.stringify(json));

      if (!res.ok) throw new Error(json?.error ?? json?.details ?? "Visualisation failed.");

      // imageUrl may be a string URL, a FileOutput object, or missing
      let imageUrl: string | null = null;
      if (typeof json.imageUrl === "string" && json.imageUrl.length > 0) {
        imageUrl = json.imageUrl;
      } else if (json.imageUrl && typeof json.imageUrl === "object") {
        // Replicate FileOutput serialised through JSON
        imageUrl = json.imageUrl.url ?? json.imageUrl.href ?? null;
        console.log("[visualiser] imageUrl was object, extracted:", imageUrl);
      }

      if (json.imageBase64 && typeof json.imageBase64 === "string") {
        setResultBase64(json.imageBase64);
      } else if (imageUrl) {
        setResultUrl(imageUrl);
      } else {
        console.warn("[visualiser] No usable image in response:", JSON.stringify(json));
        throw new Error("Generation failed — please try again.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const resultUri = resultBase64
    ? `data:image/png;base64,${resultBase64}`
    : resultUrl ?? null;

  return (
    <View style={styles.screen}>
      {fullscreen && resultUri && (
        <FullscreenViewer uri={resultUri} onClose={() => setFullscreen(false)} />
      )}

      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>AI Visualiser</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>BETA</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>See how a product looks installed in your space</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* Category selector */}
        <Text style={styles.label}>PRODUCT CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          keyboardShouldPersistTaps="always"
        >
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.categoryTab, category === c && styles.categoryTabActive]}
              onPress={() => { setCategory(c); setQuery(""); setShowDropdown(false); }}
            >
              <Text style={[styles.categoryTabText, category === c && styles.categoryTabTextActive]}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Wall Photo */}
        <Text style={styles.label}>WALL / SPACE PHOTO</Text>
        <View style={styles.photoArea}>
          {wallUri ? (
            <Pressable onPress={pickWallPhoto}>
              <Image source={{ uri: wallUri }} style={styles.wallImage} resizeMode="cover" />
              <Text style={styles.changePhoto}>Tap to change</Text>
            </Pressable>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>
                Take or choose a photo of the wall or space
              </Text>
              <View style={styles.photoButtons}>
                <Pressable style={styles.photoBtn} onPress={takeWallPhoto}>
                  <Text style={styles.photoBtnText}>Camera</Text>
                </Pressable>
                <Pressable style={styles.photoBtn} onPress={pickWallPhoto}>
                  <Text style={styles.photoBtnText}>Library</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Brand / Model search with absolute dropdown */}
        <Text style={styles.label}>BRAND & MODEL NUMBER</Text>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(t) => { setQuery(t); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder={`e.g. ${BRANDS[category][0]} FTXM25YVMA`}
            placeholderTextColor="rgba(255,255,255,0.28)"
            returnKeyType="done"
            onSubmitEditing={() => setShowDropdown(false)}
          />
          {showDropdown && filteredBrands.length > 0 && (
            <View style={styles.dropdown}>
              <FlatList
                data={filteredBrands.slice(0, 8)}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="always"
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      index === filteredBrands.slice(0, 8).length - 1 && styles.dropdownItemLast,
                    ]}
                    onPress={() => { setQuery(item + " "); setShowDropdown(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* Spacer when dropdown is open so content below isn't hidden */}
        {showDropdown && filteredBrands.length > 0 && (
          <View style={{ height: Math.min(filteredBrands.length, 8) * 45 }} />
        )}

        {/* Generate */}
        <Pressable
          style={[styles.generateBtn, loading && { opacity: 0.6 }]}
          onPress={generate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0b1220" />
          ) : (
            <Text style={styles.generateBtnText}>✦ Generate Visualisation</Text>
          )}
        </Pressable>

        {loading && (
          <Text style={styles.loadingNote}>
            Compositing product into your space — this can take 30–60 seconds…
          </Text>
        )}

        {/* Result */}
        {resultUri && (
          <View style={styles.resultWrap}>
            <Text style={styles.resultLabel}>VISUALISATION RESULT</Text>
            <Pressable onPress={() => setFullscreen(true)} activeOpacity={0.9}>
              <Image
                source={{ uri: resultUri }}
                style={styles.resultImage}
                resizeMode="contain"
              />
              <Text style={styles.tapToExpand}>Tap to expand · Pinch to zoom</Text>
            </Pressable>
            <Text style={styles.disclaimer}>
              AI-generated visualisation for reference only. Actual product appearance and
              installation may differ.
            </Text>
          </View>
        )}

        <Text style={styles.finePrint}>
          AI Visualiser is a beta feature available to Pro plan and above. Results are
          illustrative only and are not a substitute for professional advice.
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const fs = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  imgWrap: { width: SW, height: SH },
  img: { width: SW, height: SH },
  closeBtn: {
    position: "absolute", top: 52, right: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  closeText: { color: "white", fontSize: 16, fontWeight: "900" },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  title: { color: "white", fontSize: 28, fontWeight: "900" },
  betaBadge: {
    backgroundColor: "rgba(249,115,22,0.20)", borderWidth: 1, borderColor: "#f97316",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "center",
  },
  betaText: { color: "#f97316", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { padding: 18, gap: 12, paddingBottom: 60 },

  label: {
    color: "rgba(255,255,255,0.40)", fontSize: 12, fontWeight: "800",
    letterSpacing: 1, marginBottom: 6, marginTop: 4,
  },

  categoryRow: { gap: 8, paddingBottom: 4 },
  categoryTab: {
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 16, paddingVertical: 8,
  },
  categoryTabActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.15)" },
  categoryTabText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13 },
  categoryTabTextActive: { color: "#f97316" },

  photoArea: {
    borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  photoPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.04)", padding: 32, alignItems: "center", gap: 12,
  },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderText: { color: "rgba(255,255,255,0.50)", fontSize: 14, textAlign: "center" },
  photoButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  photoBtn: {
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(249,115,22,0.40)",
    backgroundColor: "rgba(249,115,22,0.10)", paddingHorizontal: 22, paddingVertical: 10,
  },
  photoBtnText: { color: "#f97316", fontWeight: "700", fontSize: 14 },
  wallImage: { width: "100%", height: 220, backgroundColor: "rgba(255,255,255,0.04)" },
  changePhoto: {
    color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700",
    textAlign: "center", paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.40)",
  },

  // Autocomplete
  searchWrap: {
    zIndex: 999,
    elevation: 999,
  },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)", color: "white", padding: 14, fontSize: 15,
  },
  dropdown: {
    position: "absolute",
    top: 52,       // sits just below the TextInput (14 + 15 + 14 + 2 border ≈ 46, with some slack)
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 999,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    backgroundColor: "#0d1f3c",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  dropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownText: { color: "white", fontSize: 14, fontWeight: "600" },

  generateBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
    backgroundColor: "#f97316", marginTop: 4,
  },
  generateBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  loadingNote: {
    color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center", fontStyle: "italic",
  },

  resultWrap: { gap: 10 },
  resultLabel: { color: "rgba(255,255,255,0.40)", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  resultImage: {
    width: "100%", height: 300, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)",
  },
  tapToExpand: {
    color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center",
    marginTop: 6, fontStyle: "italic",
  },
  disclaimer: {
    color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 16,
    textAlign: "center", fontStyle: "italic",
  },

  finePrint: {
    color: "rgba(255,255,255,0.25)", fontSize: 11, lineHeight: 17,
    textAlign: "center", paddingHorizontal: 8, marginTop: 8,
  },
});
