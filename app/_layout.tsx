import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBackButton } from '@/components/ui';
import { initAnalytics } from '@/lib/analytics/track';

import '../global.css';

export default function RootLayout() {
  // 앱 시작 시 1회. anon_id 를 미리 발급해 첫 이벤트가 지연되지 않게 한다.
  // initAnalytics 는 멱등이라 Fast Refresh 로 다시 불려도 안전하다.
  useEffect(() => {
    void initAnalytics();
  }, []);

  return (
    // 스와이프 삭제 같은 제스처가 동작하려면 루트를 이걸로 감싸야 한다.
    // expo-router 가 gesture-handler 를 의존으로 갖고 있어 새 패키지는 아니다.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack
      screenOptions={{
        headerBackTitle: '뒤로',
        // 스와이프로도 뒤로 갈 수 있게 한다 (iOS 기본이지만 명시해 둔다)
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        // ⚠️ 뒤로 버튼을 직접 그린다.
        //    네이티브 헤더는 히스토리가 있을 때만 버튼을 그려서, 딥링크나
        //    앱의 첫 화면으로 들어오면 돌아갈 방법이 사라진다.
        headerLeft: () => <HeaderBackButton />,
      }}
    >
      {/* 하단 탭 4개. (tabs) 는 URL 에 나타나지 않는다. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* 여행 생성 3단계는 자체 Stack 을 가진다. (app/trips/new/_layout.tsx)
          여기서 헤더를 끄지 않으면 헤더가 두 겹으로 그려진다. */}
      <Stack.Screen name="trips/new" options={{ headerShown: false }} />
    </Stack>
    </GestureHandlerRootView>
  );
}
