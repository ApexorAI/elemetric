import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";

// ── PDF Preview Screen ─────────────────────────────────────────────────────────
// Receives: uri (local file path), filename (display name), title (report title)
// Shows a summary card then offers Open / Share / Back actions.

export default function PdfPreview() {
  const router = useRouter();
  const { uri, filename, title } = useLocalSearchParams<{
    uri: string;
    filename: string;
    title?: string;
  }>();

  const [fileSize, setFileSize] = useState<string | null>(null);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!uri) return;
    FileSystem.getInfoAsync(uri).then((info) => {
      if (info.exists && "size" in info && typeof info.size === "number") {
        const kb = (info.size / 1024).toFixed(1);
        setFileSize(`${kb} KB`);
      }
    }).catch(() => {});
  }, [uri]);

  if (!uri) {
    return (
      <View style={styles.screen}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.errorText}>No PDF to preview.</Text>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const openInBrowser = async () => {
    setLoadingOpen(true);
    try {
      await WebBrowser.openBrowserAsync(uri);
    } catch {
      Alert.alert("Cannot Open", "Could not open the PDF. Try using Share instead.");
    } finally {
      setLoadingOpen(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing Unavailable", "Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: filename ?? "Compliance Report",
        UTI: "com.adobe.pdf",
      });
    } catch (e: any) {
      Alert.alert("Share Failed", e?.message ?? "Could not share the PDF.");
    } finally {
      setSharing(false);
    }
  };

  const displayName = filename ?? "Compliance Report.pdf";
  const displayTitle = title ?? "Compliance Report";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>PDF Preview</Text>
        <Text style={styles.subtitle}>Review your report before sharing</Text>
      </View>

      {/* PDF card */}
      <View style={styles.pdfCard}>
        <View style={styles.pdfIconWrap}>
          <Text style={styles.pdfIcon}>📄</Text>
          <View style={styles.pdfBadge}>
            <Text style={styles.pdfBadgeText}>PDF</Text>
          </View>
        </View>

        <View style={styles.pdfInfo}>
          <Text style={styles.pdfTitle} numberOfLines={2}>{displayTitle}</Text>
          <Text style={styles.pdfFilename} numberOfLines={1}>{displayName}</Text>
          <View style={styles.pdfMeta}>
            {fileSize && (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{fileSize}</Text>
              </View>
            )}
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Generated</Text>
            </View>
            <View style={[styles.metaPill, styles.metaPillGreen]}>
              <Text style={[styles.metaPillText, { color: "#22c55e" }]}>Ready</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Info note */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          📋 This report contains your compliance photos, AI analysis, checklist results, and tradesperson signature. Tap <Text style={{ fontWeight: "900" }}>Open</Text> to view in full, or <Text style={{ fontWeight: "900" }}>Share</Text> to send via email, AirDrop, or cloud storage.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actionsCol}>
        <Pressable
          style={[styles.primaryBtn, loadingOpen && { opacity: 0.6 }]}
          onPress={openInBrowser}
          disabled={loadingOpen}
        >
          {loadingOpen
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.primaryBtnText}>Open PDF →</Text>
          }
        </Pressable>

        <Pressable
          style={[styles.secondaryBtn, sharing && { opacity: 0.6 }]}
          onPress={share}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator color="white" />
            : <Text style={styles.secondaryBtnText}>⬆ Share / Export</Text>
          }
        </Pressable>
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b", padding: 20 },

  header: { paddingTop: 10, paddingBottom: 20 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  errorText: { color: "rgba(255,255,255,0.55)", marginTop: 20, fontSize: 16 },

  pdfCard: {
    flexDirection: "row",
    gap: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 18,
    alignItems: "flex-start",
  },
  pdfIconWrap: {
    position: "relative",
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pdfIcon: { fontSize: 32 },
  pdfBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pdfBadgeText: { color: "white", fontSize: 9, fontWeight: "900" },
  pdfInfo: { flex: 1, gap: 6 },
  pdfTitle: { color: "white", fontWeight: "900", fontSize: 17, lineHeight: 22 },
  pdfFilename: { color: "rgba(255,255,255,0.40)", fontSize: 12 },
  pdfMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  metaPillGreen: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.30)",
  },
  metaPillText: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" },

  infoCard: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.18)",
    backgroundColor: "rgba(249,115,22,0.05)",
    padding: 14,
  },
  infoText: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 20 },

  actionsCol: { marginTop: 20, gap: 12 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#f97316",
  },
  primaryBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnText: { color: "white", fontWeight: "900", fontSize: 16 },

  back: { marginTop: 20, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
