import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
export default function ScreenCOMM02() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  useScreenView(SCREENS.TIP_DETAIL);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '게시글/팁 상세' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">COMM-02</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">게시글/팁 상세</Text>
        <Text className="mt-1 text-xs text-gray-400">/community/posts/:postId</Text>
        <View className="mt-4 gap-1 rounded-lg bg-gray-100 px-3 py-2">
            <Text className="text-xs text-gray-500">postId: {postId}</Text>
        </View>
        <View className="mt-8 gap-3">
          <Text className="mb-1 text-xs font-medium text-gray-500">이동</Text>
          <Link href={`/community/posts/${postId}/purchase`} asChild>
            <Pressable className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100">
              <Text className="text-base text-gray-800">→ COMM-03 유료 팁 구매</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
