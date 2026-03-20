import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import { supabase } from "@/lib/supabase";

// ── Global Error Boundary ─────────────────────────────────────────────────────
// Catches unhandled React render errors, reports them to Supabase crash_logs table
// (best-effort), and shows a recovery UI instead of a blank crash screen.

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.reportCrash(error, errorInfo);
  }

  async reportCrash(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("crash_logs").insert({
        user_id: user?.id ?? null,
        error_message: error.message,
        error_name: error.name,
        component_stack: errorInfo.componentStack?.slice(0, 2000) ?? null,
        stack: error.stack?.slice(0, 2000) ?? null,
        occurred_at: new Date().toISOString(),
      });
    } catch {
      // Crash reporting failed silently — don't re-throw
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;
    const message = error?.message ?? "Something went wrong";

    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Unexpected Error</Text>
        <Text style={styles.subtitle}>
          The app ran into an unexpected problem. This has been reported automatically.
        </Text>

        <View style={styles.errorCard}>
          <Text style={styles.errorLabel}>ERROR DETAILS</Text>
          <Text style={styles.errorName}>{error?.name ?? "Error"}</Text>
          <Text style={styles.errorMessage}>{message}</Text>
        </View>

        <Text style={styles.help}>
          Try tapping Retry. If the problem persists, restart the app or contact support at{" "}
          <Text style={styles.helpEmail}>cayde@elemetric.com.au</Text>
        </Text>

        <Pressable
          style={styles.retryBtn}
          onPress={this.handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry — go back to app"
        >
          <Text style={styles.retryBtnText}>↻ Retry</Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL("mailto:cayde@elemetric.com.au?subject=App%20Crash%20Report")}
          accessibilityRole="link"
          accessibilityLabel="Contact support by email"
        >
          <Text style={styles.supportLink}>Contact Support →</Text>
        </Pressable>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  content: {
    padding: 28,
    paddingTop: 80,
    alignItems: "center",
    gap: 16,
    paddingBottom: 60,
  },

  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  icon: { fontSize: 36 },

  brand: { color: "#f97316", fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  title: { color: "white", fontSize: 26, fontWeight: "900", textAlign: "center" },
  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },

  errorCard: {
    width: "100%",
    backgroundColor: "rgba(239,68,68,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    padding: 16,
    gap: 6,
  },
  errorLabel: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  errorName: { color: "white", fontWeight: "800", fontSize: 15 },
  errorMessage: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },

  help: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  helpEmail: { color: "#f97316", fontWeight: "700" },

  retryBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  retryBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
  supportLink: { color: "#f97316", fontWeight: "700", fontSize: 14, marginTop: 4 },
});
