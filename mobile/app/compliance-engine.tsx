import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  runComplianceEngine,
  COMPLIANCE_ENGINE_KEY,
  type ComplianceInput,
  type ComplianceReport,
  type RuleResult,
} from "@/lib/compliance-rules";

// ── Options ────────────────────────────────────────────────────────────────────

const LOCATION_TYPES = [
  { key: "public", label: "Public Area (road, footpath)" },
  { key: "private_traffic", label: "Private — Traffic Area" },
  { key: "private_no_traffic", label: "Private — No Traffic" },
  { key: "under_slab", label: "Under Slab / Concrete" },
] as const;

const PIPE_MATERIALS = [
  "Copper",
  "HDPE",
  "PVC-U",
  "Stainless Steel",
  "Galvanised Steel",
  "CPVC",
  "Other",
];

const PIPE_SIZES = [15, 20, 25, 32, 40, 50, 65, 80, 100];

const JOINT_TYPES = [
  "Compression",
  "Soldered / Brazed",
  "Push-fit",
  "Welded",
  "Threaded",
  "Flanged",
];

const PROTECTION_METHODS = [
  "None",
  "Sealed conduit / sleeve",
  "Protective coating / wrapping",
  "Insulation / lagging",
  "600 mm separation from contamination",
  "Combined (conduit + insulation)",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === "PASS") return "#22c55e";
  if (status === "FAIL") return "#ef4444";
  return "rgba(255,255,255,0.35)";
}

function statusBg(status: string): string {
  if (status === "PASS") return "rgba(34,197,94,0.10)";
  if (status === "FAIL") return "rgba(239,68,68,0.10)";
  return "rgba(255,255,255,0.04)";
}

