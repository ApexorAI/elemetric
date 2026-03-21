import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

type Invoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  subtotal: number;
  gst_amount: number;
  total: number;
  status: string;
  due_date: string;
  created_at: string;
};

function statusColor(status: string): string {
  if (status === "Paid") return "#22c55e";
  if (status === "Overdue") return "#ef4444";
  return "#f97316";
}

const InvoiceCard = React.memo(function InvoiceCard({ inv }: { inv: Invoice }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.invNumber}>{inv.invoice_number}</Text>
          <Text style={styles.clientName}>{inv.client_name}</Text>
          <Text style={styles.invDate}>
            {new Date(inv.created_at).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.invTotal}>${inv.total.toFixed(2)}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor(inv.status) + "55", backgroundColor: statusColor(inv.status) + "18" }]}>
            <Text style={[styles.statusText, { color: statusColor(inv.status) }]}>{inv.status}</Text>
          </View>
        </View>
      </View>
      {inv.due_date ? (
        <Text style={styles.dueDate}>Due: {inv.due_date}</Text>
      ) : null}
    </View>
  );
});

export default function InvoiceHistory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;
          const { data } = await supabase
            .from("invoices")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          if (active && data) setInvoices(data as Invoice[]);
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const exportCSV = async () => {
    if (invoices.length === 0) {
      Alert.alert("No Data", "No invoices to export.");
      return;
    }
    setExporting(true);
    try {
      const header = "Invoice Number,Client Name,Client Email,Date,Subtotal (AUD),GST (AUD),Total (AUD),Status,Due Date\n";
      const rows = invoices.map((inv) => {
        const date = new Date(inv.created_at).toLocaleDateString("en-AU");
        const esc = (v: string | null | undefined) =>
          `"${String(v ?? "").replace(/"/g, '""')}"`;
        return [
          esc(inv.invoice_number),
          esc(inv.client_name),
          esc(inv.client_email),
          esc(date),
          inv.subtotal.toFixed(2),
          inv.gst_amount.toFixed(2),
          inv.total.toFixed(2),
          esc(inv.status),
          esc(inv.due_date),
        ].join(",");
      }).join("\n");
      const csv = header + rows;
      const path = `${FileSystem.cacheDirectory}elemetric-invoices-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Export Invoice CSV", UTI: "public.comma-separated-values-text" });
      } else {
        Alert.alert("CSV Saved", `Saved to: ${path}`);
      }
    } catch (e: any) {
      Alert.alert("Export Error", e?.message ?? "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Invoice History</Text>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} on record</Text>
          {invoices.length > 0 && (
            <Pressable onPress={exportCSV} disabled={exporting} style={styles.exportBtn} accessibilityRole="button" accessibilityLabel="Export CSV">
              {exporting
                ? <ActivityIndicator size="small" color="#f97316" />
                : <Text style={styles.exportBtnText}>Export CSV</Text>
              }
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InvoiceCard inv={item} />}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>$</Text>
              <Text style={styles.emptyTitle}>No invoices yet</Text>
              <Text style={styles.emptyBody}>Generate your first invoice to see it here.</Text>
              <Pressable style={styles.createBtn} onPress={() => router.push("/invoice")} accessibilityRole="button" accessibilityLabel="Create Invoice">
                <Text style={styles.createBtnText}>Create Invoice</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 10 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13, flex: 1 },
  subtitleRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 12 },
  exportBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.12)", borderWidth: 1, borderColor: "rgba(249,115,22,0.30)" },
  exportBtnText: { color: "#f97316", fontWeight: "700", fontSize: 12 },
  body: { padding: 20, gap: 12, paddingBottom: 60 },
  card: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardLeft: { flex: 1, gap: 2 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  invNumber: { color: "#f97316", fontWeight: "900", fontSize: 15 },
  clientName: { color: "white", fontWeight: "700", fontSize: 14 },
  invDate: { color: "rgba(255,255,255,0.40)", fontSize: 12 },
  invTotal: { color: "white", fontWeight: "900", fontSize: 20 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontWeight: "700", fontSize: 12 },
  dueDate: { color: "rgba(255,255,255,0.40)", fontSize: 12 },
  emptyCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: "white", fontWeight: "900", fontSize: 20 },
  emptyBody: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" },
  createBtn: {
    marginTop: 8,
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  createBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
});
