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
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TEMPLATES_KEY = "elemetric_job_templates";

const JOB_TYPES = [
  { key: "hotwater",   label: "Hot Water System" },
  { key: "gas",        label: "Gas Rough-In" },
  { key: "drainage",   label: "Drainage" },
  { key: "newinstall", label: "New Installation" },
  { key: "electrical", label: "Electrical" },
  { key: "hvac",       label: "HVAC" },
  { key: "carpentry",  label: "Carpentry" },
];

type Template = {
  id: string;
  name: string;
  jobType: string;
  notes: string;
  reminders: string;
  createdAt: string;
};

export default function JobTemplates() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [jobType, setJobType] = useState("hotwater");
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
          const parsed: Template[] = raw ? JSON.parse(raw) : [];
          if (active) setTemplates(parsed);
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const saveTemplate = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a template name.");
      return;
    }
    setSaving(true);
    try {
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: name.trim(),
        jobType,
        notes: notes.trim(),
        reminders: reminders.trim(),
        createdAt: new Date().toISOString(),
      };
      const updated = [newTemplate, ...templates];
      await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
      setTemplates(updated);
      setName("");
      setNotes("");
      setReminders("");
      setCreating(false);
      showToast("Template saved.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save template.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    Alert.alert("Delete Template", "Remove this template?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = templates.filter((t) => t.id !== id);
          await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
          setTemplates(updated);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Job Templates</Text>
        <Text style={styles.subtitle}>Create reusable job templates for your team</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Create new template button */}
        {!creating && (
          <Pressable
            style={styles.createBtn}
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="Create new template"
          >
            <Text style={styles.createBtnText}>+ Create New Template</Text>
          </Pressable>
        )}

        {/* Template form */}
        {creating && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Template</Text>

            <Text style={styles.label}>Template Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Standard Hot Water Install"
              placeholderTextColor="rgba(255,255,255,0.35)"
              accessibilityLabel="Template name"
            />

            <Text style={styles.label}>Job Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {JOB_TYPES.map((t) => (
                  <Pressable
                    key={t.key}
                    style={[styles.typeChip, jobType === t.key && styles.typeChipActive]}
                    onPress={() => setJobType(t.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Job type: ${t.label}`}
                  >
                    <Text style={[styles.typeChipText, jobType === t.key && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Standard Notes</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Default notes that will appear in every job using this template…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              numberOfLines={3}
              accessibilityLabel="Standard notes"
            />

            <Text style={styles.label}>Default Checklist Reminders</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={reminders}
              onChangeText={setReminders}
              placeholder="Reminders for the checklist, one per line…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              numberOfLines={3}
              accessibilityLabel="Checklist reminders"
            />

            <View style={styles.formActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setCreating(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveTemplate}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Save template"
              >
                {saving
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.saveBtnText}>Save Template</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

        {/* Templates list */}
        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
        ) : templates.length === 0 && !creating ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptySubtitle}>
              Create templates to save time when assigning recurring job types
            </Text>
          </View>
        ) : (
          templates.map((t) => (
            <View key={t.id} style={styles.templateCard}>
              <View style={styles.templateTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateType}>
                    {JOB_TYPES.find((j) => j.key === t.jobType)?.label ?? t.jobType}
                  </Text>
                </View>
                <Pressable
                  onPress={() => deleteTemplate(t.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete template ${t.name}`}
                >
                  <Text style={styles.deleteBtn}>✕</Text>
                </Pressable>
              </View>
              {t.notes ? (
                <Text style={styles.templateNotes} numberOfLines={2}>{t.notes}</Text>
              ) : null}
              {t.reminders ? (
                <Text style={styles.templateReminders} numberOfLines={2}>Reminders: {t.reminders}</Text>
              ) : null}
              <Text style={styles.templateDate}>
                Created {new Date(t.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          ))
        )}

        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },
  body: { padding: 18, gap: 12, paddingBottom: 60 },

  createBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  createBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },

  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18,
    gap: 4,
  },
  formTitle: { color: "white", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  label: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },

  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  typeChipActive: { backgroundColor: "#f97316", borderColor: "#f97316" },
  typeChipText: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
  typeChipTextActive: { color: "#0b1220" },

  formActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cancelBtnText: { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 14 },
  saveBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f97316",
  },
  saveBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 14 },

  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "white", fontSize: 17, fontWeight: "900" },
  emptySubtitle: { color: "rgba(255,255,255,0.50)", fontSize: 13, textAlign: "center", lineHeight: 19 },

  templateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 6,
  },
  templateTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  templateName: { color: "white", fontWeight: "900", fontSize: 16 },
  templateType: { color: "#f97316", fontSize: 12, fontWeight: "700", marginTop: 2 },
  templateNotes: { color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 18 },
  templateReminders: { color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 17 },
  templateDate: { color: "rgba(255,255,255,0.30)", fontSize: 11, marginTop: 4 },
  deleteBtn: { color: "rgba(255,255,255,0.35)", fontSize: 18, fontWeight: "300" },

  back: { marginTop: 8, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },

  toast: {
    position: "absolute", bottom: 40, left: 20, right: 20,
    backgroundColor: "#22c55e", borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  toastText: { color: "white", fontWeight: "900", fontSize: 15 },
});
