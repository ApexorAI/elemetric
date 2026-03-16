import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";

// ── Data Export & Privacy Screen ───────────────────────────────────────────────

type ExportFormat = "json" | "csv";

export default function DataExport() {
  const router = useRouter();

  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [clearingLocal, setClearingLocal] = useState(false);

  // ── Export helpers ────────────────────────────────────────────────────────────

  const gatherData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const [jobsRemote, profile, nearMisses] = await Promise.all([
      user
        ? supabase.from("jobs").select("*").eq("user_id", user.id).then((r) => r.data ?? [])
        : Promise.resolve([]),
      user
        ? supabase.from("profiles").select("*").eq("user_id", user.id).single().then((r) => r.data)
        : Promise.resolve(null),
      user
        ? supabase.from("near_misses").select("*").eq("user_id", user.id).then((r) => r.data ?? [])
        : Promise.resolve([]),
    ]);

    const localJobsRaw = await AsyncStorage.getItem("elemetric_jobs");
    const localJobs = localJobsRaw ? JSON.parse(localJobsRaw) : [];
    const installerName = await AsyncStorage.getItem("elemetric_installer_name");
    const materialsRaw = await AsyncStorage.getItem("elemetric_materials");
    const materials = materialsRaw ? JSON.parse(materialsRaw) : [];

    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: user?.email ?? null,
        userId: user?.id ?? null,
        profile,
      },
      jobs: {
        remote: jobsRemote,
        local: localJobs,
      },
      nearMisses,
      settings: {
        installerName,
        materials,
      },
    };
  };

  const exportJson = async () => {
    setExportingJson(true);
    try {
      const data = await gatherData();
      const json = JSON.stringify(data, null, 2);
      const path = `${FileSystem.documentDirectory}elemetric-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: "Export Elemetric Data",
        });
      } else {
        Alert.alert("Saved", `Data exported to app documents: ${path}`);
      }
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message ?? "Could not export data.");
    } finally {
      setExportingJson(false);
    }
  };

  const exportCsv = async () => {
    setExportingCsv(true);
    try {
      const data = await gatherData();
      const allJobs = [
        ...data.jobs.remote.map((j: any) => ({ source: "cloud", ...j })),
        ...data.jobs.local.map((j: any) => ({ source: "local", ...j })),
      ];

      if (allJobs.length === 0) {
        Alert.alert("No Jobs", "No job records found to export as CSV.");
        return;
      }

      const headers = ["source", "id", "job_type", "job_name", "job_addr", "confidence", "status", "created_at"];
      const rows = allJobs.map((j) =>
        headers.map((h) => {
          const val = j[h] ?? "";
          const s = String(val).replace(/"/g, '""');
          return `"${s}"`;
        }).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");

      const path = `${FileSystem.documentDirectory}elemetric-jobs-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          dialogTitle: "Export Jobs CSV",
        });
      } else {
        Alert.alert("Saved", `CSV exported to: ${path}`);
      }
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message ?? "Could not export CSV.");
    } finally {
      setExportingCsv(false);
    }
  };

  // ── Deletion helpers ──────────────────────────────────────────────────────────

  const clearLocalData = () => {
    Alert.alert(
      "Clear Local Data",
      "This will remove all locally cached jobs, checklists, and settings from this device. Your cloud data is unaffected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearingLocal(true);
            try {
              const KEYS = [
                "elemetric_jobs",
                "elemetric_current_job",
                "elemetric_installer_name",
                "elemetric_materials",
                "elemetric_current_checklist",
                "elemetric_signature_svg",
                "elemetric_signature_name",
                "elemetric_signature_default",
                "elemetric_notif_sound",
                "elemetric_recent_trade",
                "elemetric_data_export",
              ];
              await AsyncStorage.multiRemove(KEYS);
              Alert.alert("Done", "Local data cleared.");
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Could not clear local data.");
            } finally {
              setClearingLocal(false);
            }
          },
        },
      ]
    );
  };

  const requestDeletion = () => {
    Alert.alert(
      "Request Account Deletion",
      "We will permanently delete your account and all associated data within 30 days, in line with our Privacy Policy and Australian Privacy Act obligations.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit Request",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const email = user?.email ?? "unknown";
              const subject = encodeURIComponent("GDPR/Privacy Account Deletion Request");
              const body = encodeURIComponent(
                `Please delete the Elemetric account and all associated data for:\n\nEmail: ${email}\nUser ID: ${user?.id ?? "unknown"}\n\nI understand this action is irreversible.`
              );
              Linking.openURL(`mailto:cayde@elemetric.com.au?subject=${subject}&body=${body}`);
            } catch {
              Alert.alert("Error", "Could not open Mail. Please email cayde@elemetric.com.au manually.");
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.brand}>ELEMETRIC</Text>
      <Text style={styles.title}>Data & Privacy</Text>
      <Text style={styles.subtitle}>Export your data or manage your account</Text>

      {/* Export section */}
      <Text style={styles.sectionLabel}>EXPORT YOUR DATA</Text>

      <View style={styles.group}>
        <View style={styles.exportRow}>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Full Export (JSON)</Text>
            <Text style={styles.exportSub}>All jobs, near misses, profile, and settings</Text>
          </View>
          <Pressable
            style={[styles.exportBtn, exportingJson && { opacity: 0.6 }]}
            onPress={exportJson}
            disabled={exportingJson}
          >
            {exportingJson
              ? <ActivityIndicator size="small" color="#f97316" />
              : <Text style={styles.exportBtnText}>Export</Text>
            }
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.exportRow}>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Jobs CSV</Text>
            <Text style={styles.exportSub}>Job records in spreadsheet-compatible format</Text>
          </View>
          <Pressable
            style={[styles.exportBtn, exportingCsv && { opacity: 0.6 }]}
            onPress={exportCsv}
            disabled={exportingCsv}
          >
            {exportingCsv
              ? <ActivityIndicator size="small" color="#f97316" />
              : <Text style={styles.exportBtnText}>Export</Text>
            }
          </Pressable>
        </View>
      </View>

      {/* What's included */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📦 What's included in exports</Text>
        <Text style={styles.infoItem}>• All job records (cloud + local)</Text>
        <Text style={styles.infoItem}>• Near miss reports</Text>
        <Text style={styles.infoItem}>• Profile information</Text>
        <Text style={styles.infoItem}>• App settings and preferences</Text>
        <Text style={styles.infoItem}>• Material lists</Text>
      </View>

      {/* Local data */}
      <Text style={styles.sectionLabel}>LOCAL DATA</Text>
      <View style={styles.group}>
        <Pressable
          style={[styles.row, clearingLocal && { opacity: 0.6 }]}
          onPress={clearLocalData}
          disabled={clearingLocal}
        >
          {clearingLocal
            ? <ActivityIndicator size="small" color="#ef4444" style={{ flex: 1 }} />
            : <>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Clear Local Cache</Text>
                  <Text style={styles.rowSub}>Remove cached jobs and settings from this device</Text>
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </>
          }
        </Pressable>
      </View>

      {/* GDPR / Account deletion */}
      <Text style={styles.sectionLabel}>ACCOUNT DELETION</Text>
      <View style={styles.deletionCard}>
        <Text style={styles.deletionTitle}>Right to be Forgotten</Text>
        <Text style={styles.deletionBody}>
          Under the Australian Privacy Act and GDPR, you have the right to request deletion of all your personal data. Submitting this request will permanently remove your account and all associated records within 30 days.
        </Text>
        <Pressable style={styles.deletionBtn} onPress={requestDeletion}>
          <Text style={styles.deletionBtnText}>Request Account Deletion</Text>
        </Pressable>
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  body: { padding: 20, paddingBottom: 60, gap: 14 },

  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2, marginTop: 10 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 10,
  },

  group: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 16,
  },

  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  exportInfo: { flex: 1 },
  exportTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  exportSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  exportBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnText: { color: "#f97316", fontWeight: "900", fontSize: 13 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  rowSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  rowChevron: { color: "rgba(255,255,255,0.25)", fontSize: 26, fontWeight: "300" },

  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    padding: 16,
    gap: 5,
  },
  infoTitle: { color: "white", fontWeight: "800", fontSize: 15, marginBottom: 4 },
  infoItem: { color: "rgba(255,255,255,0.55)", fontSize: 13 },

  deletionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    backgroundColor: "#0f2035",
    padding: 16,
    gap: 10,
  },
  deletionTitle: { color: "#ef4444", fontWeight: "900", fontSize: 15 },
  deletionBody: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 },
  deletionBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.40)",
    marginTop: 4,
  },
  deletionBtnText: { color: "#ef4444", fontWeight: "900", fontSize: 14 },

  back: { alignItems: "center", paddingVertical: 10 },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
