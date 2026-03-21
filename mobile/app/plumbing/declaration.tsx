import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

const DECLARATIONS = [
  {
    id: "quality",
    heading: "Quality of Work",
    text: "I declare that all work described in this report was performed to a professional standard and in accordance with the applicable Australian Standards and Building Regulations.",
  },
  {
    id: "licence",
    heading: "Licence & Authority",
    text: "I hold a current and valid licence or registration to carry out this class of work in the relevant state or territory, and this work was performed within the scope of that licence.",
  },
  {
    id: "compliance",
    heading: "Regulatory Compliance",
    text: "To the best of my knowledge, the work complies with the applicable AS/NZS standards, the National Construction Code, and all relevant state plumbing, gas, and building regulations.",
  },
  {
    id: "liability",
    heading: "7-Year Liability Record",
    text: "I understand this report forms part of the 7-year liability documentation record and may be used as evidence in any future dispute, insurance claim, or regulatory inspection.",
  },
  {
    id: "accurate",
    heading: "Accuracy of Information",
    text: "All information, measurements, and site conditions recorded in this report are accurate and truthful to the best of my knowledge at the time of completing this work.",
  },
];

export default function Declaration() {
  const router = useRouter();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTicked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allTicked = DECLARATIONS.every((d) => ticked[d.id]);
  const canProceed = allTicked && name.trim().length >= 2;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Statutory Declaration</Text>
        <Text style={styles.subtitle}>Read and confirm all statements to proceed</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Legal notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeIcon}>⚖️</Text>
          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>Statutory Declaration</Text>
            <Text style={styles.noticeSub}>
              This declaration forms part of your 7-year compliance record under Australian building regulations. Tick all boxes to confirm.
            </Text>
          </View>
        </View>

        {DECLARATIONS.map((d, i) => (
          <Pressable
            key={d.id}
            style={[styles.row, ticked[d.id] && styles.rowTicked]}
            onPress={() => toggle(d.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!ticked[d.id] }}
            accessibilityLabel={d.heading}
          >
            <View style={[styles.checkbox, ticked[d.id] && styles.checkboxTicked]}>
              {ticked[d.id] && <Text style={styles.tick}>✓</Text>}
            </View>
            <View style={styles.declWrap}>
              <Text style={styles.declHeading}>{i + 1}. {d.heading}</Text>
              <Text style={styles.declText}>{d.text}</Text>
            </View>
          </Pressable>
        ))}

        {/* Name field */}
        <View style={styles.nameCard}>
          <Text style={styles.nameLabel}>FULL NAME (PRINT)</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Your full legal name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="words"
            returnKeyType="done"
            accessibilityLabel="Full name"
          />
          <Text style={styles.nameSub}>
            By entering your name you are signing this statutory declaration.
          </Text>
        </View>

        <Pressable
          style={[styles.continueBtn, !canProceed && styles.continueBtnDisabled]}
          onPress={() => {
            if (!canProceed) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/plumbing/signature");
          }}
          disabled={!canProceed}
          accessibilityRole="button"
          accessibilityLabel="Continue to signature"
        >
          <Text style={[styles.continueBtnText, !canProceed && styles.continueBtnTextDisabled]}>
            {!allTicked
              ? `${DECLARATIONS.filter(d => !ticked[d.id]).length} declarations remaining`
              : !name.trim()
              ? "Enter your name to continue"
              : "Proceed to Signature →"
            }
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
  body: { padding: 20, gap: 12, paddingBottom: 48 },

  noticeCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "rgba(96,165,250,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.25)",
    padding: 16,
    alignItems: "flex-start",
    marginBottom: 4,
  },
  noticeIcon: { fontSize: 24, flexShrink: 0 },
  noticeText: { flex: 1, gap: 4 },
  noticeTitle: { color: "#93c5fd", fontWeight: "900", fontSize: 14 },
  noticeSub: { color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 19 },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  rowTicked: {
    borderColor: "rgba(249,115,22,0.30)",
    backgroundColor: "rgba(249,115,22,0.05)",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxTicked: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  tick: { color: "white", fontWeight: "900", fontSize: 14 },
  declWrap: { flex: 1, gap: 4 },
  declHeading: { color: "white", fontWeight: "800", fontSize: 13 },
  declText: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 19 },

  nameCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  nameLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    padding: 13,
    fontSize: 15,
    fontWeight: "700",
  },
  nameSub: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 11,
    lineHeight: 16,
  },

  continueBtn: {
    marginTop: 8,
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  continueBtnDisabled: {
    backgroundColor: "rgba(249,115,22,0.25)",
  },
  continueBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
  continueBtnTextDisabled: { color: "rgba(255,255,255,0.40)" },
  back: { marginTop: 8, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
