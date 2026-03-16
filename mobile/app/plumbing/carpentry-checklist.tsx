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
  { id: "framing_plumb",    label: "Wall framing plumb, square and true" },
  { id: "stud_spacing",     label: "Stud spacing correct per engineer / plans" },
  { id: "structural_conn",  label: "Structural connections and fixings correct" },
  { id: "blocking_nogging", label: "Blocking and nogging installed as required" },
  { id: "bracing",          label: "Bracing adequate and compliant — AS 1684" },
  { id: "roof_framing",     label: "Roof framing / truss installation correct" },
  { id: "floor_framing",    label: "Floor framing and joists secure" },
  { id: "lintel_correct",   label: "Lintels correct size and bearing length" },
  { id: "door_window",      label: "Door and window frames level, plumb and square" },
  { id: "fixing_schedule",  label: "Fixing schedule followed — nail / bolt sizes correct" },
  { id: "decking_flooring", label: "Decking or flooring laid correctly" },
  { id: "finish_trim",      label: "Finishing and trim installed to standard" },
  { id: "site_clean",       label: "Site cleanup completed" },
] as const;

const DECLARATION_ITEMS = [
  "I hold a current builder's licence / carpentry registration as required by the relevant authority.",
  "All structural work has been carried out in accordance with AS 1684 Residential Timber Framing.",
  "All connections and fixings comply with manufacturer specifications and engineering requirements.",
  "The work has been inspected and meets all applicable National Construction Code requirements.",
  "I acknowledge this documentation record may be reviewed by the relevant building authority.",
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

export default function CarpentryChecklist() {
  const router    = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [loaded,        setLoaded]        = useState(false);
  const [sigW,          setSigW]          = useState(300);

  // Job
  const [jobName, setJobName] = useState("Untitled Job");
  const [jobAddr, setJobAddr] = useState("No address");

  // Carpenter details
  const [carpenterLicence, setCarpenterLicence] = useState("");
  const [contractorName,   setContractorName]   = useState("");
  const [companyName,      setCompanyName]       = useState("");

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
  const [carpenterStrokes, setCarpenterStrokes] = useState<Stroke[]>([]);

  // State
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiResult,   setAiResult]   = useState<AIResult | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
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
              if (data.company_name)   setProfileCompany(data.company_name);
              if (data.licence_number) setCarpenterLicence((prev) => prev || data.licence_number);
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
        headers: {
          "Content-Type": "application/json",
          "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
        },
        body: JSON.stringify({ type: "carpentry", images }),
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

    if (carpenterStrokes.length > 0 && countStrokePixels(carpenterStrokes) < 100) {
      Alert.alert("Incomplete Signature", "Please provide a complete carpenter signature.");
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
        const qrData = `ELM|carpentry|${jobName}|${jobAddr}|${dateShort}`;
        const qrSvg  = await QRCode.toString(qrData, { type: "svg", width: 100, margin: 1 });
        const qrUrl  = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
        qrHtml = `<div style="text-align:center;">
<img src="${qrUrl}" style="width:68px;height:68px;background:white;padding:4px;border-radius:4px;display:block;"/>
<div style="font-size:8px;margin-top:3px;opacity:0.8;">Scan to verify</div>
</div>`;
      } catch {}

      // Signature as SVG
      const carpSvg = carpenterStrokes.length
        ? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(strokesToSvg(carpenterStrokes, sigW, 160))}" style="width:200px;height:60px;object-fit:contain;display:block;"/>`
        : `<div style="width:200px;height:40px;border-bottom:1px solid #111827;"></div>`;

      // Checklist rows
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

      // Tamper-evident photo record
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

      // Declaration
      const declRows = DECLARATION_ITEMS.map((item, i) =>
        `<tr><td style="${td}width:30px;text-align:center;font-family:Helvetica,Arial,sans-serif;">${declared[i] ? "✓" : "☐"}</td><td style="${td}font-family:Helvetica,Arial,sans-serif;">${item}</td></tr>`
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
<div style="font-size:13px;opacity:0.7;margin-top:4px;font-family:Helvetica,Arial,sans-serif;">Carpentry Documentation</div>
</div>
${qrHtml}
</div>
<div style="background:#f97316;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:14px;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">Carpentry Documentation Report · AS 1684 Residential Timber Framing</div>
<div style="font-size:12px;font-family:Helvetica,Arial,sans-serif;">${dateShort}</div>
</div>

<div style="padding:22px;">

<!-- Executive Summary -->
<div style="background:#f8fafc;border-left:4px solid #f97316;padding:16px;margin-bottom:20px;border-radius:0 6px 6px 0;">
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Executive Summary</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:4px 0;width:180px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Job Type</td><td style="font-family:Helvetica,Arial,sans-serif;">Carpentry · AS 1684 Residential Timber Framing</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Date</td><td style="font-family:Helvetica,Arial,sans-serif;">${dateStr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Address</td><td style="font-family:Helvetica,Arial,sans-serif;">${jobAddr}</td></tr>
    <tr><td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">Carpenter Licence No.</td><td style="font-family:Helvetica,Arial,sans-serif;">${carpenterLicence || "Not entered"}</td></tr>
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

<!-- Carpenter Details -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Carpenter Details</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:5px 0;width:200px;font-family:Helvetica,Arial,sans-serif;"><strong>Carpenter Licence No.</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${carpenterLicence || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Contractor Name</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${contractorName || "Not entered"}</td></tr>
<tr><td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;"><strong>Company</strong></td><td style="font-family:Helvetica,Arial,sans-serif;">${companyName || profileCompany || "Not entered"}</td></tr>
</table>
</div>

${aiSection}

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Checklist -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Installation Checklist — AS 1684 Residential Timber Framing</div>
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

<!-- Declaration -->
<div style="margin-bottom:16px;">
<div style="font-size:19px;font-weight:bold;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;">Declaration</div>
<table style="width:100%;border-collapse:collapse;">
<tbody>${declRows}</tbody>
</table>
</div>

<hr style="border:none;border-top:2px solid #f97316;margin:20px 0;"/>

<!-- Signatures -->
<div style="margin-top:18px;border-top:1px solid #d1d5db;padding-top:18px;page-break-inside:avoid;">
<div style="font-size:18px;font-weight:bold;margin-bottom:16px;font-family:Helvetica,Arial,sans-serif;">Signature</div>
<div>
<div style="margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;"><strong>Licensed Carpenter</strong></div>
${carpSvg}
<div style="margin-top:6px;font-size:12px;color:#6b7280;font-family:Helvetica,Arial,sans-serif;">Licence: ${carpenterLicence || "Not entered"} · ${contractorName || ""}</div>
<div style="margin-top:4px;font-size:13px;font-family:Helvetica,Arial,sans-serif;"><strong>Date:</strong> ${dateShort}</div>
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
            job_type: "carpentry",
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

      const filename = `elemetric-carpentry-${Date.now()}.pdf`;
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
          dialogTitle: "Share Compliance Report",
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
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.body}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Carpentry Checklist</Text>
        <Text style={styles.subtitle}>AS 1684 Residential Timber Framing · Documentation</Text>
      </View>

      {/* Job info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>JOB INFORMATION</Text>
        <Text style={styles.infoLabel}>Job</Text>
        <Text style={styles.infoValue}>{jobName}</Text>
        <Text style={styles.infoLabel}>Address</Text>
        <Text style={styles.infoValue}>{jobAddr}</Text>
      </View>

      {/* Carpenter details */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CARPENTER DETAILS</Text>
        <Text style={styles.fieldLabel}>Carpenter Licence No.</Text>
        <TextInput
          style={styles.input}
          value={carpenterLicence}
          onChangeText={setCarpenterLicence}
          placeholder="Licence number"
          placeholderTextColor="rgba(255,255,255,0.28)"
        />
        <Text style={styles.fieldLabel}>Contractor Name</Text>
        <TextInput
          style={styles.input}
          value={contractorName}
          onChangeText={setContractorName}
          placeholder="Full name"
          placeholderTextColor="rgba(255,255,255,0.28)"
        />
        <Text style={styles.fieldLabel}>Company</Text>
        <TextInput
          style={styles.input}
          value={companyName || profileCompany}
          onChangeText={setCompanyName}
          placeholder="Company name"
          placeholderTextColor="rgba(255,255,255,0.28)"
        />
      </View>

      {/* Checklist */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>INSTALLATION CHECKLIST</Text>
        {CHECKS.map((c) => {
          const entry = checks[c.id];
          return (
            <View key={c.id} style={styles.checkItem}>
              <Text style={styles.checkLabel}>{c.label}</Text>
              <StatusButtons id={c.id} status={entry.status} onSet={setStatus} />
              <TextInput
                style={styles.notesInput}
                value={entry.notes}
                onChangeText={(t) => setNotes(c.id, t)}
                placeholder="Notes (optional)"
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
              />
              {/* Photos */}
              <View style={styles.photoRow}>
                {entry.photoUris.map((uri) => (
                  <Pressable key={uri} onPress={() => removePhoto(c.id, uri)}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <View style={styles.removeOverlay}>
                      <Text style={styles.removeText}>✕</Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable style={styles.addPhotoBtn} onPress={() => addPhoto(c.id)}>
                  <Text style={styles.addPhotoText}>+ Photo</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {/* AI Analysis */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI DOCUMENTATION ANALYSIS</Text>
        <Text style={styles.aiDesc}>
          Elemetric AI validates your photos to confirm they show the required carpentry work.
        </Text>
        {aiResult && (
          <View style={styles.aiResult}>
            <Text style={styles.aiConfidence}>{aiResult.confidence ?? 0}%</Text>
            <Text style={styles.aiConfidenceLabel}>Confidence</Text>
            {aiResult.action ? <Text style={styles.aiAction}>{aiResult.action}</Text> : null}
            {aiResult.analysis ? <Text style={styles.aiAnalysis}>{aiResult.analysis}</Text> : null}
          </View>
        )}
        <Pressable
          style={[styles.actionBtn, aiLoading && { opacity: 0.6 }]}
          onPress={runAI}
          disabled={aiLoading}
        >
          {aiLoading
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.actionBtnText}>Run AI Analysis</Text>
          }
        </Pressable>
      </View>

      {/* Declaration */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>DECLARATION</Text>
        {DECLARATION_ITEMS.map((item, i) => (
          <Pressable
            key={i}
            style={styles.declRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDeclared((prev) => ({ ...prev, [i]: !prev[i] }));
            }}
          >
            <View style={[styles.declCheck, declared[i] && styles.declCheckActive]}>
              {declared[i] && <Text style={styles.declCheckMark}>✓</Text>}
            </View>
            <Text style={styles.declText}>{item}</Text>
          </Pressable>
        ))}
        {!allDeclared && (
          <Text style={styles.declWarning}>Please confirm all declaration items before generating your report.</Text>
        )}
      </View>

      {/* Signature */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>SIGNATURE</Text>
        <Text style={styles.fieldLabel}>Carpenter Signature</Text>
        <View
          onLayout={(e) => setSigW(e.nativeEvent.layout.width)}
        >
          <SignaturePad
            strokes={carpenterStrokes}
            setStrokes={setCarpenterStrokes}
            onScrollLock={(enabled) => setScrollEnabled(enabled)}
          />
        </View>
      </View>

      {/* Generate PDF */}
      <Pressable
        style={[styles.generateBtn, (!allDeclared || pdfLoading) && { opacity: 0.5 }]}
        onPress={generateReport}
        disabled={!allDeclared || pdfLoading}
      >
        {pdfLoading
          ? <ActivityIndicator color="#0b1220" />
          : <Text style={styles.generateBtnText}>Generate PDF Report</Text>
        }
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <PDFSuccessModal
        visible={showSuccess}
        jobName={jobName}
        onShare={sharePdf}
        onDone={() => { setShowSuccess(false); router.push("/plumbing/jobs"); }}
        sharing={pdfSharing}
      />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  loadingScreen: { flex: 1, backgroundColor: "#07152b", alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "rgba(255,255,255,0.55)", fontSize: 13 },

  body: { paddingBottom: 60 },

  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
    textTransform: "uppercase",
  },

  infoLabel: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 },
  infoValue: { color: "white", fontSize: 15, fontWeight: "700" },

  fieldLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    padding: 14,
    fontSize: 15,
  },

  checkItem: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    paddingTop: 12,
    gap: 8,
  },
  checkLabel: { color: "white", fontSize: 15, fontWeight: "700", lineHeight: 22 },

  statusRow: { flexDirection: "row", gap: 8 },
  statusBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  sBtnPass: { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "#22c55e" },
  sBtnFail: { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "#ef4444" },
  sBtnNA:   { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.20)" },
  statusBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },
  statusBtnActive: { color: "white", fontWeight: "700" },

  notesInput: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "white",
    padding: 14,
    fontSize: 15,
    minHeight: 44,
  },

  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)" },
  removeOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: "white", fontSize: 10, fontWeight: "900" },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" },

  aiDesc: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 },
  aiResult: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 6,
  },
  aiConfidence: { color: "#f97316", fontSize: 44, fontWeight: "900" },
  aiConfidenceLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  aiAction: { color: "#f97316", fontSize: 15, fontWeight: "700", marginTop: 4 },
  aiAnalysis: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22 },
  actionBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  declRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 2 },
  declCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  declCheckActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  declCheckMark: { color: "white", fontSize: 13, fontWeight: "900" },
  declText: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22, flex: 1 },
  declWarning: { color: "#f97316", fontSize: 13, fontWeight: "700" },

  generateBtn: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  generateBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  back: { marginTop: 4, marginBottom: 20, alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
