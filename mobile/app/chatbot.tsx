import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const CHAT_KEY = "elemetric_chat_history";

const SUGGESTED_QUESTIONS = [
  "What is the 7-year liability period?",
  "What photos do I need for a gas job?",
  "How do I share my report with a client?",
  "What does my confidence score mean?",
  "What are the BPC licence requirements in Victoria?",
  "Minimum depth of cover for hot water pipes?",
  "What is AS/NZS 3500.4:2025?",
  "How do I dispute a compliance notice?",
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function TypingDots() {
  const [dot, setDot] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDot((d) => (d + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = ".".repeat(dot);
  return (
    <View style={styles.aiRow}>
      <View style={styles.aiBadge}>
        <Text style={styles.aiBadgeText}>AI</Text>
      </View>
      <View style={[styles.aiBubble, { paddingVertical: 16, paddingHorizontal: 18 }]}>
        <ActivityIndicator size="small" color="#f97316" />
        <Text style={styles.typingText}>Thinking{dots}</Text>
      </View>
    </View>
  );
}

export default function Chatbot() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sentTimestamps = useRef<number[]>([]);
  const RATE_LIMIT_COUNT = 8;
  const RATE_LIMIT_WINDOW_MS = 60_000;

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHAT_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        }
      } catch {}
      setHistoryLoaded(true);
    };
    loadHistory();
  }, []);

  // Save history whenever messages change (after initial load)
  useEffect(() => {
    if (!historyLoaded) return;
    AsyncStorage.setItem(CHAT_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages, historyLoaded]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      // Rate limit check
      const now = Date.now();
      sentTimestamps.current = sentTimestamps.current.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
      );
      if (sentTimestamps.current.length >= RATE_LIMIT_COUNT) {
        const waitSecs = Math.ceil(
          (RATE_LIMIT_WINDOW_MS - (now - sentTimestamps.current[0])) / 1000
        );
        const rateLimitMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `You're sending messages too quickly. Please wait ${waitSecs} second${waitSecs !== 1 ? "s" : ""} before sending another message.`,
        };
        setMessages((prev) => [...prev, rateLimitMsg]);
        scrollToBottom();
        return;
      }
      sentTimestamps.current.push(now);

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);
      scrollToBottom();

      // Build history array for API (exclude the new user message — it's sent as `message`)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Elemetric-Key":
              process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
          },
          body: JSON.stringify({ message: trimmed, history }),
        });

        const json = await res.json();

        const replyContent: string =
          json.reply ??
          json.error ??
          "Sorry, I couldn't reach the server. Please try again.";

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: replyContent,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Sorry, I couldn't reach the server. Please try again.",
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [messages, loading, scrollToBottom]
  );

  const clearHistory = () => {
    Alert.alert(
      "Clear Chat",
      "This will permanently delete your chat history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setMessages([]);
            await AsyncStorage.removeItem(CHAT_KEY);
          },
        },
      ]
    );
  };

  const showSuggestions = historyLoaded && messages.length === 0 && !loading;

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === "user") {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.aiRow}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
        <View style={styles.aiBubble}>
          <Text style={styles.aiText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brand}>ELEMETRIC</Text>
          <Text style={styles.headerTitle}>Compliance Assistant</Text>
        </View>
        <Pressable onPress={clearHistory} hitSlop={10} style={styles.clearBtn}>
          <Text style={styles.clearIcon}>❌</Text>
        </Pressable>
      </View>

      {/* BPC regulatory banner */}
      <View style={styles.bpcBanner}>
        <Text style={styles.bpcBannerText}>
          BPC Victoria — AS/NZS 3500 series · Plumbing Regulations 2018 (Vic)
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            historyLoaded ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>Ask me anything</Text>
                <Text style={styles.emptySub}>
                  I can help with compliance questions, licence requirements, and job documentation.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={loading ? <TypingDots /> : null}
        />

        {/* Suggested question chips */}
        {showSuggestions && (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipsLabel}>SUGGESTED QUESTIONS</Text>
            <View style={styles.chips}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <Pressable
                  key={q}
                  style={styles.chip}
                  onPress={() => sendMessage(q)}
                >
                  <Text style={styles.chipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask a compliance question..."
              placeholderTextColor="rgba(255,255,255,0.30)"
              multiline
              maxLength={1000}
              onSubmitEditing={() => sendMessage(input)}
              blurOnSubmit={false}
            />
            {input.length > 800 && (
              <Text style={styles.charCount}>{input.length}/1000</Text>
            )}
          </View>
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#07152b" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#07152b" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#07152b",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  backBtn: {
    width: 40,
    alignItems: "flex-start",
  },
  backIcon: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 22,
    fontWeight: "700",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  brand: {
    color: "#f97316",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },
  headerTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  clearBtn: {
    width: 40,
    alignItems: "flex-end",
  },
  clearIcon: {
    fontSize: 18,
  },

  bpcBanner: {
    backgroundColor: "rgba(249,115,22,0.10)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(249,115,22,0.20)",
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  bpcBannerText: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  listContent: {
    padding: 16,
    paddingBottom: 8,
    gap: 12,
    flexGrow: 1,
  },

  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: "#f97316",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: "78%",
  },
  userText: {
    color: "#07152b",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },

  aiRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  aiBadge: {
    backgroundColor: "#f97316",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
    flexShrink: 0,
  },
  aiBadgeText: {
    color: "#07152b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  aiBubble: {
    backgroundColor: "#0f2035",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: "78%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  aiText: {
    color: "white",
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  typingText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    fontStyle: "italic",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  chipsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  chipsLabel: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#0f2035",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: {
    color: "#f97316",
    fontSize: 13,
    fontWeight: "600",
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    backgroundColor: "#0b1a2e",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    gap: 10,
  },
  inputWrap: { flex: 1, position: "relative" },
  charCount: {
    position: "absolute",
    bottom: 6,
    right: 12,
    color: "rgba(249,115,22,0.7)",
    fontSize: 10,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    backgroundColor: "#0f2035",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(249,115,22,0.35)",
  },
  sendIcon: {
    color: "#07152b",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
});
