import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "elemetric_onboarding_seen";

export default function Entry() {
const router = useRouter();

useEffect(() => {
const redirect = async () => {
const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
router.replace(seen ? "/login" : "/welcome");
};
redirect();
}, []);

return <View style={styles.screen} />;
}

const styles = StyleSheet.create({
screen: {
flex: 1,
backgroundColor: "#07152b",
},
});
