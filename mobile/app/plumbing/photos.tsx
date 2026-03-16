import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
Image,
ScrollView,
Alert,
ActivityIndicator,
Modal,
Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { hashBase64, captureTimestamp } from "@/lib/photoHash";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const CHECKLIST_KEY = "elemetric_current_checklist";
const REVIEW_PHOTOS_FILE = `${FileSystem.documentDirectory}review-photos.json`;
const PHOTO_360_TOOLTIP_KEY = "elemetric_360_tooltip_shown";
const REVIEW_PHOTOS_360_FILE = `${FileSystem.documentDirectory}review-photos-360.json`;
const FLOOR_PLAN_PINS_KEY = "elemetric_floor_plan_pins";

type CurrentJob = {
type: string;
jobName: string;
jobAddr: string;
};

type ChecklistItem = {
id: string;
title: string;
subtitle: string;
};

type ChecklistState = {
checked: Record<string, boolean>;
photoMap: Record<string, string[]>;
photoMeta: Record<string, PhotoMeta[]>;
};

type PhotoMeta = {
uri: string;
hash: string;
capturedAt: string;
role?: "before" | "after";
gps?: { lat: number; lng: number };
};

type ReviewPhoto = {
label: string;
uri: string;
base64: string;
mime: string;
hash?: string;
capturedAt?: string;
role?: "before" | "after";
gps?: { lat: number; lng: number };
};

const HOTWATER_ITEMS: ChecklistItem[] = [
{
id: "before",
title: "Existing system (before)",
subtitle: "Photo required",
},
{
id: "ptr",
title: "PTR valve installed",
subtitle: "Photo required",
},
{
id: "tempering",
title: "Tempering valve",
subtitle: "Photo required",
},
{
id: "plate",
title: "Compliance plate / label",
subtitle: "Photo required",
},
{
id: "isolation",
title: "Isolation valve",
subtitle: "Photo required",
},
];

