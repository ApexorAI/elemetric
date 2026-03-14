import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  ActivityIndicator,
} from "react-native";

type Props = {
  visible: boolean;
  jobName: string;
  onShare: () => void;
  onDone: () => void;
  sharing?: boolean;
};

export default function PDFSuccessModal({ visible, jobName, onShare, onDone, sharing = false }: Props) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tick    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.6);
      opacity.setValue(0);
      tick.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(tick, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
      });
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { opacity, transform: [{ scale }] }]}>
          {/* Green tick */}
          <Animated.View style={[s.tickWrap, { transform: [{ scale: tick }] }]}>
            <Text style={s.tickIcon}>✓</Text>
          </Animated.View>

          <Text style={s.heading}>Report Generated</Text>
          <Text style={s.jobName} numberOfLines={2}>{jobName}</Text>
          <Text style={s.subtext}>
            Your compliance report is ready. Share it with your client or save it for your records.
          </Text>

          <View style={s.actions}>
            <Pressable
              style={[s.shareBtn, sharing && { opacity: 0.6 }]}
              onPress={onShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator color="#0b1220" />
              ) : (
                <Text style={s.shareBtnText}>Share PDF →</Text>
              )}
            </Pressable>

            <Pressable style={s.doneBtn} onPress={onDone}>
              <Text style={s.doneBtnText}>Done</Text>
            </Pressable>
          </View>

          <View style={s.trustRow}>
            <Text style={s.trustItem}>🔒 SHA-256 verified</Text>
            <Text style={s.trustItem}>📋 AS/NZS compliant</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0d1f3c",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1e3a5f",
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  tickWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tickIcon: {
    color: "#22c55e",
    fontSize: 34,
    fontWeight: "900",
  },
  heading: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  jobName: {
    color: "#f97316",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  subtext: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
  },
  actions: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  shareBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  shareBtnText: {
    color: "#0b1220",
    fontWeight: "900",
    fontSize: 16,
  },
  doneBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  doneBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "800",
    fontSize: 15,
  },
  trustRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 6,
  },
  trustItem: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "700",
  },
});
