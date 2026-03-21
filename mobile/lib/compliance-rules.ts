/**
 * Elemetric — Rule-based compliance engine
 * Encodes AS/NZS 3500.4:2025 (Plumbing and drainage — Heated water services)
 * Each rule returns PASS | FAIL | NOT_APPLICABLE, the clause, and a required fix.
 */

export type RuleStatus = "PASS" | "FAIL" | "NOT_APPLICABLE";

export type RuleResult = {
  id: string;
  name: string;
  status: RuleStatus;
  clause: string;
  standard: string;
  value?: string;
  requiredFix?: string;
};

export type ComplianceInput = {
  locationType: "public" | "private_traffic" | "private_no_traffic" | "under_slab";
  pipeMaterial: string;
  pipeSizeDN: number; // mm
  depthOfCoverMm: number | null;
  beddingThicknessMm: number | null;
  distanceFromWallsMm: number | null;
  trenchWidthMm: number | null;
  contaminatedArea: boolean;
  corrosiveArea: boolean;
  freezingConditions: boolean;
  roofSpace: boolean;
  externalWall: boolean;
  jointType: string;
  protectionMethod: string;
};

export type ComplianceReport = {
  results: RuleResult[];
  passCount: number;
  failCount: number;
  naCount: number;
  overallStatus: "COMPLIANT" | "NON_COMPLIANT" | "NOT_ASSESSED";
};

// ── Individual rule evaluators ─────────────────────────────────────────────────

function evalDepthOfCover(input: ComplianceInput): RuleResult {
  const { locationType, depthOfCoverMm } = input;
  if (depthOfCoverMm === null) {
    return {
      id: "depth_of_cover",
      name: "Depth of Cover",
      status: "NOT_APPLICABLE",
      clause: "4.10",
      standard: "AS/NZS 3500.4:2025",
      requiredFix: "Enter depth of cover measurement to assess.",
    };
  }

  let minDepth: number;
  let locationLabel: string;
  if (locationType === "under_slab") {
    minDepth = 75;
    locationLabel = "under slab";
  } else if (locationType === "public") {
    minDepth = 450;
    locationLabel = "public area";
  } else if (locationType === "private_traffic") {
    minDepth = 300;
    locationLabel = "private traffic area";
  } else {
    minDepth = 150;
    locationLabel = "private non-traffic area";
  }

  const pass = depthOfCoverMm >= minDepth;
  return {
    id: "depth_of_cover",
    name: "Depth of Cover",
    status: pass ? "PASS" : "FAIL",
    clause: "4.10",
    standard: "AS/NZS 3500.4:2025",
    value: `${depthOfCoverMm} mm (${locationLabel}, minimum ${minDepth} mm)`,
    requiredFix: pass
      ? undefined
      : `Increase depth of cover to at least ${minDepth} mm for ${locationLabel}. Current: ${depthOfCoverMm} mm.`,
  };
}

function evalBeddingThickness(input: ComplianceInput): RuleResult {
  const { beddingThicknessMm } = input;
  if (beddingThicknessMm === null) {
    return {
      id: "bedding_thickness",
      name: "Bedding Thickness",
      status: "NOT_APPLICABLE",
      clause: "4.7",
      standard: "AS/NZS 3500.4:2025",
      requiredFix: "Enter bedding thickness measurement to assess.",
    };
  }
  const pass = beddingThicknessMm >= 75;
  return {
    id: "bedding_thickness",
    name: "Bedding Thickness (Compacted Sand)",
    status: pass ? "PASS" : "FAIL",
    clause: "4.7",
    standard: "AS/NZS 3500.4:2025",
    value: `${beddingThicknessMm} mm (minimum 75 mm compacted sand)`,
    requiredFix: pass
      ? undefined
      : `Provide minimum 75 mm of compacted sand bedding. Current: ${beddingThicknessMm} mm. No rocks over 25 mm in backfill (Cl. 4.7).`,
  };
}

