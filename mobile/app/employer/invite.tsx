import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

type PendingInvite = {
  id: string;
  email: string;
  created_at: string;
};

export default function InviteTeamMember() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  // ── Load team + pending invites ─────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user || !active) return;

          const { data: team, error: teamError } = await supabase
            .from("teams")
            .select("id")
            .eq("owner_id", user.id)
            .single();

          if (teamError || !team) {
            if (active) setLoadingInvites(false);
            return;
          }

          if (active) setTeamId(team.id);

          const { data: invites } = await supabase
            .from("team_invites")
            .select("id, email, created_at")
            .eq("team_id", team.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

          if (active) setPendingInvites(invites ?? []);
        } catch {}
        if (active) setLoadingInvites(false);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const showToast = (msg: string, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  // ── Send invite ─────────────────────────────────────────────────────────────

  const sendInvite = async () => {
    if (!email.trim()) {
      Alert.alert("Missing email", "Please enter an email address.");
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (!teamId) {
      Alert.alert(
        "No team found",
        "You don't have a team set up yet. Go to Settings to configure your employer account."
      );
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("team_invites").insert({
        team_id: teamId,
        email: email.trim().toLowerCase(),
        status: "pending",
      });

      if (error) throw error;

      const invitedEmail = email.trim().toLowerCase();
      setEmail("");
      showToast(`Invitation sent to ${invitedEmail}`);

      // Refresh pending invites list
      const { data: invites } = await supabase
        .from("team_invites")
        .select("id, email, created_at")
        .eq("team_id", teamId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setPendingInvites(invites ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not send invitation.");
    } finally {
      setSending(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Invite Team Member</Text>
        <Text style={styles.subtitle}>
          Enter an email address to invite them to your team
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Invite form ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Invitation</Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!sending}
          />

          <Pressable
            style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            onPress={sendInvite}
            disabled={sending}
          >
            {sending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0b1220" />
                <Text style={styles.sendBtnText}> Sending…</Text>
              </View>
            ) : (
              <Text style={styles.sendBtnText}>Send Invitation</Text>
            )}
          </Pressable>
        </View>

        {/* ── Pending invites ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invites</Text>

          {loadingInvites ? (
            <ActivityIndicator color="#f97316" style={{ marginVertical: 8 }} />
          ) : pendingInvites.length === 0 ? (
            <Text style={styles.emptyText}>No pending invitations</Text>
          ) : (
            pendingInvites.map((invite) => (
              <View key={invite.id} style={styles.inviteCard}>
                <View style={styles.inviteCardLeft}>
                  <Text style={styles.inviteEmail}>{invite.email}</Text>
                  <Text style={styles.inviteDate}>
                    Sent {formatDate(invite.created_at)}
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Pressable onPress={() => router.back()} style={styles.back}>
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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { padding: 18, gap: 12, paddingBottom: 60 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 12,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 14,
  },

  sendBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sendBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 8,
  },

  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inviteCardLeft: { gap: 2, flex: 1 },
  inviteEmail: { color: "white", fontSize: 14, fontWeight: "700" },
  inviteDate: { color: "rgba(255,255,255,0.45)", fontSize: 12 },

  pendingBadge: {
    backgroundColor: "rgba(249,115,22,0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    marginLeft: 10,
  },
  pendingBadgeText: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },

  toast: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  toastText: { color: "white", fontWeight: "900", fontSize: 15 },
});
