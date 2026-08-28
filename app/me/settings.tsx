import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
export default function ScreenMY04() {
  useScreenView(SCREENS.MY_SETTINGS);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '설정' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">MY-04</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">설정</Text>
        <Text className="mt-1 text-xs text-gray-400">/me/settings</Text>
      </View>
    </ScrollView>
  );
}