export default function Photos() {
const router = useRouter();
const params = useLocalSearchParams<{ focusItem?: string }>();
const focusItem = params.focusItem ?? "";
const scrollRef = useRef<any>(null);
const itemRefs = useRef<Record<string, any>>({});

const [loaded, setLoaded] = useState(false);
const [currentJob, setCurrentJob] = useState<CurrentJob>({
type: "hotwater",
jobName: "Untitled Job",
jobAddr: "No address",
});
const [checked, setChecked] = useState<Record<string, boolean>>({});
const [photoMap, setPhotoMap] = useState<Record<string, string[]>>({});
const [photoMeta, setPhotoMeta] = useState<Record<string, PhotoMeta[]>>({});
const [loading, setLoading] = useState(false);
const [previewUri, setPreviewUri] = useState<string | null>(null);
const [photo360Map, setPhoto360Map] = useState<Record<string, string[]>>({});
const [photo360Meta, setPhoto360Meta] = useState<Record<string, PhotoMeta[]>>({});
const [showTooltip360, setShowTooltip360] = useState(false);
const [floorPlanUri, setFloorPlanUri] = useState<string | null>(null);

useFocusEffect(
useCallback(() => {
let active = true;

const loadData = async () => {
try {
const rawJob = await AsyncStorage.getItem("elemetric_current_job");
if (rawJob && active) {
const parsedJob = JSON.parse(rawJob);
setCurrentJob({
type: parsedJob.type || "hotwater",
jobName: parsedJob.jobName || "Untitled Job",
jobAddr: parsedJob.jobAddr || "No address",
});
}

const rawChecklist = await AsyncStorage.getItem(CHECKLIST_KEY);
if (rawChecklist && active) {
const parsedChecklist: ChecklistState = JSON.parse(rawChecklist);
setChecked(parsedChecklist.checked || {});
setPhotoMap(parsedChecklist.photoMap || {});
setPhotoMeta(parsedChecklist.photoMeta || {});
} else if (active) {
const blankPhotoMap: Record<string, string[]> = {};
HOTWATER_ITEMS.forEach((item) => {
blankPhotoMap[item.id] = [];
});
setPhotoMap(blankPhotoMap);
}
// Load 360° photos
const raw360 = await AsyncStorage.getItem("elemetric_360_photos");
if (raw360 && active) {
  const p360 = JSON.parse(raw360);
  setPhoto360Map(p360.photo360Map || {});
  setPhoto360Meta(p360.photo360Meta || {});
}
// Load floor plan URI from current job
const rawJobAgain = await AsyncStorage.getItem("elemetric_current_job");
if (rawJobAgain && active) {
  const parsedJob = JSON.parse(rawJobAgain);
  if (parsedJob.floorPlanUri) setFloorPlanUri(parsedJob.floorPlanUri);
}
} catch {
// ignore
} finally {
if (active) setLoaded(true);
}
};

loadData();

return () => {
active = false;
};
}, [])
);

useEffect(() => {
  if (!focusItem || !loaded) return;
  const t = setTimeout(() => {
    const ref = itemRefs.current[focusItem];
    if (ref && scrollRef.current) {
      ref.measureLayout(
        scrollRef.current,
        (_x: number, y: number) => { scrollRef.current?.scrollTo({ y: y - 20, animated: true }); },
        () => {}
      );
    }
  }, 400);
  return () => clearTimeout(t);
}, [focusItem, loaded]);

const totalRequiredPhotosAdded = useMemo(() => {
return Object.values(photoMap).reduce((sum, arr) => sum + (arr?.length || 0), 0);
}, [photoMap]);

const allWorkDays = useMemo(() => {
  const dates = new Set<string>();
  Object.values(photoMeta).flat().forEach((m) => {
    if (m.capturedAt) dates.add(new Date(m.capturedAt).toDateString());
  });
  Object.values(photo360Meta).flat().forEach((m) => {
    if (m.capturedAt) dates.add(new Date(m.capturedAt).toDateString());
  });
  return Array.from(dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}, [photoMeta, photo360Meta]);

const todayStr = new Date().toDateString();
const currentDayIndex = allWorkDays.includes(todayStr)
  ? allWorkDays.indexOf(todayStr)
  : allWorkDays.length;

const saveChecklistState = async (
nextChecked: Record<string, boolean>,
nextPhotoMap: Record<string, string[]>,
nextPhotoMeta: Record<string, PhotoMeta[]>
) => {
await AsyncStorage.setItem(
CHECKLIST_KEY,
JSON.stringify({
checked: nextChecked,
photoMap: nextPhotoMap,
photoMeta: nextPhotoMeta,
})
);
};

const save360State = async (
  next360Map: Record<string, string[]>,
  next360Meta: Record<string, PhotoMeta[]>
) => {
  await AsyncStorage.setItem(
    "elemetric_360_photos",
    JSON.stringify({ photo360Map: next360Map, photo360Meta: next360Meta })
  );
};

const addPhotoForItem = async (itemId: string) => {
try {
const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!perm.granted) {
Alert.alert("Camera Roll Access Required", "Go to Settings > Elemetric > Photos and enable access, then try again.");
return;
}

const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
quality: 1,
});

if (result.canceled) return;

const asset = result.assets?.[0];
if (!asset?.uri) {
Alert.alert("Photo Load Failed", "Could not read the selected image. Try selecting a different photo or retaking one with the camera.");
return;
}

const ts = captureTimestamp();

// Get GPS coordinates (best-effort)
let gps: { lat: number; lng: number } | undefined;
try {
const locPerm = await Location.requestForegroundPermissionsAsync();
if (locPerm.granted) {
const loc = await Location.getCurrentPositionAsync({
accuracy: Location.Accuracy.Balanced,
});
gps = { lat: loc.coords.latitude, lng: loc.coords.longitude };
}
} catch {}

// Read original base64
let b64 = "";
try {
b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
} catch {}

// Call server to burn GPS + timestamp onto the image (weatherproof stamp)
let finalUri = asset.uri;
let finalB64 = b64;
try {
const stampRes = await fetch(`${API_BASE}/stamp-photo`, {
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
},
body: JSON.stringify({ image: b64, mime: "image/jpeg", gps, capturedAt: ts }),
});
if (stampRes.ok) {
const stampJson = await stampRes.json();
if (stampJson.image) {
finalB64 = stampJson.image;
const stampedPath = `${FileSystem.documentDirectory}stamped-${Date.now()}.jpg`;
await FileSystem.writeAsStringAsync(stampedPath, finalB64, {
encoding: FileSystem.EncodingType.Base64,
});
finalUri = stampedPath;
}
}
} catch {
// Stamp failed — use original photo, continue without stamp
}

