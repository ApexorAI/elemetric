import React, { useState, useRef, useCallback, useMemo } from "react";
import PDFSuccessModal from "@/components/PDFSuccessModal";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { hashBase64, captureTimestamp } from "@/lib/photoHash";

const API_BASE = "https://elemetric-ai-production.up.railway.app";

// ── Checklist data ─────────────────────────────────────────────────────────────

const CHECKS = [
  { id: "rcd",            label: "RCD protection installed and tested" },
  { id: "circuit_breaker",label: "Circuit breaker ratings correct" },
  { id: "earth",          label: "Earth continuity tested" },
  { id: "polarity",       label: "Polarity correct" },
  { id: "insulation",     label: "Insulation resistance tested" },
  { id: "connections",    label: "All connections secure and terminations correct" },
  { id: "cable_support",  label: "Cable support and protection adequate" },
  { id: "switchboard",    label: "Switchboard labelling complete" },
  { id: "no_damage",      label: "No visible damage to cables or fittings" },
  { id: "smoke_alarm",    label: "Smoke alarm installed and tested where required" },
  { id: "safety_switch",  label: "Safety switch tested and operational" },
  { id: "test_recorded",  label: "Test results recorded" },
] as const;

const DECLARATION_ITEMS = [
  "I hold a current electrical worker licence issued by Energy Safe Victoria.",
  "I hold a current electrical contractor licence as required by law.",
  "All work has been carried out in accordance with AS/NZS 3000 Wiring Rules.",
  "I confirm that all test results recorded in this report are accurate and were obtained using calibrated test equipment.",
  "I acknowledge that this Certificate of Electrical Safety may be inspected by Energy Safe Victoria.",
];

// ── Types ──────────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "na" | null;
type Point  = { x: number; y: number };
type Stroke = Point[];
type PhotoMeta = { uri: string; hash: string; capturedAt: string };

type CheckEntry = {
  status: CheckStatus;
  notes: string;
  photoUris: string[];
};

