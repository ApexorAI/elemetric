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

const STRIPE_URLS: Record<string, string> = {
  core:          "https://buy.stripe.com/3cI00j9mofdb0oG6Ih9Zm00",
  pro:           "https://buy.stripe.com/5kQeVd6acghf2wO3w59Zm01",
  employer:      "https://buy.stripe.com/eVqaEXgOQaWV9Zg2s19Zm02",
  employerPlus:  "https://buy.stripe.com/dRm28rfKMd533AS7Ml9Zm03",
};

type PlanKey = keyof typeof STRIPE_URLS;

type Plan = {
  id: PlanKey;
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
      "Unlimited jobs",
      "Compliance docs for all trade types",
      "AS/NZS standard checklist templates",
      "PDF report generation & sharing",
      "SHA-256 tamper-evident photo record",
      "7-year liability job timeline",
      "Cloud job storage & history",
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
      "AI confidence scoring",
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

export default function Paywall() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const subscribe = async (plan: Plan) => {
    const url = STRIPE_URLS[plan.id];

    if (url.includes("your_")) {
      Alert.alert(
        "Coming Soon",
        "Payment links are being set up. Please contact support to subscribe.",
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
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.brand}>ELEMETRIC</Text>
        <Text style={s.title}>Upgrade to Continue</Text>
        <Text style={s.subtitle}>
          You've used your 3 free jobs. Subscribe to keep documenting compliance.
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Free limit callout */}
        <View style={s.limitCard}>
          <Text style={s.limitIcon}>🔒</Text>
          <View style={s.limitText}>
            <Text style={s.limitTitle}>Free limit reached</Text>
            <Text style={s.limitDesc}>
              Free accounts include 3 jobs. Choose a plan to unlock unlimited jobs, AI analysis, PDF reports, and more.
            </Text>
          </View>
        </View>

        {/* Plans */}
        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[s.planCard, plan.highlight && s.planCardHL]}
          >
            {plan.highlight && (
              <View style={s.popularBadge}>
                <Text style={s.popularText}>MOST POPULAR</Text>
              </View>
            )}

            <View style={s.planHeader}>
              <View>
                <Text style={s.planName}>{plan.name}</Text>
                <Text style={s.planTagline}>{plan.tagline}</Text>
              </View>
              <View style={s.priceWrap}>
                <Text style={s.planPrice}>{plan.price}</Text>
                <Text style={s.planPeriod}>{plan.period}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.featureList}>
              {plan.features.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <Text style={s.featureCheck}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[
                s.subscribeBtn,
                plan.highlight && s.subscribeBtnHL,
                loading === plan.id && { opacity: 0.6 },
              ]}
              onPress={() => subscribe(plan)}
              disabled={loading !== null}
            >
              {loading === plan.id ? (
                <ActivityIndicator color={plan.highlight ? "#0b1220" : "#f97316"} />
              ) : (
                <Text style={[s.subscribeBtnText, plan.highlight && s.subscribeBtnTextHL]}>
                  Subscribe — {plan.price}{plan.period}
                </Text>
              )}
            </Pressable>
          </View>
        ))}

        {/* Trust */}
        <View style={s.trustRow}>
          <Text style={s.trustItem}>🔒 Stripe secured</Text>
          <Text style={s.trustItem}>↩ Cancel anytime</Text>
          <Text style={s.trustItem}>🇦🇺 AU pricing</Text>
        </View>

        <Text style={s.finePrint}>
          All plans include a 14-day free trial. Prices in AUD, excluding GST.
          By subscribing you agree to our Terms & Conditions.
        </Text>

        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 20 },

  body: { padding: 18, gap: 14, paddingBottom: 60 },

  limitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    backgroundColor: "rgba(249,115,22,0.08)",
    padding: 16,
  },
  limitIcon: { fontSize: 28 },
  limitText: { flex: 1 },
  limitTitle: { color: "white", fontWeight: "900", fontSize: 15 },
  limitDesc: { color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 19, marginTop: 4 },

  planCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 20,
    gap: 14,
  },
  planCardHL: {
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
  popularText: { color: "#0b1220", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planName: { color: "white", fontSize: 18, fontWeight: "900" },
  planTagline: { color: "rgba(255,255,255,0.50)", fontSize: 13, marginTop: 3 },
  priceWrap: { alignItems: "flex-end" },
  planPrice: { color: "white", fontSize: 26, fontWeight: "900" },
  planPeriod: { color: "rgba(255,255,255,0.50)", fontSize: 13, marginTop: 1 },

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
  subscribeBtnHL: { backgroundColor: "#f97316", borderColor: "#f97316" },
  subscribeBtnText: { color: "#f97316", fontWeight: "900", fontSize: 15 },
  subscribeBtnTextHL: { color: "#0b1220" },

  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 4,
  },
  trustItem: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" },

  finePrint: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 15 },
});
