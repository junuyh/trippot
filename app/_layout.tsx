import { Stack, useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBackButton, Loading } from '@/components/ui';
import { initAnalytics } from '@/lib/analytics/track';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import {
  clearPendingNext,
  hydratePendingNext,
  isInternalPath,
  peekPendingNext,
  savePendingNext,
} from '@/lib/auth/pendingNext';
import { NotificationBannerObserver } from '@/lib/notifications/NotificationBannerObserver';
import { PushInboxObserver } from '@/lib/notifications/PushInboxObserver';
import { SpendReminderReconciler } from '@/lib/notifications/SpendReminderReconciler';

import '../global.css';

/** 로그인 없이 볼 수 있는 화면. 이 안에서는 가드가 내보내지 않는다. */
const PUBLIC_SEGMENT = 'login';
/** 탈퇴 대기(PENDING_WITHDRAWAL) 계정이 볼 수 있는 유일한 화면. (회원탈퇴 30일 유예 · 2026-09-17) */
const WITHDRAWAL_SEGMENT = 'withdrawal-pending';

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
  const { status, isPreview, accountState } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  // ⚠️ useGlobalSearchParams 다. 루트 레이아웃의 useLocalSearchParams 는 leaf(/login)의 ?next 를
  //    보지 못해 next 복귀가 한 번도 동작하지 않았다. (2026-09-16 2계정 E2E T1 로 확인)
  const params = useGlobalSearchParams<{ next?: string }>();
  const router = useRouter();

  /**
   * 로그인 뒤 돌아갈 곳(lib/auth/pendingNext)을 기기에서 읽었는가. (2026-09-22)
   * 앱이 다시 시작된 뒤에도 초대 링크로 돌아가려면 세션과 함께 이 값도 먼저 읽어야 한다.
   * 읽기가 끝나기 전에는 옮기지 않는다. (세션 loading 과 같은 취급 · 수 ms)
   */
  const [pendingNextReady, setPendingNextReady] = useState(false);
  useEffect(() => {
    hydratePendingNext().finally(() => setPendingNextReady(true));
  }, []);

  /**
   * 이번 로그인에서 "돌아갈 곳"을 이미 한 번 정했는가. (2026-09-22)
   *
   * ⚠️ 세션이 생긴 직후 status 가 잠깐 loading 으로 돌아간다(accountState 조회). 그 사이 가드가
   *    children 을 내리면서 라우터 상태가 리셋돼 pathname 이 '/' → '/login' 으로 흔들리고,
   *    이 effect 가 **두 번** 돈다. 첫 번째가 저장된 목적지를 꺼내 쓰고 지우면, 두 번째는
   *    남은 값이 없어 홈으로 덮어썼다. (이메일 로그인 2계정 E2E 에서 확인)
   *    그래서 목적지 결정은 로그인 한 번에 한 번만 한다. 로그아웃하면 다시 풀린다.
   */
  const continuationDoneRef = useRef(false);

  const onLoginScreen = segments[0] === PUBLIC_SEGMENT;
  const onWithdrawalScreen = segments[0] === WITHDRAWAL_SEGMENT;
  /** 탈퇴 신청 뒤 30일 이내. 홈 · 여행 · 커뮤니티 어디도 못 들어가고 /withdrawal-pending 만 본다. */
  const pendingWithdrawal =
    status === 'signedIn' && !isPreview && accountState?.kind === 'PENDING_WITHDRAWAL';

  /**
   * 내부 화면을 볼 수 있는 상태인가.
   *
   * ⚠️ 개발용 미리보기(__DEV__)도 여기에 포함된다. 실제 로그인은 아니지만
   *    Expo Go 에서 MY / GROUP 화면을 확인하려면 통과시켜야 한다.
   *    미리보기 자체는 AuthProvider 가 __DEV__ 에서만 켜준다.
   */
  const canEnter = status === 'signedIn' || isPreview;

  useEffect(() => {
    if (!canEnter) continuationDoneRef.current = false;
  }, [canEnter]);

  useEffect(() => {
    if (status === 'loading' || !pendingNextReady) return;

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
      // ⚠️ URL 의 ?next 만으로는 부족하다. 카카오 · 구글 콜백 URL 이 딥링크로 들어와 라우터가 '/' 로
      //    움직이면 ?next 가 사라져 로그인 뒤 홈에 남았다. 기기에도 같이 적어 두고 로그인 확인 순간
      //    한 번 꺼내 쓴다. (2026-09-22 · lib/auth/pendingNext · app/+native-intent.ts)
      savePendingNext(next);
      router.replace(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
      return;
    }

    // 탈퇴 대기 계정: 진입 지점 한 곳에서 막는다. 화면마다 if 를 두지 않는다.
    if (pendingWithdrawal && !onWithdrawalScreen) {
      router.replace('/withdrawal-pending');
      return;
    }
    if (!pendingWithdrawal && onWithdrawalScreen) {
      router.replace(canEnter ? '/' : '/login');
      return;
    }

    /*
      로그인이 확인됐고 탈퇴 대기도 아니다 — 기기에 남긴 목적지가 있으면 **어느 화면에 있든** 그리로 간다.
      (2026-09-22) 콜백 URL 때문에 이미 '/' 로 옮겨진 뒤에도 초대 화면으로 돌아가기 위해서다.
      한 번만 쓴다. 이미 그 경로에 있으면 그냥 지운다. 탈퇴 대기 검사(위)가 먼저라 그 정책을 우회하지 않는다.
    */
    if (canEnter && !onLoginScreen) {
      const remembered = peekPendingNext();
      if (remembered !== null) {
        clearPendingNext();
        // 꺼내 쓴 순간 잠근다. 이미 그 경로에 있어 옮기지 않는 경우도 마찬가지다 — 목적지는 정해졌다.
        continuationDoneRef.current = true;
        if (remembered !== pathname && isInternalPath(remembered)) {
          router.replace(remembered as never);
          return;
        }
      }
    }

    if (canEnter && onLoginScreen) {
      // 남겨 둔 목적지가 있으면 그리로, 없으면 홈으로. URL 의 ?next 가 먼저, 없으면 기기에 남긴 값.
      //
      // ⚠️ '/' 로 시작하는지만 보면 '//example.com' 이 통과한다. 그건 내부
      //    경로가 아니라 protocol-relative URL 이라 앱 밖을 가리킨다.
      //    '//' 를 함께 막아야 내부 경로만 남는다. (isInternalPath)
      const fromParams = typeof params.next === 'string' ? params.next : null;
      const next = fromParams ?? peekPendingNext();
      const hasNext = next !== null && isInternalPath(next);
      // ⚠️ 돌아갈 곳이 없는데 이미 이번 로그인에서 목적지를 정했다면 **아무것도 하지 않는다.**
      //    여기서 홈으로 보내면 방금 연 초대 화면을 덮어쓴다. (2026-09-22 이메일 로그인 E2E)
      if (!hasNext && continuationDoneRef.current) return;

      clearPendingNext();
      continuationDoneRef.current = true;

      // ⚠️ 초대 링크로 들어와 로그인한 사람은 **원래 /invite/:token 으로 바로 돌아간다.**
      //    (확정 정책 · docs/14 · 2026-09-16) 홈을 거쳐 다시 안내하는 흐름(PR #111)은 쓰지 않는다.
      //    "답하지 않은 초대" 홈 배너·모달은 초대 화면이 token 을 기기에 남기는 것으로
      //    그대로 동작한다. (app/invite/[token].tsx syncPendingInvite → lib/invite/pendingInvites)
      router.replace(hasNext ? (next as never) : '/');
    }
  }, [
    status,
    canEnter,
    onLoginScreen,
    pendingWithdrawal,
    onWithdrawalScreen,
    pathname,
    params.next,
    pendingNextReady,
    router,
  ]);

  if (status === 'loading' || !pendingNextReady) {
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

      {/* 탈퇴 진행 중. 로그인처럼 헤더도 뒤로가기도 없다 — 가드가 다른 화면을 허용하지 않는다. */}
      <Stack.Screen
        name="withdrawal-pending"
        options={{ headerShown: false, gestureEnabled: false }}
      />

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
        {/* 지출 리마인드 OS 예약을 지금 DB(일정 · 멤버십)에 맞춘다. 로그인 · 복귀 시. 화면을 그리지 않는다. */}
        <SpendReminderReconciler />
        <AuthGate>
          <RootStack />
        </AuthGate>
        {/* 새 DB 알림의 In-app Banner. 화면 위에 겹쳐 그린다. 마운트 1회. (lib/notifications) */}
        <NotificationBannerObserver />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
