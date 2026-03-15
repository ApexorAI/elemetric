import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Circle } from "react-native-svg";

type AIResult = {
  relevant?: boolean;
  confidence?: number;
  detected?: string[];
  unclear?: string[];
  missing?: string[];
  action?: string;
};

type ReviewPhoto = {
  label: string;
  uri: string;
  base64: string;
  mime: string;
  hash?: string;
  capturedAt?: string;
  role?: "before" | "after";
};

const REVIEW_PHOTOS_FILE = `${FileSystem.documentDirectory}review-photos.json`;

export default function JobSummary() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const decoded: AIResult | null = useMemo(() => {
    try {
      if (!params.result || typeof params.result !== "string") return null;
      return JSON.parse(params.result);
    } catch {
      try {
        if (!params.result || typeof params.result !== "string") return null;
        return JSON.parse(decodeURIComponent(params.result));
      } catch {
        return null;
      }
    }
  }, [params.result]);

  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const info = await FileSystem.getInfoAsync(REVIEW_PHOTOS_FILE);
          if (info.exists && active) {
            const raw = await FileSystem.readAsStringAsync(REVIEW_PHOTOS_FILE, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            const parsed = JSON.parse(raw);
            if (active) setPhotos(Array.isArray(parsed) ? parsed : []);
          }
        } catch {}
        if (active) setLoaded(true);
      };
      load();
      return () => {
        active = false;
      };
    }, [])
  );

  const confidence = decoded?.confidence ?? 0;
  const detected = decoded?.detected ?? [];
  const unclear = decoded?.unclear ?? [];
  const missing = decoded?.missing ?? [];
  const action = decoded?.action ?? "";

  const gaugeColor =
    confidence >= 80 ? "#22c55e" : confidence >= 50 ? "#f97316" : "#ef4444";
  const riskLabel =
    confidence >= 80 ? "LOW RISK" : confidence >= 50 ? "MEDIUM RISK" : "HIGH RISK";
  const riskBg =
    confidence >= 80
      ? "rgba(34,197,94,0.15)"
      : confidence >= 50
      ? "rgba(249,115,22,0.15)"
      : "rgba(239,68,68,0.15)";
  const riskBorderColor =
    confidence >= 80
      ? "rgba(34,197,94,0.40)"
      : confidence >= 50
      ? "rgba(249,115,22,0.40)"
      : "rgba(239,68,68,0.40)";

  const GAUGE_RADIUS = 55;
  const GAUGE_SW = 11;
  const GAUGE_C = 2 * Math.PI * GAUGE_RADIUS;
  const gaugeDashOffset = GAUGE_C - (confidence / 100) * GAUGE_C;

  const getPhotoStatus = (
    photo: ReviewPhoto
  ): "detected" | "missing" | "unclear" | "ok" => {
    const lbl = photo.label.toLowerCase();
    if (
      detected.some(
        (d) =>
          d.toLowerCase().includes(lbl) || lbl.includes(d.toLowerCase())
      )
    )
      return "detected";
    if (
      missing.some(
        (m) =>
          m.toLowerCase().includes(lbl) || lbl.includes(m.toLowerCase())
      )
    )
      return "missing";
    if (
      unclear.some(
        (u) =>
          u.toLowerCase().includes(lbl) || lbl.includes(u.toLowerCase())
      )
    )
      return "unclear";
    return "ok";
  };

  const allActions = [
    ...missing.map((item) => ({
      item,
      type: "missing" as const,
      text: `Retake photo for "${item}" — item was not clearly visible in the provided photo.`,
    })),
    ...unclear.map((item) => ({
      item,
      type: "unclear" as const,
      text: `Improve photo of "${item}" — move closer, improve lighting, and remove any obstructions.`,
    })),
  ];

  if (!loaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
        <Text style={styles.loadingText}>Loading summary…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Job Summary</Text>
        <Text style={styles.subtitle}>
          Review carefully before proceeding to declaration
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Confidence + Risk ── */}
        <View style={styles.scoreCard}>
          <View style={{ position: "relative", alignSelf: "center" }}>
            <Svg width={140} height={140}>
              <Circle
                cx={70}
                cy={70}
                r={GAUGE_RADIUS}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={GAUGE_SW}
                fill="none"
              />
              <Circle
                cx={70}
                cy={70}
                r={GAUGE_RADIUS}
                stroke={gaugeColor}
                strokeWidth={GAUGE_SW}
                fill="none"
                strokeDasharray={`${GAUGE_C} ${GAUGE_C}`}
                strokeDashoffset={gaugeDashOffset}
                strokeLinecap="round"
                rotation="-90"
                originX={70}
                originY={70}
              />
            </Svg>
            <View style={styles.gaugeCenter}>
              <Text style={[styles.gaugeScore, { color: gaugeColor }]}>
                {confidence}%
              </Text>
              <Text style={styles.gaugeLabel}>AI score</Text>
            </View>
          </View>

          <View
            style={[
              styles.riskBanner,
              { backgroundColor: riskBg, borderColor: riskBorderColor },
            ]}
          >
            <Text style={[styles.riskText, { color: gaugeColor }]}>
              {riskLabel}
            </Text>
          </View>
        </View>

        {/* ── Photo Status ── */}
        {photos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photo Status</Text>
            {photos.map((photo, i) => {
              const status = getPhotoStatus(photo);
              const statusIcon =
                status === "detected"
                  ? "✓"
                  : status === "missing"
                  ? "✗"
                  : status === "unclear"
                  ? "!"
                  : "–";
              const statusColor =
                status === "detected"
                  ? "#22c55e"
                  : status === "missing"
                  ? "#ef4444"
                  : status === "unclear"
                  ? "#f97316"
                  : "rgba(255,255,255,0.5)";
              const statusLabel =
                status === "detected"
                  ? "PASS"
                  : status === "missing"
                  ? "FAIL"
                  : status === "unclear"
                  ? "UNCLEAR"
                  : "OK";
              return (
                <View key={i} style={styles.photoRow}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoLabel}>{photo.label}</Text>
                    {photo.role && (
                      <Text style={styles.photoRole}>
                        {photo.role === "before" ? "Before" : "After"}
                      </Text>
                    )}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: `${statusColor}22`,
                          borderColor: `${statusColor}66`,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusIcon, { color: statusColor }]}
                      >
                        {statusIcon}
                      </Text>
                      <Text
                        style={[styles.statusLabel, { color: statusColor }]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Recommended Actions ── */}
        {allActions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            <Text style={styles.sectionSubtitle}>
              Address these before proceeding to sign
            </Text>
            {allActions.map((a, i) => (
              <View
                key={i}
                style={[
                  styles.actionRow,
                  a.type === "missing"
                    ? styles.actionRowRed
                    : styles.actionRowOrange,
                ]}
              >
                <Text
                  style={[
                    styles.actionIcon,
                    { color: a.type === "missing" ? "#ef4444" : "#f97316" },
                  ]}
                >
                  {a.type === "missing" ? "✗" : "!"}
                </Text>
                <Text style={styles.actionText}>{a.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.allClearCard}>
            <Text style={styles.allClearIcon}>✓</Text>
            <Text style={styles.allClearTitle}>All items verified</Text>
            <Text style={styles.allClearBody}>
              No missing or unclear items detected. Your documentation is
              complete and ready to sign.
            </Text>
          </View>
        )}

        {/* ── Overall Action ── */}
        {!!action && (
          <View style={styles.overallCard}>
            <Text style={styles.overallLabel}>AI RECOMMENDATION</Text>
            <Text style={styles.overallText}>{action}</Text>
          </View>
        )}

        {/* ── Buttons ── */}
        <Pressable
          style={styles.retakeBtn}
          onPress={() => router.push("/plumbing/photos")}
        >
          <Text style={styles.retakeBtnText}>Retake Photos</Text>
        </Pressable>

        <Pressable
          style={styles.proceedBtn}
          onPress={() => router.push("/plumbing/declaration")}
        >
          <Text style={styles.proceedBtnText}>Proceed to Declaration →</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back to AI Overview</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#07152b",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: "rgba(255,255,255,0.7)" },
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.70)", fontSize: 13 },
  body: { padding: 18, gap: 12, paddingBottom: 40 },
  scoreCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18,
    gap: 14,
    alignItems: "center",
  },
  gaugeCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeScore: { fontSize: 30, fontWeight: "900" },
  gaugeLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 },
  riskBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
    alignSelf: "stretch",
  },
  riskText: { fontWeight: "900", fontSize: 17, letterSpacing: 2 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: -6,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  photoInfo: { flex: 1, gap: 4 },
  photoLabel: { color: "white", fontWeight: "700", fontSize: 14 },
  photoRole: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusIcon: { fontWeight: "900", fontSize: 12 },
  statusLabel: { fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  actionRowRed: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.25)",
  },
  actionRowOrange: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.25)",
  },
  actionIcon: { fontWeight: "900", fontSize: 14, marginTop: 1 },
  actionText: {
    flex: 1,
    color: "rgba(255,255,255,0.80)",
    fontSize: 14,
    lineHeight: 20,
  },
  allClearCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.30)",
    backgroundColor: "rgba(34,197,94,0.08)",
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  allClearIcon: { fontSize: 32, color: "#22c55e" },
  allClearTitle: { color: "#22c55e", fontWeight: "900", fontSize: 18 },
  allClearBody: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  overallCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    backgroundColor: "rgba(249,115,22,0.10)",
    padding: 16,
    gap: 6,
  },
  overallLabel: {
    color: "#f97316",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  overallText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 22,
  },
  retakeBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  retakeBtnText: { color: "white", fontWeight: "900", fontSize: 16 },
  proceedBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#f97316",
  },
  proceedBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 17 },
  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.60)", fontWeight: "700" },
});
