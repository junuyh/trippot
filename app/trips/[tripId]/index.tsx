import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { TRIP_STATUS } from '@/lib/constants/status';
export default function ScreenTRIPHOME01() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  // TRIP-HOME-01(진행)/02(종료)가 같은 라우트를 공유한다.
  // 실제 구현에서는 trip.status 를 넘긴다. 뼈대라 PLANNING 고정이다.
  useScreenView(SCREENS.TRIP_HOME, TRIP_STATUS.PLANNING);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '여행 홈' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">TRIP-HOME-01 / 02</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">여행 홈</Text>
        <Text className="mt-1 text-xs text-gray-400">/trips/:tripId</Text>
        <View className="mt-4 gap-1 rounded-lg bg-gray-100 px-3 py-2">
            <Text className="text-xs text-gray-500">tripId: {tripId}</Text>
        </View>
        <View className="mt-8 gap-3">
          <Text className="mb-1 text-xs font-medium text-gray-500">이동</Text>
          <Link href={`/trips/${tripId}/budget`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ BUDGET-01 예산 상세</Text>
            </Pressable>
          </Link>
          <Link href={`/trips/${tripId}/funds`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ FUND-01 여행자금/입출금</Text>
            </Pressable>
          </Link>
          <Link href={`/trips/${tripId}/contributions`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ CONTRIB-01 멤버 납부 현황</Text>
            </Pressable>
          </Link>
          <Link href={`/trips/${tripId}/settlement`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ SETTLE-01 여행 결산</Text>
            </Pressable>
          </Link>
          <Link href={`/trips/${tripId}/type-result`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ TYPE-01 여행 유형 결과</Text>
            </Pressable>
          </Link>
          <Link href={`/trips/${tripId}/insurance`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ INSURANCE-01 보험 제휴 안내</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
