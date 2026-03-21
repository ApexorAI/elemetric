import React, { useEffect, useMemo, useRef, useState } from "react";
import {
View,
Text,
StyleSheet,
Pressable,
ScrollView,
ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

type ChecklistItem = {
id: string;
title: string;
subtitle: string;
kind: "photo" | "info";
hint?: string;
standard?: string;
};

type CurrentJob = {
type: string;
jobName: string;
jobAddr: string;
startTime?: string;
};

type ChecklistState = {
checked: Record<string, boolean>;
photoMap: Record<string, string[]>;
};

const HOTWATER_ITEMS: ChecklistItem[] = [
{
id: "before",
title: "Existing system (before)",
subtitle: "Photo required",
kind: "photo",
hint: "Photo of the old unit before you remove or disconnect anything.",
standard: "AS/NZS 3500.1:2025 §3.1",
},
{
id: "ptr",
title: "PTR valve installed",
subtitle: "Photo required",
kind: "photo",
hint: "The small valve on the side of the hot water unit with a pipe going to the floor. It pops open if pressure gets too high.",
standard: "AS/NZS 3500.1:2025 §6.4",
},
{
id: "tempering",
title: "Tempering valve",
subtitle: "Photo required",
kind: "photo",
hint: "The valve that mixes cold water in so the hot water at the tap is never scalding. Usually under the unit or at the first outlet.",
standard: "AS/NZS 3500.1:2025 §6.6",
},
{
id: "plate",
title: "Compliance plate / label",
subtitle: "Photo required",
kind: "photo",
hint: "The label stuck to the side of the unit showing make, model, serial number, and gas/electrical rating.",
standard: "AS/NZS 3500.1:2025 §6.2",
},
{
id: "isolation",
title: "Isolation valve",
subtitle: "Photo required",
kind: "photo",
hint: "The tap that turns the water supply to the unit on or off. Show it clearly labelled or tagged.",
standard: "AS/NZS 3500.1:2025 §3.8",
},
{
id: "pressure",
title: "Confirm: Pressure test completed",
subtitle: "Confirmation",
kind: "info",
hint: "Confirm you've pressure tested the installation before signing off.",
standard: "AS/NZS 3500.1:2025 §4.2",
},
];

const CHECKLIST_KEY = "elemetric_current_checklist";

export default function Checklist() {
const router = useRouter();

const [loaded, setLoaded] = useState(false);
const [jobName, setJobName] = useState("Untitled Job");
const [jobAddr, setJobAddr] = useState("No address");
const [checked, setChecked] = useState<Record<string, boolean>>({});
const [photoMap, setPhotoMap] = useState<Record<string, string[]>>({});
const [startTime, setStartTime] = useState<string | null>(null);
const [elapsed, setElapsed] = useState("00:00:00");
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
const loadData = async () => {
try {
const rawJob = await AsyncStorage.getItem("elemetric_current_job");
if (rawJob) {
const job: CurrentJob = JSON.parse(rawJob);
setJobName(job.jobName || "Untitled Job");
setJobAddr(job.jobAddr || "No address");
if (job.startTime) setStartTime(job.startTime);
}

const rawChecklist = await AsyncStorage.getItem(CHECKLIST_KEY);
if (rawChecklist) {
const parsed: ChecklistState = JSON.parse(rawChecklist);
setChecked(parsed.checked || {});
setPhotoMap(parsed.photoMap || {});
} else {
const blankPhotoMap: Record<string, string[]> = {};
HOTWATER_ITEMS.forEach((item) => {
if (item.kind === "photo") blankPhotoMap[item.id] = [];
});
setPhotoMap(blankPhotoMap);
}
} catch {
// keep defaults
} finally {
setLoaded(true);
}
};

loadData();
}, []);

useEffect(() => {
  if (!startTime) return;
  const tick = () => {
    const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, "0");
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");
    setElapsed(`${h}:${m}:${s}`);
  };
  tick();
  timerRef.current = setInterval(tick, 1000);
  return () => { if (timerRef.current) clearInterval(timerRef.current); };
}, [startTime]);

const requiredTotal = useMemo(
() => HOTWATER_ITEMS.filter((item) => item.kind === "photo").length,
[]
);

const requiredDone = useMemo(
() =>
HOTWATER_ITEMS.filter((item) => item.kind === "photo" && checked[item.id]).length,
[checked]
);

const toggleItem = async (id: string) => {
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const nextChecked = {
...checked,
[id]: !checked[id],
};

setChecked(nextChecked);

try {
await AsyncStorage.setItem(
CHECKLIST_KEY,
JSON.stringify({
checked: nextChecked,
photoMap,
})
);
} catch {}
};

const goPhotos = async () => {
try {
await AsyncStorage.setItem(
CHECKLIST_KEY,
JSON.stringify({
checked,
photoMap,
})
);
} catch {}

router.push("/plumbing/photos");
};

