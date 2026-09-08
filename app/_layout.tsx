import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBackButton, Loading } from '@/components/ui';
import { initAnalytics } from '@/lib/analytics/track';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';

import '../global.css';

/** 로그인 없이 볼 수 있는 화면. 이 안에서는 가드가 내보내지 않는다. */
const PUBLIC_SEGMENT = 'login';

/**
 * 로그인 상태에 따라 화면을 옮긴다.
 *
 * ⚠️ 세션을 읽는 동안(loading)에는 **아무 화면도 그리지 않는다.** 로딩만 띄운다.
 *    그리고 나서 옮기면 로그인 화면과 홈이 번갈아 보이는 깜빡임이 없다.
 *    (expo-splash-screen 을 새로 넣지 않으려고 이 방식을 쓴다)
 *
 * ⚠️ 렌더 중에 <Redirect> 를 쓰지 않고 effect 에서 옮긴다. Redirect 는
 *    판단을 렌더마다 다시 하게 만들어 같은 깜빡임을 만든다.
 *
 * ⚠️ /login 에서 다시 /login 으로 보내지 않는다. 무한 반복이 된다.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const params = useLocalSearchParams<{ next?: string }>();
  const router = useRouter();

  const onLoginScreen = segments[0] === PUBLIC_SEGMENT;

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'signedOut' && !onLoginScreen) {
      // ⚠️ 어디로 가려던 길이었는지 남긴다. 나중에 카카오톡 초대 링크로
      //    들어온 사람이 로그인 뒤 원래 링크로 돌아가야 한다.
      //    (초대 기능 자체는 이번 범위가 아니다)
      const next = `/${segments.join('/')}`;
      router.replace(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (status === 'signedIn' && onLoginScreen) {
      // 남겨 둔 목적지가 있으면 그리로, 없으면 홈으로.
      //
      // ⚠️ '/' 로 시작하는지만 보면 '//example.com' 이 통과한다. 그건 내부
      //    경로가 아니라 protocol-relative URL 이라 앱 밖을 가리킨다.
      //    '//' 를 함께 막아야 내부 경로만 남는다.
      const next = typeof params.next === 'string' ? params.next : null;
      const isInternalPath = next !== null && next.startsWith('/') && !next.startsWith('//');
      router.replace(isInternalPath ? (next as never) : '/');
    }
  }, [status, onLoginScreen, segments, params.next, router]);

  if (status === 'loading') {
    return (
      <View className="flex-1 bg-white">
        <Loading />
      </View>
    );
  }

  return <>{children}</>;
}

function RootStack() {
  return (
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
      {/* 로그인. 헤더도 뒤로가기도 없다. */}
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />

      {/* 하단 탭 4개. (tabs) 는 URL 에 나타나지 않는다. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* 여행 생성 3단계는 자체 Stack 을 가진다. (app/trips/new/_layout.tsx)
          여기서 헤더를 끄지 않으면 헤더가 두 겹으로 그려진다. */}
      <Stack.Screen name="trips/new" options={{ headerShown: false }} />
    </Stack>
  );
}

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
      <AuthProvider>
        <AuthGate>
          <RootStack />
        </AuthGate>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
