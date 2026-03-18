import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ONBOARDING_KEY = "elemetric_onboarding_seen";

const SLIDES = [
  {
    emoji: "🛡️",
    title: "Your licence is\nyour livelihood.",
    subtitle: "We protect it. Every job documented, every time.",
    accent: "#f97316",
  },
  {
    emoji: "📸",
    title: "Photo your job.",
    subtitle: "Takes under 60 seconds on site. No paperwork.",
    accent: "#60a5fa",
  },
  {
    emoji: "🤖",
    title: "AI checks\ncompliance.",
    subtitle: "Against real Australian Standards — AS/NZS 3000, 3500, 5601 and more.",
    accent: "#a78bfa",
  },
  {
    emoji: "✅",
    title: "You're protected.",
    subtitle: "Every job documented forever. Pull up any job, any time — even 7 years later.",
    accent: "#22c55e",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/login");
  };

  const goBack = () => {
    if (activeIndex > 0) goToSlide(activeIndex - 1);
  };

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === SLIDES.length - 1;
  const progress = (activeIndex + 1) / SLIDES.length;

  return (
    <View style={styles.screen}>
      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` as any }]} />
      </View>

      {/* Skip button */}
      {!isLast && (
        <Pressable style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        scrollEnabled
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={styles.slide}>
            {/* Illustration */}
            <View style={[styles.illustrationWrap, { borderColor: slide.accent + "33", backgroundColor: slide.accent + "12" }]}>
              <Text style={styles.illustrationEmoji}>{slide.emoji}</Text>
            </View>

            <Text style={styles.brand}>ELEMETRIC</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>

            {/* Step indicator text */}
            <Text style={styles.stepLabel}>{i + 1} of {SLIDES.length}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => goToSlide(i)}>
              <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        {/* Navigation buttons */}
        <View style={styles.navRow}>
          <Pressable
            style={[styles.backBtn, isFirst && { opacity: 0 }]}
            onPress={goBack}
            disabled={isFirst}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          {isLast ? (
            <Pressable style={styles.getStartedBtn} onPress={finish}>
              <Text style={styles.getStartedText}>Get Started →</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.nextBtn} onPress={() => goToSlide(activeIndex + 1)}>
              <Text style={styles.nextText}>Next →</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07152b",
  },

  progressWrap: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  progressBar: {
    height: 3,
    backgroundColor: "#f97316",
  },

  skipBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  skipText: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    fontSize: 13,
  },

  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 200,
    paddingTop: 60,
    gap: 20,
  },

  illustrationWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#0f2035",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  illustrationEmoji: {
    fontSize: 48,
  },

  brand: {
    color: "#f97316",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
  },
  title: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 40,
  },
  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    lineHeight: 24,
  },
  stepLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 20,
    backgroundColor: "#07152b",
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },

  dots: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotActive: {
    width: 24,
    backgroundColor: "#f97316",
    borderRadius: 4,
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  backBtnText: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    fontSize: 15,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  nextText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  getStartedBtn: {
    flex: 1,
    backgroundColor: "#f97316",
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  getStartedText: {
    color: "#07152b",
    fontSize: 15,
    fontWeight: "900",
  },
});
