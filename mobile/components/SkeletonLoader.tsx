import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export const SkeletonJobCard = React.memo(function SkeletonJobCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <SkeletonBox width={40} height={40} borderRadius={12} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="70%" height={16} />
          <SkeletonBox width="50%" height={12} />
        </View>
        <SkeletonBox width={44} height={26} borderRadius={10} />
      </View>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
        <SkeletonBox width={80} height={12} />
        <SkeletonBox width={80} height={12} />
        <SkeletonBox width={60} height={20} borderRadius={8} />
      </View>
    </View>
  );
});

export const SkeletonProfileCard = React.memo(function SkeletonProfileCard() {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="50%" height={16} />
          <SkeletonBox width="80%" height={12} />
          <SkeletonBox width={80} height={24} borderRadius={10} />
        </View>
        <SkeletonBox width={90} height={90} borderRadius={45} />
      </View>
    </View>
  );
});

export const SkeletonHomeCard = React.memo(function SkeletonHomeCard() {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="65%" height={15} />
          <SkeletonBox width="45%" height={11} />
          <SkeletonBox width="35%" height={10} />
        </View>
        <SkeletonBox width={44} height={28} borderRadius={10} />
      </View>
    </View>
  );
});

export const SkeletonTimelineCard = React.memo(function SkeletonTimelineCard() {
  return (
    <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: "rgba(255,255,255,0.1)" }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="65%" height={16} />
          <SkeletonBox width="50%" height={12} />
        </View>
        <SkeletonBox width={80} height={28} borderRadius={20} />
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <SkeletonBox width={70} height={32} />
        <SkeletonBox width={70} height={32} />
        <SkeletonBox width={70} height={32} />
      </View>
      <SkeletonBox width="40%" height={15} style={{ marginTop: 8 }} />
    </View>
  );
});

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
