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
    title: "Stop worrying about\nthe 7-year liability",
    subtitle: "Elemetric documents every job with AI-powered compliance reports that protect your licence.",
    accent: "#f97316",
  },
  {
    emoji: "📸",
    title: "Photo. Analyse.\nSign. Done.",
    subtitle: "Complete a full compliance report in under 5 minutes on any job site — no paperwork.",
    accent: "#60a5fa",
  },
  {
    emoji: "🤖",
    title: "AI checks\nevery item",
    subtitle: "Our AI reviews your photos against AS/NZS standards and flags anything missing before you leave site.",
    accent: "#a78bfa",
  },
  {
    emoji: "📊",
    title: "Your full job\nhistory. Always.",
    subtitle: "Every report saved to the cloud. Pull up any job, any time — even years later.",
    accent: "#22c55e",
  },
  {
    emoji: "👷",
    title: "Built for\ntrade professionals",
    subtitle: "Used by plumbers, gas fitters, electricians, and HVAC technicians across Australia.",
    accent: "#f97316",
  },
  {
    emoji: "🚀",
    title: "Ready to protect\nyour licence?",
    subtitle: "Create your free account and run your first compliance report today.",
    accent: "#f97316",
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
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressBar: {
    height: 3,
    backgroundColor: "#f97316",
  },

  skipBtn: {
    position: "absolute",
    top: 18,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    paddingHorizontal: 36,
    paddingBottom: 200,
    paddingTop: 60,
    gap: 20,
  },

  illustrationWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    borderWidth: 1,
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
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 42,
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 16,
    lineHeight: 26,
  },
  stepLabel: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 20,
    backgroundColor: "#07152b",
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: "rgba(255,255,255,0.18)",
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
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  nextText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
  getStartedBtn: {
    flex: 1,
    backgroundColor: "#f97316",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  getStartedText: {
    color: "#07152b",
    fontSize: 16,
    fontWeight: "900",
  },
});
