import { Stack, useLocalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBackButton, Loading } from '@/components/ui';
import { initAnalytics } from '@/lib/analytics/track';
import { AuthProvider, useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import {
  rememberInviteForLogin,
  savePendingInvite,
  takeRememberedInvite,
} from '@/lib/invite/pendingInvites';
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

      /*
        ⚠️ 2026-09-16 초대 링크였다면 token 을 **기기에 맡겨 둔다.**
           로그인이 끝나면 아래 분기가 꺼내서 그 사람의 보관함으로 옮긴다.
           초대 화면에서 답하지 않고 나갔을 때 홈이 배너로 다시 알리기 위해서다.
           (화면 이동은 원래대로 초대 화면이다 — 아래 분기 주석 참조)

           주소(?next=)에만 담아 두면 카카오 로그인으로 앱 밖을 다녀오거나
           웹에서 새로고침이 일어날 때 사라진다. (lib/invite/pendingInvites)
      */
      const token = inviteTokenFromPath(next);
      if (token) rememberInviteForLogin(token).catch(() => undefined);

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
        ⚠️ 2026-09-16 초대 링크로 들어온 사람은 **원래대로 초대 화면으로 돌려보낸다.**
           (2026-09-15 에 홈으로 보내도록 바꿨다가 되돌렸다 — 초대를 읽는 자리는
            초대 화면 INV-02 이고, 홈 배너는 **거기서 답하지 않고 나갔을 때만**
            다시 알리는 보조 장치다.)

           옮기기 전에 token 을 그 사람 보관함에 저장한다. 초대 화면이 뜨면 거기서도
           같은 저장을 하지만(app/invite/[token].tsx), 로그인 직후 한 번 더 해 두면
           초대 화면을 보지 못하고 앱을 닫아도 홈이 배너로 알릴 수 있다.
           저장은 같은 token 이면 덮어쓰지 않으므로 모달이 두 번 뜨지 않는다.
      */
      const inviteToken = isInternalPath && next ? inviteTokenFromPath(next) : null;

      void (async () => {
        /*
          맡겨 둔 초대를 먼저 꺼낸다. 주소에 남아 있으면 그것도 본다.
          ⚠️ 꺼내는 일은 **성공하든 실패하든 한 번만** 한다. 자리를 비워 두지 않으면
             다음에 로그인할 때 남의 초대가 뜬다.
        */
        const remembered = await takeRememberedInvite();
        const token = inviteToken ?? remembered;

        if (token && userId) {
          await savePendingInvite(userId, token).catch(() => undefined);
          // 초대 화면으로 보낸다. 주소에 next 가 남아 있으면 그것을, 없으면 맡겨 둔 token 으로 만든다.
          router.replace(`/invite/${encodeURIComponent(token)}` as never);
          return;
        }

        router.replace(isInternalPath ? (next as never) : '/');
      })();
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
