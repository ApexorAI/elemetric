import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUBS_KEY = "elemetric_subcontractors";

type Subcontractor = {
  id: string;
  name: string;
  licence_number: string;
  trade_type: string;
  company_name: string;
  abn: string;
  insurance_expiry: string; // DD/MM/YYYY
  licence_expiry: string;   // DD/MM/YYYY
  status: "active" | "expiring" | "expired";
};

function computeStatus(insurance_expiry: string, licence_expiry: string): "active" | "expiring" | "expired" {
  const parseDDMMYYYY = (s: string): Date | null => {
    const parts = s.split("/");
    if (parts.length !== 3) return null;
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  };
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const insDate = parseDDMMYYYY(insurance_expiry);
  const licDate = parseDDMMYYYY(licence_expiry);
  const isExpired = (insDate && insDate < now) || (licDate && licDate < now);
  const isExpiring = !isExpired && ((insDate && insDate < thirtyDays) || (licDate && licDate < thirtyDays));
  if (isExpired) return "expired";
  if (isExpiring) return "expiring";
  return "active";
}

function statusColor(status: string): string {
  if (status === "active") return "#22c55e";
  if (status === "expiring") return "#f97316";
  return "#ef4444";
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "expiring") return "Expiring Soon";
  return "Expired";
}

const EMPTY_FORM = {
  name: "",
  licence_number: "",
  trade_type: "",
  company_name: "",
  abn: "",
  insurance_expiry: "",
  licence_expiry: "",
};

export default function Subcontractors() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const raw = await AsyncStorage.getItem(SUBS_KEY);
        if (raw && active) setSubs(JSON.parse(raw));
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const filtered = subs.filter((s) =>
    search.length === 0 ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.trade_type.toLowerCase().includes(search.toLowerCase()) ||
    s.company_name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (sub: Subcontractor) => {
    setEditId(sub.id);
    setForm({
      name: sub.name,
      licence_number: sub.licence_number,
      trade_type: sub.trade_type,
      company_name: sub.company_name,
      abn: sub.abn,
      insurance_expiry: sub.insurance_expiry,
      licence_expiry: sub.licence_expiry,
    });
    setShowForm(true);
  };

  const saveSub = async () => {
    if (!form.name.trim()) {
      Alert.alert("Required", "Please enter the subcontractor's name.");
      return;
    }
    setSaving(true);
    try {
      const status = computeStatus(form.insurance_expiry, form.licence_expiry);
      let next: Subcontractor[];
      if (editId) {
        next = subs.map((s) =>
          s.id === editId ? { ...s, ...form, status } : s
        );
      } else {
        const newSub: Subcontractor = {
          id: Date.now().toString(),
          ...form,
          status,
        };
        next = [...subs, newSub];
      }
      setSubs(next);
      await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(next));
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteSub = (id: string) => {
    Alert.alert("Remove Subcontractor", "Are you sure you want to remove this subcontractor?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = subs.filter((s) => s.id !== id);
          setSubs(next);
          await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(next));
        },
      },
    ]);
  };

  const updateForm = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.screen}>
      {/* Add/Edit modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>{editId ? "Edit Subcontractor" : "Add Subcontractor"}</Text>

            {[
              { label: "Full Name *", field: "name" as const, placeholder: "e.g. John Smith" },
              { label: "Trade Type", field: "trade_type" as const, placeholder: "e.g. Plumber, Electrician" },
              { label: "Company Name", field: "company_name" as const, placeholder: "e.g. Smith Plumbing Pty Ltd" },
              { label: "Licence Number", field: "licence_number" as const, placeholder: "e.g. PL012345" },
              { label: "ABN", field: "abn" as const, placeholder: "e.g. 12 345 678 901" },
              { label: "Insurance Expiry (DD/MM/YYYY)", field: "insurance_expiry" as const, placeholder: "31/12/2025" },
              { label: "Licence Expiry (DD/MM/YYYY)", field: "licence_expiry" as const, placeholder: "31/12/2025" },
            ].map(({ label, field, placeholder }) => (
              <View key={field} style={{ gap: 6 }}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[field]}
                  onChangeText={(v) => updateForm(field, v)}
                  placeholder={placeholder}
                  placeholderTextColor="rgba(255,255,255,0.30)"
                />
              </View>
            ))}

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveSub}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#07152b" size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>ELEMETRIC</Text>
            <Text style={styles.title}>Subcontractors</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add subcontractor">
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>{subs.length} registered · {subs.filter((s) => s.status === "expiring").length} expiring</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, trade, company…"
          placeholderTextColor="rgba(255,255,255,0.30)"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👷</Text>
            <Text style={styles.emptyTitle}>No subcontractors yet</Text>
            <Text style={styles.emptyBody}>Tap "+ Add" to register a subcontractor and track their licences and insurances.</Text>
          </View>
        ) : (
          filtered.map((sub) => (
            <Pressable key={sub.id} style={styles.card} onPress={() => openEdit(sub)}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  {sub.company_name ? <Text style={styles.subCompany}>{sub.company_name}</Text> : null}
                  <Text style={styles.subMeta}>
                    {sub.trade_type ? `${sub.trade_type}` : "No trade specified"}
                    {sub.licence_number ? ` · ${sub.licence_number}` : ""}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: statusColor(sub.status) + "55", backgroundColor: statusColor(sub.status) + "18" }]}>
                  <Text style={[styles.statusText, { color: statusColor(sub.status) }]}>{statusLabel(sub.status)}</Text>
                </View>
              </View>
              {(sub.insurance_expiry || sub.licence_expiry) && (
                <View style={styles.expiryRow}>
                  {sub.insurance_expiry ? (
                    <Text style={styles.expiryItem}>Insurance: {sub.insurance_expiry}</Text>
                  ) : null}
                  {sub.licence_expiry ? (
                    <Text style={styles.expiryItem}>Licence: {sub.licence_expiry}</Text>
                  ) : null}
                </View>
              )}
              <View style={styles.cardActions}>
                <Pressable style={styles.editBtn} onPress={() => openEdit(sub)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => deleteSub(sub.id)}>
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { marginBottom: 10 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 4 },
  subtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 4 },
  addBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  addBtnText: { color: "#07152b", fontWeight: "900", fontSize: 14 },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  searchInput: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  body: { paddingHorizontal: 20, paddingBottom: 60, gap: 12 },
  card: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardLeft: { flex: 1, gap: 2 },
  subName: { color: "white", fontWeight: "900", fontSize: 16 },
  subCompany: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  subMeta: { color: "rgba(255,255,255,0.40)", fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginLeft: 8,
  },
  statusText: { fontWeight: "700", fontSize: 12 },
  expiryRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  expiryItem: { color: "rgba(255,255,255,0.40)", fontSize: 12 },
  cardActions: { flexDirection: "row", gap: 8 },
  editBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  editBtnText: { color: "#f97316", fontWeight: "700", fontSize: 13 },
  deleteBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  deleteBtnText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },
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
  emptyBody: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center", lineHeight: 22 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    justifyContent: "flex-end",
  },
  modalScroll: {
    backgroundColor: "#0d1f3c",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalContent: {
    padding: 24,
    gap: 14,
    paddingBottom: 40,
  },
  modalTitle: { color: "white", fontWeight: "900", fontSize: 20, marginBottom: 4 },
  fieldLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cancelBtnText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 15 },
  saveBtn: {
    flex: 1,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316",
  },
  saveBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
});