if (!loaded) {
return (
<View style={styles.loadingScreen}>
<ActivityIndicator />
<Text style={styles.loadingText}>Loading checklist…</Text>
</View>
);
}

return (
<View style={styles.screen}>
<View style={styles.header}>
<Text style={styles.brand}>ELEMETRIC</Text>
<Text style={styles.title}>Checklist</Text>

<Text style={styles.job}>
{jobName} • {jobAddr}
</Text>

<Text style={styles.progress}>
Required photos: {requiredDone}/{requiredTotal}
</Text>
{startTime && (
  <Text style={styles.timer}>Time on site: {elapsed}</Text>
)}
</View>

<ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
{HOTWATER_ITEMS.map((item) => {
const isChecked = !!checked[item.id];
const isPhoto = item.kind === "photo";
const photoCount = photoMap[item.id]?.length || 0;

return (
<Pressable
key={item.id}
style={styles.card}
onPress={() => toggleItem(item.id)}
>
<View style={styles.row}>
<View style={[styles.checkbox, isChecked && styles.checkboxOn]}>
{isChecked ? <Text style={styles.tick}>✓</Text> : null}
</View>

<View style={styles.textWrap}>
<Text style={styles.item}>{item.title}</Text>
<Text style={styles.sub}>
{item.subtitle}
{isPhoto && photoCount > 0 ? ` • ${photoCount} photo${photoCount > 1 ? "s" : ""}` : ""}
</Text>
{item.standard && <Text style={styles.itemStandard}>{item.standard}</Text>}
{item.hint && <Text style={styles.itemHint}>{item.hint}</Text>}
</View>

<View
style={[
styles.badgeBase,
isPhoto
? isChecked
? styles.badgeOk
: styles.badgeReq
: styles.infoBadge,
]}
>
<Text style={styles.badgeText}>
{isPhoto ? (isChecked ? "OK" : "REQ") : "INFO"}
</Text>
</View>
</View>
</Pressable>
);
})}

<Pressable style={styles.next} onPress={goPhotos}>
<Text style={styles.nextText}>Next: Add Photos →</Text>
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
loadingText: {
color: "rgba(255,255,255,0.55)",
},

screen: {
flex: 1,
backgroundColor: "#07152b",
},

header: {
paddingTop: 20,
paddingHorizontal: 20,
},

brand: {
color: "#f97316",
fontWeight: "900",
fontSize: 18,
letterSpacing: 2,
},

title: {
color: "white",
fontSize: 22,
fontWeight: "900",
marginTop: 8,
},

job: {
color: "rgba(255,255,255,0.55)",
marginTop: 6,
fontSize: 13,
},

progress: {
color: "rgba(255,255,255,0.55)",
marginTop: 4,
fontWeight: "500",
fontSize: 13,
},

timer: {
color: "#f97316",
marginTop: 4,
fontWeight: "700",
fontSize: 13,
letterSpacing: 0.5,
},

body: {
flex: 1,
},

bodyContent: {
padding: 20,
},

card: {
backgroundColor: "#0f2035",
borderRadius: 16,
padding: 16,
marginBottom: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.07)",
},

row: {
flexDirection: "row",
alignItems: "center",
},

checkbox: {
width: 28,
height: 28,
borderRadius: 6,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.20)",
marginRight: 12,
alignItems: "center",
justifyContent: "center",
},

checkboxOn: {
backgroundColor: "#22c55e",
borderColor: "#22c55e",
},

tick: {
color: "white",
fontWeight: "900",
fontSize: 16,
},

textWrap: {
flex: 1,
paddingRight: 10,
},

item: {
color: "white",
fontWeight: "700",
fontSize: 15,
},

sub: {
color: "rgba(255,255,255,0.55)",
fontSize: 13,
marginTop: 2,
},

itemStandard: {
color: "rgba(249,115,22,0.7)",
fontSize: 10,
fontWeight: "700",
letterSpacing: 0.3,
marginTop: 2,
},
itemHint: {
color: "rgba(255,255,255,0.35)",
fontSize: 12,
fontStyle: "italic",
marginTop: 2,
lineHeight: 16,
},

badgeBase: {
paddingHorizontal: 10,
paddingVertical: 4,
borderRadius: 20,
minWidth: 58,
alignItems: "center",
borderWidth: 1,
},

badgeReq: {
borderColor: "#f97316",
},

badgeOk: {
borderColor: "#22c55e",
},

infoBadge: {
borderColor: "rgba(255,255,255,0.20)",
},

badgeText: {
color: "white",
fontWeight: "700",
fontSize: 12,
},

next: {
backgroundColor: "#f97316",
borderRadius: 14,
height: 56,
marginTop: 8,
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 20,
},

nextText: {
fontWeight: "900",
fontSize: 15,
color: "#07152b",
},

back: {
marginTop: 14,
alignItems: "center",
},

backText: {
color: "rgba(255,255,255,0.55)",
},
});