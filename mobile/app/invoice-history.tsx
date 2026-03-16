import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

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

export default function InvoiceHistory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Invoice History</Text>
        <Text style={styles.subtitle}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} on record</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
        ) : invoices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>No invoices yet</Text>
            <Text style={styles.emptyBody}>Generate your first invoice to see it here.</Text>
            <Pressable style={styles.createBtn} onPress={() => router.push("/invoice")} accessibilityRole="button" accessibilityLabel="Create Invoice">
              <Text style={styles.createBtnText}>Create Invoice →</Text>
            </Pressable>
          </View>
        ) : (
          invoices.map((inv) => (
            <View key={inv.id} style={styles.card}>
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
              {inv.due_date && (
                <Text style={styles.dueDate}>Due: {inv.due_date}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
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
