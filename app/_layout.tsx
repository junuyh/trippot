import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { initAnalytics } from '@/lib/analytics/track';

import '../global.css';

export default function RootLayout() {
  // 앱 시작 시 1회. anon_id 를 미리 발급해 첫 이벤트가 지연되지 않게 한다.
  // initAnalytics 는 멱등이라 Fast Refresh 로 다시 불려도 안전하다.
  useEffect(() => {
    void initAnalytics();
  }, []);

  return (
    <Stack screenOptions={{ headerBackTitle: '뒤로' }}>
      {/* 하단 탭 4개. (tabs) 는 URL 에 나타나지 않는다. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* 여행 생성 3단계는 자체 Stack 을 가진다. (app/trips/new/_layout.tsx)
          여기서 헤더를 끄지 않으면 헤더가 두 겹으로 그려진다. */}
      <Stack.Screen name="trips/new" options={{ headerShown: false }} />
    </Stack>
  );
}
