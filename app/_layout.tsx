import { Stack, useLocalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBackButton, Loading } from '@/components/ui';
import { initAnalytics } from '@/lib/analytics/track';
import { AuthProvider, useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { savePendingInvite } from '@/lib/invite/pendingInvites';
import { PushInboxObserver } from '@/lib/notifications/PushInboxObserver';

import '../global.css';

/** 로그인 없이 볼 수 있는 화면. 이 안에서는 가드가 내보내지 않는다. */
const PUBLIC_SEGMENT = 'login';

/** '/invite/abc123' → 'abc123'. 초대 링크가 아니면 null. */
function inviteTokenFromPath(path: string): string | null {
  const match = /^\/invite\/([^/?#]+)$/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

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
  const { status, isPreview } = useAuth();
  const userId = useCurrentUserId();
  const segments = useSegments();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ next?: string }>();
  const router = useRouter();

  const onLoginScreen = segments[0] === PUBLIC_SEGMENT;

  /**
   * 내부 화면을 볼 수 있는 상태인가.
   *
   * ⚠️ 개발용 미리보기(__DEV__)도 여기에 포함된다. 실제 로그인은 아니지만
   *    Expo Go 에서 MY / GROUP 화면을 확인하려면 통과시켜야 한다.
   *    미리보기 자체는 AuthProvider 가 __DEV__ 에서만 켜준다.
   */
  const canEnter = status === 'signedIn' || isPreview;

  useEffect(() => {
    if (status === 'loading') return;

    if (!canEnter && !onLoginScreen) {
      // ⚠️ 어디로 가려던 길이었는지 남긴다. 카카오톡 초대 링크로 들어온 사람이
      //    로그인 뒤 원래 링크로 돌아가야 한다. (/invite/:token · 2026-09-11)
      //
      // ⚠️ segments 가 아니라 **pathname** 을 쓴다. useSegments() 는 파일 경로를
      //    그대로 돌려줘서 /invite/abc123 이 ['invite', '[token]'] 이 된다.
      //    그걸 이어 붙이면 '/invite/[token]' — 실제 토큰이 사라진다.
      //    usePathname() 은 정규화된 '/invite/abc123' 을 준다.
      //    (expo-router hooks.d.ts: "Segments are not normalized" / "Segments will be normalized")
      const next = pathname;
      router.replace(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (canEnter && onLoginScreen) {
      // 남겨 둔 목적지가 있으면 그리로, 없으면 홈으로.
      //
      // ⚠️ '/' 로 시작하는지만 보면 '//example.com' 이 통과한다. 그건 내부
      //    경로가 아니라 protocol-relative URL 이라 앱 밖을 가리킨다.
      //    '//' 를 함께 막아야 내부 경로만 남는다.
      const next = typeof params.next === 'string' ? params.next : null;
      const isInternalPath = next !== null && next.startsWith('/') && !next.startsWith('//');

      /*
        ⚠️ 2026-09-16 초대 링크로 들어와 **로그인 · 가입을 거친 사람은 홈으로 보낸다.**
           초대 화면(/invite/:token)으로 돌려보내지 않는다. (HOME-01 담당 · 사용자 결정)
           token 을 기기에 저장해 두면 홈이 초대한 사람 · 여행지 · 날짜를 확인해
           모달을 한 번 띄우고, 답할 때까지 배너를 남긴다. (lib/invite/pendingInvites)

           이미 로그인돼 있던 사람은 이 분기에 오지 않는다. 가드가 막지 않아서
           링크가 곧장 초대 화면을 연다. 그 흐름은 바꾸지 않았다.

        ⚠️ 저장이 끝난 뒤에 옮긴다. 먼저 옮기면 홈이 빈 저장소를 읽어 모달이 안 뜬다.
           저장에 실패하면 초대를 잃지 않게 원래대로 초대 화면으로 보낸다.
      */
      const inviteToken = isInternalPath && next ? inviteTokenFromPath(next) : null;
      if (inviteToken && userId) {
        savePendingInvite(userId, inviteToken)
          .then(() => router.replace('/'))
          .catch(() => router.replace(next as never));
        return;
      }

      router.replace(isInternalPath ? (next as never) : '/');
    }
  }, [status, canEnter, onLoginScreen, pathname, params.next, router, userId]);

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
        {/* 기기에 도착한 알림을 사용자별로 보관한다. 화면을 그리지 않는다. (lib/notifications) */}
        <PushInboxObserver />
        <AuthGate>
          <RootStack />
        </AuthGate>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
