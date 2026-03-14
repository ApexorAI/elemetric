import React, { useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

type Note = {
  id: string;
  userId: string;
  authorName: string;
  note: string;
  createdAt: string;
  isOwn: boolean;
};

export default function JobNotes() {
  const { jobId, jobName } = useLocalSearchParams<{ jobId: string; jobName: string }>();
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("job_notes")
        .select("id, user_id, note, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error || !data) return;

      // Hydrate author names
      const hydrated: Note[] = [];
      for (const row of data) {
        let authorName = "Unknown";
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", row.user_id)
            .single();
          if (profile?.full_name) authorName = profile.full_name;
        } catch {}
        hydrated.push({
          id: row.id,
          userId: row.user_id,
          authorName,
          note: row.note,
          createdAt: row.created_at,
          isOwn: row.user_id === user.id,
        });
      }
      setNotes(hydrated);
    } catch {}
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotes();
    }, [jobId])
  );

  const sendNote = async () => {
    const text = draft.trim();
    if (!text || !currentUserId) return;

    setSending(true);
    try {
      const { error } = await supabase.from("job_notes").insert({
        job_id: jobId,
        user_id: currentUserId,
        note: text,
      });
      if (error) throw error;
      setDraft("");
      await loadNotes();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
    setSending(false);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Job Notes</Text>
        {jobName ? <Text style={styles.subtitle} numberOfLines={1}>{jobName}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#f97316" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>Add a note to start the conversation</Text>
            </View>
          ) : (
            notes.map((note) => (
              <View
                key={note.id}
                style={[styles.bubble, note.isOwn ? styles.bubbleOwn : styles.bubbleOther]}
              >
                {!note.isOwn && (
                  <Text style={styles.bubbleAuthor}>{note.authorName}</Text>
                )}
                <Text style={[styles.bubbleText, note.isOwn && styles.bubbleTextOwn]}>
                  {note.note}
                </Text>
                <Text style={[styles.bubbleTime, note.isOwn && styles.bubbleTimeOwn]}>
                  {formatTime(note.createdAt)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a note…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <Pressable
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendNote}
          disabled={!draft.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#0b1220" />
            : <Text style={styles.sendBtnText}>↑</Text>
          }
        </Pressable>
      </View>

      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 2, color: "rgba(255,255,255,0.5)", fontSize: 13 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  thread: { padding: 16, gap: 8, paddingBottom: 12 },

  emptyState: {
    marginTop: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "white", fontSize: 17, fontWeight: "900" },
  emptySubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center" },

  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderBottomLeftRadius: 4,
  },
  bubbleOwn: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(249,115,22,0.18)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    borderBottomRightRadius: 4,
  },
  bubbleAuthor: {
    color: "#f97316",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  bubbleText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextOwn: { color: "white" },
  bubbleTime: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    alignSelf: "flex-end",
  },
  bubbleTimeOwn: { color: "rgba(249,115,22,0.5)" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#07152b",
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(249,115,22,0.35)" },
  sendBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 18, marginTop: -1 },

  back: { paddingVertical: 10, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
