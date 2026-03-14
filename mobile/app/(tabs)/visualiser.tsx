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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const API_BASE = "https://elemetric-ai-production.up.railway.app";

export default function VisualiserScreen() {
  const [wallUri, setWallUri] = useState<string | null>(null);
  const [modelNumber, setModelNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);

  const pickWallPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      setWallUri(result.assets?.[0]?.uri ?? null);
      setResultUrl(null);
      setResultBase64(null);
    }
  };

  const takeWallPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) {
      setWallUri(result.assets?.[0]?.uri ?? null);
      setResultUrl(null);
      setResultBase64(null);
    }
  };

  const generate = async () => {
    if (!wallUri) {
      Alert.alert("No photo", "Please take or select a wall photo first.");
      return;
    }
    if (!modelNumber.trim()) {
      Alert.alert("No model", "Please enter a product model number.");
      return;
    }

    setLoading(true);
    setResultUrl(null);
    setResultBase64(null);
    try {
      const r = await ImageManipulator.manipulateAsync(
        wallUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
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
          modelNumber: modelNumber.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Visualisation failed.");
      if (json.imageBase64) {
        setResultBase64(json.imageBase64);
      } else if (json.imageUrl) {
        setResultUrl(json.imageUrl);
      } else {
        throw new Error("No image returned from server.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const hasResult = resultBase64 || resultUrl;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>AI Visualiser</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>BETA</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          See how a product looks installed in your space
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Model Number */}
        <Text style={styles.label}>PRODUCT MODEL NUMBER</Text>
        <TextInput
          style={styles.input}
          value={modelNumber}
          onChangeText={setModelNumber}
          placeholder="e.g. Daikin FTXM25YVMA"
          placeholderTextColor="rgba(255,255,255,0.28)"
          autoCapitalize="characters"
          returnKeyType="done"
        />

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
            Generating your visualisation — this can take 15–30 seconds…
          </Text>
        )}

        {/* Result */}
        {hasResult && (
          <View style={styles.resultWrap}>
            <Text style={styles.resultLabel}>VISUALISATION RESULT</Text>
            <Image
              source={
                resultBase64
                  ? { uri: `data:image/png;base64,${resultBase64}` }
                  : { uri: resultUrl! }
              }
              style={styles.resultImage}
              resizeMode="contain"
            />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  title: { color: "white", fontSize: 28, fontWeight: "900" },
  betaBadge: {
    backgroundColor: "rgba(249,115,22,0.20)",
    borderWidth: 1,
    borderColor: "#f97316",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "center",
  },
  betaText: { color: "#f97316", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { padding: 18, gap: 12, paddingBottom: 60 },

  label: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },

  photoArea: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  photoPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderText: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 14,
    textAlign: "center",
  },
  photoButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  photoBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    backgroundColor: "rgba(249,115,22,0.10)",
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  photoBtnText: { color: "#f97316", fontWeight: "700", fontSize: 14 },
  wallImage: {
    width: "100%",
    height: 220,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  changePhoto: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.40)",
  },

  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "white",
    padding: 14,
    fontSize: 15,
  },

  generateBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#f97316",
    marginTop: 4,
  },
  generateBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  loadingNote: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
  },

  resultWrap: { gap: 10 },
  resultLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  resultImage: {
    width: "100%",
    height: 300,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  disclaimer: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontStyle: "italic",
  },

  finePrint: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
    marginTop: 8,
  },
});
