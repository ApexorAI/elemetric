import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

const version = Constants.expoConfig?.version ?? "1.0.0";
const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? "1";

const openLink = async (url: string) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    Alert.alert("Cannot open link", url);
  }
};

export default function About() {
  const router = useRouter();

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.brand}>ELEMETRIC</Text>
        <Text style={s.title}>About</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Logo block */}
        <View style={s.logoCard}>
          <Text style={s.logoWordmark}>ELEMETRIC</Text>
          <View style={s.logoDivider} />
          <Text style={s.logoTagline}>AI Compliance Documentation for Trades</Text>
        </View>

        {/* Version info */}
        <View style={s.group}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowValue}>{version}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Build</Text>
            <Text style={s.rowValue}>{buildNumber}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Platform</Text>
            <Text style={s.rowValue}>iOS / Android</Text>
          </View>
        </View>

        {/* Legal */}
        <Text style={s.sectionLabel}>LEGAL</Text>
        <View style={s.group}>
          <Pressable style={s.row} onPress={() => openLink("https://elemetric.com.au/privacy")} accessibilityRole="link" accessibilityLabel="Privacy Policy">
            <Text style={s.rowAction}>Privacy Policy</Text>
            <Text style={s.rowChevron}>›</Text>
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.row} onPress={() => openLink("https://elemetric.com.au/terms")} accessibilityRole="link" accessibilityLabel="Terms and Conditions">
            <Text style={s.rowAction}>Terms & Conditions</Text>
            <Text style={s.rowChevron}>›</Text>
          </Pressable>
        </View>

        {/* Credits */}
        <Text style={s.sectionLabel}>CREDITS</Text>
        <View style={s.group}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Made with</Text>
            <Text style={s.rowValue}>❤️ in Ballarat, VIC</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Built for</Text>
            <Text style={s.rowValue}>Australian Tradespeople</Text>
          </View>
        </View>

        {/* Copyright */}
        <View style={s.copyrightBlock}>
          <Text style={s.copyright}>© 2026 Elemetric</Text>
          <Text style={s.copyrightSub}>
            All compliance documentation is a tool to assist licensed tradespeople.
            Final compliance responsibility remains with the licence holder.
          </Text>
        </View>

        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 12 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },

  body: { paddingHorizontal: 18, paddingBottom: 60, gap: 0 },

  logoCard: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: "#0d1f3c",
    borderWidth: 1,
    borderColor: "#1e3a5f",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  logoWordmark: {
    color: "#f97316",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 5,
  },
  logoDivider: {
    height: 1,
    width: 48,
    backgroundColor: "rgba(249,115,22,0.35)",
  },
  logoTagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },

  sectionLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 4,
  },

  group: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
  },
  rowValue: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  rowAction: {
    flex: 1,
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  rowChevron: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 22,
    fontWeight: "300",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 16,
  },

  copyrightBlock: {
    marginTop: 32,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  copyright: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    fontWeight: "800",
  },
  copyrightSub: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  back: { marginTop: 28, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
