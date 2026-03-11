import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function Login() {
const router = useRouter();

return (
<View style={styles.container}>

<Text style={styles.logo}>ELEMETRIC</Text>

<Text style={styles.title}>Login</Text>

<TextInput
style={styles.input}
placeholder="Email"
placeholderTextColor="#888"
/>

<TextInput
style={styles.input}
placeholder="Password"
placeholderTextColor="#888"
secureTextEntry
/>

<Pressable
style={styles.button}
onPress={() => router.replace("/home")}
>
<Text style={styles.buttonText}>Sign In</Text>
</Pressable>

</View>
);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#07152b",
justifyContent:"center",
padding:30
},

logo:{
fontSize:32,
fontWeight:"900",
color:"#f97316",
marginBottom:30
},

title:{
fontSize:28,
fontWeight:"800",
color:"white",
marginBottom:20
},

input:{
backgroundColor:"#0d1f3d",
padding:16,
borderRadius:10,
marginBottom:16,
color:"white"
},

button:{
backgroundColor:"#f97316",
padding:16,
borderRadius:10,
alignItems:"center"
},

buttonText:{
fontSize:18,
fontWeight:"800",
color:"#07152b"
}

});