function evalTrenchWidth(input: ComplianceInput): RuleResult {
  const { trenchWidthMm, pipeSizeDN } = input;
  if (trenchWidthMm === null) {
    return {
      id: "trench_width",
      name: "Trench Width",
      status: "NOT_APPLICABLE",
      clause: "4.7",
      standard: "AS/NZS 3500.4:2025",
      requiredFix: "Enter trench width measurement to assess.",
    };
  }
  const minWidth = pipeSizeDN + 150;
  const pass = trenchWidthMm >= minWidth;
  return {
    id: "trench_width",
    name: "Trench Width (Pipe DN + 150 mm)",
    status: pass ? "PASS" : "FAIL",
    clause: "4.7",
    standard: "AS/NZS 3500.4:2025",
    value: `${trenchWidthMm} mm (DN${pipeSizeDN} + 150 = minimum ${minWidth} mm)`,
    requiredFix: pass
      ? undefined
      : `Widen trench to at least ${minWidth} mm (pipe DN${pipeSizeDN} + 150 mm clearance). Current: ${trenchWidthMm} mm.`,
  };
}

function evalContamination(input: ComplianceInput): RuleResult {
  if (!input.contaminatedArea) {
    return {
      id: "contamination",
      name: "Contamination Zone Protection",
      status: "NOT_APPLICABLE",
      clause: "4.8",
      standard: "AS/NZS 3500.4:2025",
    };
  }
  const hasProtection =
    input.protectionMethod.toLowerCase().includes("conduit") ||
    input.protectionMethod.toLowerCase().includes("sleeve") ||
    input.protectionMethod.toLowerCase().includes("600");
  return {
    id: "contamination",
    name: "Contamination Zone Protection",
    status: hasProtection ? "PASS" : "FAIL",
    clause: "4.8",
    standard: "AS/NZS 3500.4:2025",
    value: input.protectionMethod || "Not specified",
    requiredFix: hasProtection
      ? undefined
      : "In contaminated areas, pipe must be in a sealed conduit or installed minimum 600 mm above contamination source (AS/NZS 3500.4:2025 Cl. 4.8).",
  };
}

function evalCorrosion(input: ComplianceInput): RuleResult {
  if (!input.corrosiveArea) {
    return {
      id: "corrosion",
      name: "Corrosion Protection",
      status: "NOT_APPLICABLE",
      clause: "4.9",
      standard: "AS/NZS 3500.4:2025",
    };
  }
  const hasProtection =
    input.protectionMethod.toLowerCase().includes("coating") ||
    input.protectionMethod.toLowerCase().includes("sleeve") ||
    input.protectionMethod.toLowerCase().includes("wrap") ||
    input.pipeMaterial.toLowerCase().includes("hdpe") ||
    input.pipeMaterial.toLowerCase().includes("pvc") ||
    input.pipeMaterial.toLowerCase().includes("stainless");
  return {
    id: "corrosion",
    name: "Corrosion Protection (Corrosive Area)",
    status: hasProtection ? "PASS" : "FAIL",
    clause: "4.9",
    standard: "AS/NZS 3500.4:2025",
    value: `Material: ${input.pipeMaterial}, Protection: ${input.protectionMethod || "none specified"}`,
    requiredFix: hasProtection
      ? undefined
      : "In corrosive areas, pipes must have protective coating, sleeve, or wrapping — or use a corrosion-resistant material (HDPE, PVC, stainless) (AS/NZS 3500.4:2025 Cl. 4.9).",
  };
}

