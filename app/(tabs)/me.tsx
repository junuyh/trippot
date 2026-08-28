import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
export default function ScreenMY01() {
  useScreenView(SCREENS.MY_PAGE);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '마이페이지' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">MY-01</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">마이페이지</Text>
        <Text className="mt-1 text-xs text-gray-400">/me</Text>
        <View className="mt-8 gap-3">
          <Text className="mb-1 text-xs font-medium text-gray-500">이동</Text>
          <Link href={'/me/trips'} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ MY-02 나의 여행</Text>
            </Pressable>
          </Link>
          <Link href={'/me/community'} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ MY-03 나의 커뮤니티 활동</Text>
            </Pressable>
          </Link>
          <Link href={'/me/settings'} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ MY-04 설정</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
