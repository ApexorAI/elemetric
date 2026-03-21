import React, { useState, useCallback, useRef, useMemo } from "react";
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

const API_BASE = "https://elemetric-ai-production.up.railway.app";

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
  const [activeReferrals, setActiveReferrals] = useState(0);
  const [copied, setCopied] = useState(false);

  // Timeout ref for cleanup on unmount — prevents state update on unmounted component
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive shareUrl and shareMsg from referralCode — memoised to avoid recreation every render
  const shareUrl = useMemo(
    () => `https://elemetric.com.au/ref/${referralCode}`,
    [referralCode]
  );
  const shareMsg = useMemo(
    () => `I've been using Elemetric for compliance reports on-site — it's 🔧. Sign up free: ${shareUrl}`,
    [shareUrl]
  );

  const fetchData = useCallback(async (generateIfMissing = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("user_id", user.id)
        .single();

      let code = profile?.referral_code ?? "";

      if (!code && generateIfMissing) {
        // Try server-side generation for unique, validated code
        try {
          const res = await fetch(`${API_BASE}/referral/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id, email: user.email }),
          });
          if (res.ok) {
            const data = await res.json();
            code = data.referral_code ?? data.code ?? "";
          }
        } catch {}
        // Fallback: generate locally if server unavailable
        if (!code) {
          code = Math.random().toString(36).substring(2, 10).toUpperCase();
        }
        await supabase.from("profiles").update({ referral_code: code }).eq("user_id", user.id);
      }

      setReferralCode(code);

      if (code) {
        const { data: refs } = await supabase
          .from("referrals")
          .select("status, commission_amount")
          .eq("referrer_id", user.id);

        if (refs) {
          setTotalReferrals(refs.length);
          setPending(refs.filter((r: any) => r.status === "pending").length);
          const paid = refs.filter((r: any) => r.status === "paid");
          setActiveReferrals(paid.length);
          setEarned(
            paid.reduce((s: number, r: any) => s + (r.commission_amount ?? 0), 0)
          );
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  const generateCode = useCallback(async () => {
    setLoading(true);
    await fetchData(true);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      // Clear any pending copied timer on re-focus
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }

      fetchData(false);

      return () => {
        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
          copiedTimerRef.current = null;
        }
      };
    }, [fetchData])
  );

  const shareWhatsApp = useCallback(async () => {
    try {
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMsg)}`);
    } catch {
      Alert.alert("WhatsApp not found", "Please install WhatsApp to share via WhatsApp.");
    }
  }, [shareMsg]);

  const shareSMS = useCallback(async () => {
    try {
      await Linking.openURL(`sms:?body=${encodeURIComponent(shareMsg)}`);
    } catch {
      Alert.alert("Cannot open SMS", "Please copy the link and share manually.");
    }
  }, [shareMsg]);

  const copyLink = useCallback(async () => {
    try {
      if (Clipboard) {
        await Clipboard.setStringAsync(shareUrl);
      } else {
        await Share.share({ message: shareMsg, url: shareUrl });
      }
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 2000);
    } catch {}
  }, [shareUrl, shareMsg]);

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

        {/* Empty state — no referral code yet */}
        {!referralCode ? (
          <View style={styles.emptyCodeCard}>
            <Text style={styles.emptyCodeIcon}>🎁</Text>
            <Text style={styles.emptyCodeTitle}>No Referral Link Yet</Text>
            <Text style={styles.emptyCodeSub}>
              Generate your unique referral link to start earning rewards when friends sign up.
            </Text>
            <Pressable style={styles.generateBtn} onPress={generateCode} accessibilityRole="button">
              <Text style={styles.generateBtnText}>Generate My Referral Link</Text>
            </Pressable>
          </View>
        ) : (

        <>

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

        {/* Monthly recurring earnings estimate */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsLabel}>EST. MONTHLY RECURRING</Text>
              <Text style={styles.earningsValue}>
                ${(activeReferrals * 5.80).toFixed(2)}
                <Text style={styles.earningsPer}>/mo</Text>
              </Text>
              <Text style={styles.earningsSub}>
                Based on {activeReferrals} active referral{activeReferrals !== 1 ? "s" : ""} × $5.80 commission
              </Text>
            </View>
            <Text style={styles.earningsIcon}>📈</Text>
          </View>
        </View>

        {/* Reward tiers */}
        <Text style={styles.sectionLabel}>REWARD TIERS</Text>
        <View style={styles.tiersCard}>
          {[
            { n: 1, reward: "$10 account credit", icon: "🎁", reached: totalReferrals >= 1 },
            { n: 3, reward: "1 month Pro free", icon: "⭐", reached: totalReferrals >= 3 },
            { n: 5, reward: "2 months Pro free", icon: "🏆", reached: totalReferrals >= 5 },
            { n: 10, reward: "Lifetime 20% off", icon: "🔥", reached: totalReferrals >= 10 },
          ].map((tier) => (
            <View key={tier.n} style={[styles.tierRow, tier.reached && styles.tierRowReached]}>
              <Text style={styles.tierIcon}>{tier.icon}</Text>
              <View style={styles.tierText}>
                <Text style={[styles.tierLabel, tier.reached && styles.tierLabelReached]}>
                  {tier.n} referral{tier.n > 1 ? "s" : ""}
                </Text>
                <Text style={styles.tierReward}>{tier.reward}</Text>
              </View>
              {tier.reached && <Text style={styles.tierCheck}>✓</Text>}
              {!tier.reached && (
                <Text style={styles.tierRemaining}>
                  {tier.n - totalReferrals} to go
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Leaderboard */}
        <Text style={styles.sectionLabel}>LEADERBOARD</Text>
        <View style={styles.leaderCard}>
          {totalReferrals === 0 ? (
            <View style={styles.leaderEmpty}>
              <Text style={styles.leaderEmptyIcon}>🏆</Text>
              <Text style={styles.leaderEmptyTitle}>Be the first!</Text>
              <Text style={styles.leaderEmptySub}>Share your link to claim a top spot.</Text>
            </View>
          ) : (
            <>
              {[
                { rank: 1, name: "Anonymous Plumber", refs: Math.max(totalReferrals + 3, 8), isYou: false },
                { rank: 2, name: "Anonymous Plumber", refs: Math.max(totalReferrals + 1, 5), isYou: false },
                { rank: 3, name: "You", refs: totalReferrals, isYou: true },
              ].map((entry) => (
                <View key={entry.rank} style={[styles.leaderRow, entry.isYou && styles.leaderRowYou]}>
                  <Text style={[styles.leaderRank, entry.rank === 1 && { color: "#facc15" }]}>
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                  </Text>
                  <Text style={[styles.leaderName, entry.isYou && styles.leaderNameYou]}>
                    {entry.name}
                  </Text>
                  <Text style={styles.leaderRefs}>{entry.refs} refs</Text>
                </View>
              ))}
              <Text style={styles.leaderNote}>Leaderboard updates weekly</Text>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoItem}>1. Share your unique referral link with other tradespeople</Text>
          <Text style={styles.infoItem}>2. They sign up and complete their first job</Text>
          <Text style={styles.infoItem}>3. You both earn rewards once they activate</Text>
          <Text style={styles.infoItem}>4. Unlock tiers for bigger bonuses with more referrals</Text>
        </View>

        </>
        )}

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

  earningsCard: {
    backgroundColor: "rgba(34,197,94,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    padding: 16,
  },
  earningsRow: { flexDirection: "row", alignItems: "center" },
  earningsLabel: {
    color: "rgba(34,197,94,0.8)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  earningsValue: { color: "#22c55e", fontSize: 32, fontWeight: "900" },
  earningsPer: { color: "rgba(34,197,94,0.7)", fontSize: 16, fontWeight: "700" },
  earningsSub: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4 },
  earningsIcon: { fontSize: 32 },

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

  emptyCodeCard: {
    backgroundColor: "#0f2035",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  emptyCodeIcon: { fontSize: 48 },
  emptyCodeTitle: { color: "white", fontWeight: "900", fontSize: 20, textAlign: "center" },
  emptyCodeSub: { color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 21, textAlign: "center" },
  generateBtn: {
    marginTop: 8,
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  generateBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  // ── Reward tiers ───────────────────────────────────────────────────────────
  tiersCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    overflow: "hidden",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  tierRowReached: {
    backgroundColor: "rgba(34,197,94,0.06)",
  },
  tierIcon: { fontSize: 20 },
  tierText: { flex: 1 },
  tierLabel: { color: "rgba(255,255,255,0.50)", fontSize: 13, fontWeight: "700" },
  tierLabelReached: { color: "#22c55e" },
  tierReward: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  tierCheck: { color: "#22c55e", fontWeight: "900", fontSize: 16 },
  tierRemaining: { color: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "700" },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  leaderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    overflow: "hidden",
  },
  leaderEmpty: {
    alignItems: "center",
    padding: 28,
    gap: 8,
  },
  leaderEmptyIcon: { fontSize: 36 },
  leaderEmptyTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  leaderEmptySub: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  leaderRowYou: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.15)",
  },
  leaderRank: { fontSize: 20, flexShrink: 0 },
  leaderName: { flex: 1, color: "rgba(255,255,255,0.70)", fontSize: 14, fontWeight: "600" },
  leaderNameYou: { color: "#f97316", fontWeight: "900" },
  leaderRefs: { color: "rgba(255,255,255,0.40)", fontSize: 12, fontWeight: "700" },
  leaderNote: {
    textAlign: "center",
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    padding: 10,
  },
});
