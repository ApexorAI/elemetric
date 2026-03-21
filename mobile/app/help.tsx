import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQ = { q: string; a: string };
type Category = { id: string; icon: string; label: string; faqs: FAQ[] };

const CATEGORIES: Category[] = [
  {
    id: "getting-started",
    icon: "rocket",
    label: "Getting Started",
    faqs: [
      {
        q: "What is Elemetric?",
        a: "Elemetric is an AI-powered compliance documentation app for licensed tradespeople. You photograph your work, and our AI analyses the photos against Australian Standards — generating a compliance report you can use for your 7-year liability records.",
      },
      {
        q: "How do I start my first job?",
        a: "Tap 'New Job' on the home screen. Enter the job name and address, select the job type (e.g. Hot Water, Gas, Drainage), then work through the checklist, photos, and AI review steps.",
      },
      {
        q: "What trades are supported?",
        a: "Currently: Plumbing (hot water, gas, drainage, roof plumbing), Electrical, HVAC, Fire Protection, and General Mechanical. More trades are added regularly.",
      },
      {
        q: "Do I need an internet connection?",
        a: "An internet connection is required for AI analysis and syncing jobs to the cloud. Offline, you can still complete checklists and capture photos — these sync automatically when you reconnect.",
      },
      {
        q: "Is my data backed up?",
        a: "Yes. All completed jobs are saved to our secure Supabase cloud database, as well as locally on your device. You can also export your data any time from Settings > Privacy & Data.",
      },
    ],
  },
  {
    id: "ai-review",
    icon: "robot",
    label: "AI Review",
    faqs: [
      {
        q: "How does the AI review work?",
        a: "After uploading your job photos, our AI compares what it detects in the images against the relevant Australian Standard (e.g. AS/NZS 3500.4 for hot water). It produces a confidence score, lists detected and missing items, and gives you a recommended action.",
      },
      {
        q: "What is the confidence score?",
        a: "The confidence score (0-100%) represents how completely the AI could verify compliance from your photos. A score above 85% is excellent. Lower scores usually mean some photos are unclear or missing — the AI will tell you specifically what to re-photograph.",
      },
      {
        q: "The AI result is wrong — what do I do?",
        a: "AI analysis is a decision-support tool, not a legal substitute for your professional judgement. If you believe the result is incorrect, re-photograph the specific items flagged, or add a note in the job summary. Always sign off on your own compliance.",
      },
      {
        q: "How many photos should I take?",
        a: "More is always better. Aim for at least 6-10 photos per job: wide shots for context, close-ups of key compliance points (valves, labels, connections), and any certificates or test readings. Good lighting significantly improves accuracy.",
      },
      {
        q: "Why is analysis taking a long time?",
        a: "AI analysis typically takes 10-30 seconds depending on the number of photos and server load. If it takes more than 2 minutes, check your internet connection and try again. Your photos are already uploaded so no data is lost.",
      },
    ],
  },
  {
    id: "documents",
    icon: "doc",
    label: "Documents & PDF",
    faqs: [
      {
        q: "How do I generate a compliance PDF?",
        a: "From any completed job's AI Review screen, tap the Share button in the top-right corner and select 'Export PDF'. The PDF includes a cover page, executive summary, full AI assessment, your photos, and a compliance certificate.",
      },
      {
        q: "Is the PDF legally valid?",
        a: "The PDF is a detailed compliance record suitable for your 7-year liability documentation obligations. It is not a formal certificate of compliance — that must be issued through your state's regulatory body. Elemetric documents support your records, not replace official certificates.",
      },
      {
        q: "Can I share the PDF with my client?",
        a: "Yes. Use the standard iOS/Android share sheet to send via email, AirDrop, or any messaging app. You can also save it to Files or Google Drive.",
      },
      {
        q: "Where are my PDFs stored?",
        a: "PDFs are generated on-device and can be shared immediately. They are not automatically stored — save them to Files or email yourself a copy for your records.",
      },
    ],
  },
  {
    id: "checklist",
    icon: "check",
    label: "Checklists",
    faqs: [
      {
        q: "What is the checklist for?",
        a: "The checklist ensures you capture all required compliance items before taking photos and running the AI review. Completing it prompts you to photograph each item methodically, which improves your AI confidence score.",
      },
      {
        q: "Can I skip checklist items?",
        a: "You can proceed even if not all items are ticked, but your AI confidence score will likely be lower. Required items are marked — these correspond to mandatory Australian Standards requirements.",
      },
      {
        q: "Can I customise the checklist?",
        a: "Custom checklist templates are available to Employer account holders via the Job Templates feature in the Employer Dashboard. Individual accounts use the standard trade-specific checklists.",
      },
    ],
  },
  {
    id: "account",
    icon: "person",
    label: "Account & Billing",
    faqs: [
      {
        q: "What is the difference between Individual and Employer accounts?",
        a: "Individual accounts are for sole traders managing their own jobs. Employer accounts add team management: you can invite subcontractors, assign jobs, view team reports, and manage job templates.",
      },
      {
        q: "How do I switch between Individual and Employer mode?",
        a: "Go to Settings > View > Account Type and tap 'Employer' or 'Individual'. Switching is instant and reversible. Your job history is preserved regardless of role.",
      },
      {
        q: "What is included in the free trial?",
        a: "The 14-day free trial includes full access to all features. No credit card is required to start. After 14 days, you'll need a Pro subscription to continue creating new jobs.",
      },
      {
        q: "How do I cancel my subscription?",
        a: "Subscriptions are managed through the App Store (iOS) or Google Play (Android). Go to your device's subscription settings and cancel from there. Go to Settings > Subscription > Manage Subscription for a direct link.",
      },
      {
        q: "Will I lose my data if I cancel?",
        a: "No. Your completed jobs and history remain accessible in read-only mode after cancellation. You just won't be able to create new jobs until you resubscribe.",
      },
    ],
  },
  {
    id: "employer",
    icon: "building",
    label: "Employer & Teams",
    faqs: [
      {
        q: "How do I invite a team member?",
        a: "From the Employer Dashboard, tap 'Invite Member'. Enter their email address — they'll receive an invitation to join your team in Elemetric. They need to have an existing Elemetric account or create one.",
      },
      {
        q: "How do I assign a job to someone?",
        a: "Tap 'Assign Job' on the Employer Dashboard, fill in the job details and address, and select the team member from your roster. They'll receive a notification and the job will appear in their queue.",
      },
      {
        q: "Can I see my team's compliance reports?",
        a: "Yes. The Team Report view in the Employer Dashboard shows all completed jobs by your team members, including AI confidence scores and compliance status.",
      },
      {
        q: "How many team members can I add?",
        a: "There is no hard limit on team size. Each team member requires their own Elemetric subscription — your Employer subscription covers your own account only.",
      },
    ],
  },
  {
    id: "privacy",
    icon: "lock",
    label: "Privacy & Security",
    faqs: [
      {
        q: "Who can see my job photos?",
        a: "Only you (and your employer if you're on a team). Photos are stored securely in Australian-region cloud storage. Elemetric staff do not access your photos except to investigate a specific support request you raise.",
      },
      {
        q: "How is my data protected?",
        a: "All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use Supabase with row-level security — each user can only access their own data.",
      },
      {
        q: "How do I export or delete my data?",
        a: "Go to Settings > Privacy & Data > Export My Data to download a JSON export of all your jobs. To delete your account, tap 'Request Account Deletion' — your data is removed within 30 days per our privacy policy.",
      },
      {
        q: "Is Elemetric compliant with Australian privacy law?",
        a: "Yes. Elemetric complies with the Australian Privacy Act 1988 and the Australian Privacy Principles (APPs). Our full privacy policy is at elemetric.com.au/privacy.",
      },
    ],
  },
  {
    id: "troubleshooting",
    icon: "wrench",
    label: "Troubleshooting",
    faqs: [
      {
        q: "The app crashed — what do I do?",
        a: "Force-close and reopen the app. If the crash repeats, restart your device. If the problem persists, contact support at cayde@elemetric.com.au with a description of what you were doing.",
      },
      {
        q: "My photos aren't uploading",
        a: "Check your internet connection. Make sure Elemetric has permission to access your camera and photo library in your device Settings. Photos up to 20MB are supported — very large RAW files may need to be compressed first.",
      },
      {
        q: "I can't sign in",
        a: "Try resetting your password via Settings > Change Password, or from the login screen. If you've forgotten your email, contact support. Make sure you're using the same sign-in method you registered with (email/Google/Apple).",
      },
      {
        q: "The AI returned 'Unable to analyse'",
        a: "This usually means the photos were too dark, blurry, or the subject wasn't clearly visible. Retake the photos in better lighting with the camera steady, ensuring compliance labels and components are in focus.",
      },
      {
        q: "GPS address not auto-filling",
        a: "Elemetric requires location permission to auto-fill the job address. Go to your device Settings > Privacy > Location Services > Elemetric and set to 'While Using'. You can always type the address manually.",
      },
    ],
  },
];