// Hash the final (stamped) image
let hash = "";
try {
hash = await hashBase64(finalB64);
} catch {}

const nextPhotoMap = {
...photoMap,
[itemId]: [...(photoMap[itemId] || []), finalUri],
};
const nextPhotoMeta = {
...photoMeta,
[itemId]: [...(photoMeta[itemId] || []), { uri: finalUri, hash, capturedAt: ts, gps }],
};
const nextChecked = {
...checked,
[itemId]: true,
};

setPhotoMap(nextPhotoMap);
setPhotoMeta(nextPhotoMeta);
setChecked(nextChecked);

await saveChecklistState(nextChecked, nextPhotoMap, nextPhotoMeta);
} catch (e: any) {
Alert.alert("Photo Error", e?.message ?? "Could not process this photo. Try selecting a different image or use the camera to take a new one.");
}
};

const setPhotoRole = async (
itemId: string,
uri: string,
role: "before" | "after"
) => {
const currentMeta = photoMeta[itemId] || [];
const nextMeta = currentMeta.map((m) =>
m.uri === uri ? { ...m, role: m.role === role ? undefined : role } : m
);
const nextPhotoMeta = { ...photoMeta, [itemId]: nextMeta };
setPhotoMeta(nextPhotoMeta);
try {
await saveChecklistState(checked, photoMap, nextPhotoMeta);
} catch {}
};

const removePhotoForItem = async (itemId: string, uri: string) => {
const nextArray = (photoMap[itemId] || []).filter((p) => p !== uri);
const nextMetaArray = (photoMeta[itemId] || []).filter((m) => m.uri !== uri);

const nextPhotoMap = { ...photoMap, [itemId]: nextArray };
const nextPhotoMeta = { ...photoMeta, [itemId]: nextMetaArray };
const nextChecked = { ...checked, [itemId]: nextArray.length > 0 };

setPhotoMap(nextPhotoMap);
setPhotoMeta(nextPhotoMeta);
setChecked(nextChecked);

try {
await saveChecklistState(nextChecked, nextPhotoMap, nextPhotoMeta);
} catch {}
};

const addPhoto360ForItem = async (itemId: string) => {
  // Show tooltip on first use
  const tooltipShown = await AsyncStorage.getItem(PHOTO_360_TOOLTIP_KEY);
  if (!tooltipShown) {
    setShowTooltip360(true);
    await AsyncStorage.setItem(PHOTO_360_TOOLTIP_KEY, "true");
    // Don't return — still let them pick
  }
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera Roll Access Required", "Enable photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const ts = captureTimestamp();
    let b64 = "";
    try {
      b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    } catch {}
    let hash = "";
    try { hash = await hashBase64(b64); } catch {}
    const next360Map = { ...photo360Map, [itemId]: [...(photo360Map[itemId] || []), asset.uri] };
    const next360Meta = { ...photo360Meta, [itemId]: [...(photo360Meta[itemId] || []), { uri: asset.uri, hash, capturedAt: ts, is360: true }] };
    setPhoto360Map(next360Map);
    setPhoto360Meta(next360Meta);
    await save360State(next360Map, next360Meta);
  } catch (e: any) {
    Alert.alert("360° Photo Error", e?.message ?? "Could not load photo.");
  }
};

const remove360Photo = async (itemId: string, uri: string) => {
  const next360Map = { ...photo360Map, [itemId]: (photo360Map[itemId] || []).filter((u) => u !== uri) };
  const next360Meta = { ...photo360Meta, [itemId]: (photo360Meta[itemId] || []).filter((m) => m.uri !== uri) };
  setPhoto360Map(next360Map);
  setPhoto360Meta(next360Meta);
  await save360State(next360Map, next360Meta);
};

