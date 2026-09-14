// ============================================================================
// 로그인 세션 하나만 들고 있는 곳. 앱 전체의 유일한 기준이다.
//
// ⚠️ 현재 사용자 id 의 Source of Truth 는 **session.user.id** 하나뿐이다.
//    화면이 각자 사용자를 알아내려 하면 로그아웃 뒤에도 남의 데이터가
//    남아 있는 화면이 생긴다.
//
// ⚠️ DEV_USER_ID 를 fallback 으로 돌려주지 않는다. 로그인하지 않았으면 null 이다.
//    fallback 을 두면 미로그인 상태에서 seed 사용자의 여행·모임이 자기 것처럼
//    보인다. 그건 버그가 아니라 사고다.
//    (lib/constants/devUser.ts 는 아직 다른 담당 화면이 쓰고 있어 남겨 둔다)
// ============================================================================
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { signOut as supabaseSignOut } from '@/lib/auth/kakao';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { supabase } from '@/lib/supabase/client';
import { ensureUserProfile } from '@/lib/supabase/queries/users';

/**
 * 세 가지뿐이다.
 *   loading   아직 저장된 세션을 읽는 중. 아무 화면도 보여주면 안 된다
 *   signedIn  세션이 있다
 *   signedOut 세션이 없다
 */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  /** 로그인한 사용자의 id. 없으면 null. */
  userId: string | null;
  /**
   * 개발용 미리보기 상태. (__DEV__ 전용)
   *
   * ⚠️ 실제 로그인이 아니다. Supabase 세션을 만들지 않고, DEV_USER_ID seed
   *    사용자의 데이터를 보여줄 뿐이다. 자세한 내용은 enterPreview 참고.
   */
  isPreview: boolean;
  /** 개발용 미리보기 시작. __DEV__ 가 아니면 아무 일도 하지 않는다. */
  /**
   * 개발용 미리보기 시작.
   *
   * @param userId 미리볼 seed 사용자. 안 주면 지수(DEV_USER_ID)로 들어간다.
   *               고를 수 있는 사람은 lib/constants/devUser.ts 의
   *               DEV_PREVIEW_USERS 다.
   */
  enterPreview: (userId?: string) => void;
  /** 개발용 미리보기 종료. */
  exitPreview: () => void;
  /**
   * 로그아웃. 미리보기면 미리보기만 끝내고, 실제 로그인이면 세션을 지운다.
   *
   * ⚠️ 화면마다 분기를 두지 않으려고 여기서 한 번에 처리한다.
   *    (MY-01 · 계정관리가 같은 함수를 쓴다)
   */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * 개발용 미리보기.
   *
   * ⚠️ 저장하지 않는다. AsyncStorage 를 쓰지 않는다. 앱을 다시 켜면 로그인
   *    화면으로 돌아온다. 버튼 한 번이면 다시 들어올 수 있어서, 저장해 두는
   *    쪽이 오히려 '개발용 상태로 켜져 있는 줄 모르는' 위험을 만든다.
   */
  /**
   * 미리보기로 보고 있는 seed 사용자 id. null 이면 미리보기가 꺼진 것이다.
   *
   * ⚠️ boolean 이 아니라 id 를 담는다. 취소 동의처럼 **사람이 둘 이상 있어야**
   *    열리는 화면을 시뮬레이터 두 대에서 서로 다른 사람으로 눌러 보려면
   *    누구로 들어왔는지가 필요하다. (2026-09-14)
   */
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    // 저장된 세션을 먼저 읽는다. (client.ts 가 AsyncStorage 를 쓰고 있어
    // 앱을 껐다 켜도 여기서 복원된다)
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });

    // 로그인·로그아웃·토큰 갱신이 전부 여기로 온다.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      // getSession 보다 이쪽이 먼저 올 수도 있다. 그때도 대기를 푼다.
      setReady(true);

      // ⚠️ 로그인한 순간 public.users 행이 있는지 확인한다. Supabase 는
      //    auth.users 만 만들고 public.users 는 아무도 만들지 않는다.
      //    이미 있으면 아무것도 하지 않는다. (ensureUserProfile)
      //
      //    실패해도 로그인을 막지 않는다. 여기서 throw 하면 앱이 통째로 죽는다.
      //
      // ⚠️ SIGNED_IN 만 보면 안 된다. 저장된 세션이 복원될 때 오는 이벤트는
      //    SIGNED_IN 이 아니라 INITIAL_SESSION 이다.
      //    (@supabase/auth-js GoTrueClient _emitInitialSession)
      //    SIGNED_IN 만 보면, 최초 로그인 때 네트워크 문제로 INSERT 가
      //    실패한 사용자는 앱을 몇 번 다시 켜도 영영 public.users 행이
      //    생기지 않는다. 두 이벤트를 함께 봐야 다음 실행에서 다시 시도된다.
      //
      //    TOKEN_REFRESHED 까지 넓히지 않는다. 토큰 갱신은 수시로 일어나고,
      //    그때마다 SELECT 를 한 번씩 더 하는 값어치가 없다.
      //
      // ⚠️ 다만 두 이벤트가 같은 뜻은 아니다. **탈퇴한 계정을 되살리는 것은
      //    SIGNED_IN 일 때뿐이다.** (allowRevive)
      //      SIGNED_IN        사용자가 직접 다시 로그인했다 = 재가입 의사
      //      INITIAL_SESSION  저장된 세션이 복원됐을 뿐이다
      //    구분하지 않으면, 탈퇴 직후 로그아웃이 실패해 세션만 남은 사용자가
      //    앱을 다시 켰다는 이유만으로 탈퇴가 취소된다.
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && next?.user) {
        void ensureUserProfile(next.user, {
          allowRevive: event === 'SIGNED_IN',
        }).catch(() => {});
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /**
   * 개발용 미리보기 시작.
   *
   * ⚠️ __DEV__ 가 아니면 아무 일도 하지 않는다. 이중 방어다. 진입 버튼도
   *    __DEV__ 에서만 그려지지만(components/auth/LoginView), 호출 경로가
   *    하나 더 생겨도 production 에서는 켜지지 않아야 한다.
   *
   * ⚠️ 가짜 Supabase 세션을 만들지 않는다. setSession 을 부르지 않고
   *    public.users 도 만들지 않는다. 세션은 실제 로그인만 만든다.
   */
  const enterPreview = useCallback((userId?: string) => {
    if (!__DEV__) return;
    // 인자를 안 주면 지금까지와 같이 지수로 들어간다. 기존 호출부를 깨지 않는다.
    setPreviewUserId(userId ?? DEV_USER_ID);
  }, []);

  const exitPreview = useCallback(() => {
    setPreviewUserId(null);
  }, []);

  const signOut = useCallback(async () => {
    // 미리보기는 세션이 없다. supabase.auth.signOut() 을 부를 이유가 없다.
    if (previewUserId) {
      setPreviewUserId(null);
      return;
    }
    await supabaseSignOut();
  }, [previewUserId]);

  const value = useMemo<AuthValue>(
    () => ({
      status: !ready ? 'loading' : session ? 'signedIn' : 'signedOut',
      session,
      // ⚠️ 세션이 없다고 자동으로 DEV_USER_ID 를 주지 않는다. 사용자가 직접
      //    미리보기를 켠 경우에만 준다. 자동 fallback 은 미로그인 상태에서
      //    seed 사용자의 여행·모임이 자기 것처럼 보이게 만든다.
      userId: session?.user.id ?? previewUserId,
      isPreview: previewUserId !== null,
      enterPreview,
      exitPreview,
      signOut,
    }),
    [ready, session, previewUserId, enterPreview, exitPreview, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 는 AuthProvider 안에서만 쓴다.');
  return value;
}

/**
 * 화면이 데이터를 조회할 때 쓰는 사용자 id.
 *
 * ⚠️ 로그인하지 않았으면 **null** 이다. 세션이 없다는 이유만으로 DEV_USER_ID 를
 *    돌려주지 않는다. 쓰는 쪽에서 null 을 반드시 다뤄야 한다. 라우트 가드가
 *    미로그인 상태를 이미 막고 있으므로 화면 안에서는 사실상 항상 값이 있다.
 *
 * 값이 정해지는 순서는 셋뿐이다.
 *   실제 세션이 있으면        session.user.id
 *   개발용 미리보기가 켜졌으면  DEV_USER_ID  (__DEV__ + 사용자가 직접 켠 경우만)
 *   그 외                    null
 */
export function useCurrentUserId(): string | null {
  return useAuth().userId;
}