function evalFreezing(input: ComplianceInput): RuleResult {
  if (!input.freezingConditions) {
    return {
      id: "freezing",
      name: "Freezing Protection",
      status: "NOT_APPLICABLE",
      clause: "4.11",
      standard: "AS/NZS 3500.4:2025",
    };
  }
  const depthOk = input.depthOfCoverMm !== null && input.depthOfCoverMm >= 300;
  const hasInsulation =
    input.protectionMethod.toLowerCase().includes("insul") ||
    input.protectionMethod.toLowerCase().includes("wrap") ||
    input.protectionMethod.toLowerCase().includes("lagg");
  const pass = depthOk || hasInsulation;
  return {
    id: "freezing",
    name: "Freezing Protection",
    status: pass ? "PASS" : "FAIL",
    clause: "4.11",
    standard: "AS/NZS 3500.4:2025",
    value: `Depth: ${input.depthOfCoverMm ?? "—"} mm, Protection: ${input.protectionMethod || "none"}`,
    requiredFix: pass
      ? undefined
      : "In freezing conditions, bury pipe minimum 300 mm OR provide full insulation/lagging. Neither criterion is currently met (AS/NZS 3500.4:2025 Cl. 4.11).",
  };
}

function evalRoofSpaceClearance(input: ComplianceInput): RuleResult {
  if (!input.roofSpace) {
    return {
      id: "roof_clearance",
      name: "Roof Space Clearance",
      status: "NOT_APPLICABLE",
      clause: "4.11",
      standard: "AS/NZS 3500.4:2025",
    };
  }
  const distOk = input.distanceFromWallsMm !== null && input.distanceFromWallsMm >= 100;
  return {
    id: "roof_clearance",
    name: "Roof Space Clearance (min 100 mm from surfaces)",
    status: distOk ? "PASS" : "FAIL",
    clause: "4.11",
    standard: "AS/NZS 3500.4:2025",
    value: input.distanceFromWallsMm !== null ? `${input.distanceFromWallsMm} mm` : "Not measured",
    requiredFix: distOk
      ? undefined
      : `Minimum 100 mm clearance from surfaces required in roof space. Current: ${input.distanceFromWallsMm ?? "not measured"} mm (AS/NZS 3500.4:2025 Cl. 4.11).`,
  };
}

function evalExternalWallClearance(input: ComplianceInput): RuleResult {
  if (!input.externalWall) {
    return {
      id: "wall_clearance",
      name: "External Wall Clearance",
      status: "NOT_APPLICABLE",
      clause: "4.11",
      standard: "AS/NZS 3500.4:2025",
    };
  }
  const distOk = input.distanceFromWallsMm !== null && input.distanceFromWallsMm >= 20;
  return {
    id: "wall_clearance",
    name: "External Wall Clearance (min 20 mm)",
    status: distOk ? "PASS" : "FAIL",
    clause: "4.11",
    standard: "AS/NZS 3500.4:2025",
    value: input.distanceFromWallsMm !== null ? `${input.distanceFromWallsMm} mm` : "Not measured",
    requiredFix: distOk
      ? undefined
      : `Minimum 20 mm clearance from external wall surface required. Current: ${input.distanceFromWallsMm ?? "not measured"} mm (AS/NZS 3500.4:2025 Cl. 4.11).`,
  };
}

// ── Main engine ────────────────────────────────────────────────────────────────

export function runComplianceEngine(input: ComplianceInput): ComplianceReport {
  const results: RuleResult[] = [
    evalDepthOfCover(input),
    evalBeddingThickness(input),
    evalTrenchWidth(input),
    evalContamination(input),
    evalCorrosion(input),
    evalFreezing(input),
    evalRoofSpaceClearance(input),
    evalExternalWallClearance(input),
  ];

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const naCount = results.filter((r) => r.status === "NOT_APPLICABLE").length;

  const assessed = results.filter((r) => r.status !== "NOT_APPLICABLE");
  let overallStatus: ComplianceReport["overallStatus"];
  if (assessed.length === 0) {
    overallStatus = "NOT_ASSESSED";
  } else if (failCount > 0) {
    overallStatus = "NON_COMPLIANT";
  } else {
    overallStatus = "COMPLIANT";
  }

  return { results, passCount, failCount, naCount, overallStatus };
}

export const COMPLIANCE_ENGINE_KEY = "elemetric_compliance_engine_results";
