import React, { useEffect, useMemo, useState } from "react";
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

type ChecklistItem = {
id: string;
title: string;
subtitle: string;
kind: "photo" | "info";
};

type CurrentJob = {
type: string;
jobName: string;
jobAddr: string;
};

type ChecklistState = {
checked: Record<string, boolean>;
photoMap: Record<string, string[]>;
};

const HOTWATER_ITEMS: ChecklistItem[] = [
{
id: "before",
title: "Photo: Existing system (before)",
subtitle: "Photo required",
kind: "photo",
},
{
id: "ptr",
title: "Photo: PTR valve installed",
subtitle: "Photo required",
kind: "photo",
},
{
id: "tempering",
title: "Photo: Tempering valve",
subtitle: "Photo required",
kind: "photo",
},
{
id: "plate",
title: "Photo: Compliance plate / label",
subtitle: "Photo required",
kind: "photo",
},
{
id: "isolation",
title: "Photo: Isolation valve",
subtitle: "Photo required",
kind: "photo",
},
{
id: "pressure",
title: "Confirm: Pressure test completed",
subtitle: "Confirmation",
kind: "info",
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

useEffect(() => {
const loadData = async () => {
try {
const rawJob = await AsyncStorage.getItem("elemetric_current_job");
if (rawJob) {
const job: CurrentJob = JSON.parse(rawJob);
setJobName(job.jobName || "Untitled Job");
setJobAddr(job.jobAddr || "No address");
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
color: "rgba(255,255,255,0.7)",
},

screen: {
flex: 1,
backgroundColor: "#07152b",
},

header: {
paddingTop: 18,
paddingHorizontal: 18,
},

brand: {
color: "#f97316",
fontWeight: "900",
fontSize: 18,
letterSpacing: 2,
},

title: {
color: "white",
fontSize: 28,
fontWeight: "900",
marginTop: 8,
},

job: {
color: "rgba(255,255,255,0.7)",
marginTop: 6,
},

progress: {
color: "rgba(255,255,255,0.7)",
marginTop: 4,
fontWeight: "700",
},

body: {
flex: 1,
},

bodyContent: {
padding: 18,
},

card: {
backgroundColor: "rgba(255,255,255,0.04)",
borderRadius: 16,
padding: 16,
marginBottom: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
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
borderColor: "rgba(255,255,255,0.2)",
marginRight: 12,
alignItems: "center",
justifyContent: "center",
},

checkboxOn: {
backgroundColor: "rgba(34,197,94,0.25)",
borderColor: "rgba(34,197,94,0.45)",
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
fontWeight: "800",
fontSize: 15,
},

sub: {
color: "rgba(255,255,255,0.6)",
fontSize: 12,
marginTop: 2,
},

badgeBase: {
paddingHorizontal: 12,
paddingVertical: 6,
borderRadius: 20,
minWidth: 58,
alignItems: "center",
},

badgeReq: {
backgroundColor: "rgba(249,115,22,0.25)",
},

badgeOk: {
backgroundColor: "rgba(34,197,94,0.25)",
},

infoBadge: {
backgroundColor: "rgba(255,255,255,0.15)",
},

badgeText: {
color: "white",
fontWeight: "900",
},

next: {
backgroundColor: "#f97316",
padding: 18,
borderRadius: 18,
marginTop: 8,
alignItems: "center",
},

nextText: {
fontWeight: "900",
fontSize: 16,
color: "#0b1220",
},

back: {
marginTop: 14,
alignItems: "center",
},

backText: {
color: "rgba(255,255,255,0.7)",
},
});