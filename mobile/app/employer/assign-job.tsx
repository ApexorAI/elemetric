import React, { useState, useCallback, useEffect } from "react";
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
import { supabase } from "@/lib/supabase";

type TeamMember = {
  userId: string;
  fullName: string;
  licenceNumber: string;
};

const JOB_TYPES = [
  { key: "hotwater",   label: "Plumbing (Hot Water)" },
  { key: "gas",        label: "Gas Rough-In" },
  { key: "drainage",   label: "Drainage" },
  { key: "newinstall", label: "New Install" },
  { key: "electrical", label: "Electrical" },
  { key: "hvac",       label: "HVAC" },
];

export default function AssignJob() {
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [jobName, setJobName] = useState("");
  const [jobAddr, setJobAddr] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedType, setSelectedType] = useState("hotwater");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Nominatim address autocomplete
  const [addrSuggestions, setAddrSuggestions] = useState<string[]>([]);
  const [addrDebounce, setAddrDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          const { data: team } = await supabase
            .from("teams")
            .select("id")
            .eq("owner_id", user.id)
            .single();

          if (!team || !active) return;

          const { data: rawMembers } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", team.id);

          if (!rawMembers || !active) return;

          const hydrated: TeamMember[] = [];
          for (const m of rawMembers) {
            if (!active) break;
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, licence_number")
                .eq("user_id", m.user_id)
                .single();
              hydrated.push({
                userId: m.user_id,
                fullName: profile?.full_name ?? "Unknown",
                licenceNumber: profile?.licence_number ?? "—",
              });
            } catch {}
          }

          if (active) setMembers(hydrated);
        } catch {}
        if (active) setLoadingMembers(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const handleAddrChange = (text: string) => {
    setJobAddr(text);
    setAddrSuggestions([]);
    if (addrDebounce) clearTimeout(addrDebounce);
    if (text.length < 4) return;
    const t = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=au`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const json = await res.json();
        const suggestions = json.map((r: any) => r.display_name as string);
        setAddrSuggestions(suggestions);
      } catch {}
    }, 450);
    setAddrDebounce(t);
  };

  const saveJob = async () => {
    if (!jobName.trim()) {
      Alert.alert("Missing field", "Please enter a job name.");
      return;
    }
    if (!jobAddr.trim()) {
      Alert.alert("Missing field", "Please enter a job address.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const { error } = await supabase.from("jobs").insert({
        user_id: user.id,
        job_type: selectedType,
        job_name: jobName.trim(),
        job_addr: jobAddr.trim(),
        scheduled_date: scheduledDate.trim() || null,
        assigned_to: selectedUserId || null,
        status: selectedUserId ? "assigned" : "unassigned",
        confidence: 0,
        relevant: false,
        detected: [],
        unclear: [],
        missing: [],
        action: "",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      Alert.alert("Job Created", selectedUserId ? "Job assigned successfully." : "Job created (unassigned).", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not create job.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Assign New Job</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Job Name */}
        <Text style={styles.label}>Job Name</Text>
        <TextInput
          style={styles.input}
          value={jobName}
          onChangeText={setJobName}
          placeholder="e.g. Bathroom Hot Water Replacement"
          placeholderTextColor="rgba(255,255,255,0.3)"
          returnKeyType="next"
        />

        {/* Address */}
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={jobAddr}
          onChangeText={handleAddrChange}
          placeholder="Start typing an address…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          returnKeyType="next"
        />
        {addrSuggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {addrSuggestions.map((s, i) => (
              <Pressable
                key={i}
                style={styles.suggestItem}
                onPress={() => {
                  setJobAddr(s);
                  setAddrSuggestions([]);
                }}
              >
                <Text style={styles.suggestText} numberOfLines={2}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Scheduled Date */}
        <Text style={styles.label}>Scheduled Date (optional)</Text>
        <TextInput
          style={styles.input}
          value={scheduledDate}
          onChangeText={setScheduledDate}
          placeholder="e.g. 15 Mar 2026"
          placeholderTextColor="rgba(255,255,255,0.3)"
          returnKeyType="done"
        />

        {/* Job Type */}
        <Text style={styles.label}>Job Type</Text>
        <View style={styles.typeGrid}>
          {JOB_TYPES.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.typeChip, selectedType === t.key && styles.typeChipActive]}
              onPress={() => setSelectedType(t.key)}
            >
              <Text style={[styles.typeChipText, selectedType === t.key && styles.typeChipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Assign To */}
        <Text style={styles.label}>Assign To</Text>
        {loadingMembers ? (
          <ActivityIndicator color="#f97316" style={{ marginVertical: 10 }} />
        ) : members.length === 0 ? (
          <View style={styles.emptyMembers}>
            <Text style={styles.emptyMembersText}>No team members yet. Invite someone first.</Text>
          </View>
        ) : (
          <>
            <Pressable
              style={[styles.memberRow, !selectedUserId && styles.memberRowActive]}
              onPress={() => setSelectedUserId(null)}
            >
              <Text style={styles.memberName}>Unassigned</Text>
              {!selectedUserId && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            {members.map((m) => (
              <Pressable
                key={m.userId}
                style={[styles.memberRow, selectedUserId === m.userId && styles.memberRowActive]}
                onPress={() => setSelectedUserId(m.userId)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.fullName}</Text>
                  <Text style={styles.memberLicence}>{m.licenceNumber}</Text>
                </View>
                {selectedUserId === m.userId && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            ))}
          </>
        )}

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveJob} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.saveBtnText}>Create & Assign Job</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
  body: { padding: 18, gap: 10, paddingBottom: 60 },

  label: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  suggestBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0d1e38",
    overflow: "hidden",
    marginTop: -4,
  },
  suggestItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  suggestText: { color: "rgba(255,255,255,0.82)", fontSize: 14 },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  typeChipActive: { backgroundColor: "#f97316", borderColor: "#f97316" },
  typeChipText: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
  typeChipTextActive: { color: "#0b1220" },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  memberRowActive: {
    borderColor: "rgba(249,115,22,0.5)",
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  memberName: { color: "white", fontWeight: "700", fontSize: 15 },
  memberLicence: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
  checkmark: { color: "#f97316", fontWeight: "900", fontSize: 18, marginLeft: 8 },

  emptyMembers: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    alignItems: "center",
  },
  emptyMembersText: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" },

  saveBtn: {
    marginTop: 12,
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
