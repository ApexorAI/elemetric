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
import { supabase } from "@/lib/supabase";

type Suggestion = { display: string; short: string };

const TYPE_LABELS: Record<string, string> = {
  gas:        "Gas Rough-In",
  drainage:   "Drainage",
  newinstall: "New Installation",
  electrical: "Electrical",
  hvac:       "HVAC",
  carpentry:  "Carpentry",
  hotwater:   "Hot Water System Install",
};

const TYPE_DEST: Record<string, string> = {
  gas:        "/plumbing/gas-checklist",
  drainage:   "/plumbing/drainage-checklist",
  newinstall: "/plumbing/newinstall-checklist",
  electrical: "/plumbing/electrical-checklist",
  hvac:       "/plumbing/general-checklist",
  carpentry:  "/plumbing/carpentry-checklist",
};

const FREE_JOB_LIMIT = 3;

export default function NewJob() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = String(params.type || "hotwater");

  const [jobName,    setJobName]    = useState("");
  const [jobAddr,    setJobAddr]    = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [checking,   setChecking]   = useState(false);
  const [weather, setWeather] = useState<"Clear" | "Overcast" | "Rain" | "Indoor">("Clear");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Address autocomplete ───────────────────────────────────────────────────

  const fetchSuggestions = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 4) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggLoading(true);
      try {
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
      } catch {
        setSuggestions([]);
      } finally {
        setSuggLoading(false);
      }
    }, 450);
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
      if (!user) return true; // not signed in — let them proceed (login will catch it)

      // Check role and beta status — paid users and beta testers are never blocked
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, free_jobs_used, beta_tester")
        .eq("user_id", user.id)
        .single();

      const role = profile?.role ?? "free";
      if (role && role !== "free") return true; // paid subscriber
      if (profile?.beta_tester === true) return true; // beta tester bypass

      // Count total jobs saved
      const { count } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count ?? 0) >= FREE_JOB_LIMIT) {
        return false; // hit the free limit
      }
    } catch {
      // If the check fails (offline), let them proceed
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
        weather: weather,
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
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
                  <Pressable style={styles.suggItem} onPress={() => pickSuggestion(item)}>
                    <Text style={styles.suggPrimary} numberOfLines={1}>{item.short}</Text>
                    <Text style={styles.suggSecondary} numberOfLines={1}>{item.display}</Text>
                  </Pressable>
                )}
              />
              <Text style={styles.suggAttrib}>© OpenStreetMap contributors</Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Weather Conditions</Text>
        <View style={styles.weatherRow}>
          {(["Clear", "Overcast", "Rain", "Indoor"] as const).map((w) => (
            <Pressable
              key={w}
              style={[styles.weatherBtn, weather === w && styles.weatherBtnActive]}
              onPress={() => setWeather(w)}
            >
              <Text style={[styles.weatherBtnText, weather === w && styles.weatherBtnTextActive]}>
                {w === "Clear" ? "☀️ Clear" : w === "Overcast" ? "☁️ Overcast" : w === "Rain" ? "🌧️ Rain" : "🏠 Indoor"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.button, checking && { opacity: 0.6 }]}
          onPress={onContinue}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.buttonText}>Continue →</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 13 },

  body: { padding: 20, paddingBottom: 60 },
  label: { color: "rgba(255,255,255,0.65)", marginTop: 20, fontWeight: "700", fontSize: 15 },

  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0d1f3d",
    marginTop: 4,
    overflow: "hidden",
  },
  suggItem: { paddingHorizontal: 14, paddingVertical: 12 },
  suggPrimary: { color: "white", fontWeight: "700", fontSize: 14 },
  suggSecondary: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 },
  suggDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 14 },
  suggAttrib: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 10,
    textAlign: "right",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  button: {
    marginTop: 36,
    backgroundColor: "#f97316",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: { color: "#0b1220", fontWeight: "900", fontSize: 17 },

  back: { marginTop: 18, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 15 },
  weatherRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  weatherBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  weatherBtnActive: {
    backgroundColor: "rgba(249,115,22,0.20)",
    borderColor: "#f97316",
  },
  weatherBtnText: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
    fontSize: 13,
  },
  weatherBtnTextActive: {
    color: "white",
  },
});