const rotatePhoto = async (itemId: string, uri: string) => {
try {
const result = await ImageManipulator.manipulateAsync(uri, [{ rotate: 90 }], {
compress: 0.9,
format: ImageManipulator.SaveFormat.JPEG,
});
const newUri = result.uri;
const nextPhotoMap = {
...photoMap,
[itemId]: (photoMap[itemId] || []).map((u) => (u === uri ? newUri : u)),
};
const nextPhotoMeta = {
...photoMeta,
[itemId]: (photoMeta[itemId] || []).map((m) => (m.uri === uri ? { ...m, uri: newUri } : m)),
};
setPhotoMap(nextPhotoMap);
setPhotoMeta(nextPhotoMeta);
await saveChecklistState(checked, nextPhotoMap, nextPhotoMeta);
} catch (e: any) {
Alert.alert("Rotation Failed", e?.message ?? "Could not rotate the photo.");
}
};

const movePhoto = async (itemId: string, index: number, direction: -1 | 1) => {
const arr = [...(photoMap[itemId] || [])];
const meta = [...(photoMeta[itemId] || [])];
const swapIdx = index + direction;
if (swapIdx < 0 || swapIdx >= arr.length) return;
[arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
[meta[index], meta[swapIdx]] = [meta[swapIdx], meta[index]];
const nextPhotoMap = { ...photoMap, [itemId]: arr };
const nextPhotoMeta = { ...photoMeta, [itemId]: meta };
setPhotoMap(nextPhotoMap);
setPhotoMeta(nextPhotoMeta);
await saveChecklistState(checked, nextPhotoMap, nextPhotoMeta);
};

const convertToJpeg = async (uri: string) => {
const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], {
compress: 0.8,
format: ImageManipulator.SaveFormat.JPEG,
base64: true,
});

if (!result.base64) {
throw new Error("Could not convert image to JPEG.");
}

return {
uri: result.uri,
base64: result.base64,
mime: "image/jpeg",
};
};

const runAI = async () => {
if (totalRequiredPhotosAdded < 2) {
Alert.alert("More Photos Required", "Add at least 2 photos before running the AI analysis. Each checklist item should have at least one clear photo.");
return;
}

setLoading(true);

try {
const reviewPhotos: ReviewPhoto[] = [];
const images: { mime: string; data: string; label: string }[] = [];

for (const item of HOTWATER_ITEMS) {
const itemUris = photoMap[item.id] || [];
const itemMeta = photoMeta[item.id] || [];

for (const uri of itemUris) {
const converted = await convertToJpeg(uri);
const meta = itemMeta.find((m) => m.uri === uri);

reviewPhotos.push({
label: item.title,
uri: converted.uri,
base64: converted.base64,
mime: converted.mime,
hash: meta?.hash,
capturedAt: meta?.capturedAt,
role: meta?.role,
gps: meta?.gps,
});

images.push({
mime: converted.mime,
data: converted.base64,
label: item.title,
});
}
}

const payload = JSON.stringify(reviewPhotos);
await FileSystem.writeAsStringAsync(REVIEW_PHOTOS_FILE, payload, {
encoding: FileSystem.EncodingType.UTF8,
});

// Write 360° photos to separate file
const all360Photos: ReviewPhoto[] = [];
for (const item of HOTWATER_ITEMS) {
  const uris360 = photo360Map[item.id] || [];
  const meta360 = photo360Meta[item.id] || [];
  for (const uri of uris360) {
    try {
      const converted = await convertToJpeg(uri);
      const meta = meta360.find((m) => m.uri === uri);
      all360Photos.push({
        label: `360° — ${item.title}`,
        uri: converted.uri,
        base64: converted.base64,
        mime: converted.mime,
        capturedAt: meta?.capturedAt,
        hash: meta?.hash,
      });
    } catch {}
  }
}
if (all360Photos.length > 0) {
  await FileSystem.writeAsStringAsync(REVIEW_PHOTOS_360_FILE, JSON.stringify(all360Photos), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

// Upload photos to Supabase Storage (best-effort — does not block AI)
try {
const { data: { user } } = await supabase.auth.getUser();
if (user) {
const jobId = Date.now().toString();
for (const photo of reviewPhotos) {
const safeLabel = photo.label.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
const path = `${user.id}/${jobId}/${safeLabel}.jpg`;
const byteArray = Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0));
await supabase.storage
.from("job-photos")
.upload(path, byteArray, { contentType: "image/jpeg", upsert: true });
}
}
} catch {
// Storage upload failed — continue to AI review regardless
}

const res = await fetch(`${API_BASE}/review`, {
method: "POST",
headers: {
"Content-Type": "application/json",
        "X-Elemetric-Key": process.env.EXPO_PUBLIC_ELEMETRIC_API_KEY ?? "",
},
body: JSON.stringify({
type: currentJob.type,
images,
}),
});

const text = await res.text();

let json: any;
try {
json = JSON.parse(text);
} catch {
throw new Error(`Server returned invalid response: ${text.slice(0, 120)}`);
}

if (!res.ok) {
throw new Error(json?.error || json?.details || "AI request failed");
}

router.push({
pathname: "/plumbing/ai-review",
params: {
result: JSON.stringify(json),
},
});
} catch (e: any) {
Alert.alert("AI Analysis Failed", e?.message ?? "Could not analyse your photos. Check your internet connection and try again. If the problem persists, try retaking photos with better lighting.");
} finally {
setLoading(false);
}
};

