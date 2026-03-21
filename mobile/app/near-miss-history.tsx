import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

type NearMiss = {
  id: string;
  property_address: string;
  description: string;
  immediate_action: string | null;
  reporter_name: string | null;
  created_at: string;
};

const NearMissCard = React.memo(function NearMissCard({ item }: { item: NearMiss }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.alertDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.address} numberOfLines={1}>{item.property_address || "No address"}</Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })}
            {item.reporter_name ? ` · ${item.reporter_name}` : ""}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
      {item.immediate_action ? (
        <View style={styles.actionBox}>
          <Text style={styles.actionLabel}>Action Taken</Text>
          <Text style={styles.actionText} numberOfLines={2}>{item.immediate_action}</Text>
        </View>
      ) : null}
    </View>
  );
});

export default function NearMissHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NearMiss[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;
          const { data } = await supabase
            .from("near_misses")
            .select("id, property_address, description, immediate_action, reporter_name, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          if (active && data) setItems(data as NearMiss[]);
        } catch {}
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(52, insets.top + 12) }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Near Miss History</Text>
        <Text style={styles.subtitle}>{items.length} report{items.length !== 1 ? "s" : ""} on record</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NearMissCard item={item} />}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>{"⚠️"}</Text>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyBody}>Near miss reports you submit will appear here.</Text>
              <Pressable
                style={styles.createBtn}
                onPress={() => router.push("/near-miss")}
                accessibilityRole="button"
                accessibilityLabel="File Near Miss Report"
              >
                <Text style={styles.createBtnText}>File a Report {"→"}</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 10 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
  body: { padding: 20, gap: 12, paddingBottom: 60 },
  card: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginTop: 6,
  },
  address: { color: "white", fontWeight: "700", fontSize: 15 },
  date: { color: "rgba(255,255,255,0.40)", fontSize: 12, marginTop: 2 },
  description: { color: "rgba(255,255,255,0.70)", fontSize: 13, lineHeight: 19 },
  actionBox: {
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.20)",
    padding: 10,
    gap: 2,
  },
  actionLabel: { color: "#22c55e", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  actionText: { color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 17 },
  emptyCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: "white", fontWeight: "900", fontSize: 20 },
  emptyBody: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" },
  createBtn: {
    marginTop: 8,
    backgroundColor: "#ef4444",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  createBtnText: { color: "white", fontWeight: "900", fontSize: 15 },
});
