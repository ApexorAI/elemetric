import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="visualiser"
        options={{
          title: 'Visualise',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
          tabBarLabel: ({ color }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ color, fontSize: 10, fontWeight: '600' }}>Visualise</Text>
              <View style={{ backgroundColor: '#f97316', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
                <Text style={{ color: '#0b1220', fontSize: 7, fontWeight: '900' }}>BETA</Text>
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="liability-timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
