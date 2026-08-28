import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
export default function ScreenMY02() {
  useScreenView(SCREENS.MY_TRIPS);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '나의 여행' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">MY-02</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">나의 여행</Text>
        <Text className="mt-1 text-xs text-gray-400">/me/trips</Text>
        <View className="mt-8 gap-3">
          <Text className="mb-1 text-xs font-medium text-gray-500">이동</Text>
          <Link href={`/trips/b0000000-0000-4000-8000-000000000001`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ TRIP-HOME-02 종료 상태 여행 홈</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
