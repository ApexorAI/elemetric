import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";

// ── FAQ data ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: "Getting Started",
    icon: "🚀",
    items: [
      {
        q: "How do I create my first job?",
        a: "From the home screen, tap New Job. Enter the job name and address, then select your trade type. You'll be taken to the checklist for that trade where you can capture photos.",
      },
      {
        q: "What information do I need in my profile?",
        a: "Add your full name, licence number, company name, and phone number. These details are automatically included in every compliance report PDF you generate.",
      },
      {
        q: "How do I set up a team as an employer?",
        a: "Go to Settings and switch your account type to Employer. A team will be created automatically. Then use the Employer Portal to invite team members by email.",
      },
      {
        q: "How do plumbers join a team?",
        a: "Ask your employer to send you an invite email. Then go to Settings → Join a Team and enter the email address the invite was sent to. Your account will be linked to the team.",
      },
    ],
  },
  {
    title: "How AI Analysis Works",
    icon: "🤖",
    items: [
      {
        q: "What does the AI analyse?",
        a: "The AI reviews your site photos against Australian Standards (AS/NZS 3500 for plumbing, AS/NZS 5601 for gas, AS/NZS 3000 for electrical, AS/NZS 1668 for HVAC). It identifies visible components, unclear elements, and missing items.",
      },
      {
        q: "What does Visible, Unclear, and Missing mean?",
        a: "Visible: components clearly captured in photos that meet the standard. Unclear: components present but photo quality or angle makes it hard to confirm compliance. Missing: components required by the standard that are not visible in the provided photos.",
      },
      {
        q: "How accurate is the AI?",
        a: "The AI is a documentation aid, not a certified compliance inspector. It helps you capture and document your work systematically. Final compliance responsibility always rests with the licensed tradesperson.",
      },
      {
        q: "What is AI Confidence?",
        a: "Confidence is a 0–100% score representing how completely your photo set documents the required compliance items for that trade type. Higher confidence means more required items were clearly captured.",
      },
      {
        q: "Why did my photos get a low confidence score?",
        a: "Common causes: photos are too dark or blurry, required components are out of frame, or photos were taken before installation was complete. Retake photos in good light with all components clearly in frame.",
      },
    ],
  },
  {
    title: "Understanding Your Compliance Score",
    icon: "📊",
    items: [
      {
        q: "How is my compliance score calculated?",
        a: "Your compliance score is the average AI confidence across all your completed jobs. A score above 80% is Excellent, 50–79% is Good, and below 50% indicates your documentation needs improvement.",
      },
      {
        q: "How do I improve my score?",
        a: "Take clear, well-lit photos of all required components before and after installation. Ensure every checklist item is covered by at least one photo. Re-run analysis if you add more photos.",
      },
      {
        q: "Does my compliance score affect anything?",
        a: "Your score is visible to your employer if you're part of a team, and it appears in your profile. A high score demonstrates consistent, thorough documentation practice.",
      },
    ],
  },
  {
    title: "Liability Timeline Explained",
    icon: "📅",
    items: [
      {
        q: "What is the Liability Timeline?",
        a: "Under Australian law, licensed tradespeople can be held liable for their work for up to 7 years after completion. The Liability Timeline shows a countdown for each job from its completion date.",
      },
      {
        q: "Why does this matter?",
        a: "If a defect claim is made years after a job, your compliance reports are your evidence that work was done correctly at the time. Elemetric keeps your documentation safely stored in the cloud.",
      },
      {
        q: "What happens when a job expires?",
        a: "After 7 years the job is outside the general liability window. You can safely archive old records, though keeping them longer is always an option.",
      },
      {
        q: "What are compliance alerts?",
        a: "When a job is within 12 months of its 7-year liability expiry, Elemetric sends you an alert so you can review and archive the documentation as needed.",
      },
    ],
  },
  {
    title: "Employer Portal Guide",
    icon: "🏢",
    items: [
      {
        q: "What can I do in the Employer Portal?",
        a: "View all team members' compliance scores, job counts, and last active dates. Assign jobs to specific plumbers with a scheduled date. Use the Job Planner for a weekly schedule view. Export monthly PDF team reports.",
      },
      {
        q: "How do I assign a job to a plumber?",
        a: "From the Employer Portal, tap Assign New Job. Fill in the job details, select a team member from the dropdown, and tap Create & Assign Job. The plumber receives a push notification and can accept the job in their app.",
      },
      {
        q: "What does the Job Planner show?",
        a: "The Job Planner shows all assigned jobs in a weekly calendar view. Tap any day to see that day's jobs and the assigned plumber. Tap a job card to reassign it or change the scheduled date.",
      },
      {
        q: "How do I generate a team report?",
        a: "From the Employer Portal, tap Team Report. This shows each team member's jobs completed this month, average compliance score, and total jobs. Tap Export Team Report PDF to generate and share a branded report.",
      },
    ],
  },
];

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Help() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const openSupport = () => {
    const email = "cayde@elemetric.com.au";
    const subject = encodeURIComponent("Elemetric App Support Request");
    const body = encodeURIComponent(
      "Hi Elemetric Support,\n\nI need help with:\n\n[Describe your issue here]\n\nApp version: 1.0.0\nDevice: [Your device]\n"
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert("Cannot open email", "Please email cayde@elemetric.com.au directly.")
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Help & FAQ</Text>
        <Text style={styles.subtitle}>Everything you need to know</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{section.icon}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            {section.items.map((item, idx) => {
              const key = `${section.title}-${idx}`;
              const open = !!expanded[key];
              return (
                <Pressable
                  key={key}
                  style={[styles.faqItem, idx < section.items.length - 1 && styles.faqItemBorder]}
                  onPress={() => toggle(key)}
                >
                  <View style={styles.faqQ}>
                    <Text style={styles.faqQText}>{item.q}</Text>
                    <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>
                      {open ? "−" : "+"}
                    </Text>
                  </View>
                  {open && (
                    <Text style={styles.faqA}>{item.a}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Contact support */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Still need help?</Text>
          <Text style={styles.supportSubtitle}>
            Our team is here to help. Send us an email and we'll get back to you within one business day.
          </Text>
          <Pressable style={styles.supportBtn} onPress={openSupport}>
            <Text style={styles.supportBtnText}>✉️  Contact Support</Text>
          </Pressable>
          <Text style={styles.supportEmail}>cayde@elemetric.com.au</Text>
        </View>

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
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.5)", fontSize: 13 },

  body: { padding: 16, gap: 12, paddingBottom: 50 },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  sectionIcon: { fontSize: 20 },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  faqItem: { padding: 16 },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  faqQ: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  faqQText: { flex: 1, color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 14, lineHeight: 20 },
  faqChevron: { color: "#f97316", fontSize: 20, fontWeight: "700", lineHeight: 22, marginTop: -1 },
  faqChevronOpen: { color: "#f97316" },
  faqA: {
    marginTop: 10,
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    lineHeight: 22,
  },

  supportCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    backgroundColor: "rgba(249,115,22,0.06)",
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  supportTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  supportSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  supportBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  supportBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },
  supportEmail: { color: "rgba(249,115,22,0.7)", fontSize: 12, marginTop: -4 },

  back: { marginTop: 4, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
