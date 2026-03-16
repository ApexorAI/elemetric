import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Alert,
  TextInput,
  Dimensions,
  Modal,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FLOOR_PLAN_PINS_KEY = "elemetric_floor_plan_pins";
const { width: SCREEN_W } = Dimensions.get("window");
const IMG_W = SCREEN_W - 36;

type Pin = {
  id: string;
  itemId: string;
  label: string;
  x: number; // 0-1 fraction of image width
  y: number; // 0-1 fraction of image height
};

export default function FloorPlanPin() {
  const router = useRouter();
  const { itemId, itemLabel } = useLocalSearchParams<{ itemId: string; itemLabel: string }>();

  const [floorPlanUri, setFloorPlanUri] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [imgH, setImgH] = useState(280);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinLabel, setPinLabel] = useState(itemLabel ?? "");
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ripplePin, setRipplePin] = useState<string | null>(null);
  const rippleAnim = useRef(new Animated.Value(1)).current;
  const [tooltipPin, setTooltipPin] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const rawJob = await AsyncStorage.getItem("elemetric_current_job");
        if (rawJob && active) {
          const job = JSON.parse(rawJob);
          if (job.floorPlanUri) {
            setFloorPlanUri(job.floorPlanUri);
            Image.getSize(
              job.floorPlanUri,
              (w, h) => {
                if (active) setImgH(Math.round((h / w) * IMG_W));
              },
              () => {}
            );
          }
        }
        const rawPins = await AsyncStorage.getItem(FLOOR_PLAN_PINS_KEY);
        if (rawPins && active) {
          setPins(JSON.parse(rawPins));
        }
      })();
      return () => { active = false; };
    }, [])
  );

  const triggerRipple = (pinId: string) => {
    setRipplePin(pinId);
    rippleAnim.setValue(1);
    Animated.sequence([
      Animated.timing(rippleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(rippleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start(() => setRipplePin(null));
  };

  const handleImageTap = (evt: any) => {
    const { locationX, locationY } = evt.nativeEvent;
    const x = Math.max(0, Math.min(1, locationX / IMG_W));
    const y = Math.max(0, Math.min(1, locationY / imgH));
    setPendingPin({ x, y });
    setPinLabel(itemLabel ?? "");
    setShowLabelModal(true);
  };

  const confirmPin = async () => {
    if (!pendingPin) return;
    setSaving(true);
    try {
      const newPin: Pin = {
        id: Date.now().toString(),
        itemId: itemId ?? "general",
        label: pinLabel.trim() || (itemLabel ?? "Item"),
        x: pendingPin.x,
        y: pendingPin.y,
      };
      const next = [...pins, newPin];
      setPins(next);
      await AsyncStorage.setItem(FLOOR_PLAN_PINS_KEY, JSON.stringify(next));
      setPendingPin(null);
      setShowLabelModal(false);
      // Ripple animation on new pin
      triggerRipple(newPin.id);
    } finally {
      setSaving(false);
    }
  };

  const removePin = async (id: string) => {
    const next = pins.filter((p) => p.id !== id);
    setPins(next);
    await AsyncStorage.setItem(FLOOR_PLAN_PINS_KEY, JSON.stringify(next));
    setTooltipPin(null);
  };

  const handlePinTap = (pin: Pin) => {
    // Show tooltip with pin label
    setTooltipPin(tooltipPin === pin.id ? null : pin.id);
  };

  const handlePinLongPress = (pin: Pin) => {
    setTooltipPin(null);
    Alert.alert(
      `Remove pin: ${pin.label}`,
      "Are you sure you want to remove this pin?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removePin(pin.id) },
      ]
    );
  };

  const itemPins = pins.filter((p) => p.itemId === itemId);
  const otherPins = pins.filter((p) => p.itemId !== itemId);

  if (!floorPlanUri) {
    return (
      <View style={styles.screen}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Floor Plan</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>No Floor Plan</Text>
          <Text style={styles.emptyBody}>Upload a floor plan when starting a new job to enable pin mapping.</Text>
        </View>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Label input modal */}
      <Modal visible={showLabelModal} transparent animationType="fade" onRequestClose={() => setShowLabelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.labelCard}>
            <Text style={styles.labelCardTitle}>Name this pin</Text>
            <Text style={styles.labelCardSub}>What is located at this point on the floor plan?</Text>
            <TextInput
              style={styles.labelInput}
              value={pinLabel}
              onChangeText={setPinLabel}
              placeholder={itemLabel ?? "e.g. PTR Valve"}
              placeholderTextColor="rgba(255,255,255,0.30)"
              autoFocus
            />
            <View style={styles.labelBtnRow}>
              <Pressable style={styles.labelCancelBtn} onPress={() => { setShowLabelModal(false); setPendingPin(null); }}>
                <Text style={styles.labelCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.labelConfirmBtn, saving && { opacity: 0.6 }]} onPress={confirmPin} disabled={saving}>
                {saving ? <ActivityIndicator color="#0b1220" size="small" /> : <Text style={styles.labelConfirmText}>Place Pin</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Floor Plan</Text>
        <Text style={styles.subtitle}>
          Tap to pin · Long-press to remove{"\n"}Marking: {itemLabel ?? "this item"}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* Floor plan with pins */}
        <View style={[styles.planWrap, { height: imgH }]}>
          <Pressable onPress={handleImageTap} style={StyleSheet.absoluteFill}>
            <Image
              source={{ uri: floorPlanUri }}
              style={{ width: IMG_W, height: imgH, borderRadius: 12 }}
              resizeMode="contain"
            />
          </Pressable>

          {/* Render item pins (orange) */}
          {itemPins.map((pin) => (
            <Pressable
              key={pin.id}
              style={[
                styles.pinTouchArea,
                {
                  left: pin.x * IMG_W - 25,
                  top: pin.y * imgH - 25,
                },
              ]}
              onPress={() => handlePinTap(pin)}
              onLongPress={() => handlePinLongPress(pin)}
              delayLongPress={500}
              accessibilityRole="button"
              accessibilityLabel={`Pin: ${pin.label}. Long press to remove.`}
            >
              <Animated.View
                style={[
                  styles.pinDot,
                  styles.pinDotItem,
                  ripplePin === pin.id && { transform: [{ scale: rippleAnim }] },
                ]}
              >
                <View style={styles.pinCenter} />
              </Animated.View>
              {tooltipPin === pin.id && (
                <View style={styles.pinTooltip}>
                  <Text style={styles.pinTooltipText}>{pin.label}</Text>
                </View>
              )}
            </Pressable>
          ))}

          {/* Render other item pins (blue) */}
          {otherPins.map((pin) => (
            <View
              key={pin.id}
              style={[
                styles.pinDot,
                styles.pinDotOther,
                { left: pin.x * IMG_W - 10, top: pin.y * imgH - 10 },
              ]}
            >
              <View style={styles.pinCenter} />
            </View>
          ))}

          {/* Pin labels */}
          {pins.map((pin) => (
            <View
              key={`lbl-${pin.id}`}
              style={[styles.pinLabel, { left: pin.x * IMG_W - 30, top: pin.y * imgH + 14 }]}
              pointerEvents="none"
            >
              <Text style={styles.pinLabelText}>{pin.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>Tap to place · Long-press a pin to remove</Text>

        {/* Pin count */}
        {itemPins.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PINS FOR THIS ITEM ({itemPins.length})</Text>
            <View style={styles.pinList}>
              {itemPins.map((pin, i) => (
                <React.Fragment key={pin.id}>
                  {i > 0 && <View style={styles.pinDivider} />}
                  <View style={styles.pinRow}>
                    <View style={styles.pinRowDot} />
                    <Text style={styles.pinRowLabel}>{pin.label}</Text>
                    <Text style={styles.pinRowCoords}>
                      ({Math.round(pin.x * 100)}%, {Math.round(pin.y * 100)}%)
                    </Text>
                    <Pressable
                      onLongPress={() => handlePinLongPress(pin)}
                      style={styles.pinRowRemoveBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove pin ${pin.label}`}
                    >
                      <Text style={styles.pinRowRemove}>✕</Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        <Pressable style={styles.doneBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Done — Save Pins">
          <Text style={styles.doneBtnText}>Done — Save Pins</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 10 },
  backBtn: { marginBottom: 10 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 26, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 18 },
  body: { paddingHorizontal: 18, paddingBottom: 60, gap: 14 },
  planWrap: {
    width: IMG_W,
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  hint: { color: "rgba(255,255,255,0.30)", fontSize: 11, textAlign: "center" },
  // Larger 50x50 touch target around 20x20 visual dot
  pinTouchArea: {
    position: "absolute",
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  pinDotItem: { backgroundColor: "#f97316" },
  pinDotOther: {
    position: "absolute",
    backgroundColor: "#60a5fa",
  },
  pinCenter: { width: 6, height: 6, borderRadius: 3, backgroundColor: "white" },
  pinTooltip: {
    position: "absolute",
    top: -28,
    backgroundColor: "rgba(7,21,43,0.95)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    minWidth: 60,
    alignItems: "center",
  },
  pinTooltipText: { color: "white", fontSize: 11, fontWeight: "700" },
  pinLabel: {
    position: "absolute",
    backgroundColor: "rgba(7,21,43,0.85)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 80,
  },
  pinLabelText: { color: "white", fontSize: 9, fontWeight: "700" },
  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pinList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0f2035",
    overflow: "hidden",
  },
  pinDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 14 },
  pinRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  pinRowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#f97316" },
  pinRowLabel: { flex: 1, color: "white", fontWeight: "700", fontSize: 14 },
  pinRowCoords: { color: "rgba(255,255,255,0.35)", fontSize: 11 },
  pinRowRemoveBtn: { padding: 8 },
  pinRowRemove: { color: "rgba(255,255,255,0.30)", fontSize: 18, fontWeight: "300" },
  doneBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },
  back: { alignItems: "center", paddingVertical: 8 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: "white", fontWeight: "900", fontSize: 22 },
  emptyBody: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center", lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.80)", alignItems: "center", justifyContent: "center", padding: 28 },
  labelCard: {
    backgroundColor: "#0d1f3d",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    padding: 24,
    gap: 14,
    width: "100%",
  },
  labelCardTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  labelCardSub: { color: "rgba(255,255,255,0.50)", fontSize: 13 },
  labelInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  labelBtnRow: { flexDirection: "row", gap: 10 },
  labelCancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  labelCancelText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
  labelConfirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#f97316" },
  labelConfirmText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },
});
