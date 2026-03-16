import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const STORAGE_KEY = "elemetric_training_history";
const AI_URL = "https://elemetric-ai-production.up.railway.app/training";

const TRADES = [
  { id: "hotwater", label: "Hot Water", icon: "🔧" },
  { id: "gas", label: "Gas Rough-In", icon: "🔥" },
  { id: "drainage", label: "Drainage", icon: "🚿" },
  { id: "newinstall", label: "New Install", icon: "🏗️" },
  { id: "electrical", label: "Electrical", icon: "⚡" },
  { id: "hvac", label: "HVAC", icon: "❄️" },
];

const CHECKLISTS: Record<string, string[]> = {
  hotwater: [
    "Pressure relief valve installed and discharged to drain",
    "Cold water inlet with isolation valve",
    "Temperature set to 60°C or above",
    "Expansion vessel or relief point",
    "Correct pipe material and jointing",
    "Unit secured/supported correctly",
  ],
  gas: [
    "Gas meter and regulator accessible",
    "Pressure test completed (2× working pressure)",
    "All joints tested with leak detection solution",
    "Flexible connector where required",
    "Gas cock at appliance",
    "Earthquake valve installed if required",
  ],
  drainage: [
    "Falls correct (min 1:60)",
    "Inspection opening accessible",
    "Correct pipe material (AS 3500)",
    "Pipe bedding and cover depth",
    "Junction entry angles correct",
    "Vent stack height above roof line",
  ],
  newinstall: [
    "Council/permit approval sighted",
    "Materials match specification",
    "Pressure test completed",
    "Water meter and isolation valve",
    "Backflow prevention fitted",
    "Commissioning sign-off completed",
  ],
  electrical: [
    "RCD protection on all circuits",
    "Earthing complete and tested",
    "Cable management and labelling",
    "Switchboard schedule updated",
    "Isolation verified before work",
    "Compliance certificate issued",
  ],
  hvac: [
    "Refrigerant type and charge recorded",
    "Condensate drain falls correct",
    "Electrical protection in place",
    "Filter accessible for service",
    "Supply/return air sealed",
    "Commissioning data sheet completed",
  ],
};

type HistoryItem = {
  id: string;
  trade: string;
  date: string;
  score: number | null;
  feedback: string;
};

