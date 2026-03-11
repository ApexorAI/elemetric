import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function PlumbingHome() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Plumbing</Text>
        <Text style={styles.subtitle}>Start a new job and create compliance evidence</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New Plumbing Job</Text>
        <Text style={styles.cardSub}>Choose a job type, complete checklist, add photos, run AI overview.</Text>

        <Pressable style={styles.cta} onPress={() => router.push("/plumbing/job-types")}>
          <Text style={styles.ctaText}>Choose Job Type →</Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondary} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b1220", padding: 18, paddingTop: 60 },
  header: { marginBottom: 18 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 26, fontWeight: "900" },
  subtitle: { marginTop: 8, color: "rgba(255,255,255,0.75)" },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.70)", lineHeight: 18 },

  cta: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f97316",
  },
  ctaText: { color: "#0b1220", fontWeight: "900", fontSize: 16 },

  secondary: { marginTop: 16, alignItems: "center" },
  secondaryText: { color: "rgba(255,255,255,0.65)", fontWeight: "800" },
});