import React, { useCallback, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
Image,
ScrollView,
Alert,
ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { hashBase64, captureTimestamp } from "@/lib/photoHash";

const API_BASE = "https://elemetric-ai-production.up.railway.app";
const CHECKLIST_KEY = "elemetric_current_checklist";
const REVIEW_PHOTOS_FILE = `${FileSystem.documentDirectory}review-photos.json`;

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
};

type ReviewPhoto = {
label: string;
uri: string;
base64: string;
mime: string;
hash?: string;
capturedAt?: string;
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

const totalRequiredPhotosAdded = useMemo(() => {
return Object.values(photoMap).reduce((sum, arr) => sum + (arr?.length || 0), 0);
}, [photoMap]);

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

const addPhotoForItem = async (itemId: string) => {
try {
const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!perm.granted) {
Alert.alert("Permission needed", "Please allow photo access.");
return;
}

const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
quality: 1,
});

if (result.canceled) return;

const asset = result.assets?.[0];
if (!asset?.uri) {
Alert.alert("Photo error", "Could not read selected image.");
return;
}

// Generate SHA-256 hash at capture time
const ts = captureTimestamp();
let hash = "";
try {
const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
hash = await hashBase64(b64);
} catch {}

const nextPhotoMap = {
...photoMap,
[itemId]: [...(photoMap[itemId] || []), asset.uri],
};
const nextPhotoMeta = {
...photoMeta,
[itemId]: [...(photoMeta[itemId] || []), { uri: asset.uri, hash, capturedAt: ts }],
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
Alert.alert("Photo error", e?.message ?? "Unknown error");
}
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

const convertToJpeg = async (uri: string) => {
const result = await ImageManipulator.manipulateAsync(uri, [], {
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
Alert.alert("More photos needed", "Please add at least 2 photos before running AI analysis.");
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
Alert.alert("AI Error", e?.message ?? "Unknown error");
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

return (
<View style={styles.screen}>
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

<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
{HOTWATER_ITEMS.map((item) => {
const itemPhotos = photoMap[item.id] || [];
const itemDone = !!checked[item.id];

return (
<View key={item.id} style={styles.card}>
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

{itemPhotos.length > 0 && (
<View style={styles.photoGrid}>
{itemPhotos.map((uri, i) => {
const meta = (photoMeta[item.id] || []).find((m) => m.uri === uri);
return (
<View key={`${item.id}-${uri}-${i}`} style={styles.photoWrap}>
<Image source={{ uri }} style={styles.photo} />
{meta?.hash ? (
<View style={styles.shield}>
<Text style={styles.shieldText}>🛡</Text>
</View>
) : null}
<Pressable
style={styles.remove}
onPress={() => removePhotoForItem(item.id, uri)}
disabled={loading}
>
<Text style={styles.removeText}>×</Text>
</Pressable>
</View>
);
})}
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
title: { marginTop: 6, color: "white", fontSize: 22, fontWeight: "900" },
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
});