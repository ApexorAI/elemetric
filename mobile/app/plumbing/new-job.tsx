import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";

const FLOW_STEPS = ["Job Details", "Checklist", "Photos", "AI Review"];

type Suggestion = { display: string; short: string };

const TYPE_LABELS: Record<string, string> = {
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Installation",
  electrical: "Electrical",
  hvac:       "HVAC",
  carpentry:  "Carpentry",
  hotwater:   "Hot Water System Install",
  powerpoint: "Power Point Installation",
  lighting: "Lighting Installation",
  switchboard: "Switchboard Upgrade",
  circuit: "Circuit Installation",
  faultfinding: "Fault Finding",
  appliance: "Appliance Installation",
  smokealarm: "Smoke Alarm Installation",
  splitsystem: "Split System Installation",
  ducted: "Ducted System Installation",
  refrigerant: "Refrigerant Piping",
  hvacservice: "HVAC Maintenance",
  ventilation: "Ventilation Installation",
  framing: "Structural Framing",
  decking: "Decking",
  pergola: "Pergola / Outdoor Structure",
  door: "Door Installation",
  window: "Window Installation",
  flooring: "Flooring",
  fixing: "Fixing and Finishing",
  woodheater: "Wood Heater",
  gasheater: "Gas Heater",
};

const TYPE_DEST: Record<string, string> = {
  // Plumbing — dedicated checklists
  gas:          "/plumbing/gas-checklist",
  drainage:     "/plumbing/drainage-checklist",
  newinstall:   "/plumbing/newinstall-checklist",
  woodheater:   "/plumbing/general-checklist",
  gasheater:    "/plumbing/gas-checklist",
  // Electrical — all route to electrical-checklist (type-aware)
  electrical:   "/plumbing/electrical-checklist",
  powerpoint:   "/plumbing/electrical-checklist",
  lighting:     "/plumbing/electrical-checklist",
  switchboard:  "/plumbing/electrical-checklist",
  circuit:      "/plumbing/electrical-checklist",
  faultfinding: "/plumbing/electrical-checklist",
  appliance:    "/plumbing/electrical-checklist",
  smokealarm:   "/plumbing/electrical-checklist",
  // HVAC — general checklist handles all HVAC types via TYPE_API_MAP
  hvac:         "/plumbing/general-checklist",
  splitsystem:  "/plumbing/general-checklist",
  ducted:       "/plumbing/general-checklist",
  refrigerant:  "/plumbing/general-checklist",
  hvacservice:  "/plumbing/general-checklist",
  ventilation:  "/plumbing/general-checklist",
  // Carpentry — all route to carpentry-checklist (type-aware)
  carpentry:    "/plumbing/carpentry-checklist",
  framing:      "/plumbing/carpentry-checklist",
  decking:      "/plumbing/carpentry-checklist",
  pergola:      "/plumbing/carpentry-checklist",
  door:         "/plumbing/carpentry-checklist",
  window:       "/plumbing/carpentry-checklist",
  flooring:     "/plumbing/carpentry-checklist",
  fixing:       "/plumbing/carpentry-checklist",
};

