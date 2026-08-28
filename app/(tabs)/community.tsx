import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
export default function ScreenCOMM01() {
  useScreenView(SCREENS.TIP_LIST);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '커뮤니티 홈' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">COMM-01</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">커뮤니티 홈</Text>
        <Text className="mt-1 text-xs text-gray-400">/community</Text>
        <View className="mt-8 gap-3">
          <Text className="mb-1 text-xs font-medium text-gray-500">이동</Text>
          <Link href={'/community/posts/0f000000-0000-4000-8000-000000000001'} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ COMM-02 게시글/팁 상세</Text>
            </Pressable>
          </Link>
          <Link href={'/community/write'} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ COMM-04 게시글/팁 작성</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
