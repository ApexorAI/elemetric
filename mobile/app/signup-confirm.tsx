import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function SignupConfirm() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const openEmailApp = async () => {
    try {
      await Linking.openURL("message://");
    } catch {
      try {
        await Linking.openURL("mailto:");
      } catch {}
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>ELEMETRIC</Text>

      {/* Envelope icon card */}
      <View style={styles.iconCard}>
        <Text style={styles.iconEmoji}>✉️</Text>
      </View>

      <Text style={styles.heading}>Check your inbox</Text>

      <Text style={styles.body}>
        We've sent a confirmation email to verify your account. Click the link inside to get started.
      </Text>

      {!!email && (
        <View style={styles.emailCard}>
          <Text style={styles.emailHintLabel}>Sent to</Text>
          <Text style={styles.emailValue}>{email}</Text>
        </View>
      )}

      <Text style={styles.note}>
        Can't find it? Check your spam or junk folder. The link expires in 24 hours.
      </Text>

      <Pressable style={styles.emailBtn} onPress={openEmailApp} accessibilityRole="button" accessibilityLabel="Open email app">
        <Text style={styles.emailBtnText}>Open Email App →</Text>
      </Pressable>

      <Pressable style={styles.backBtn} onPress={() => router.replace("/login")} accessibilityRole="button" accessibilityLabel="Back to sign in">
        <Text style={styles.backBtnText}>Back to Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07152b",
    justifyContent: "center",
    padding: 32,
  },
  logo: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f97316",
    letterSpacing: 2,
    marginBottom: 28,
  },
  iconCard: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  iconEmoji: { fontSize: 36 },
  heading: {
    fontSize: 26,
    fontWeight: "900",
    color: "white",
    marginBottom: 12,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 24,
    marginBottom: 20,
  },
  emailCard: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 2,
  },
  emailHintLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  emailValue: {
    color: "#f97316",
    fontWeight: "800",
    fontSize: 15,
  },
  note: {
    fontSize: 13,
    color: "rgba(255,255,255,0.40)",
    lineHeight: 20,
    marginBottom: 32,
  },
  emailBtn: {
    backgroundColor: "#f97316",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
    height: 56,
    justifyContent: "center",
  },
  emailBtnText: {
    color: "#07152b",
    fontWeight: "900",
    fontSize: 16,
  },
  backBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  backBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    fontSize: 15,
  },
});