const CAT_ICONS: Record<string, string> = {
  rocket: "🚀",
  robot: "🤖",
  doc: "📄",
  check: "✅",
  person: "👤",
  building: "🏢",
  lock: "🔒",
  wrench: "🛠",
};

export default function Help() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.faqs.length > 0);
  }, [search]);

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(20, insets.top + 8) }]}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Help & FAQ</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIconText}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search questions..."
          placeholderTextColor="rgba(255,255,255,0.30)"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Text style={styles.searchClear}>X</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>?</Text>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyText}>
              Try different keywords, or contact support below.
            </Text>
          </View>
        )}

        {filtered.map((cat) => (
          <View key={cat.id} style={styles.section}>
            <View style={styles.catHeader}>
              <Text style={styles.catIconText}>{CAT_ICONS[cat.icon] ?? ""}</Text>
              <Text style={styles.catLabel}>{cat.label}</Text>
            </View>
            <View style={styles.group}>
              {cat.faqs.map((faq, i) => {
                const key = `${cat.id}-${i}`;
                const open = openItems.has(key);
                return (
                  <React.Fragment key={key}>
                    {i > 0 && <View style={styles.divider} />}
                    <Pressable style={styles.faqRow} onPress={() => toggle(key)}>
                      <Text style={styles.faqQ}>{faq.q}</Text>
                      <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>
                        {open ? "\u2228" : "\u203a"}
                      </Text>
                    </Pressable>
                    {open && (
                      <View style={styles.faqAnswer}>
                        <Text style={styles.faqAnswerText}>{faq.a}</Text>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactText}>
            Our support team responds within 1 business day.
          </Text>
          <Pressable
            style={styles.contactBtn}
            onPress={() => {
              const subject = encodeURIComponent("Elemetric Support Request");
              Linking.openURL(`mailto:cayde@elemetric.com.au?subject=${subject}`).catch(() => {});
            }}
          >
            <Text style={styles.contactBtnText}>Email Support</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 12 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#0f2035",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIconText: { fontSize: 16 },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 15,
    paddingVertical: 12,
  },
  searchClear: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 14,
    fontWeight: "700",
    paddingLeft: 4,
  },

  body: { paddingHorizontal: 20, paddingBottom: 60 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48, color: "rgba(255,255,255,0.30)" },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  emptyText: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" },

  section: { marginBottom: 24 },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  catIconText: { fontSize: 18 },
  catLabel: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  group: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 16,
  },

  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8,
  },
  faqQ: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  faqChevron: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 16,
    textAlign: "center",
  },
  faqChevronOpen: {
    color: "#f97316",
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqAnswerText: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 14,
    lineHeight: 21,
  },

  contactCard: {
    marginTop: 8,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    padding: 20,
    gap: 8,
  },
  contactTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  contactText: { color: "rgba(255,255,255,0.50)", fontSize: 14 },
  contactBtn: {
    marginTop: 8,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f97316",
    paddingVertical: 12,
    alignItems: "center",
  },
  contactBtnText: { color: "#f97316", fontWeight: "700", fontSize: 15 },

  back: { marginTop: 24, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