function statusBorder(status: string): string {
  if (status === "PASS") return "rgba(34,197,94,0.30)";
  if (status === "FAIL") return "rgba(239,68,68,0.30)";
  return "rgba(255,255,255,0.08)";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.optionRow, selected && styles.optionRowActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={[styles.optionDot, selected && styles.optionDotActive]} />
      <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Toggle({
  label,
  value,
  onToggle,
  accessibilityLabel,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={styles.toggleRow}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

function MeasurementInput({
  label,
  hint,
  value,
  onChange,
  accessibilityLabel,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.measureRow}>
      <View style={styles.measureInfo}>
        <Text style={styles.measureLabel}>{label}</Text>
        <Text style={styles.measureHint}>{hint}</Text>
      </View>
      <TextInput
        style={styles.measureInput}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor="rgba(255,255,255,0.25)"
        maxLength={6}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={hint}
      />
      <Text style={styles.measureUnit}>mm</Text>
    </View>
  );
}

function ResultCard({ result }: { result: RuleResult }) {
  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: statusBg(result.status),
          borderColor: statusBorder(result.status),
          borderLeftColor: statusColor(result.status),
        },
      ]}
      accessibilityLabel={`${result.name}: ${result.status}`}
    >
      <View style={styles.resultTop}>
        <View style={styles.resultTitleWrap}>
          <Text style={styles.resultName}>{result.name}</Text>
          <Text style={styles.resultClause}>
            {result.standard} Cl. {result.clause}
          </Text>
        </View>
        <View
          style={[
            styles.resultBadge,
            { borderColor: statusColor(result.status) + "55", backgroundColor: statusColor(result.status) + "18" },
          ]}
        >
          <Text style={[styles.resultBadgeText, { color: statusColor(result.status) }]}>
            {result.status === "NOT_APPLICABLE" ? "N/A" : result.status}
          </Text>
        </View>
      </View>
      {result.value ? (
        <Text style={styles.resultValue}>{result.value}</Text>
      ) : null}
      {result.requiredFix && result.status === "FAIL" ? (
        <View style={styles.fixBox}>
          <Text style={styles.fixLabel}>REQUIRED FIX</Text>
          <Text style={styles.fixText}>{result.requiredFix}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ComplianceEngine() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobType?: string; nextRoute?: string }>();
  const nextRoute = (params.nextRoute as string) ?? "/plumbing/checklist";

  // Form state
  const [locationType, setLocationType] =
    useState<ComplianceInput["locationType"]>("private_no_traffic");
  const [pipeMaterial, setPipeMaterial] = useState(PIPE_MATERIALS[0]);
  const [pipeSizeDN, setPipeSizeDN] = useState(20);
  const [depthOfCover, setDepthOfCover] = useState("");
  const [beddingThickness, setBeddingThickness] = useState("");
  const [distanceFromWalls, setDistanceFromWalls] = useState("");
  const [trenchWidth, setTrenchWidth] = useState("");
  const [contaminatedArea, setContaminatedArea] = useState(false);
  const [corrosiveArea, setCorrosiveArea] = useState(false);
  const [freezingConditions, setFreezingConditions] = useState(false);
  const [roofSpace, setRoofSpace] = useState(false);
  const [externalWall, setExternalWall] = useState(false);
  const [jointType, setJointType] = useState(JOINT_TYPES[0]);
  const [protectionMethod, setProtectionMethod] = useState(PROTECTION_METHODS[0]);

  // Results state
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [showResults, setShowResults] = useState(false);

  const buildInput = (): ComplianceInput => ({
    locationType,
    pipeMaterial,
    pipeSizeDN,
    depthOfCoverMm: depthOfCover ? parseInt(depthOfCover, 10) : null,
    beddingThicknessMm: beddingThickness ? parseInt(beddingThickness, 10) : null,
    distanceFromWallsMm: distanceFromWalls ? parseInt(distanceFromWalls, 10) : null,
    trenchWidthMm: trenchWidth ? parseInt(trenchWidth, 10) : null,
    contaminatedArea,
    corrosiveArea,
    freezingConditions,
    roofSpace,
    externalWall,
    jointType,
    protectionMethod,
  });

  const handleAssess = async () => {
    const input = buildInput();
    const result = runComplianceEngine(input);
    setReport(result);
    setShowResults(true);
    // Persist for PDF inclusion
    try {
      await AsyncStorage.setItem(
        COMPLIANCE_ENGINE_KEY,
        JSON.stringify({ input, report: result, assessedAt: new Date().toISOString() })
      );
    } catch {}
  };

  const handleProceed = () => {
    router.push(nextRoute as never);
  };

  const handleReset = () => {
    setShowResults(false);
    setReport(null);
  };

  if (showResults && report) {
    // ── Results view ────────────────────────────────────────────────────────────
    const overallColor =
      report.overallStatus === "COMPLIANT"
        ? "#22c55e"
        : report.overallStatus === "NON_COMPLIANT"
        ? "#ef4444"
        : "#f97316";

    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={handleReset}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to form"
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.brand}>ELEMETRIC</Text>
          <Text style={styles.title}>Compliance Assessment</Text>
          <Text style={styles.subtitle}>AS/NZS 3500.4:2025 — BPC Enforced</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Overall status */}
          <View
            style={[
              styles.overallCard,
              {
                borderColor: overallColor + "55",
                backgroundColor: overallColor + "10",
              },
            ]}
            accessibilityLabel={`Overall status: ${report.overallStatus}`}
          >
            <Text style={styles.overallLabel}>STRUCTURED COMPLIANCE ASSESSMENT</Text>
            <Text style={[styles.overallStatus, { color: overallColor }]}>
              {report.overallStatus === "COMPLIANT"
                ? "✓ COMPLIANT"
                : report.overallStatus === "NON_COMPLIANT"
                ? "✗ NON-COMPLIANT"
                : "— NOT ASSESSED"}
            </Text>
            <View style={styles.overallStats}>
              <View style={styles.overallStat}>
                <Text style={[styles.overallStatNum, { color: "#22c55e" }]}>
                  {report.passCount}
                </Text>
                <Text style={styles.overallStatLabel}>PASS</Text>
              </View>
              <View style={styles.overallStat}>
                <Text style={[styles.overallStatNum, { color: "#ef4444" }]}>
                  {report.failCount}
                </Text>
                <Text style={styles.overallStatLabel}>FAIL</Text>
              </View>
              <View style={styles.overallStat}>
                <Text style={[styles.overallStatNum, { color: "rgba(255,255,255,0.45)" }]}>
                  {report.naCount}
                </Text>
                <Text style={styles.overallStatLabel}>N/A</Text>
              </View>
            </View>
            {report.failCount > 0 && (
              <Text style={styles.overallWarning}>
                {report.failCount} item{report.failCount > 1 ? "s" : ""} require remediation before proceeding.
              </Text>
            )}
          </View>

          {/* Individual rule results */}
          <SectionLabel label="RULE-BY-RULE BREAKDOWN" />
          {report.results.map((r) => (
            <ResultCard key={r.id} result={r} />
          ))}

          {/* Actions */}
          <Pressable
            style={[
              styles.proceedBtn,
              report.overallStatus === "NON_COMPLIANT" && styles.proceedBtnWarn,
            ]}
            onPress={handleProceed}
            accessibilityRole="button"
            accessibilityLabel={
              report.overallStatus === "NON_COMPLIANT"
                ? "Proceed to photos despite failures"
                : "Proceed to photo checklist"
            }
          >
            <Text style={styles.proceedBtnText}>
              {report.overallStatus === "NON_COMPLIANT"
                ? "Proceed to Photos (with failures noted) →"
                : "Proceed to Photo Checklist →"}
            </Text>
          </Pressable>

          {report.overallStatus === "NON_COMPLIANT" && (
            <Text style={styles.warnNote}>
              Non-compliant results will be included in the final PDF report and flagged for the BPC.
            </Text>
          )}

          <Pressable
            style={styles.reassessBtn}
            onPress={handleReset}
            accessibilityRole="button"
            accessibilityLabel="Re-assess with different values"
          >
            <Text style={styles.reassessBtnText}>↺ Re-assess with Different Values</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Form view ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Compliance Engine</Text>
        <Text style={styles.subtitle}>AS/NZS 3500.4:2025 — Pre-Installation Check</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Enter installation details below. The rule engine will instantly check each field against BPC-enforced AS/NZS 3500.4:2025 requirements and flag any non-compliance before you take photos.
          </Text>
        </View>

        {/* Location type */}
        <SectionLabel label="LOCATION TYPE" />
        <View style={styles.optionCard}>
          {LOCATION_TYPES.map((lt) => (
            <OptionRow
              key={lt.key}
              label={lt.label}
              selected={locationType === lt.key}
              onPress={() => setLocationType(lt.key)}
            />
          ))}
        </View>

        {/* Pipe material */}
        <SectionLabel label="PIPE MATERIAL" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {PIPE_MATERIALS.map((m) => (
            <Pressable
              key={m}
              style={[styles.chip, pipeMaterial === m && styles.chipActive]}
              onPress={() => setPipeMaterial(m)}
              accessibilityRole="radio"
              accessibilityState={{ selected: pipeMaterial === m }}
              accessibilityLabel={m}
            >
              <Text style={[styles.chipText, pipeMaterial === m && styles.chipTextActive]}>
                {m}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Pipe size */}
        <SectionLabel label="PIPE SIZE (DN)" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {PIPE_SIZES.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, pipeSizeDN === s && styles.chipActive]}
              onPress={() => setPipeSizeDN(s)}
              accessibilityRole="radio"
              accessibilityState={{ selected: pipeSizeDN === s }}
              accessibilityLabel={`DN ${s}`}
            >
              <Text style={[styles.chipText, pipeSizeDN === s && styles.chipTextActive]}>
                DN{s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Measurements */}
        <SectionLabel label="MEASUREMENTS" />
        <View style={styles.measureCard}>
          <MeasurementInput
            label="Depth of Cover"
            hint="From pipe top to finished surface"
            value={depthOfCover}
            onChange={setDepthOfCover}
            accessibilityLabel="Depth of cover in millimetres"
          />
          <View style={styles.divider} />
          <MeasurementInput
            label="Bedding Thickness"
            hint="Compacted sand below pipe"
            value={beddingThickness}
            onChange={setBeddingThickness}
            accessibilityLabel="Bedding thickness in millimetres"
          />
          <View style={styles.divider} />
          <MeasurementInput
            label="Trench Width"
            hint="Clear width of trench"
            value={trenchWidth}
            onChange={setTrenchWidth}
            accessibilityLabel="Trench width in millimetres"
          />
          <View style={styles.divider} />
          <MeasurementInput
            label="Distance from Walls"
            hint="Clearance from adjacent surfaces"
            value={distanceFromWalls}
            onChange={setDistanceFromWalls}
            accessibilityLabel="Distance from walls in millimetres"
          />
        </View>

        {/* Installation conditions */}
        <SectionLabel label="INSTALLATION CONDITIONS" />
        <View style={styles.toggleCard}>
          <Toggle
            label="Contaminated Area"
            value={contaminatedArea}
            onToggle={() => setContaminatedArea((v) => !v)}
            accessibilityLabel="Toggle: Contaminated area"
          />
          <View style={styles.divider} />
          <Toggle
            label="Corrosive Area"
            value={corrosiveArea}
            onToggle={() => setCorrosiveArea((v) => !v)}
            accessibilityLabel="Toggle: Corrosive area"
          />
          <View style={styles.divider} />
          <Toggle
            label="Freezing Conditions"
            value={freezingConditions}
            onToggle={() => setFreezingConditions((v) => !v)}
            accessibilityLabel="Toggle: Freezing conditions"
          />
          <View style={styles.divider} />
          <Toggle
            label="Roof Space Installation"
            value={roofSpace}
            onToggle={() => setRoofSpace((v) => !v)}
            accessibilityLabel="Toggle: Roof space installation"
          />
          <View style={styles.divider} />
          <Toggle
            label="External Wall Adjacent"
            value={externalWall}
            onToggle={() => setExternalWall((v) => !v)}
            accessibilityLabel="Toggle: External wall adjacent"
          />
        </View>

        {/* Joint type */}
        <SectionLabel label="JOINT TYPE" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {JOINT_TYPES.map((j) => (
            <Pressable
              key={j}
              style={[styles.chip, jointType === j && styles.chipActive]}
              onPress={() => setJointType(j)}
              accessibilityRole="radio"
              accessibilityState={{ selected: jointType === j }}
              accessibilityLabel={j}
            >
              <Text style={[styles.chipText, jointType === j && styles.chipTextActive]}>
                {j}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Protection method */}
        <SectionLabel label="PROTECTION METHOD" />
        <View style={styles.optionCard}>
          {PROTECTION_METHODS.map((p) => (
            <OptionRow
              key={p}
              label={p}
              selected={protectionMethod === p}
              onPress={() => setProtectionMethod(p)}
            />
          ))}
        </View>

        {/* Submit */}
        <Pressable
          style={styles.assessBtn}
          onPress={handleAssess}
          accessibilityRole="button"
          accessibilityLabel="Run compliance assessment"
          accessibilityHint="Evaluates all inputs against AS/NZS 3500.4:2025 rules"
        >
          <Text style={styles.assessBtnText}>Run Compliance Assessment →</Text>
        </Pressable>

        <Text style={styles.standardNote}>
          Rules encoded from AS/NZS 3500.4:2025 as enforced by the Building and Plumbing Commission of Victoria under the Plumbing Regulations 2018 (Vic).
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 10 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
  body: { padding: 20, gap: 12, paddingBottom: 60 },

  sectionLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginLeft: 2,
  },

  infoBanner: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    padding: 14,
  },
  infoBannerText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 20,
  },

  optionCard: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  optionRowActive: { backgroundColor: "rgba(249,115,22,0.08)" },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  optionDotActive: {
    borderColor: "#f97316",
    backgroundColor: "#f97316",
  },
  optionLabel: { color: "rgba(255,255,255,0.70)", fontSize: 14, fontWeight: "600" },
  optionLabelActive: { color: "white", fontWeight: "700" },

  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0f2035",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  chipText: { color: "rgba(255,255,255,0.60)", fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#f97316" },

  measureCard: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  measureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  measureInfo: { flex: 1, gap: 2 },
  measureLabel: { color: "white", fontWeight: "700", fontSize: 14 },
  measureHint: { color: "rgba(255,255,255,0.40)", fontSize: 11 },
  measureInput: {
    width: 72,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
  },
  measureUnit: { color: "rgba(255,255,255,0.40)", fontSize: 13, width: 24 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },

  toggleCard: {
    backgroundColor: "#0f2035",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLabel: { color: "white", fontWeight: "700", fontSize: 14, flex: 1 },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleTrackOn: { backgroundColor: "#f97316" },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "white",
    alignSelf: "flex-start",
  },
  toggleThumbOn: { alignSelf: "flex-end" },

  assessBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  assessBtnText: { color: "#07152b", fontWeight: "900", fontSize: 16 },

  standardNote: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },

  // ── Results ──
  overallCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    borderLeftWidth: 4,
  },
  overallLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  overallStatus: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  overallStats: { flexDirection: "row", gap: 24 },
  overallStat: { alignItems: "center", gap: 2 },
  overallStatNum: { fontSize: 28, fontWeight: "900" },
  overallStatLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  overallWarning: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    gap: 8,
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  resultTitleWrap: { flex: 1, gap: 3 },
  resultName: { color: "white", fontWeight: "700", fontSize: 14 },
  resultClause: { color: "rgba(255,255,255,0.40)", fontSize: 11, fontWeight: "600" },
  resultBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  resultBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  resultValue: { color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 17 },
  fixBox: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    padding: 10,
    gap: 4,
  },
  fixLabel: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  fixText: { color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 18 },

  proceedBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  proceedBtnWarn: { backgroundColor: "#f97316" },
  proceedBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },
  warnNote: {
    color: "rgba(239,68,68,0.70)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  reassessBtn: { alignItems: "center", paddingVertical: 10 },
  reassessBtnText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 13 },
});
