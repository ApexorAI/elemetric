import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

// expo-clipboard may not be installed — use Share as fallback
let Clipboard: { setStringAsync: (text: string) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Clipboard = require("expo-clipboard");
} catch {}

export default function Referral() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [pending, setPending] = useState(0);
  const [earned, setEarned] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ label: string; count: number }[]>([]);
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://elemetric.com.au/ref/${referralCode}`;
  const shareMsg = `I've been using Elemetric for compliance reports on-site — it's 🔧. Sign up free: ${shareUrl}`;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("referral_code")
            .eq("user_id", user.id)
            .single();

          let code = profile?.referral_code;
          if (!code) {
            code = Math.random().toString(36).substring(2, 10).toUpperCase();
            await supabase.from("profiles").update({ referral_code: code }).eq("user_id", user.id);
          }
          if (active) setReferralCode(code);

          // Referral stats
          const { data: refs } = await supabase
            .from("referrals")
            .select("status, commission_amount")
            .eq("referrer_id", user.id);

          if (active && refs) {
            setTotalReferrals(refs.length);
            setPending(refs.filter((r: any) => r.status === "pending").length);
            setEarned(
              refs
                .filter((r: any) => r.status === "paid")
                .reduce((s: number, r: any) => s + (r.commission_amount ?? 0), 0)
            );
          }

          // Leaderboard
          const { data: lb } = await supabase
            .from("referrals")
            .select("referrer_id")
            .eq("status", "accepted");

          if (active && lb) {
            const counts: Record<string, number> = {};
            lb.forEach((r: any) => {
              counts[r.referrer_id] = (counts[r.referrer_id] ?? 0) + 1;
            });
            const sorted = Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);
            setLeaderboard(
              sorted.map(([, count], i) => ({
                label: `Plumber #${i + 1}`,
                count,
              }))
            );
          }
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const shareWhatsApp = async () => {
    try {
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMsg)}`);
    } catch {
      Alert.alert("WhatsApp not found", "Please install WhatsApp to share via WhatsApp.");
    }
  };

  const shareSMS = async () => {
    try {
      await Linking.openURL(`sms:?body=${encodeURIComponent(shareMsg)}`);
    } catch {
      Alert.alert("Cannot open SMS", "Please copy the link and share manually.");
    }
  };

  const copyLink = async () => {
    try {
      if (Clipboard) {
        await Clipboard.setStringAsync(shareUrl);
      } else {
        await Share.share({ message: shareMsg, url: shareUrl });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Refer a Friend</Text>
        <Text style={styles.subtitle}>Share Elemetric and earn rewards</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Referral link card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>YOUR REFERRAL LINK</Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{shareUrl}</Text>
          </View>
          <Text style={styles.codeLabel}>Code: <Text style={styles.codeText}>{referralCode}</Text></Text>

          {/* Share buttons */}
          <View style={styles.shareRow}>
            <Pressable style={styles.shareBtn} onPress={shareWhatsApp} accessibilityRole="button" accessibilityLabel="Share via WhatsApp">
              <Text style={styles.shareBtnIcon}>💬</Text>
              <Text style={styles.shareBtnText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={shareSMS} accessibilityRole="button" accessibilityLabel="Share via SMS">
              <Text style={styles.shareBtnIcon}>📱</Text>
              <Text style={styles.shareBtnText}>SMS</Text>
            </Pressable>
            <Pressable
              style={[styles.shareBtn, copied && styles.shareBtnCopied]}
              onPress={copyLink}
              accessibilityRole="button"
              accessibilityLabel="Copy link"
            >
              <Text style={styles.shareBtnIcon}>{copied ? "✓" : "🔗"}</Text>
              <Text style={styles.shareBtnText}>{copied ? "Copied!" : "Copy Link"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats card */}
        <Text style={styles.sectionLabel}>YOUR STATS</Text>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalReferrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#22c55e" }]}>${earned.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
        </View>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>TOP REFERRERS</Text>
            <View style={styles.card}>
              {leaderboard.map((item, i) => (
                <View key={i} style={[styles.lbRow, i < leaderboard.length - 1 && styles.lbDivider]}>
                  <View style={[styles.lbRank, i === 0 && styles.lbRankGold]}>
                    <Text style={[styles.lbRankText, i === 0 && styles.lbRankTextGold]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.lbLabel}>{item.label}</Text>
                  <Text style={styles.lbCount}>{item.count} referrals</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {leaderboard.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No referrals accepted yet.</Text>
            <Text style={styles.emptySubText}>Be the first to earn rewards!</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoItem}>1. Share your unique referral link</Text>
          <Text style={styles.infoItem}>2. Your friend signs up and completes their first job</Text>
          <Text style={styles.infoItem}>3. You both earn a reward once they activate</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: "#07152b", alignItems: "center", justifyContent: "center" },
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 12 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
  body: { paddingHorizontal: 20, paddingBottom: 60, gap: 12 },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 2,
  },

  card: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 12,
  },

  linkBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  linkText: { color: "#f97316", fontSize: 13, fontWeight: "600" },
  codeLabel: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  codeText: { color: "white", fontWeight: "900" },

  shareRow: { flexDirection: "row", gap: 10 },
  shareBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(249,115,22,0.08)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
  },
  shareBtnCopied: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.30)",
  },
  shareBtnIcon: { fontSize: 18 },
  shareBtnText: { color: "rgba(255,255,255,0.80)", fontSize: 11, fontWeight: "700" },

  statsCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { color: "white", fontSize: 28, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700" },
  statDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.07)" },

  lbRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  lbDivider: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  lbRank: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  lbRankGold: { backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(251,191,36,0.40)" },
  lbRankText: { color: "rgba(255,255,255,0.55)", fontWeight: "900", fontSize: 13 },
  lbRankTextGold: { color: "#fbbf24" },
  lbLabel: { flex: 1, color: "white", fontWeight: "700", fontSize: 14 },
  lbCount: { color: "rgba(255,255,255,0.45)", fontSize: 12 },

  emptyCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 14 },
  emptySubText: { color: "rgba(255,255,255,0.30)", fontSize: 12 },

  infoCard: {
    backgroundColor: "rgba(249,115,22,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    padding: 16,
    gap: 8,
  },
  infoTitle: { color: "#f97316", fontWeight: "900", fontSize: 14 },
  infoItem: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 20 },
});
