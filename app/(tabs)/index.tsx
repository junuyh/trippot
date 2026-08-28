import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// 여기서 <Stack.Screen options={{ title }} /> 을 쓰면 Tabs 스크린 옵션을 덮어써서
// 하단 탭 라벨까지 바뀐다.
export default function ScreenHOME01() {
  useScreenView(SCREENS.HOME);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">HOME-01</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">홈</Text>
        <Text className="mt-1 text-xs text-gray-400">/</Text>
        <View className="mt-8 gap-3">
          <Text className="mb-1 text-xs font-medium text-gray-500">이동</Text>
          <Link href={'/trips/new/owner'} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ TRIP-01 여행 생성</Text>
            </Pressable>
          </Link>
          <Link href={`/trips/b0000000-0000-4000-8000-000000000001`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ TRIP-HOME-01 여행 준비 홈</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
