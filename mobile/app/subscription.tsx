import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

// ── Stripe hosted checkout URLs ────────────────────────────────────────────────
// Replace these with your real Stripe Payment Link URLs from the Stripe Dashboard.
// Create Payment Links at: https://dashboard.stripe.com/payment-links
const STRIPE_URLS = {
  core:          "https://buy.stripe.com/your_core_link",
  pro:           "https://buy.stripe.com/your_pro_link",
  employer:      "https://buy.stripe.com/your_employer_link",
  employerPlus:  "https://buy.stripe.com/your_employer_plus_link",
};

// ── Plan definitions ──────────────────────────────────────────────────────────

type Plan = {
  id: keyof typeof STRIPE_URLS;
  name: string;
  price: string;
  period: string;
  tagline: string;
  highlight: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "core",
    name: "Core",
    price: "$24.99",
    period: "/month",
    tagline: "Compliance documentation for solo tradespeople",
    highlight: false,
    features: [
      "Compliance documentation for all trade types",
      "AS/NZS standard checklist templates",
      "PDF report generation & sharing",
      "SHA-256 tamper-evident photo record",
      "7-year liability job timeline",
      "Near miss incident documentation",
      "Cloud job storage & history",
      "Signature & photo capture",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$39.99",
    period: "/month",
    tagline: "Everything in Core plus AI-powered analysis",
    highlight: false,
    features: [
      "Everything in Core",
      "AI photo compliance analysis",
      "AI Visualiser beta access",
      "Certificate of Compliance generator",
      "AI confidence scoring & gating",
      "Priority report processing",
    ],
  },
  {
    id: "employer",
    name: "Employer",
    price: "$99",
    period: "/month",
    tagline: "Up to 5 licensed tradespeople",
    highlight: true,
    features: [
      "Everything in Pro",
      "Team management portal",
      "Up to 5 team members",
      "Job assignment & scheduling",
      "Weekly job planner",
      "Monthly compliance reports",
      "Team performance analytics",
      "Push notifications for team",
      "Job notes & communication",
    ],
  },
  {
    id: "employerPlus",
    name: "Employer Plus",
    price: "$149",
    period: "/month",
    tagline: "Up to 15 licensed tradespeople",
    highlight: false,
    features: [
      "Everything in Employer",
      "Up to 15 team members",
      "Bulk job assignment",
      "PDF team compliance reports",
      "Priority support",
      "Early access to new features",
    ],
  },
];

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Subscription() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const openCheckout = async (plan: Plan) => {
    const url = STRIPE_URLS[plan.id];

    // Detect placeholder URLs
    if (url.includes("your_")) {
      Alert.alert(
        "Stripe not configured",
        "Payment links are not set up yet. Please contact support to subscribe.",
        [{ text: "OK" }]
      );
      return;
    }

    setLoading(plan.id);
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: "#07152b",
        controlsColor: "#f97316",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not open payment page.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Choose a Plan</Text>
        <Text style={styles.subtitle}>
          Start free for 14 days — cancel anytime
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[styles.planCard, plan.highlight && styles.planCardHighlight]}
          >
            {plan.highlight && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planTagline}>{plan.tagline}</Text>
              </View>
              <View style={styles.priceWrap}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureList}>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[
                styles.subscribeBtn,
                plan.highlight && styles.subscribeBtnHighlight,
                loading === plan.id && { opacity: 0.7 },
              ]}
              onPress={() => openCheckout(plan)}
              disabled={loading !== null}
            >
              {loading === plan.id ? (
                <ActivityIndicator color={plan.highlight ? "#0b1220" : "#f97316"} />
              ) : (
                <Text
                  style={[
                    styles.subscribeBtnText,
                    plan.highlight && styles.subscribeBtnTextHighlight,
                  ]}
                >
                  Subscribe — {plan.price}{plan.period}
                </Text>
              )}
            </Pressable>
          </View>
        ))}

        {/* Trust badges */}
        <View style={styles.trustRow}>
          <Text style={styles.trustItem}>🔒 Stripe secured</Text>
          <Text style={styles.trustItem}>↩ Cancel anytime</Text>
          <Text style={styles.trustItem}>🇦🇺 AU pricing</Text>
        </View>

        <Text style={styles.finePrint}>
          All plans include a 14-day free trial. Payment is processed securely
          by Stripe. Prices shown in AUD and exclude GST. By subscribing you
          agree to our Terms & Conditions.
        </Text>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.55)", fontSize: 14 },

  body: { padding: 18, gap: 16, paddingBottom: 60 },

  planCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 20,
    gap: 14,
  },
  planCardHighlight: {
    borderColor: "rgba(249,115,22,0.45)",
    backgroundColor: "rgba(249,115,22,0.06)",
  },

  popularBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f97316",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: -4,
  },
  popularBadgeText: { color: "#0b1220", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planName: { color: "white", fontSize: 18, fontWeight: "900" },
  planTagline: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 3 },
  priceWrap: { alignItems: "flex-end" },
  planPrice: { color: "white", fontSize: 26, fontWeight: "900" },
  planPeriod: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 1 },

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },

  featureList: { gap: 8 },
  featureRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  featureCheck: { color: "#22c55e", fontWeight: "900", fontSize: 14, marginTop: 1 },
  featureText: { color: "rgba(255,255,255,0.82)", fontSize: 14, flex: 1, lineHeight: 20 },

  subscribeBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
  },
  subscribeBtnHighlight: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  subscribeBtnText: { color: "#f97316", fontWeight: "900", fontSize: 15 },
  subscribeBtnTextHighlight: { color: "#0b1220" },

  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 4,
  },
  trustItem: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },

  finePrint: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