export default function NewJob() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = String(params.type || "hotwater");

  const [jobName,    setJobName]    = useState("");
  const [jobAddr,    setJobAddr]    = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [checking,   setChecking]   = useState(false);
  // Floor plan upload hidden until post-launch

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Address autocomplete ───────────────────────────────────────────────────

  const fetchSuggestions = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 4) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggLoading(true);
      try {
        const googleKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
        if (googleKey) {
          // Google Places Autocomplete — best results for Australian addresses
          const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${googleKey}&components=country:au&language=en&types=address`;
          const res = await fetch(url);
          const data = await res.json();
          const items: Suggestion[] = (data.predictions ?? []).map((p: any) => ({
            display: p.description,
            short: p.description,
          }));
          setSuggestions(items);
        } else {
          // Fallback: OpenStreetMap Nominatim (no API key needed)
          const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=au&addressdetails=1&limit=6&q=${encodeURIComponent(text)}`;
          const res = await fetch(url, {
            headers: { "User-Agent": "ElemetricApp/1.0 (plumbing compliance)" },
          });
          const data = await res.json();
          const items: Suggestion[] = data.map((r: any) => {
            const p = r.address ?? {};
            const short = [
              p.house_number,
              p.road,
              p.suburb ?? p.village ?? p.town ?? p.city,
              p.state,
              p.postcode,
            ].filter(Boolean).join(" ");
            return { display: r.display_name, short: short || r.display_name };
          });
          setSuggestions(items);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSuggLoading(false);
      }
    }, 350);
  };

  const onAddrChange = (text: string) => {
    setJobAddr(text);
    fetchSuggestions(text);
  };

  const pickSuggestion = (s: Suggestion) => {
    setJobAddr(s.short);
    setSuggestions([]);
  };

  // ── Free tier gate ─────────────────────────────────────────────────────────

  const checkFreeLimit = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return true;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, beta_tester, trial_started_at")
        .eq("user_id", user.id)
        .single();

      const role = profile?.role ?? "free";
      if (role && role !== "free") return true; // paid subscriber
      if (profile?.beta_tester === true) return true; // beta tester bypass

      // Start trial on first job if not started
      let trialStart = profile?.trial_started_at ? new Date(profile.trial_started_at) : null;
      if (!trialStart) {
        const now = new Date();
        await supabase.from("profiles").update({ trial_started_at: now.toISOString() }).eq("user_id", user.id);
        trialStart = now;
      }

      const daysSince = Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = 14 - daysSince;

      if (daysRemaining <= 0) {
        return false; // trial expired
      }

      if (daysRemaining === 1) {
        Alert.alert("Last Day of Trial", "Today is the last day of your 14-day free trial. Upgrade to keep creating jobs.");
      } else if (daysRemaining <= 2) {
        Alert.alert("Trial Ending Soon", `You have ${daysRemaining} days left in your free trial.`);
      }
    } catch {
      // If check fails (offline), let them proceed
    }
    return true;
  };

  // ── Continue ───────────────────────────────────────────────────────────────

  const onContinue = async () => {
    setSuggestions([]);
    setChecking(true);

    try {
      // Gate: check free tier limit
      const allowed = await checkFreeLimit();
      if (!allowed) {
        router.push("/paywall");
        return;
      }

      const currentJob = {
        type,
        jobName: jobName.trim() || "Untitled Job",
        jobAddr: jobAddr.trim() || "No address",
        startTime: new Date().toISOString(),
      };
      await AsyncStorage.setItem("elemetric_current_job", JSON.stringify(currentJob));

      const dest = TYPE_DEST[type] ?? "/plumbing/checklist";
      router.push(dest as never);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save job");
    } finally {
      setChecking(false);
    }
  };

  const typeLabel = TYPE_LABELS[type] ?? "New Job";

  const TYPE_ICONS: Record<string, string> = {
    hotwater: "🚿", gas: "🔥", drainage: "🪣", newinstall: "🔧",
    electrical: "⚡", hvac: "❄️", carpentry: "🪚",
    powerpoint: "🔌", lighting: "💡", switchboard: "🔋",
    splitsystem: "🌬️", ducted: "🌡️", framing: "🏗️",
    decking: "🪵", door: "🚪", window: "🪟", flooring: "🏠",
  };
  const jobIcon = TYPE_ICONS[type] ?? "🔧";

  return (
    <View style={styles.screen}>
      {/* Progress indicator */}
      <View style={styles.progressWrap}>
        {FLOW_STEPS.map((step, i) => (
          <View key={step} style={styles.progressItem}>
            <View style={[
              styles.progressDot,
              i === 0 && styles.progressDotActive,
              i > 0 && styles.progressDotFuture,
            ]}>
              {i === 0
                ? <Text style={styles.progressDotText}>1</Text>
                : <View style={styles.progressDotInner} />
              }
            </View>
            <Text style={[
              styles.progressLabel,
              i === 0 && styles.progressLabelActive,
            ]}>{step}</Text>
            {i < FLOW_STEPS.length - 1 && (
              <View style={styles.progressLine} />
            )}
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <Text style={styles.jobIcon}>{jobIcon}</Text>
        <Text style={styles.title}>Job Details</Text>
        <Text style={styles.subtitle}>{typeLabel}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Job Name</Text>
        <TextInput
          style={styles.input}
          value={jobName}
          onChangeText={setJobName}
          placeholder="e.g. Smith Residence"
          placeholderTextColor="rgba(255,255,255,0.28)"
          returnKeyType="next"
          accessibilityLabel="Job name"
        />

        <Text style={styles.label}>Job Address</Text>
        <View style={styles.addrWrap}>
          <TextInput
            style={styles.input}
            value={jobAddr}
            onChangeText={onAddrChange}
            placeholder="Start typing an address…"
            placeholderTextColor="rgba(255,255,255,0.28)"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => setSuggestions([])}
          />
          {suggLoading && (
            <ActivityIndicator size="small" color="#f97316" style={styles.suggSpinner} />
          )}
          {suggestions.length > 0 && (
            <View style={styles.suggBox}>
              <FlatList
                data={suggestions}
                keyExtractor={(_, i) => String(i)}
                keyboardShouldPersistTaps="always"
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.suggDivider} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.suggItem} onPress={() => pickSuggestion(item)} accessibilityRole="button" accessibilityLabel={item.display}>
                    <Text style={styles.suggPrimary} numberOfLines={1}>{item.short}</Text>
                    <Text style={styles.suggSecondary} numberOfLines={1}>{item.display}</Text>
                  </Pressable>
                )}
              />
              <Text style={styles.suggAttrib}>
                {process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ? "Powered by Google" : "© OpenStreetMap contributors"}
              </Text>
            </View>
          )}
        </View>

        {/* Floor plan upload hidden until post-launch */}

        {/* What's next card */}
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>What happens next</Text>
          {[
            { step: "2", label: "Checklist", desc: "Complete the job-type checklist" },
            { step: "3", label: "Photos", desc: "Capture site photos for AI analysis" },
            { step: "4", label: "AI Review", desc: "Get your compliance score & report" },
          ].map((s) => (
            <View key={s.step} style={styles.nextRow}>
              <View style={styles.nextStepBadge}>
                <Text style={styles.nextStepNum}>{s.step}</Text>
              </View>
              <View style={styles.nextRowText}>
                <Text style={styles.nextRowLabel}>{s.label}</Text>
                <Text style={styles.nextRowDesc}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.button, checking && { opacity: 0.6 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onContinue(); }}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Continue to checklist"
        >
          {checking
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.buttonText}>Continue to Checklist →</Text>
          }
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

  // ── Progress indicator ─────────────────────────────────────────────────────
  progressWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  progressItem: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  progressLine: {
    position: "absolute",
    top: 13,
    left: "50%",
    right: "-50%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  progressDotActive: {
    backgroundColor: "#f97316",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  progressDotFuture: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  progressDotText: {
    color: "#07152b",
    fontWeight: "900",
    fontSize: 12,
  },
  progressDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  progressLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
  },
  progressLabelActive: {
    color: "#f97316",
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 8 },
  jobIcon: { fontSize: 36, marginBottom: 4 },
  title: { color: "white", fontSize: 26, fontWeight: "900" },
  subtitle: { marginTop: 2, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  // ── What's next card ───────────────────────────────────────────────────────
  nextCard: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    gap: 12,
  },
  nextTitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nextStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nextStepNum: {
    color: "#f97316",
    fontWeight: "900",
    fontSize: 11,
  },
  nextRowText: { flex: 1 },
  nextRowLabel: { color: "rgba(255,255,255,0.80)", fontWeight: "700", fontSize: 13 },
  nextRowDesc: { color: "rgba(255,255,255,0.40)", fontSize: 12, marginTop: 1 },

  body: { padding: 20, paddingBottom: 60 },
  label: {
    color: "rgba(255,255,255,0.35)",
    marginTop: 20,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  input: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    padding: 14,
    color: "white",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 15,
  },

  addrWrap: { position: "relative" },
  suggSpinner: { position: "absolute", right: 14, top: 22 },
  suggBox: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginTop: 4,
    overflow: "hidden",
  },
  suggItem: { paddingHorizontal: 14, paddingVertical: 12 },
  suggPrimary: { color: "white", fontWeight: "700", fontSize: 14 },
  suggSecondary: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 },
  suggDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 14 },
  suggAttrib: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    textAlign: "right",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  button: {
    marginTop: 36,
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  back: { marginTop: 20, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 15 },
  floorPlanBtn: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    height: 52,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  floorPlanPreviewRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  floorPlanThumb: { width: 60, height: 60, borderRadius: 10 },
  floorPlanSelected: { color: "white", fontWeight: "700", fontSize: 15 },
  floorPlanSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  floorPlanEmptyRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  floorPlanIcon: { fontSize: 24 },
  floorPlanEmptyText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 15 },
});
