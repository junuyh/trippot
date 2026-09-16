// ============================================================================
// 로그인 (/login)
//
// 카카오 하나뿐이다. 로그인에 성공하면 세션이 생기고, 화면 이동은
// app/_layout.tsx 의 가드가 한다. 여기서 router.replace 를 부르지 않는다.
// 두 곳이 같이 옮기면 순간적으로 화면이 두 번 바뀐다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { LoginView } from '@/components/auth/LoginView';
import { useAuth } from '@/lib/auth/AuthProvider';
import { DEV_PREVIEW_USERS, DEV_USER_ID } from '@/lib/constants/devUser';
import { signInWithKakao } from '@/lib/auth/kakao';

export default function ScreenLogin() {
  const router = useRouter();
  const { enterPreview } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePressKakao() {
    // 연타로 인증 창이 두 번 열리지 않게 한다.
    if (loading) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await signInWithKakao();

      // 사용자가 창을 닫은 것은 오류가 아니다. 아무 말도 하지 않는다.
      // 실패했다고 알리면 스스로 취소한 사람에게 문제가 생긴 것처럼 보인다.
      if (result === 'canceled') return;

      // 성공. 세션이 생기면 가드가 알아서 화면을 옮긴다.
    } catch {
      // 예외 객체를 그대로 노출하지 않는다.
      setErrorMessage('로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * [개발용] 신규 사용자 홈(여행 0개) 미리보기. (2026-09-16 · HOME-01 담당)
   *
   * 미리보기로 들어간 **뒤 어디로 갈지**는 가드(app/_layout.tsx)가 next 파라미터로
   * 정한다. 그래서 여기서 router.replace 를 부르지 않고 next 만 심어 둔다.
   * 두 곳이 같이 옮기면 화면이 두 번 바뀐다. (이 파일 머리말)
   *
   * ⚠️ 어느 seed 사용자로 들어가도 화면은 같다. 홈이 ?preview=empty 를 보고
   *    **조회 결과와 무관하게** 신규 사용자 홈을 그린다. (app/(tabs)/index.tsx)
   * ⚠️ 확인이 끝나면 이 함수와 LoginView 의 칩을 지운다.
   */
  function handlePressNewUserPreview() {
    router.setParams({ next: '/?preview=empty' });
    enterPreview(DEV_USER_ID);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginView
        loading={loading}
        errorMessage={errorMessage}
        onPressKakao={() => void handlePressKakao()}
        onPressTerms={() => router.push('/me/settings/terms')}
        onPressPrivacy={() => router.push('/me/settings/privacy')}
        // ⚠️ __DEV__ 는 production 번들에서 false 로 굳는다. 그래서 개발용
        //    미리보기는 배포된 앱에 아예 그려지지 않는다. (AuthProvider 가
        //    enterPreview 안에서도 한 번 더 막는다)
        showDevPreview={__DEV__}
        /*
          ⚠️ seed 사용자 넷을 그대로 쓴다. 오사카·도쿄 여행의 trip_members 에
             넷이 모두 ACTIVE 라, 시뮬레이터 두 대에서 서로 다른 사람으로
             들어가면 취소 동의·여행장 위임을 눌러 볼 수 있다.
        */
        devPreviewUsers={DEV_PREVIEW_USERS}
        onPressDevPreview={enterPreview}
        onPressDevPreviewNewUser={handlePressNewUserPreview}
      />
    </>
  );
}
