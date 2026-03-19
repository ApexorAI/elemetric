import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Logged storage adapter — confirms session read/write is working
const loggedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await AsyncStorage.getItem(key);
    console.log(`[SupaStorage] getItem("${key}") →`, value ? `[${value.length} chars]` : "null");
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    console.log(`[SupaStorage] setItem("${key}") ← [${value.length} chars]`);
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    console.log(`[SupaStorage] removeItem("${key}")`);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: loggedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