export default function TrainingMode() {
  const router = useRouter();

  const [trade, setTrade] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number | null; feedback: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setHistory(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const pickPhoto = async (fromCamera: boolean) => {
    try {
      let res: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Camera permission is needed."); return; }
        res = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });
      }
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];

      // Resize and convert to base64
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setPhotoUri(manipResult.uri);
      setBase64(manipResult.base64 ?? null);
      setResult(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load photo.");
    }
  };

  const analyse = async () => {
    if (!trade || !base64) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade,
          checklist: CHECKLISTS[trade] ?? [],
          image: base64,
        }),
      });
      const data = await response.json();
      const feedback: string = data?.feedback ?? data?.result ?? data?.message ?? "No feedback returned.";
      const scoreMatch = feedback.match(/(\d+)\s*(?:%|\/100|out of 100)/i);
      const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : null;
      const newResult = { score, feedback };
      setResult(newResult);

      // Save to history
      const item: HistoryItem = {
        id: Date.now().toString(),
        trade,
        date: new Date().toISOString(),
        score,
        feedback,
      };
      const updated = [item, ...history].slice(0, 20);
      setHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e: any) {
      Alert.alert("Analysis Error", e?.message ?? "Could not connect to AI.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhotoUri(null);
    setBase64(null);
    setResult(null);
    setTrade(null);
  };

  const scoreColor = (s: number | null) => {
    if (s === null) return "rgba(255,255,255,0.55)";
    if (s >= 80) return "#22c55e";
    if (s >= 50) return "#f97316";
    return "#ef4444";
  };

  const selectedTrade = TRADES.find((t) => t.id === trade);
  const checklist = trade ? CHECKLISTS[trade] ?? [] : [];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Training Mode</Text>
        <Text style={styles.subtitle}>Practice your compliance checklist with AI coaching</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Trade selector */}
        <Text style={styles.sectionLabel}>SELECT TRADE</Text>
        <View style={styles.tradeGrid}>
          {TRADES.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.tradeBtn, trade === t.id && styles.tradeBtnActive]}
              onPress={() => { setTrade(t.id); setResult(null); setPhotoUri(null); setBase64(null); }}
            >
              <Text style={styles.tradeIcon}>{t.icon}</Text>
              <Text style={[styles.tradeBtnText, trade === t.id && styles.tradeBtnTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Checklist preview */}
        {trade && (
          <>
            <Text style={styles.sectionLabel}>CHECKLIST — {selectedTrade?.label.toUpperCase()}</Text>
            <View style={styles.checklistCard}>
              {checklist.map((item, i) => (
                <View key={i} style={[styles.checklistRow, i < checklist.length - 1 && styles.checklistRowBorder]}>
                  <Text style={styles.checklistDot}>·</Text>
                  <Text style={styles.checklistItem}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Photo picker */}
            <Text style={styles.sectionLabel}>UPLOAD SITE PHOTO</Text>
            {photoUri ? (
              <View style={styles.photoCard}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <Pressable style={styles.changePhotoBtn} onPress={() => { setPhotoUri(null); setBase64(null); setResult(null); }}>
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoPickerRow}>
                <Pressable style={styles.photoPickerBtn} onPress={() => pickPhoto(true)}>
                  <Text style={styles.photoPickerIcon}>📷</Text>
                  <Text style={styles.photoPickerText}>Take Photo</Text>
                </Pressable>
                <Pressable style={styles.photoPickerBtn} onPress={() => pickPhoto(false)}>
                  <Text style={styles.photoPickerIcon}>🖼️</Text>
                  <Text style={styles.photoPickerText}>From Library</Text>
                </Pressable>
              </View>
            )}

            {/* Analyse button */}
            {photoUri && !result && (
              <Pressable
                style={[styles.analyseBtn, loading && { opacity: 0.6 }]}
                onPress={analyse}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color="#07152b" size="small" />
                    <Text style={styles.analyseBtnText}>Analysing…</Text>
                  </>
                ) : (
                  <Text style={styles.analyseBtnText}>Analyse with AI Coach →</Text>
                )}
              </Pressable>
            )}

            {/* Result */}
            {result && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>AI Coaching Result</Text>
                  {result.score !== null && (
                    <View style={[styles.scoreBadge, { borderColor: scoreColor(result.score) + "55", backgroundColor: scoreColor(result.score) + "18" }]}>
                      <Text style={[styles.scoreBadgeText, { color: scoreColor(result.score) }]}>{result.score}%</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.resultFeedback}>{result.feedback}</Text>
                <Pressable style={styles.resetBtn} onPress={reset}>
                  <Text style={styles.resetBtnText}>↺ Start New Session</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <Pressable style={styles.historyToggle} onPress={() => setShowHistory((v) => !v)}>
              <Text style={styles.historyToggleText}>
                {showHistory ? "▼" : "▶"} Training History ({history.length})
              </Text>
            </Pressable>
            {showHistory && history.map((h) => (
              <View key={h.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyTrade}>
                    {TRADES.find((t) => t.id === h.trade)?.icon ?? "📋"} {TRADES.find((t) => t.id === h.trade)?.label ?? h.trade}
                  </Text>
                  <Text style={[styles.historyScore, { color: scoreColor(h.score) }]}>
                    {h.score !== null ? `${h.score}%` : "—"}
                  </Text>
                </View>
                <Text style={styles.historyDate}>
                  {new Date(h.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
                <Text style={styles.historyFeedback} numberOfLines={3}>{h.feedback}</Text>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 14 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },

  body: { padding: 20, gap: 12, paddingBottom: 60 },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginLeft: 2,
  },

  tradeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tradeBtn: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0f2035",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 6,
  },
  tradeBtnActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.10)" },
  tradeIcon: { fontSize: 24 },
  tradeBtnText: { color: "rgba(255,255,255,0.70)", fontWeight: "700", fontSize: 13 },
  tradeBtnTextActive: { color: "#f97316" },

  checklistCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  checklistRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 11, alignItems: "flex-start" },
  checklistRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  checklistDot: { color: "#f97316", fontWeight: "900", fontSize: 16, marginTop: -1 },
  checklistItem: { flex: 1, color: "rgba(255,255,255,0.80)", fontSize: 14, lineHeight: 20 },

  photoPickerRow: { flexDirection: "row", gap: 12 },
  photoPickerBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0f2035",
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  photoPickerIcon: { fontSize: 28 },
  photoPickerText: { color: "rgba(255,255,255,0.70)", fontWeight: "700", fontSize: 13 },

  photoCard: { borderRadius: 16, overflow: "hidden", gap: 0 },
  photo: { width: "100%", height: 200, borderRadius: 16 },
  changePhotoBtn: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 8,
  },
  changePhotoBtnText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 13 },

  analyseBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  analyseBtnText: { color: "#07152b", fontWeight: "900", fontSize: 16 },

  resultCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 12,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  scoreBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  scoreBadgeText: { fontWeight: "900", fontSize: 15 },
  resultFeedback: { color: "rgba(255,255,255,0.80)", fontSize: 14, lineHeight: 22 },
  resetBtn: { alignItems: "center", paddingVertical: 8 },
  resetBtnText: { color: "#f97316", fontWeight: "800", fontSize: 14 },

  historyToggle: { paddingVertical: 10, alignItems: "center" },
  historyToggleText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 13 },
  historyCard: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    gap: 6,
  },
  historyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTrade: { color: "white", fontWeight: "700", fontSize: 14 },
  historyScore: { fontWeight: "900", fontSize: 14 },
  historyDate: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  historyFeedback: { color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 19 },
});