if (!loaded) {
return (
<View style={styles.loadingScreen}>
<ActivityIndicator />
<Text style={styles.loadingText}>Loading photos…</Text>
</View>
);
}

const { width: SCREEN_W } = Dimensions.get("window");

return (
<View style={styles.screen}>
{/* Zoom preview modal */}
<Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
<Pressable style={styles.modalOverlay} onPress={() => setPreviewUri(null)}>
<Image source={{ uri: previewUri ?? "" }} style={[styles.modalImage, { width: SCREEN_W, height: SCREEN_W }]} resizeMode="contain" />
<Text style={styles.modalDismiss}>Tap to close</Text>
</Pressable>
</Modal>

{/* 360° Tooltip */}
<Modal visible={showTooltip360} transparent animationType="fade" onRequestClose={() => setShowTooltip360(false)}>
  <Pressable style={styles.tooltipOverlay} onPress={() => setShowTooltip360(false)}>
    <View style={styles.tooltipCard}>
      <Text style={styles.tooltipEmoji}>🔮</Text>
      <Text style={styles.tooltipTitle}>360° Photo Tip</Text>
      <Text style={styles.tooltipBody}>
        One 360° photo can satisfy multiple checklist items at once! The AI scans the entire room and detects all visible compliance items in a single shot.{"\n\n"}Take your 360° photo from the centre of the room for best coverage.
      </Text>
      <Pressable style={styles.tooltipBtn} onPress={() => setShowTooltip360(false)}>
        <Text style={styles.tooltipBtnText}>Got it →</Text>
      </Pressable>
    </View>
  </Pressable>
</Modal>

<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Add Photos</Text>
<Text style={styles.subtitle}>Attach photos to checklist items</Text>

<View style={styles.metaCard}>
<Text style={styles.metaLine}>Job type: {currentJob.type}</Text>
<Text style={styles.metaLine}>Job: {currentJob.jobName}</Text>
<Text style={styles.metaLine}>Address: {currentJob.jobAddr}</Text>
</View>
</View>

{/* Multi-day timeline */}
{allWorkDays.length > 0 && (
  <View style={styles.timelineWrap}>
    <Text style={styles.timelineHeading}>PROJECT TIMELINE</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineRow}>
      {allWorkDays.map((dateStr, i) => {
        const isToday = dateStr === todayStr;
        const d = new Date(dateStr);
        return (
          <View key={dateStr} style={[styles.timelineItem, { marginHorizontal: 20 }]}>
            {i > 0 && <View style={styles.timelineConnector} />}
            <View style={[styles.timelineDot, isToday && styles.timelineDotActive]} />
            <Text style={[styles.timelineDayLabel, isToday && styles.timelineDayLabelActive]}>
              Day {i + 1}
            </Text>
            <Text style={styles.timelineDateLabel}>
              {d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </Text>
          </View>
        );
      })}
      {!allWorkDays.includes(todayStr) && (
        <View style={[styles.timelineItem, { marginHorizontal: 20 }]}>
          {allWorkDays.length > 0 && <View style={styles.timelineConnector} />}
          <View style={[styles.timelineDot, styles.timelineDotActive]} />
          <Text style={[styles.timelineDayLabel, styles.timelineDayLabelActive]}>
            Day {allWorkDays.length + 1}
          </Text>
          <Text style={styles.timelineDateLabel}>Today</Text>
        </View>
      )}
    </ScrollView>
  </View>
)}

<ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
{HOTWATER_ITEMS.map((item) => {
const itemPhotos = photoMap[item.id] || [];
const itemDone = !!checked[item.id];

const isFocused = focusItem && (focusItem.toLowerCase().includes(item.title.toLowerCase()) || item.title.toLowerCase().includes(focusItem.toLowerCase()));
return (
<View key={item.id} ref={(r) => { itemRefs.current[item.id] = r; }} style={[styles.card, isFocused ? styles.cardFocused : null]}>
<View style={styles.itemTopRow}>
<View style={styles.itemTextWrap}>
<Text style={styles.itemTitle}>{item.title}</Text>
<Text style={styles.itemSub}>
{item.subtitle} • {itemPhotos.length} photo{itemPhotos.length === 1 ? "" : "s"}
</Text>
</View>

<View style={[styles.badge, itemDone ? styles.badgeOk : styles.badgeReq]}>
<Text style={styles.badgeText}>{itemDone ? "OK" : "REQ"}</Text>
</View>
</View>

<Pressable
style={styles.addBtn}
onPress={() => addPhotoForItem(item.id)}
disabled={loading}
>
<Text style={styles.addBtnText}>+ Add Photo</Text>
</Pressable>

{/* 360° Photo button */}
<Pressable
  style={styles.btn360}
  onPress={() => addPhoto360ForItem(item.id)}
  disabled={loading}
>
  <View style={styles.btn360Ring}>
    <Text style={styles.btn360Text}>360°</Text>
  </View>
  <Text style={styles.btn360Label}>Add 360° Photo</Text>
</Pressable>

{/* Mark on Floor Plan button (if floor plan exists) */}
{floorPlanUri && (
  <Pressable
    style={styles.planBtn}
    onPress={() => router.push({ pathname: "/plumbing/floor-plan-pin", params: { itemId: item.id, itemLabel: item.title } })}
    disabled={loading}
  >
    <Text style={styles.planBtnText}>📍 Mark on Floor Plan</Text>
  </Pressable>
)}

{itemPhotos.length > 0 && (
<View style={styles.photoGrid}>
{itemPhotos.map((uri, i) => {
const meta = (photoMeta[item.id] || []).find((m) => m.uri === uri);
return (
<View key={`${item.id}-${uri}-${i}`} style={styles.photoWrap}>
{/* Tappable photo for zoom */}
<Pressable onPress={() => setPreviewUri(uri)} disabled={loading}>
<Image source={{ uri }} style={styles.photo} />
</Pressable>

{/* Count badge */}
<View style={styles.countBadge}>
<Text style={styles.countBadgeText}>{i + 1}/{itemPhotos.length}</Text>
</View>

{/* Hash shield */}
{meta?.hash ? (
<View style={styles.shield}>
<Text style={styles.shieldText}>🛡</Text>
</View>
) : null}

{/* Remove */}
<Pressable
style={styles.remove}
onPress={() => removePhotoForItem(item.id, uri)}
disabled={loading}
>
<Text style={styles.removeText}>×</Text>
</Pressable>

{/* Before / After + rotate */}
<View style={styles.roleRow}>
<Pressable
style={[styles.roleBtn, meta?.role === "before" && styles.roleBtnBefore]}
onPress={() => setPhotoRole(item.id, uri, "before")}
disabled={loading}
>
<Text style={[styles.roleBtnText, meta?.role === "before" && styles.roleBtnTextActive]}>B</Text>
</Pressable>
<Pressable
style={[styles.roleBtn, meta?.role === "after" && styles.roleBtnAfter]}
onPress={() => setPhotoRole(item.id, uri, "after")}
disabled={loading}
>
<Text style={[styles.roleBtnText, meta?.role === "after" && styles.roleBtnTextActive]}>A</Text>
</Pressable>
<Pressable
style={styles.roleBtn}
onPress={() => rotatePhoto(item.id, uri)}
disabled={loading}
>
<Text style={styles.roleBtnText}>↻</Text>
</Pressable>
</View>

{/* Reorder arrows */}
{itemPhotos.length > 1 && (
<View style={styles.reorderRow}>
<Pressable
style={[styles.reorderBtn, i === 0 && { opacity: 0.3 }]}
onPress={() => movePhoto(item.id, i, -1)}
disabled={loading || i === 0}
>
<Text style={styles.reorderText}>◀</Text>
</Pressable>
<Pressable
style={[styles.reorderBtn, i === itemPhotos.length - 1 && { opacity: 0.3 }]}
onPress={() => movePhoto(item.id, i, 1)}
disabled={loading || i === itemPhotos.length - 1}
>
<Text style={styles.reorderText}>▶</Text>
</Pressable>
</View>
)}
</View>
);
})}
</View>
)}

{/* 360° Photos */}
{(photo360Map[item.id] || []).length > 0 && (
  <View style={styles.photos360Wrap}>
    <Text style={styles.photos360Label}>360° PHOTOS</Text>
    <View style={styles.photoGrid}>
      {(photo360Map[item.id] || []).map((uri, i) => (
        <View key={`360-${item.id}-${i}`} style={styles.photoWrap}>
          <Pressable onPress={() => setPreviewUri(uri)} disabled={loading}>
            <Image source={{ uri }} style={styles.photo} />
          </Pressable>
          <View style={styles.badge360}>
            <Text style={styles.badge360Text}>360°</Text>
          </View>
          <Pressable
            style={styles.remove}
            onPress={() => remove360Photo(item.id, uri)}
            disabled={loading}
          >
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  </View>
)}
</View>
);
})}

<Pressable
style={[styles.aiBtn, (loading || totalRequiredPhotosAdded < 2) && { opacity: 0.6 }]}
onPress={runAI}
disabled={loading || totalRequiredPhotosAdded < 2}
>
{loading ? (
<View style={styles.loadingRow}>
<ActivityIndicator />
<Text style={styles.aiText}>Analysing photos against Victorian compliance standards...</Text>
</View>
) : (
<Text style={styles.aiText}>Run AI Overview →</Text>
)}
</Pressable>

<Pressable onPress={() => router.back()} style={styles.back}>
<Text style={styles.backText}>← Back</Text>
</Pressable>
</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
loadingScreen: {
flex: 1,
backgroundColor: "#07152b",
alignItems: "center",
justifyContent: "center",
gap: 10,
},
loadingText: { color: "rgba(255,255,255,0.7)" },
screen: { flex: 1, backgroundColor: "#07152b" },
header: { paddingTop: 18, paddingHorizontal: 18 },
brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
subtitle: { marginTop: 4, color: "rgba(255,255,255,0.75)" },
metaCard: {
marginTop: 12,
borderRadius: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 12,
gap: 4,
},
metaLine: { color: "rgba(255,255,255,0.82)", fontSize: 13 },
body: { padding: 18, gap: 12 },
card: {
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
backgroundColor: "rgba(255,255,255,0.04)",
padding: 14,
},
cardFocused: {
  borderColor: "#f97316",
  borderWidth: 2,
  backgroundColor: "rgba(249,115,22,0.08)",
},
itemTopRow: {
flexDirection: "row",
alignItems: "center",
},
itemTextWrap: {
flex: 1,
paddingRight: 10,
},
itemTitle: {
color: "white",
fontWeight: "800",
fontSize: 15,
},
itemSub: {
color: "rgba(255,255,255,0.6)",
fontSize: 12,
marginTop: 2,
},
badge: {
minWidth: 58,
borderRadius: 20,
paddingHorizontal: 12,
paddingVertical: 6,
alignItems: "center",
},
badgeReq: {
backgroundColor: "rgba(249,115,22,0.25)",
},
badgeOk: {
backgroundColor: "rgba(34,197,94,0.25)",
},
badgeText: {
color: "white",
fontWeight: "900",
},
addBtn: {
marginTop: 12,
backgroundColor: "#f97316",
borderRadius: 12,
paddingVertical: 12,
alignItems: "center",
},
addBtnText: {
color: "#0b1220",
fontWeight: "900",
},
photoGrid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginTop: 12,
},
photoWrap: {
position: "relative",
width: 96,
},
photo: {
width: 96,
height: 96,
borderRadius: 10,
},
shield: {
position: "absolute",
bottom: 4,
left: 4,
backgroundColor: "rgba(34,197,94,0.85)",
borderRadius: 8,
paddingHorizontal: 4,
paddingVertical: 1,
},
shieldText: { fontSize: 11 },
remove: {
position: "absolute",
top: 6,
right: 6,
width: 24,
height: 24,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(0,0,0,0.55)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.18)",
},
removeText: {
color: "white",
fontSize: 16,
fontWeight: "900",
marginTop: -1,
},
roleRow: {
flexDirection: "row",
gap: 4,
marginTop: 5,
justifyContent: "center",
},
roleBtn: {
flex: 1,
paddingVertical: 3,
borderRadius: 6,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
roleBtnBefore: {
backgroundColor: "rgba(217,119,6,0.35)",
borderColor: "#d97706",
},
roleBtnAfter: {
backgroundColor: "rgba(34,197,94,0.30)",
borderColor: "#22c55e",
},
roleBtnText: {
color: "rgba(255,255,255,0.55)",
fontSize: 11,
fontWeight: "900",
},
roleBtnTextActive: {
color: "white",
},
aiBtn: {
marginTop: 8,
borderRadius: 14,
paddingVertical: 14,
alignItems: "center",
backgroundColor: "rgba(249,115,22,0.20)",
borderWidth: 1,
borderColor: "rgba(249,115,22,0.35)",
},
aiText: {
color: "white",
fontWeight: "900",
},
loadingRow: {
flexDirection: "row",
alignItems: "center",
gap: 10,
},
back: {
marginTop: 6,
alignItems: "center",
},
backText: {
color: "rgba(255,255,255,0.6)",
},
modalOverlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.92)",
alignItems: "center",
justifyContent: "center",
gap: 16,
},
modalImage: {
borderRadius: 12,
},
modalDismiss: {
color: "rgba(255,255,255,0.45)",
fontWeight: "700",
fontSize: 13,
},
countBadge: {
position: "absolute",
top: 4,
left: 4,
backgroundColor: "rgba(0,0,0,0.60)",
borderRadius: 6,
paddingHorizontal: 5,
paddingVertical: 2,
},
countBadgeText: {
color: "white",
fontSize: 10,
fontWeight: "700",
},
reorderRow: {
flexDirection: "row",
gap: 4,
marginTop: 4,
justifyContent: "center",
},
reorderBtn: {
flex: 1,
paddingVertical: 3,
borderRadius: 6,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
reorderText: {
color: "rgba(255,255,255,0.55)",
fontSize: 11,
},
  // 360° button
  btn360: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  btn360Ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  btn360Text: { color: "#f97316", fontWeight: "900", fontSize: 11, letterSpacing: -0.5 },
  btn360Label: { color: "#f97316", fontWeight: "800", fontSize: 13 },
  planBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.40)",
    backgroundColor: "rgba(96,165,250,0.08)",
    alignItems: "center",
  },
  planBtnText: { color: "#60a5fa", fontWeight: "700", fontSize: 13 },
  photos360Wrap: { marginTop: 10 },
  photos360Label: {
    color: "#f97316",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 6,
  },
  badge360: {
    position: "absolute",
    top: 4,
    right: 28,
    backgroundColor: "rgba(249,115,22,0.90)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badge360Text: { color: "white", fontSize: 9, fontWeight: "900" },
  // Day timeline
  timelineWrap: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
  },
  timelineHeading: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  timelineRow: { paddingHorizontal: 18, gap: 0, alignItems: "center" },
  timelineItem: { alignItems: "center", position: "relative" },
  timelineConnector: {
    position: "absolute",
    left: -24,
    top: 9,
    width: 48,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.20)",
  },
  timelineDotActive: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  timelineDayLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },
  timelineDayLabelActive: { color: "#f97316" },
  timelineDateLabel: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 9,
    marginTop: 2,
  },
  // Tooltip
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  tooltipCard: {
    backgroundColor: "#0d1f3d",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    padding: 24,
    gap: 12,
    alignItems: "center",
    maxWidth: 340,
  },
  tooltipEmoji: { fontSize: 40 },
  tooltipTitle: { color: "white", fontWeight: "900", fontSize: 18, textAlign: "center" },
  tooltipBody: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 22, textAlign: "center" },
  tooltipBtn: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  tooltipBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 15 },
});