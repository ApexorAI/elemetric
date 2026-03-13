import React, { useState, useCallback, useRef } from "react";
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

// ── Constants ──────────────────────────────────────────────────────────────────

const TRADE_TYPES = ["Gas", "Plumbing", "Electrical", "HVAC", "Drainage", "Other"] as const;
type TradeType = (typeof TRADE_TYPES)[number];

const getTodayDDMMYYYY = (): string => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// ── Main screen ────────────────────────────────────────────────────────────────

export default function NearMiss() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  // Profile
  const [plumberName, setPlumberName] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Form fields
  const [propertyAddress, setPropertyAddress] = useState("");
  const [dateDiscovered, setDateDiscovered] = useState(getTodayDDMMYYYY());
  const [tradeType, setTradeType] = useState<TradeType>("Plumbing");
  const [description, setDescription] = useState("");

  // Photos
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  // PDF
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Load profile ────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user && active) {
            const { data } = await supabase
              .from("profiles")
              .select("full_name, licence_number, company_name")
              .eq("user_id", user.id)
              .single();
            if (data && active) {
              if (data.full_name) setPlumberName(data.full_name);
              if (data.licence_number) setLicenceNumber(data.licence_number);
              if (data.company_name) setCompanyName(data.company_name);
            }
          }
        } catch {}
        if (active) setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  // ── Photos ──────────────────────────────────────────────────────────────────

  const addPhoto = async (source: "library" | "camera") => {
    try {
      if (source === "library") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Please allow photo library access.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
          allowsMultipleSelection: true,
        });
        if (result.canceled) return;
        const uris = result.assets?.map((a) => a.uri).filter(Boolean) ?? [];
        if (uris.length) setPhotoUris((prev) => [...prev, ...uris]);
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Please allow camera access.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
        });
        if (result.canceled) return;
        const uri = result.assets?.[0]?.uri;
        if (uri) setPhotoUris((prev) => [...prev, uri]);
      }
    } catch (e: any) {
      Alert.alert("Photo error", e?.message ?? "Unknown error");
    }
  };

  const showPhotoOptions = () => {
    Alert.alert("Add Photo", "Choose a source", [
      { text: "Camera", onPress: () => addPhoto("camera") },
      { text: "Photo Library", onPress: () => addPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const removePhoto = (uri: string) => {
    setPhotoUris((prev) => prev.filter((u) => u !== uri));
  };

  // ── PDF ─────────────────────────────────────────────────────────────────────

  const generateReport = async () => {
    if (!propertyAddress.trim()) {
      Alert.alert("Missing field", "Please enter the property address.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing field", "Please enter a description of the issue.");
      return;
    }
    setPdfLoading(true);
    try {
      const now = new Date();
      const dateShort = now.toLocaleDateString("en-AU");

      // QR code
      let qrHtml = "";
      try {
        const qrData = `ELM|near-miss|${propertyAddress}|${dateDiscovered}|${tradeType}`;
        const qrSvg = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
        const qrUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
        qrHtml = `<div style="text-align:center;">
          <img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
          <div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
        </div>`;
      } catch {}

      // Photos — convert to base64 for embedding
      const photoHtmlItems: string[] = [];
      for (const uri of photoUris) {
        try {
          const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          });
          if (r.base64) {
            photoHtmlItems.push(
              `<div style="break-inside:avoid;">
                <img src="data:image/jpeg;base64,${r.base64}" style="width:100%;height:220px;object-fit:cover;border-radius:6px;display:block;border:1px solid #e5e7eb;"/>
              </div>`
            );
          }
        } catch {}
      }

      const photosSection =
        photoHtmlItems.length > 0
          ? `<div style="margin-bottom:20px;">
              <div style="font-size:19px;font-weight:bold;margin-bottom:12px;">Site Photos</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                ${photoHtmlItems.join("")}
              </div>
            </div>`
          : "";

      const td = "border:1px solid #d1d5db;padding:8px;";

      const html = `<html><head><style>@page{margin:15mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}@bottom-left{content:"ELEMETRIC \00B7 Confidential";font-size:9pt;color:#6b7280;font-family:Arial,sans-serif;}}body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;background:#fff;}</style></head>
<body>
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="font-size:28px;font-weight:900;letter-spacing:3px;">ELEMETRIC</div>
  ${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="font-size:14px;font-weight:bold;">Near Miss / Pre-Existing Non-Compliance Record</div>
  <div style="font-size:12px;">${dateShort}</div>
</div>

<div style="padding:22px;">

  <div style="margin-bottom:20px;">
    <div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Job Details</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="${td}background:#f3f4f6;width:180px;"><strong>Property Address</strong></td><td style="${td}">${propertyAddress || "Not entered"}</td></tr>
      <tr><td style="${td}background:#f3f4f6;"><strong>Date Discovered</strong></td><td style="${td}">${dateDiscovered || "Not entered"}</td></tr>
      <tr><td style="${td}background:#f3f4f6;"><strong>Trade Type</strong></td><td style="${td}">${tradeType}</td></tr>
      <tr><td style="${td}background:#f3f4f6;"><strong>Reported By</strong></td><td style="${td}">${plumberName || "Not entered"}</td></tr>
      <tr><td style="${td}background:#f3f4f6;"><strong>Licence No.</strong></td><td style="${td}">${licenceNumber || "Not entered"}</td></tr>
      <tr><td style="${td}background:#f3f4f6;"><strong>Company</strong></td><td style="${td}">${companyName || "Not entered"}</td></tr>
    </table>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:19px;font-weight:bold;margin-bottom:10px;">Description of Non-Compliant Work</div>
    <div style="border:1px solid #d1d5db;border-radius:6px;padding:14px;font-size:14px;line-height:1.7;white-space:pre-wrap;">${description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>

  ${photosSection}

  <div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;page-break-inside:avoid;">
    <div style="font-size:18px;font-weight:bold;margin-bottom:12px;">Sign-Off</div>
    <div style="margin-bottom:6px;"><strong>Reported by:</strong> ${plumberName || "Not entered"}</div>
    <div style="width:200px;height:40px;border-bottom:1px solid #111827;margin-bottom:6px;"></div>
    <div style="font-size:13px;"><strong>Date:</strong> ${dateShort}</div>
  </div>

  <div style="margin-top:24px;padding:14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;font-size:11px;color:#92400e;line-height:1.7;">
    <strong style="color:#78350f;">IMPORTANT:</strong> This record documents pre-existing non-compliant work discovered by the undersigned tradesperson on the date indicated. The undersigned takes no responsibility for this pre-existing condition and this record is created solely to protect against any future claim of liability for work performed by others prior to this visit. Always consult the relevant Australian standard.
  </div>

</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });
      try {
        await AsyncStorage.setItem("elemetric_pdf_generated", "1");
      } catch {}
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Near Miss Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Created", `Saved to: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Near Miss Report</Text>
        <Text style={styles.subtitle}>Pre-existing non-compliance documentation</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Property Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>

          <Text style={styles.fieldLabel}>Property Address</Text>
          <TextInput
            style={styles.input}
            value={propertyAddress}
            onChangeText={setPropertyAddress}
            placeholder="Enter full property address"
            placeholderTextColor="#555"
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Date Discovered</Text>
          <TextInput
            style={styles.input}
            value={dateDiscovered}
            onChangeText={setDateDiscovered}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#555"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* ── Trade Type ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trade Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tradeRow}
          >
            {TRADE_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.tradeChip, tradeType === t && styles.tradeChipActive]}
                onPress={() => setTradeType(t)}
              >
                <Text style={[styles.tradeChipText, tradeType === t && styles.tradeChipTextActive]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Description ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description of Issue</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the pre-existing non-compliant work found on site, including location, nature of the defect, and any relevant details…"
            placeholderTextColor="#555"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* ── Photos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Photos</Text>
          <Text style={styles.fieldLabel}>
            {photoUris.length === 0
              ? "No photos added"
              : `${photoUris.length} photo${photoUris.length !== 1 ? "s" : ""} added`}
          </Text>

          {photoUris.length > 0 && (
            <View style={styles.photoGrid}>
              {photoUris.map((uri, i) => (
                <View key={`photo-${i}`} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} />
                  <Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(uri)}>
                    <Text style={styles.removePhotoText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable style={styles.addPhotoBtn} onPress={showPhotoOptions}>
            <Text style={styles.addPhotoBtnText}>+ Add Photo</Text>
          </Pressable>
        </View>

        {/* ── Reporter Details (read-only display) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reported By</Text>
          <View style={styles.profileRow}>
            <View style={styles.profileField}>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.profileValue}>{plumberName || "Not set in profile"}</Text>
            </View>
            <View style={styles.profileField}>
              <Text style={styles.fieldLabel}>Licence No.</Text>
              <Text style={styles.profileValue}>{licenceNumber || "Not set in profile"}</Text>
            </View>
            <View style={styles.profileField}>
              <Text style={styles.fieldLabel}>Company</Text>
              <Text style={styles.profileValue}>{companyName || "Not set in profile"}</Text>
            </View>
          </View>
          <Text style={styles.profileHint}>
            Update these details in your profile settings.
          </Text>
        </View>

        {/* ── Disclaimer ── */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>IMPORTANT</Text>
          <Text style={styles.disclaimerText}>
            This record documents pre-existing non-compliant work discovered by the undersigned
            tradesperson on the date indicated. The undersigned takes no responsibility for this
            pre-existing condition and this record is created solely to protect against any future
            claim of liability for work performed by others prior to this visit. Always consult the
            relevant Australian standard.
          </Text>
        </View>

        {/* ── Generate PDF ── */}
        <Pressable
          style={[styles.reportBtn, pdfLoading && { opacity: 0.6 }]}
          onPress={generateReport}
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="white" />
              <Text style={styles.reportBtnText}> Generating PDF…</Text>
            </View>
          ) : (
            <Text style={styles.reportBtnText}>Generate PDF Report</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

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

  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { padding: 18, gap: 12, paddingBottom: 40 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 10,
  },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  fieldLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 12,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 14,
  },

  tradeRow: { gap: 8, paddingVertical: 2 },
  tradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tradeChipActive: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  tradeChipText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    fontSize: 14,
  },
  tradeChipTextActive: {
    color: "#0b1220",
    fontWeight: "900",
  },

  descriptionInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 12,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 14,
    minHeight: 140,
    lineHeight: 22,
  },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoWrap: { position: "relative" },
  photo: { width: 88, height: 88, borderRadius: 10 },
  removePhotoBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  removePhotoText: { color: "white", fontSize: 15, fontWeight: "900", marginTop: -1 },

  addPhotoBtn: {
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  addPhotoBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 14 },

  profileRow: { gap: 6 },
  profileField: { gap: 2 },
  profileValue: { color: "white", fontSize: 15, fontWeight: "700" },
  profileHint: { color: "rgba(255,255,255,0.35)", fontSize: 12 },

  disclaimerBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.45)",
    backgroundColor: "rgba(254,243,199,0.10)",
    padding: 16,
    gap: 8,
  },
  disclaimerTitle: {
    color: "#fcd34d",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1,
  },
  disclaimerText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 20,
  },

  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },

  reportBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.40)",
  },
  reportBtnText: { color: "white", fontWeight: "900", fontSize: 16 },

  back: { marginTop: 6, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
});
