import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Email required", "Please enter the email address on your account.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      Alert.alert(
        "Could Not Send Reset Email",
        e?.message ?? "Please check the email address and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>ELEMETRIC</Text>
      <Text style={styles.title}>Forgot Password</Text>

      {sent ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmIcon}>✉️</Text>
          <Text style={styles.confirmHeading}>Check your email</Text>
          <Text style={styles.confirmBody}>
            We've sent a password reset link to{" "}
            <Text style={styles.confirmEmail}>{email.trim()}</Text>.{"\n\n"}
            Open the link in the email to set a new password. Check your spam folder if it
            doesn't arrive within a minute.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.replace("/login")}>
            <Text style={styles.doneBtnText}>Back to Login</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Enter your account email and we'll send you a reset link.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="rgba(255,255,255,0.30)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={sendReset}
          />

          <Pressable
            style={[styles.button, (loading || !email.trim()) && { opacity: 0.55 }]}
            onPress={sendReset}
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#07152b" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Email</Text>
            )}
          </Pressable>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back to Login</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07152b",
    justifyContent: "center",
    padding: 30,
  },
  brand: {
    fontSize: 28,
    fontWeight: "900",
    color: "#f97316",
    marginBottom: 28,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.60)",
    marginBottom: 28,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#0d1f3d",
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  button: {
    backgroundColor: "#f97316",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#07152b",
  },
  backBtn: {
    marginTop: 20,
    alignItems: "center",
  },
  backText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
  },
  confirmCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.30)",
    backgroundColor: "rgba(34,197,94,0.08)",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  confirmIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  confirmHeading: {
    fontSize: 22,
    fontWeight: "900",
    color: "white",
  },
  confirmBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
    lineHeight: 22,
  },
  confirmEmail: {
    color: "#f97316",
    fontWeight: "700",
  },
  doneBtn: {
    marginTop: 8,
    backgroundColor: "#f97316",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneBtnText: {
    color: "#07152b",
    fontWeight: "900",
    fontSize: 16,
  },
});
