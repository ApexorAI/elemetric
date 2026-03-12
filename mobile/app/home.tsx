import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function Home() {

const router = useRouter();

return (
<View style={styles.container}>

<Text style={styles.logo}>ELEMETRIC</Text>

<Text style={styles.subtitle}>
What would you like to do?
</Text>

<Pressable
style={styles.button}
onPress={() => router.push("/trade")}
>
<Text style={styles.buttonText}>New Job</Text>
</Pressable>

<Pressable
style={styles.button}
onPress={() => router.push("/plumbing/jobs")}
>
<Text style={styles.buttonText}>Past Jobs</Text>
</Pressable>

<Pressable
style={styles.disabled}
>
<Text style={styles.disabledText}>
Electrical (Coming Soon)
</Text>
</Pressable>

</View>
);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#07152b",
padding:30,
justifyContent:"center"
},

logo:{
fontSize:38,
fontWeight:"900",
color:"#f97316",
marginBottom:10
},

subtitle:{
color:"white",
fontSize:18,
marginBottom:40
},

button:{
backgroundColor:"#0d1f3d",
padding:18,
borderRadius:12,
marginBottom:16
},

buttonText:{
color:"white",
fontSize:18,
fontWeight:"700"
},

disabled:{
backgroundColor:"#091327",
padding:18,
borderRadius:12
},

disabledText:{
color:"#666",
fontSize:18,
fontWeight:"700"
}

});