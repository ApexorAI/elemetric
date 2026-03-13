import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

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
    }, [])
  );

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
    if (!n.read) markAsRead(n.id);
    if (n.jobId) {
      // Navigate to assigned jobs if this is a job-related notification
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

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You'll see job assignments, completions, and compliance alerts here
            </Text>
          </View>
        ) : (
          notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.general;
            return (
              <Pressable
                key={n.id}
                style={[styles.notifCard, !n.read && styles.notifCardUnread]}
                onPress={() => handlePress(n)}
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
  loadingText: { color: "rgba(255,255,255,0.7)" },

  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
  unreadBadge: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    marginTop: 8,
  },
  unreadBadgeText: { color: "#0b1220", fontWeight: "900", fontSize: 14 },

  markAllRow: { paddingHorizontal: 18, paddingBottom: 4 },
  markAllBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  markAllText: { color: "#f97316", fontWeight: "700", fontSize: 13 },

  body: { padding: 16, gap: 10, paddingBottom: 40 },

  emptyState: {
    marginTop: 40,
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  emptySubtitle: {
    color: "rgba(255,255,255,0.45)", fontSize: 13,
    textAlign: "center", lineHeight: 20,
  },

  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
  },
  notifCardUnread: {
    borderColor: "rgba(249,115,22,0.25)",
    backgroundColor: "rgba(249,115,22,0.05)",
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
  notifTitle: { flex: 1, color: "white", fontWeight: "800", fontSize: 14 },
  notifTime: { color: "rgba(255,255,255,0.35)", fontSize: 11, flexShrink: 0 },
  notifBody: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 18 },
  notifBottom: { flexDirection: "row", alignItems: "center", gap: 8 },

  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  typeBadgeText: { fontSize: 10, fontWeight: "800" },

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
    color: "rgba(255,255,255,0.3)",
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 20,
  },

  back: { marginTop: 8, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
