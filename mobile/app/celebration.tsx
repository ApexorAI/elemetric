import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";

// ── Stage 2 unlock celebration screen ────────────────────────────────────────
// Shown once, after a user generates their very first PDF compliance report.
// Sets elemetric_stage2_unlocked = "true" in AsyncStorage so subsequent
// app launches unlock the full feature set.

export const STAGE2_KEY = "elemetric_stage2_unlocked";

export default function Celebration() {
  const router = useRouter();
  const { jobAddr, confidence, reportUri } = useLocalSearchParams<{
    jobAddr?: string;
    confidence?: string;
    reportUri?: string;
  }>();

  // Pulse animation on shield
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const confScore = confidence ? parseInt(confidence, 10) : null;
  const confColor = confScore != null
    ? confScore >= 80 ? "#22c55e" : confScore >= 50 ? "#f97316" : "#ef4444"
    : "#f97316";

  const handleShareWithClient = async () => {
    if (reportUri) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(reportUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Compliance Report",
        });
      }
    } else {
      await Share.share({
        message: `Your compliance report has been completed by Elemetric. Job: ${jobAddr ?? "your property"}.`,
      });
    }
  };

  const handleSaveToFiles = async () => {
    if (reportUri) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(reportUri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      }
    }
    router.replace("/(tabs)/" as never);
  };

  const handleViewReport = () => {
    if (reportUri) {
      router.push({
        pathname: "/pdf-preview",
        params: { uri: reportUri, title: "Compliance Report", filename: "report.pdf" },
      });
    } else {
      router.replace("/(tabs)/" as never);
    }
  };

  return (
    <View style={s.screen}>
      {/* Shield icon */}
      <Animated.View style={[s.shieldWrap, { transform: [{ scale: pulse }] }]}>
        <Text style={s.shieldIcon}>🛡️</Text>
      </Animated.View>

      {/* PROTECTED heading */}
      <Text style={s.heading}>PROTECTED</Text>
      <Text style={s.sub}>Your work is documented</Text>

      {/* Job details card */}
      <View style={s.card}>
        {jobAddr ? (
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>PROPERTY</Text>
            <Text style={s.cardValue} numberOfLines={2}>{jobAddr}</Text>
          </View>
        ) : null}
        {confScore != null ? (
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>AI CONFIDENCE</Text>
            <Text style={[s.cardScore, { color: confColor }]}>{confScore}%</Text>
          </View>
        ) : null}
      </View>

      {/* View report */}
      <Pressable style={s.viewBtn} onPress={handleViewReport}>
        <Text style={s.viewBtnText}>View My Report</Text>
      </Pressable>

      {/* Share / Save row */}
      <View style={s.secondaryRow}>
        <Pressable style={s.secondaryBtn} onPress={handleShareWithClient}>
          <Text style={s.secondaryBtnText}>Share with Client</Text>
        </Pressable>
        <Pressable style={s.secondaryBtn} onPress={handleSaveToFiles}>
          <Text style={s.secondaryBtnText}>Save to Files</Text>
        </Pressable>
      </View>

      {/* Unlock note */}
      <Text style={s.unlockNote}>
        You've unlocked Elemetric's full toolset — explore your Profile to see everything.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07152b",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 20,
  },

  shieldWrap: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: 2,
    borderColor: "rgba(249,115,22,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  shieldIcon: { fontSize: 56 },

  heading: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    marginTop: 4,
  },
  sub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    textAlign: "center",
    marginTop: -8,
  },

  card: {
    width: "100%",
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 12,
  },
  cardRow: { gap: 4 },
  cardLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardValue: { color: "#ffffff", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  cardScore: { fontSize: 28, fontWeight: "900" },

  viewBtn: {
    width: "100%",
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnText: { color: "#07152b", fontSize: 17, fontWeight: "900" },

  secondaryRow: { flexDirection: "row", width: "100%", gap: 12 },
  secondaryBtn: {
    flex: 1,
    height: 52,
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  secondaryBtnText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  unlockNote: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
