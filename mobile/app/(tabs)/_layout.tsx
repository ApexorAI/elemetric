import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.40)',
        tabBarStyle: {
          backgroundColor: '#07152b',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}>
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
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar.badge.clock" color={color} />,
          tabBarAccessibilityLabel: 'Job calendar',
        }}
      />
      <Tabs.Screen
        name="liability-timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
          tabBarAccessibilityLabel: 'Liability timeline',
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
      <Tabs.Screen
        name="visualiser"
        options={{ href: null }}
      />
    </Tabs>
  );
}
