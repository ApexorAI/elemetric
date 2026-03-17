import { Tabs, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Stage 2 unlocks when user generates their first PDF report.
// Key written in app/celebration.tsx and app/plumbing/ai-review.tsx.
const STAGE2_KEY = "elemetric_stage2_unlocked";

export default function TabLayout() {
  const [stage2, setStage2] = useState(false);

  // Re-check on every focus so the Tools tab appears as soon as the
  // celebration screen sets the key and returns to the tab bar.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(STAGE2_KEY).then((v) => {
        if (v === "true") setStage2(true);
      });
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.40)',
        tabBarStyle: {
          backgroundColor: '#07152b',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
          tabBarAccessibilityLabel: 'Home screen',
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="folder.fill" color={color} />,
          tabBarAccessibilityLabel: 'Saved jobs',
        }}
      />

      {/* Tools tab — invisible until Stage 2 unlocked */}
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="wrench.fill" color={color} />,
          tabBarAccessibilityLabel: 'Tools and features',
          // Hide from tab bar until unlocked; screen is still navigable
          tabBarButton: stage2 ? undefined : () => null,
          tabBarStyle: stage2 ? undefined : { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
          tabBarAccessibilityLabel: 'Your profile',
        }}
      />

      {/* ── Hidden screens (accessible via push, not tab bar) ── */}
      <Tabs.Screen name="calendar"          options={{ href: null }} />
      <Tabs.Screen name="liability-timeline" options={{ href: null }} />
      <Tabs.Screen name="visualiser"         options={{ href: null }} />
    </Tabs>
  );
}
