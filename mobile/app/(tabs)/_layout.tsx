import { Tabs, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const [isEmployer, setIsEmployer] = useState(false);

  // Re-check role on every focus so tabs update as soon as role changes.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          setIsEmployer(profile?.role === 'employer');
        } catch {}
      })();
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
      {/* ── Individual plumber tabs ── */}
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
      <Tabs.Screen
        name="liability-timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="shield.fill" color={color} />,
          tabBarAccessibilityLabel: 'Liability timeline',
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="wrench.fill" color={color} />,
          tabBarAccessibilityLabel: 'Tools and features',
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

      {/* ── Employer-only tabs ── */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
          tabBarAccessibilityLabel: 'Job calendar',
          // Only show tab bar button for employers
          tabBarButton: isEmployer ? undefined : () => null,
          tabBarStyle: isEmployer ? undefined : { display: 'none' },
        }}
      />

      {/* ── Hidden screens (accessible via push, not tab bar) ── */}
      <Tabs.Screen name="visualiser" options={{ href: null }} />
    </Tabs>
  );
}
