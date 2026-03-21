import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");
const STEPS = 4;

// ── Step indicators ────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: STEPS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current && styles.dotActive, i < current && styles.dotDone]}
        />
      ))}
    </View>
  );
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.brand}>ELEMETRIC</Text>

      <View style={styles.iconBlock}>
        <Text style={styles.bigIcon}>⚡</Text>
      </View>

      <Text style={styles.stepHeading}>Welcome to{"\n"}Elemetric.</Text>
      <Text style={styles.stepSub}>
        The compliance app built for Australian tradespeople. Every job documented,
        every report signed — protecting your licence for the next 7 years.
      </Text>

      <View style={styles.bpcBanner}>
        <Text style={styles.bpcBannerText}>
          Designed for BPC Victoria licensed tradespeople · AS/NZS 3500 series
        </Text>
      </View>

      <View style={styles.valueList}>
        <ValueRow icon="📸" text="Photograph your work on site" />
        <ValueRow icon="🤖" text="AI analyses against AS/NZS standards" />
        <ValueRow icon="📄" text="PDF compliance report in minutes" />
        <ValueRow icon="☁️" text="Backed up securely to the cloud" />
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onNext();
        }}
      >
        <Text style={styles.primaryBtnText}>Let's set you up →</Text>
      </Pressable>
    </View>
  );
}

function ValueRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueIcon}>{icon}</Text>
      <Text style={styles.valueText}>{text}</Text>
    </View>
  );
}

// ── Step 2: Licence details ────────────────────────────────────────────────────

function StepLicence({
  onNext,
  onSkip,
}: {
  onNext: (data: { fullName: string; licenceNumber: string; companyName: string }) => void;
  onSkip: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert(
          {
            user_id: user.id,
            full_name: fullName.trim(),
            licence_number: licenceNumber.trim(),
            company_name: companyName.trim(),
          },
          { onConflict: "user_id" }
        );
      }
    } catch {}
    setSaving(false);
    onNext({ fullName, licenceNumber, companyName });
  };

  const hasAny = fullName.trim() || licenceNumber.trim() || companyName.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.stepContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.stepHeading}>Your licence{"\n"}details</Text>
        <Text style={styles.stepSub}>
          These appear on every compliance report you generate. Under the Plumbing Regulations 2018 (Vic),
          your licence number must appear on all compliance documentation. Update anytime in Profile.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Jane Smith"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Licence Number</Text>
          <TextInput
            style={styles.input}
            value={licenceNumber}
            onChangeText={setLicenceNumber}
            placeholder="e.g. PL123456"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>Company Name</Text>
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="e.g. Smith Plumbing Pty Ltd"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="words"
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, (!hasAny || saving) && { opacity: 0.6 }]}
          onPress={save}
          disabled={!hasAny || saving}
        >
          {saving ? (
            <ActivityIndicator color="#0b1220" />
          ) : (
            <Text style={styles.primaryBtnText}>Save & Continue →</Text>
          )}
        </Pressable>

        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step 3: How it works ───────────────────────────────────────────────────────

function StepHowItWorks({ onNext }: { onNext: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.brand}>ELEMETRIC</Text>
      <Text style={styles.stepHeading}>How it{"\n"}works</Text>
      <Text style={styles.stepSub}>
        Three steps. Any job site. Under 5 minutes.
      </Text>

      <View style={styles.howList}>
        <HowStep
          number="1"
          title="Photo"
          desc="Photograph every stage of your work — before, during, and after. The camera is your evidence."
          color="#3b82f6"
        />
        <View style={styles.howConnector} />
        <HowStep
          number="2"
          title="Analyse"
          desc="Our AI checks your photos against AS/NZS 3500 series standards (enforced by the BPC of Victoria) and gives you a compliance score with flagged items."
          color="#f97316"
        />
        <View style={styles.howConnector} />
        <HowStep
          number="3"
          title="Sign & Export"
          desc="Review the report, add your signature, and export a professional PDF to share or store."
          color="#22c55e"
        />
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onNext();
        }}
      >
        <Text style={styles.primaryBtnText}>Got it →</Text>
      </Pressable>
    </ScrollView>
  );
}

