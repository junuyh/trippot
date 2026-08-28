import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
export default function ScreenMY03() {
  // TODO: 이 화면은 lib/analytics/events.ts 의 SCREENS 에 값이 없어 useScreenView 를 부르지 않는다.
  //       docs/06_이벤트로그정의서_v2.md §7-0 '아직 screen_name 값이 없는 화면' 참조.
  //       화면 구현(2026-09-07~) 시점에 docs/06 을 v3로 갱신한 뒤 추가한다. 임의로 만들지 않는다.

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '나의 커뮤니티 활동' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">MY-03</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">나의 커뮤니티 활동</Text>
        <Text className="mt-1 text-xs text-gray-400">/me/community</Text>
      </View>
    </ScrollView>
  );
}
