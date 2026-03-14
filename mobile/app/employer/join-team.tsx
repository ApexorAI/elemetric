import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function JoinTeam() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string, duration = 3500) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };

  const joinTeam = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert("Missing email", "Please enter the email address the invite was sent to.");
      return;
    }

    setJoining(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to join a team.");

      // Look up a pending invite matching this email
      const { data: invite, error: inviteError } = await supabase
        .from("team_invites")
        .select("id, team_id, email, status")
        .eq("email", trimmedEmail)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (inviteError || !invite) {
        Alert.alert(
          "No invite found",
          "We couldn't find a pending invite for that email address. Check with your employer that the invite was sent correctly."
        );
        return;
      }

      // Add user to team_members (ignore conflict if already a member)
      const { error: memberError } = await supabase
        .from("team_members")
        .upsert(
          { team_id: invite.team_id, user_id: user.id, role: "member" },
          { onConflict: "team_id,user_id" }
        );

      if (memberError) throw memberError;

      // Mark invite as accepted
      await supabase
        .from("team_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      showToast("You've joined the team!");
      setTimeout(() => router.back(), 2000);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not join team. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Join a Team</Text>
        <Text style={styles.subtitle}>
          Enter the email address your employer sent the invite to
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team Invitation</Text>
          <Text style={styles.cardDesc}>
            Your employer will have sent an invite to your email address. Enter
            that email below to accept and join their team.
          </Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!joining}
          />

          <Pressable
            style={[styles.joinBtn, joining && { opacity: 0.6 }]}
            onPress={joinTeam}
            disabled={joining}
          >
            {joining ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0b1220" />
                <Text style={styles.joinBtnText}> Joining…</Text>
              </View>
            ) : (
              <Text style={styles.joinBtnText}>Join Team</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoItem}>1. Your employer sends you an invite from the Employer Portal</Text>
          <Text style={styles.infoItem}>2. Enter the email address they sent it to above</Text>
          <Text style={styles.infoItem}>3. Your jobs and compliance score become visible to your employer</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { padding: 18, gap: 14, paddingBottom: 60 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18,
    gap: 12,
  },
  cardTitle: { color: "white", fontWeight: "900", fontSize: 17 },
  cardDesc: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 19,
  },

  label: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 14 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 13,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 15,
  },

  joinBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  joinBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    backgroundColor: "rgba(249,115,22,0.06)",
    padding: 16,
    gap: 8,
  },
  infoTitle: { color: "#f97316", fontWeight: "900", fontSize: 14, marginBottom: 2 },
  infoItem: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 19,
  },

  back: { alignItems: "center", marginTop: 4 },
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