function HowStep({
  number,
  title,
  desc,
  color,
}: {
  number: string;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <View style={styles.howStep}>
      <View style={[styles.howNumber, { backgroundColor: color + "22", borderColor: color + "55" }]}>
        <Text style={[styles.howNumberText, { color }]}>{number}</Text>
      </View>
      <View style={styles.howContent}>
        <Text style={[styles.howTitle, { color }]}>{title}</Text>
        <Text style={styles.howDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ── Step 4: You're protected ───────────────────────────────────────────────────

function StepProtected({ onFinish, finishing }: { onFinish: () => void; finishing: boolean }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.brand}>ELEMETRIC</Text>

      <View style={styles.iconBlock}>
        <Text style={styles.bigIcon}>🛡️</Text>
      </View>

      <Text style={styles.stepHeading}>You're{"\n"}protected.</Text>
      <Text style={styles.stepSub}>
        Every job you complete in Elemetric builds your compliance record under
        the BPC Victoria framework. If anything is ever disputed — your documentation is ready.
      </Text>

      <View style={styles.protectedStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>7</Text>
          <Text style={styles.statLabel}>Year liability{"\n"}record</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>BPC</Text>
          <Text style={styles.statLabel}>Victoria{"\n"}compliant</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>AS/NZS</Text>
          <Text style={styles.statLabel}>3500 series{"\n"}aligned</Text>
        </View>
      </View>

      <View style={styles.bpcBanner}>
        <Text style={styles.bpcBannerText}>
          Reports reference AS/NZS 3500 series · Plumbing Regulations 2018 (Vic)
        </Text>
      </View>

      <Pressable
        style={[styles.primaryBtn, finishing && { opacity: 0.6 }]}
        onPress={onFinish}
        disabled={finishing}
      >
        {finishing ? (
          <ActivityIndicator color="#0b1220" />
        ) : (
          <Text style={styles.primaryBtnText}>Start My First Job →</Text>
        )}
      </Pressable>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingSetup() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS - 1));

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setFinishing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .upsert({ user_id: user.id, onboarding_complete: true }, { onConflict: "user_id" });
      }
    } catch {}
    router.replace("/home");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.dotsRow}>
        <StepDots current={step} />
      </View>

      <View style={styles.content}>
        {step === 0 && <StepWelcome onNext={next} />}
        {step === 1 && <StepLicence onNext={next} onSkip={next} />}
        {step === 2 && <StepHowItWorks onNext={next} />}
        {step === 3 && <StepProtected onFinish={finish} finishing={finishing} />}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },

  dotsRow: {
    paddingTop: 60,
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  dots: { flexDirection: "row", gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotActive: { width: 28, backgroundColor: "#f97316" },
  dotDone: { backgroundColor: "rgba(249,115,22,0.40)" },

  content: { flex: 1 },

  stepContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 16,
    gap: 0,
  },

  brand: {
    color: "#f97316",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 24,
  },

  iconBlock: {
    marginBottom: 20,
  },
  bigIcon: {
    fontSize: 64,
  },

  stepHeading: {
    color: "white",
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 46,
    marginBottom: 16,
  },
  stepSub: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },

  valueList: { gap: 16, marginBottom: 36 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  valueIcon: { fontSize: 24, width: 32, textAlign: "center" },
  valueText: { color: "rgba(255,255,255,0.80)", fontSize: 15, flex: 1, lineHeight: 21 },

  fieldGroup: { gap: 4, marginBottom: 24 },
  fieldLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 15,
  },

  howList: { gap: 0, marginBottom: 36 },
  howStep: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  howConnector: {
    width: 2,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginLeft: 23,
  },
  howNumber: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  howNumberText: { fontSize: 18, fontWeight: "900" },
  howContent: { flex: 1, paddingTop: 6, paddingBottom: 4 },
  howTitle: { fontSize: 18, fontWeight: "900", marginBottom: 4 },
  howDesc: { color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 20 },

  protectedStats: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 20,
    marginBottom: 36,
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: { flex: 1, alignItems: "center", gap: 6 },
  statNum: { color: "#f97316", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.50)", fontSize: 11, textAlign: "center", lineHeight: 16 },
  statDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.08)" },

  primaryBtn: {
    backgroundColor: "#f97316",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: "auto" as any,
  },
  primaryBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  skipBtn: { marginTop: 16, alignItems: "center" },
  skipText: { color: "rgba(255,255,255,0.40)", fontSize: 14, fontWeight: "700" },

  bpcBanner: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    marginVertical: 4,
  },
  bpcBannerText: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});