type AIResult = {
  relevant?: boolean;
  confidence?: number;
  detected?: string[];
  unclear?: string[];
  missing?: string[];
  action?: string;
  analysis?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusLabel = (s: CheckStatus) => {
  if (s === "pass") return "Pass";
  if (s === "fail") return "Fail";
  if (s === "na")   return "N/A";
  return "—";
};

const statusHtmlColor = (s: CheckStatus) => {
  if (s === "pass") return "#16a34a";
  if (s === "fail") return "#dc2626";
  if (s === "na")   return "#6b7280";
  return "#374151";
};

const strokesToSvg = (strokes: Stroke[], w: number, h: number): string => {
  const paths = strokes
    .map((stroke) => {
      if (!stroke.length) return "";
      const d = stroke.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      return `<path d="${d}" stroke="#111827" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="white"/>${paths}</svg>`;
};

function countStrokePixels(strokes: Stroke[]): number {
  let total = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const dx = stroke[i].x - stroke[i - 1].x;
      const dy = stroke[i].y - stroke[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
  }
  return total;
}

// ── SignaturePad ───────────────────────────────────────────────────────────────

function SignaturePad({
  strokes,
  setStrokes,
  onScrollLock,
}: {
  strokes: Stroke[];
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  onScrollLock: (enabled: boolean) => void;
}) {
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [padW, setPadW] = useState(300);
  const [padH, setPadH] = useState(160);
  const drawingRef  = useRef(false);
  const strokeRef   = useRef<Point[]>([]);
  const padWRef     = useRef(300);
  const padHRef     = useRef(160);
  const lockRef     = useRef(onScrollLock);
  lockRef.current   = onScrollLock;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const pt = {
            x: Math.max(0, Math.min(padWRef.current, locationX)),
            y: Math.max(0, Math.min(padHRef.current, locationY)),
          };
          drawingRef.current = true;
          strokeRef.current  = [pt];
          setCurrentStroke([pt]);
          lockRef.current(false);
        },
        onPanResponderMove: (evt) => {
          if (!drawingRef.current) return;
          const { locationX, locationY } = evt.nativeEvent;
          const pt = {
            x: Math.max(0, Math.min(padWRef.current, locationX)),
            y: Math.max(0, Math.min(padHRef.current, locationY)),
          };
          strokeRef.current = [...strokeRef.current, pt];
          setCurrentStroke([...strokeRef.current]);
        },
        onPanResponderRelease: () => {
          if (strokeRef.current.length) {
            setStrokes((prev) => [...prev, [...strokeRef.current]]);
          }
          strokeRef.current  = [];
          setCurrentStroke([]);
          drawingRef.current = false;
          lockRef.current(true);
        },
        onPanResponderTerminate: () => {
          strokeRef.current  = [];
          setCurrentStroke([]);
          drawingRef.current = false;
          lockRef.current(true);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const toPath = (stroke: Stroke) => {
    if (!stroke.length) return "";
    if (stroke.length === 1)
      return `M ${stroke[0].x} ${stroke[0].y} L ${stroke[0].x + 0.1} ${stroke[0].y + 0.1}`;
    return stroke.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  };

  const allStrokes = [...strokes, ...(currentStroke.length ? [currentStroke] : [])];

  return (
    <View style={sigStyles.wrap}>
      <View
        style={sigStyles.pad}
        onLayout={(e: LayoutChangeEvent) => {
          padWRef.current = e.nativeEvent.layout.width;
          padHRef.current = e.nativeEvent.layout.height;
          setPadW(e.nativeEvent.layout.width);
          setPadH(e.nativeEvent.layout.height);
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {allStrokes.map((s, i) => (
            <Path
              key={i}
              d={toPath(s)}
              stroke="#111827"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
      <Pressable
        style={sigStyles.clearBtn}
        onPress={() => { setStrokes([]); setCurrentStroke([]); }}
      >
        <Text style={sigStyles.clearText}>Clear</Text>
      </Pressable>
    </View>
  );
}

const sigStyles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  pad: {
    height: 160,
    backgroundColor: "white",
  },
  clearBtn: {
    padding: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  clearText: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    fontSize: 13,
  },
});

// ── StatusButtons ──────────────────────────────────────────────────────────────

function StatusButtons({
  id,
  status,
  onSet,
}: {
  id: string;
  status: CheckStatus;
  onSet: (id: string, s: CheckStatus) => void;
}) {
  return (
    <View style={styles.statusRow}>
      {(["pass", "fail", "na"] as CheckStatus[]).map((s) => (
        <Pressable
          key={s}
          style={[
            styles.statusBtn,
            status === s && (
              s === "pass" ? styles.sBtnPass :
              s === "fail" ? styles.sBtnFail :
              styles.sBtnNA
            ),
          ]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSet(id, s); }}
        >
          <Text style={[styles.statusBtnText, status === s && styles.statusBtnActive]}>
            {s === "pass" ? "Pass" : s === "fail" ? "Fail" : "N/A"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ElectricalChecklist() {
  const router    = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [loaded,        setLoaded]        = useState(false);
  const [sigW,          setSigW]          = useState(300);

  // Job
  const [jobName, setJobName] = useState("Untitled Job");
  const [jobAddr, setJobAddr] = useState("No address");

  // Electrician details
  const [electricianLicence,  setElectricianLicence]  = useState("");
  const [contractorLicence,   setContractorLicence]   = useState("");
  const [testInstrumentSerial,setTestInstrumentSerial] = useState("");
  const [contractorName,      setContractorName]       = useState("");

  // Test readings
  const [circuitVoltage,          setCircuitVoltage]          = useState("");
  const [supplyFrequency,         setSupplyFrequency]         = useState("");
  const [circuitCurrent,          setCircuitCurrent]          = useState("");
  const [insulationResistance,    setInsulationResistance]    = useState("");
  const [insulationResistanceLN,  setInsulationResistanceLN]  = useState("");
  const [insulationResistanceLPE, setInsulationResistanceLPE] = useState("");
  const [insulationResistanceNPE, setInsulationResistanceNPE] = useState("");
  const [earthLoopImpedance,      setEarthLoopImpedance]      = useState("");
  const [pscc,                    setPscc]                    = useState("");
  const [rcdTripTime,             setRcdTripTime]             = useState("");
  const [rcdTripCurrent,          setRcdTripCurrent]          = useState("");
  const [testInstrumentModel,     setTestInstrumentModel]     = useState("");
  const [testInstrumentCalDate,   setTestInstrumentCalDate]   = useState("");

  // Profile
  const [profileCompany, setProfileCompany] = useState("");

  // Checklist
  const [checks, setChecks] = useState<Record<string, CheckEntry>>(() =>
    Object.fromEntries(CHECKS.map((c) => [c.id, { status: null, notes: "", photoUris: [] }]))
  );
  const [photoMeta, setPhotoMeta] = useState<Record<string, PhotoMeta[]>>({});

  // Declaration
  const [declared, setDeclared] = useState<Record<number, boolean>>({});

  // Signatures
  const [electricianStrokes, setElectricianStrokes] = useState<Stroke[]>([]);
  const [contractorStrokes,  setContractorStrokes]  = useState<Stroke[]>([]);

  // State
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiResult,    setAiResult]    = useState<AIResult | null>(null);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pdfUri,      setPdfUri]      = useState<string | null>(null);
  const [pdfSharing,  setPdfSharing]  = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem("elemetric_current_job");
          if (raw && active) {
            const j = JSON.parse(raw);
            setJobName(j.jobName || "Untitled Job");
            setJobAddr(j.jobAddr  || "No address");
          }
        } catch {}
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && active) {
            const { data } = await supabase
              .from("profiles")
              .select("full_name, licence_number, company_name")
              .eq("user_id", user.id)
              .single();
            if (data && active) {
              if (data.company_name)  setProfileCompany(data.company_name);
              if (data.licence_number) setElectricianLicence((prev) => prev || data.licence_number);
            }
          }
        } catch {}
        if (active) setLoaded(true);
      })();
      return () => { active = false; };
    }, [])
  );

  // ── Photo capture ─────────────────────────────────────────────────────────────

  const addPhoto = async (id: string) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      const ts = captureTimestamp();
      let hash = "";
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        hash = await hashBase64(b64);
      } catch {}
      setPhotoMeta((prev) => ({ ...prev, [id]: [...(prev[id] || []), { uri, hash, capturedAt: ts }] }));
      setChecks((prev) => ({ ...prev, [id]: { ...prev[id], photoUris: [...prev[id].photoUris, uri] } }));
    } catch (e: any) {
      Alert.alert("Photo error", e?.message ?? "Unknown error");
    }
  };

  const removePhoto = (id: string, uri: string) => {
    setPhotoMeta((prev) => ({ ...prev, [id]: (prev[id] || []).filter((m) => m.uri !== uri) }));
    setChecks((prev) => ({ ...prev, [id]: { ...prev[id], photoUris: prev[id].photoUris.filter((u) => u !== uri) } }));
  };

  const setStatus = (id: string, s: CheckStatus) =>
    setChecks((prev) => ({ ...prev, [id]: { ...prev[id], status: s } }));

  const setNotes = (id: string, notes: string) =>
    setChecks((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));

  // ── AI analysis ───────────────────────────────────────────────────────────────

  const runAI = async () => {
    const allPhotos: { label: string; uri: string }[] = [];
    for (const c of CHECKS) {
      for (const uri of checks[c.id]?.photoUris ?? []) {
        allPhotos.push({ label: c.label, uri });
      }
    }
    if (allPhotos.length < 2) {
      Alert.alert("More photos needed", "Please add at least 2 photos before running AI analysis.");
      return;
    }
    setAiLoading(true);
    try {
      const images: { mime: string; data: string; label: string }[] = [];
      for (const p of allPhotos) {
        const r = await ImageManipulator.manipulateAsync(p.uri, [{ resize: { width: 1200 } }], {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        if (r.base64) images.push({ mime: "image/jpeg", data: r.base64, label: p.label });
      }
      const res = await fetch(`${API_BASE}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json",
        "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "", },
        body: JSON.stringify({ type: "electrical", images }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "AI request failed");
      setAiResult(json);
      if ((json.confidence ?? 0) < 35) {
        Alert.alert(
          "Low Confidence Score",
          "Low confidence score. We recommend retaking photos with better lighting and angles before generating your report."
        );
      }
    } catch (e: any) {
      Alert.alert("AI Error", e?.message ?? "Unknown error");
    } finally {
      setAiLoading(false);
    }
  };

  // ── PDF ───────────────────────────────────────────────────────────────────────

  const generateReport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (electricianStrokes.length > 0 && countStrokePixels(electricianStrokes) < 100) {
      Alert.alert("Incomplete Signature", "Please provide a complete electrician signature.");
      return;
    }

    setPdfLoading(true);
    try {
      let dateStr = new Date().toLocaleString("en-AU");
      let dateShort = new Date().toLocaleDateString("en-AU");
      try {
        const tsRes = await fetch(`${API_BASE}/timestamp`, { headers: { "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "" } });
        const tsJson = await tsRes.json();
        if (tsJson?.formatted) dateStr = tsJson.formatted;
        if (tsJson?.timestamp) dateShort = new Date(tsJson.timestamp).toLocaleDateString("en-AU");
      } catch {}

      const td = `border:1px solid #d1d5db;padding:8px;`;
      const th = `${td}background:#f3f4f6;text-align:left;font-weight:bold;font-family:Helvetica,Arial,sans-serif;`;

      // QR code
      let qrHtml = "";
      try {
        const qrData = `ELM|electrical|${jobName}|${jobAddr}|${dateShort}`;
        const qrSvg  = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
        const qrUrl  = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
        qrHtml = `<div style="text-align:center;">
<img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
<div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
</div>`;
      } catch {}

      // Signatures as SVG
      const elecSvg = electricianStrokes.length
        ? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(strokesToSvg(electricianStrokes, sigW, 160))}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
        : `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

      const contrSvg = contractorStrokes.length
        ? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(strokesToSvg(contractorStrokes, sigW, 160))}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
        : `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

      // Checklist rows with color-coded backgrounds
      const checkRows = CHECKS.map((c) => {
        const e   = checks[c.id];
        const lbl = statusLabel(e?.status ?? null);
        const col = statusHtmlColor(e?.status ?? null);
        const rowBg =
          e?.status === "pass" ? "background:#dcfce7;" :
          e?.status === "fail" ? "background:#fee2e2;" :
          e?.status === "na"   ? "background:#f3f4f6;" :
          "";
        return `<tr style="${rowBg}">
<td style="${td}font-family:Helvetica,Arial,sans-serif;">${c.label}</td>
<td style="${td}font-weight:bold;color:${col};font-family:Helvetica,Arial,sans-serif;">${lbl}</td>
<td style="${td}font-family:Helvetica,Arial,sans-serif;">${e?.notes || ""}</td>
</tr>`;
      }).join("");

      // AI section
      const aiSection = aiResult ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<div style="margin-bottom:16px;border:1px solid #e5e7eb;padding:16px;background:#f9fafb;">
<div style="font-size:17px;font-weight:bold;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">AI Documentation Analysis</div>
<div style="font-size:30px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${aiResult.confidence ?? 0}%</div>
<div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;"><strong>Action:</strong> ${aiResult.action || "—"}</div>
<div style="margin-top:4px;font-family:Helvetica,Arial,sans-serif;">${aiResult.analysis || ""}</div>
</div>` : "";

      // Build all photo records for tamper-evident table
      const allPhotoMeta: { label: string; hash: string; capturedAt: string }[] = [];
      for (const c of CHECKS) {
        for (const uri of checks[c.id]?.photoUris ?? []) {
          const m = (photoMeta[c.id] || []).find((x) => x.uri === uri);
          allPhotoMeta.push({ label: c.label, hash: m?.hash || "—", capturedAt: m?.capturedAt || "" });
        }
      }
      const tamperRows = allPhotoMeta.map((p) =>
        `<tr>
<td style="${td}font-weight:600;font-family:Helvetica,Arial,sans-serif;">${p.label}</td>
<td style="${td}white-space:nowrap;font-family:Helvetica,Arial,sans-serif;">${p.capturedAt ? new Date(p.capturedAt).toLocaleString("en-AU") : "—"}</td>
<td style="${td}font-family:monospace;word-break:break-all;font-size:9px;">${p.hash}</td>
</tr>`
      ).join("");

      const html = `<html><head><style>
@page { margin: 15mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } @bottom-left { content: "ELEMETRIC · Confidential"; font-size: 9pt; color: #6b7280; font-family: Helvetica, Arial, sans-serif; } }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 80pt; font-family: Helvetica,Arial,sans-serif; font-weight: bold; color: rgba(7,21,43,0.04); white-space: nowrap; pointer-events: none; z-index: -1; letter-spacing: 8px; }
</style></head>
<body>
<div class="watermark">ELEMETRIC</div>

<!-- Header -->
<div style="background:#07152b;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
<div>
<div style="font-size:28px;font-weight:900;letter-spacing:3px;font-family:Helvetica,Arial,sans-serif;">ELEMETRIC</div>
<div style="font-size:13px;opacity:0.7;margin-top:4px;font-family:Helvetica,Arial,sans-serif;">Electrical Compliance Documentation</div>
</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">Electrical Compliance Report · AS/NZS 3000 Wiring Rules</div>
<div style="font-size:12px;font-family:Helvetica,Arial,sans-serif;">${dateShort}</div>
</div>

<div style="padding:22px;">

<!-- Executive Summary -->
<div style="background:#f8fafc;border-left:4px solid #f97316;padding:16px;margin-bottom:20px;border-radius:0 6px 6px 0;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Executive Summary</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:4px 0;width:180px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Job Type</td><td style="font-family:Helvetica,Arial,sans-serif;">Electrical · AS/NZS 3000 Wiring Rules</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Date</td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Address</td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Electrician Licence</td><td style="font-family:Helvetica,Arial,sans-serif;">${electricianLicence || "Not entered"}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">AI Confidence</td><td style="font-family:Helvetica,Arial,sans-serif;">${aiResult ? `${aiResult.confidence ?? 0}%` : "Not analysed"}</td></tr>
  </table>
</div>
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Job Details -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Job Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:200px;font-family:Helvetica,Arial,sans-serif;"><strong>Job Name</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${jobName}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Address</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Report Date</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Electrician Details -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Electrician Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:200px;font-family:Helvetica,Arial,sans-serif;"><strong>Electrician Licence No.</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${electricianLicence || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Electrical Contractor Licence</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${contractorLicence || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Contractor Name</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${contractorName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Company</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${profileCompany || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Test Instrument Serial No.</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${testInstrumentSerial || "Not entered"}</td></tr>
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Electrical Test Results -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:6px;font-family:Helvetica,Arial,sans-serif;">Electrical Test Results</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:12px;font-family:Helvetica,Arial,sans-serif;">AS/NZS 3000:2018 — All values recorded using calibrated test instrument</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
<thead>
<tr style="background:#f8fafc;">
<th style="${th}width:45%;">Test Parameter</th>
<th style="${th}width:20%;">Recorded Value</th>
<th style="${th}">Reference / Limit (AS/NZS 3000)</th>
</tr>
</thead>
<tbody>
<tr style="background:#fafafa;"><td colspan="3" style="${td}font-family:Helvetica,Arial,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Supply Characteristics</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Supply Voltage</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${circuitVoltage ? circuitVoltage + " V" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">230 V ±6% (216–244 V)</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Supply Frequency</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${supplyFrequency ? supplyFrequency + " Hz" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">50 Hz ±0.5 Hz</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Circuit Current</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${circuitCurrent ? circuitCurrent + " A" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Must not exceed rated current</td></tr>
<tr style="background:#fafafa;"><td colspan="3" style="${td}font-family:Helvetica,Arial,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Insulation Resistance @ 500 V DC</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Line → Neutral (L-N)</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${insulationResistanceLN ? insulationResistanceLN + " MΩ" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≥ 1 MΩ (cl. 8.3.3)</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Line → Earth (L-PE)</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${insulationResistanceLPE ? insulationResistanceLPE + " MΩ" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≥ 1 MΩ (cl. 8.3.3)</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Neutral → Earth (N-PE)</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${insulationResistanceNPE ? insulationResistanceNPE + " MΩ" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≥ 1 MΩ (cl. 8.3.3)</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Overall IR</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${insulationResistance ? insulationResistance + " MΩ" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≥ 1 MΩ (cl. 8.3.3)</td></tr>
<tr style="background:#fafafa;"><td colspan="3" style="${td}font-family:Helvetica,Arial,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Earth Fault Loop &amp; Short-Circuit Protection</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Earth Loop Impedance (Ze)</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${earthLoopImpedance ? earthLoopImpedance + " Ω" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≤ 0.8 Ω (typical)</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Prospective Short-Circuit Current (PSCC)</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${pscc ? pscc + " A" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Within device rating</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">RCD Trip Time</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${rcdTripTime ? rcdTripTime + " ms" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≤ 300 ms @ I△n (cl. 2.6.2)</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">RCD Trip Current</td><td style="${td}font-weight:bold;font-family:Helvetica,Arial,sans-serif;">${rcdTripCurrent ? rcdTripCurrent + " mA" : "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">≤ 30 mA (personal protection)</td></tr>
<tr style="background:#fafafa;"><td colspan="3" style="${td}font-family:Helvetica,Arial,sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;">Test Instrument</td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Instrument Serial Number</td><td style="${td}font-family:Helvetica,Arial,sans-serif;">${testInstrumentSerial || "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;"></td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Instrument Model</td><td style="${td}font-family:Helvetica,Arial,sans-serif;">${testInstrumentModel || "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;"></td></tr>
<tr><td style="${td}font-family:Helvetica,Arial,sans-serif;">Calibration Due Date</td><td style="${td}font-family:Helvetica,Arial,sans-serif;">${testInstrumentCalDate || "—"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;color:#6b7280;font-size:11px;">Must be current</td></tr>
</tbody>
</table>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#1e40af;line-height:1.5;">
  <strong>Test Method Note:</strong> All tests performed in accordance with AS/NZS 3000:2018 Appendix B and Energy Safe Victoria Certificate of Electrical Safety requirements. Test instrument calibrated and traceable to national standards.
</div>
</div>

${aiSection}

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Checklist -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Installation Checklist — AS/NZS 3000:2018</div>
<table style="width:100%;border-collapse:collapse;">
<thead>
<tr>
<th style="${th}width:58%;">Check Item</th>
<th style="${th}width:10%;">Result</th>
<th style="${th}">Notes</th>
</tr>
</thead>
<tbody>
${checkRows}
</tbody>
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Signatures -->
<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;page-break-inside:avoid;">
<div style="font-size:18px;font-weight:bold;margin-bottom:16px;font-family:Helvetica,Arial,sans-serif;">Signatures</div>
<div style="display:flex;gap:48px;flex-wrap:wrap;">
<div>
<div style="margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;"><strong>Licensed Electrician</strong></div>
${elecSvg}
<div style="margin-top:6px;font-size:12px;color:#6b7280;font-family:Helvetica,Arial,sans-serif;">Licence: ${electricianLicence || "Not entered"}</div>
<div style="margin-top:4px;font-size:13px;font-family:Helvetica,Arial,sans-serif;"><strong>Date:</strong> ${dateShort}</div>
</div>
<div>
<div style="margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;"><strong>Electrical Contractor</strong></div>
${contrSvg}
<div style="margin-top:6px;font-size:12px;color:#6b7280;font-family:Helvetica,Arial,sans-serif;">Licence: ${contractorLicence || "Not entered"} · ${contractorName || ""}</div>
<div style="margin-top:4px;font-size:13px;font-family:Helvetica,Arial,sans-serif;"><strong>Date:</strong> ${dateShort}</div>
</div>
</div>
</div>

${allPhotoMeta.length > 0 ? `
<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>
<!-- Tamper-Evident Photo Record -->
<div style="margin-top:24px;page-break-inside:avoid;">
<div style="font-size:17px;font-weight:bold;margin-bottom:6px;font-family:Helvetica,Arial,sans-serif;">Tamper-Evident Photo Record</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Each photo hash can be used to verify this image has not been modified since capture.</div>
<table style="width:100%;border-collapse:collapse;font-size:11px;">
<thead><tr style="background:#f3f4f6;">
<th style="${td}text-align:left;font-family:Helvetica,Arial,sans-serif;">Photo Label</th>
<th style="${td}text-align:left;font-family:Helvetica,Arial,sans-serif;">Captured At</th>
<th style="${td}text-align:left;word-break:break-all;font-family:Helvetica,Arial,sans-serif;">SHA-256 Hash</th>
</tr></thead>
<tbody>${tamperRows}</tbody>
</table>
</div>` : ""}

<!-- Disclaimer -->
<div style="margin-top:24px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.6;font-family:Helvetica,Arial,sans-serif;"><strong style="color:#374151;">Compliance Disclaimer:</strong> Generated by Elemetric on ${dateStr}. This report is a documentation aid only. Elemetric Pty Ltd accepts no liability for the accuracy of work described herein. Compliance responsibility rests solely with the licensed tradesperson.</div>

</div>
</body>
</html>`;

      const { uri: printUri } = await Print.printToFileAsync({ html });
      try { await AsyncStorage.setItem("elemetric_pdf_generated", "1"); } catch {}

      // Save job to Supabase for free tier tracking and timeline
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const passCount = CHECKS.filter((c) => checks[c.id]?.status === "pass").length;
          const confidence = CHECKS.length > 0 ? Math.round((passCount / CHECKS.length) * 100) : 0;
          await supabase.from("jobs").insert({
            user_id: user.id,
            job_type: "electrical",
            job_name: jobName,
            job_addr: jobAddr,
            confidence: aiResult?.confidence ?? confidence,
            relevant: true,
            detected: aiResult?.detected ?? [],
            unclear: aiResult?.unclear ?? [],
            missing: aiResult?.missing ?? [],
            action: aiResult?.action ?? "",
          });
        }
      } catch {}

      const filename = `elemetric-electrical-${Date.now()}.pdf`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({ from: printUri, to: dest });
      setPdfUri(dest);
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert("PDF Error", e?.message ?? "Could not generate report.");
    } finally {
      setPdfLoading(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfUri) return;
    setPdfSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Electrical Compliance Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Created", `Saved to: ${pdfUri}`);
      }
    } catch (e: any) {
      Alert.alert("Share Error", e?.message ?? "Could not share report.");
    } finally {
      setPdfSharing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const allDeclared = DECLARATION_ITEMS.every((_, i) => declared[i]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Electrical Checklist</Text>
        <Text style={styles.meta}>{jobName} • {jobAddr}</Text>
        <Text style={styles.standard}>AS/NZS 3000:2018 Wiring Rules</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Electrician Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Electrician Details</Text>
          <Text style={styles.fieldLabel}>Electrician Licence Number</Text>
          <TextInput style={styles.input} value={electricianLicence} onChangeText={setElectricianLicence} placeholderTextColor="#555" placeholder="e.g. EW012345" />
          <Text style={styles.fieldLabel}>Electrical Contractor Licence Number</Text>
          <TextInput style={styles.input} value={contractorLicence} onChangeText={setContractorLicence} placeholderTextColor="#555" placeholder="e.g. EC012345" />
          <Text style={styles.fieldLabel}>Contractor / Supervising Electrician Name</Text>
          <TextInput style={styles.input} value={contractorName} onChangeText={setContractorName} placeholderTextColor="#555" />
          <Text style={styles.fieldLabel}>Test Instrument Serial Number</Text>
          <TextInput style={styles.input} value={testInstrumentSerial} onChangeText={setTestInstrumentSerial} placeholderTextColor="#555" placeholder="e.g. SN-2024-0001" />
        </View>

        {/* ── Electrician Details continued ── */}
        {/* Additional instrument info now in Electrician Details section */}

        {/* ── Test Readings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Electrical Test Results</Text>
          <Text style={styles.sectionSub}>AS/NZS 3000:2018 — All values per calibrated instrument</Text>

          <Text style={styles.subHeading}>Supply Characteristics</Text>
          <View style={styles.readingsGrid}>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Supply Voltage (V)</Text>
              <TextInput style={styles.input} value={circuitVoltage} onChangeText={setCircuitVoltage} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 230" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Frequency (Hz)</Text>
              <TextInput style={styles.input} value={supplyFrequency} onChangeText={setSupplyFrequency} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 50" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Circuit Current (A)</Text>
              <TextInput style={styles.input} value={circuitCurrent} onChangeText={setCircuitCurrent} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 15.4" />
            </View>
          </View>

          <Text style={styles.subHeading}>Insulation Resistance (MΩ @ 500V DC)</Text>
          <View style={styles.readingsGrid}>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Line → Neutral</Text>
              <TextInput style={styles.input} value={insulationResistanceLN} onChangeText={setInsulationResistanceLN} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 200" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Line → Earth</Text>
              <TextInput style={styles.input} value={insulationResistanceLPE} onChangeText={setInsulationResistanceLPE} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 200" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Neutral → Earth</Text>
              <TextInput style={styles.input} value={insulationResistanceNPE} onChangeText={setInsulationResistanceNPE} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 200" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Overall IR (MΩ)</Text>
              <TextInput style={styles.input} value={insulationResistance} onChangeText={setInsulationResistance} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="≥ 1 MΩ" />
            </View>
          </View>

          <Text style={styles.subHeading}>Earth Fault Loop &amp; Protection</Text>
          <View style={styles.readingsGrid}>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>Earth Loop Impedance (Ω)</Text>
              <TextInput style={styles.input} value={earthLoopImpedance} onChangeText={setEarthLoopImpedance} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="e.g. 0.45" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>PSCC (A)</Text>
              <TextInput style={styles.input} value={pscc} onChangeText={setPscc} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="Prospective short-circuit" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>RCD Trip Time (ms)</Text>
              <TextInput style={styles.input} value={rcdTripTime} onChangeText={setRcdTripTime} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="≤ 300 ms" />
            </View>
            <View style={styles.readingCell}>
              <Text style={styles.fieldLabel}>RCD Trip Current (mA)</Text>
              <TextInput style={styles.input} value={rcdTripCurrent} onChangeText={setRcdTripCurrent} keyboardType="decimal-pad" placeholderTextColor="#555" placeholder="≤ 30 mA" />
            </View>
          </View>

          <Text style={styles.subHeading}>Test Instrument Details</Text>
          <Text style={styles.fieldLabel}>Instrument Model</Text>
          <TextInput style={styles.input} value={testInstrumentModel} onChangeText={setTestInstrumentModel} placeholderTextColor="#555" placeholder="e.g. Fluke 1663" />
          <Text style={styles.fieldLabel}>Calibration Due Date</Text>
          <TextInput style={styles.input} value={testInstrumentCalDate} onChangeText={setTestInstrumentCalDate} placeholderTextColor="#555" placeholder="DD/MM/YYYY" />
        </View>

        {/* ── Installation Checks ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Installation Checks</Text>
          <Text style={styles.sectionSub}>AS/NZS 3000:2018 Wiring Rules</Text>
          {CHECKS.map((check) => {
            const entry = checks[check.id];
            return (
              <View key={check.id} style={styles.checkCard}>
                <Text style={styles.checkLabel}>{check.label}</Text>
                <StatusButtons id={check.id} status={entry.status} onSet={setStatus} />
                <TextInput
                  style={styles.notesInput}
                  value={entry.notes}
                  onChangeText={(t) => setNotes(check.id, t)}
                  placeholder="Notes / reading"
                  placeholderTextColor="#555"
                  multiline
                />
                <Pressable style={styles.addPhotoBtn} onPress={() => addPhoto(check.id)}>
                  <Text style={styles.addPhotoBtnText}>+ Add Photo</Text>
                </Pressable>
                {entry.photoUris.length > 0 && (
                  <View style={styles.photoGrid}>
                    {entry.photoUris.map((uri, i) => {
                      const meta = (photoMeta[check.id] || []).find((m) => m.uri === uri);
                      return (
                        <View key={`${check.id}-${i}`} style={styles.photoWrap}>
                          <Image source={{ uri }} style={styles.photo} />
                          {meta?.hash ? <View style={styles.shieldBadge}><Text style={styles.shieldBadgeText}>🛡</Text></View> : null}
                          <Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(check.id, uri)}>
                            <Text style={styles.removePhotoText}>×</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Declaration ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Declaration</Text>
          <Text style={styles.sectionSub}>Tick all boxes before signing</Text>
          {DECLARATION_ITEMS.map((text, i) => (
            <Pressable
              key={i}
              style={styles.declRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDeclared((prev) => ({ ...prev, [i]: !prev[i] }));
              }}
            >
              <View style={[styles.declCheck, declared[i] && styles.declCheckTicked]}>
                {declared[i] && <Text style={styles.declTick}>✓</Text>}
              </View>
              <Text style={styles.declText}>{text}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Electrician Signature ── */}
        <View
          style={styles.section}
          onLayout={(e) => setSigW(e.nativeEvent.layout.width - 32)}
        >
          <Text style={styles.sectionTitle}>Electrician Signature</Text>
          {!allDeclared && (
            <Text style={styles.sigWarning}>Complete declaration above before signing.</Text>
          )}
          <SignaturePad
            strokes={electricianStrokes}
            setStrokes={setElectricianStrokes}
            onScrollLock={setScrollEnabled}
          />
        </View>

        {/* ── Electrical Contractor Signature ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Electrical Contractor Signature</Text>
          <SignaturePad
            strokes={contractorStrokes}
            setStrokes={setContractorStrokes}
            onScrollLock={setScrollEnabled}
          />
        </View>

        {/* ── AI Analysis ── */}
        <Pressable
          style={[styles.aiBtn, aiLoading && { opacity: 0.6 }]}
          onPress={runAI}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.aiBtnText}> Analysing photos against AS/NZS 3000…</Text>
            </View>
          ) : (
            <Text style={styles.aiBtnText}>Run AI Analysis →</Text>
          )}
        </Pressable>

        {aiResult && (
          <View style={styles.aiCard}>
            <Text style={styles.aiCardLabel}>AI Analysis</Text>
            <Text style={styles.aiScore}>{aiResult.confidence ?? 0}%</Text>
            {!!aiResult.action && <Text style={styles.aiAction}>{aiResult.action}</Text>}
            {!!aiResult.detected?.length && (
              <>
                <Text style={styles.aiListTitle}>Verified</Text>
                {aiResult.detected.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
              </>
            )}
            {!!aiResult.unclear?.length && (
              <>
                <Text style={styles.aiListTitleAmber}>Unclear</Text>
                {aiResult.unclear.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
              </>
            )}
            {!!aiResult.missing?.length && (
              <>
                <Text style={styles.aiListTitleRed}>Missing / Failed</Text>
                {aiResult.missing.map((x, i) => <Text key={i} style={styles.aiItem}>• {x}</Text>)}
              </>
            )}
          </View>
        )}

        {/* ── Generate Report ── */}
        <Pressable
          style={[styles.reportBtn, pdfLoading && { opacity: 0.6 }]}
          onPress={generateReport}
          disabled={pdfLoading}
        >
          <Text style={styles.reportBtnText}>
            {pdfLoading ? "Generating…" : "Generate Compliance Report"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

      </ScrollView>

      <PDFSuccessModal
        visible={showSuccess}
        jobName={jobName}
        onShare={sharePdf}
        onDone={() => { setShowSuccess(false); router.push("/plumbing/jobs"); }}
        sharing={pdfSharing}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: "#07152b", alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText:   { color: "rgba(255,255,255,0.7)" },

  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8 },
  brand:    { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title:    { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  meta:     { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 13 },
  standard: { marginTop: 2, color: "rgba(255,255,255,0.45)", fontSize: 12 },

  body: { padding: 18, gap: 12, paddingBottom: 40 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 10,
  },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  sectionSub:   { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: -4 },

  fieldLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 12,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontSize: 14,
  },

  readingsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  readingCell:  { width: "47%" },
  subHeading: { color: "rgba(255,255,255,0.55)", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },

  checkCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    gap: 10,
  },
  checkLabel: { color: "white", fontWeight: "800", fontSize: 14, lineHeight: 20 },

  statusRow: { flexDirection: "row", gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  sBtnPass: { backgroundColor: "rgba(22,163,74,0.25)",  borderColor: "rgba(22,163,74,0.5)" },
  sBtnFail: { backgroundColor: "rgba(220,38,38,0.25)",  borderColor: "rgba(220,38,38,0.5)" },
  sBtnNA:   { backgroundColor: "rgba(107,114,128,0.25)", borderColor: "rgba(107,114,128,0.5)" },
  statusBtnText:   { color: "rgba(255,255,255,0.5)", fontWeight: "800", fontSize: 13 },
  statusBtnActive: { color: "white" },

  notesInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: 10,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    fontSize: 13,
    minHeight: 40,
  },

  addPhotoBtn:     { backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  addPhotoBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 13 },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoWrap: { position: "relative" },
  photo:     { width: 88, height: 88, borderRadius: 10 },
  shieldBadge: { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(34,197,94,0.85)", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
  shieldBadgeText: { fontSize: 11 },
  removePhotoBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  removePhotoText: { color: "white", fontSize: 14, fontWeight: "900", marginTop: -1 },

  // Declaration
  declRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
  },
  declCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  declCheckTicked: { backgroundColor: "#f97316", borderColor: "#f97316" },
  declTick:        { color: "white", fontWeight: "900", fontSize: 13 },
  declText:        { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 20 },

  sigWarning: { color: "#f97316", fontSize: 12, fontWeight: "700" },

  aiBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
  },
  aiBtnText:  { color: "white", fontWeight: "900" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  aiCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 6,
  },
  aiCardLabel:      { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  aiScore:          { color: "white", fontSize: 34, fontWeight: "900" },
  aiAction:         { color: "#f97316", fontSize: 13, fontWeight: "700", marginTop: 4 },
  aiListTitle:      { color: "#22c55e", fontWeight: "900", fontSize: 13, marginTop: 8 },
  aiListTitleAmber: { color: "#f97316", fontWeight: "900", fontSize: 13, marginTop: 8 },
  aiListTitleRed:   { color: "#ef4444", fontWeight: "900", fontSize: 13, marginTop: 8 },
  aiItem:           { color: "rgba(255,255,255,0.75)", fontSize: 13 },

  reportBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.40)",
  },
  reportBtnText: { color: "white", fontWeight: "900", fontSize: 16 },

  back:     { marginTop: 6, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },
});
