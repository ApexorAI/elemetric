import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Switch,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";

const SOUND_PREF_KEY = "elemetric_notif_sound";

// ── Types ─────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  jobId: string | null;
  createdAt: string;
};

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  job_assigned:     { icon: "📋", color: "#60a5fa", label: "Job Assigned" },
  job_completed:    { icon: "✅", color: "#22c55e", label: "Job Completed" },
  compliance_alert: { icon: "⚠️", color: "#f97316", label: "Compliance Alert" },
  near_miss:        { icon: "🚨", color: "#ef4444", label: "Near Miss" },
  general:          { icon: "📣", color: "rgba(255,255,255,0.6)", label: "Update" },
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);
  const [search, setSearch]               = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [soundEnabled, setSoundEnabled]   = useState(true);
  const [showPrefs, setShowPrefs]         = useState(false);

  const loadPrefs = async () => {
    const val = await AsyncStorage.getItem(SOUND_PREF_KEY);
    if (val !== null) setSoundEnabled(val === "true");
  };

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        setNotifications(
          data.map((row: any) => ({
            id: row.id,
            title: row.title,
            body: row.body ?? null,
            type: row.type ?? "general",
            read: row.read ?? false,
            jobId: row.job_id ?? null,
            createdAt: row.created_at,
          }))
        );
      }
    } catch {}
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
      loadPrefs();
    }, [])
  );

  const toggleSound = async (val: boolean) => {
    setSoundEnabled(val);
    await AsyncStorage.setItem(SOUND_PREF_KEY, val ? "true" : "false");
  };

  const deleteAll = async () => {
    Alert.alert("Delete All", "Delete all notifications? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from("notifications").delete().eq("user_id", user.id);
            setNotifications([]);
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Could not delete notifications.");
          }
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not mark all as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handlePress = (n: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!n.read) markAsRead(n.id);
    if (n.jobId) {
      router.push("/assigned-jobs");
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins  = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days  = Math.floor(diff / 86400000);
      if (mins < 1)  return "just now";
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7)  return `${days}d ago`;
      return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const CATEGORIES = [
    { key: "all", label: "All" },
    { key: "job_assigned", label: "Jobs" },
    { key: "compliance_alert", label: "Compliance" },
    { key: "near_miss", label: "Near Miss" },
    { key: "general", label: "Updates" },
  ];

  const filtered = useMemo(() => notifications.filter((n) => {
    if (categoryFilter !== "all" && n.type !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || (n.body ?? "").toLowerCase().includes(q);
  }), [notifications, search, categoryFilter]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#f97316" />
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>ELEMETRIC</Text>
            <Text style={styles.title}>Notifications</Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {unreadCount > 0 && (
        <View style={styles.markAllRow}>
          <Pressable onPress={markAllRead} disabled={markingAll} style={styles.markAllBtn}>
            {markingAll
              ? <ActivityIndicator size="small" color="#f97316" />
              : <Text style={styles.markAllText}>Mark all as read</Text>
            }
          </Pressable>
        </View>
      )}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search notifications…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search notifications"
        />
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={[styles.filterChip, categoryFilter === cat.key && styles.filterChipActive]}
            onPress={() => setCategoryFilter(cat.key)}
          >
            <Text style={[styles.filterChipText, categoryFilter === cat.key && styles.filterChipTextActive]}>
              {cat.label}
              {cat.key === "all"
                ? ` (${notifications.length})`
                : notifications.filter((n) => n.type === cat.key).length > 0
                  ? ` (${notifications.filter((n) => n.type === cat.key).length})`
                  : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Actions row */}
      <View style={styles.actionsRow}>
        <Pressable onPress={() => setShowPrefs(!showPrefs)} style={styles.prefBtn}>
          <Text style={styles.prefBtnText}>⚙ Preferences</Text>
        </Pressable>
        {notifications.length > 0 && (
          <Pressable onPress={deleteAll} style={styles.deleteAllBtn}>
            <Text style={styles.deleteAllBtnText}>Delete All</Text>
          </Pressable>
        )}
      </View>

      {/* Preferences panel */}
      {showPrefs && (
        <View style={styles.prefsPanel}>
          <Text style={styles.prefsPanelTitle}>Notification Preferences</Text>
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Text style={styles.prefLabel}>Sound</Text>
              <Text style={styles.prefSub}>Play sound on new notifications</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: "rgba(255,255,255,0.12)", true: "#f97316" }}
              thumbColor="white"
            />
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f97316"
            colors={["#f97316"]}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You'll see job assignments, completions, and compliance alerts here
            </Text>
          </View>
        ) : (
          filtered.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.general;
            return (
              <Pressable
                key={n.id}
                style={[styles.notifCard, !n.read && styles.notifCardUnread]}
                onPress={() => handlePress(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}${n.body ? `: ${n.body}` : ""}${!n.read ? " — unread" : ""}`}
              >
                <View style={[styles.iconWrap, { borderColor: cfg.color + "44", backgroundColor: cfg.color + "18" }]}>
                  <Text style={styles.icon}>{cfg.icon}</Text>
                </View>

                <View style={styles.notifContent}>
                  <View style={styles.notifTop}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                    <Text style={styles.notifTime}>{formatTime(n.createdAt)}</Text>
                  </View>
                  {n.body ? (
                    <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                  ) : null}
                  <View style={styles.notifBottom}>
                    <View style={[styles.typeBadge, { borderColor: cfg.color + "44", backgroundColor: cfg.color + "18" }]}>
                      <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {!n.read && <View style={styles.unreadDot} />}
                  </View>
                </View>

                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => deleteNotification(n.id)}
                  hitSlop={10}
                >
                  <Text style={styles.deleteBtnText}>×</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1, backgroundColor: "#07152b",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  loadingText: { color: "rgba(255,255,255,0.55)" },

  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  unreadBadge: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    marginTop: 8,
  },
  unreadBadgeText: { color: "#07152b", fontWeight: "900", fontSize: 14 },

  markAllRow: { paddingHorizontal: 20, paddingBottom: 4 },
  markAllBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  markAllText: { color: "#f97316", fontWeight: "700", fontSize: 13 },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  searchInput: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  body: { padding: 20, gap: 12, paddingBottom: 40 },

  emptyState: {
    marginTop: 40,
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: "white", fontSize: 22, fontWeight: "900" },
  emptySubtitle: {
    color: "rgba(255,255,255,0.55)", fontSize: 13,
    textAlign: "center", lineHeight: 20,
  },

  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: "#f97316",
    borderColor: "rgba(255,255,255,0.07)",
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: { fontSize: 20 },

  notifContent: { flex: 1, gap: 5 },
  notifTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  notifTitle: { flex: 1, color: "white", fontWeight: "700", fontSize: 15 },
  notifTime: { color: "rgba(255,255,255,0.35)", fontSize: 12, flexShrink: 0 },
  notifBody: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  notifBottom: { flexDirection: "row", alignItems: "center", gap: 8 },

  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
    backgroundColor: "transparent",
  },
  typeBadgeText: { fontSize: 12, fontWeight: "700" },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#f97316",
  },

  deleteBtn: {
    paddingLeft: 4,
    paddingTop: 2,
  },
  deleteBtnText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 20,
  },

  back: { marginTop: 8, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },

  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  filterChipActive: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  filterChipText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500" },
  filterChipTextActive: { color: "#07152b", fontWeight: "700" },

  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 10,
    alignItems: "center",
  },
  prefBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  prefBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },
  deleteAllBtn: {
    marginLeft: "auto" as any,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
  },
  deleteAllBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },

  prefsPanel: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 10,
  },
  prefsPanelTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  prefRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  prefInfo: { flex: 1 },
  prefLabel: { color: "white", fontWeight: "700", fontSize: 15 },
  prefSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
});
