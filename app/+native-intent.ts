// ============================================================================
// 시스템에서 들어오는 URL 을 라우터에 넘기기 전에 거른다 (expo-router +native-intent · 2026-09-22)
//
// 왜 필요한가 — 초대 링크 → 로그인 → 초대 화면 복귀 실패
//   카카오 · 구글 로그인은 앱 안 브라우저를 열고, 끝나면 Supabase 가
//     exp://127.0.0.1:8081/--/#access_token=…   (Expo Go)
//     trippot://#access_token=…                (배포 앱)
//   로 돌려보낸다. lib/auth/oauth.ts 가 그 URL 의 토큰으로 세션을 만든다.
//   그런데 같은 URL 이 **딥링크로도** 앱에 전달되어 expo-router 가 경로 '/'(홈)로 이동시켰다.
//   그 순간 /login?next=/invite/:token 이 사라져, 로그인이 끝나도 초대 화면 대신 홈에 남았다.
//   초대 화면을 거치지 않으니 INVITE_RECEIVED 알림도 만들어지지 않았다.
//   (2026-09-22 Expo Go 시뮬레이터에서 콜백 모양 URL 로 재현)
//
// 무엇을 하는가
//   인증 콜백 URL(토큰 · code · 오류가 실린 루트 주소)은 **라우터 이동으로 쓰지 않는다.**
//   빈 문자열을 돌려주면 expo-router 가 그 URL 을 버린다(subscribe: `if (href) listener(href)`).
//   세션 생성은 여기와 무관하게 openAuthSessionAsync 의 결과로 계속 이루어진다.
//   콜백이 앱의 **첫** URL 인 경우(앱이 다시 시작된 경우)도 루트에서 시작하고,
//   로그인 뒤 어디로 갈지는 lib/auth/pendingNext 가 기억한 값으로 가드가 정한다.
//
// ⚠️ 초대 · 여행 · 알림 딥링크(trippot://invite/…, exp://…/--/trips/…)는 그대로 통과한다.
//    경로가 있는 URL 은 건드리지 않는다. 오직 "경로 없음 + 인증 파라미터" 조합만 거른다.
// ⚠️ 여기서 예외를 던지면 앱이 죽을 수 있다(expo-router 문서). 판단이 안 되면 원래 값을 돌려준다.
// ============================================================================

/** 인증 콜백에만 실리는 파라미터. 하나라도 있고 경로가 비어 있으면 콜백으로 본다. */
const AUTH_CALLBACK_PARAMS = ['access_token', 'refresh_token', 'code', 'error', 'error_code', 'error_description'];

/**
 * expo-router 가 넘겨주는 값은 전체 URL 이거나(배포 앱 · 초기 URL) 이미 앱 경로로 바뀐 문자열이다(Expo Go).
 * 어느 쪽이든 "경로" 와 "파라미터(? 와 # 뒤)" 만 본다.
 */
function isAuthCallbackUrl(value: string): boolean {
  try {
    // 스킴이 있으면 URL 로, 아니면 상대 경로로 읽는다.
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
    const url = new URL(hasScheme ? value : `app://x${value.startsWith('/') ? '' : '/'}${value}`);
    // Expo Go 의 exp://host:port/--/ 를 벗긴다. 배포 앱의 trippot:// 는 host 가 없어 pathname 만 남는다.
    const path = url.pathname.replace(/^\/--/, '');
    if (path === '' || path === '/') {
      const params = new URLSearchParams(url.search);
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
      return AUTH_CALLBACK_PARAMS.some((key) => params.has(key) || fragment.has(key));
    }
    // 경로가 있는 URL(초대 · 여행 · 알림 딥링크)은 콜백이 아니다.
    return false;
  } catch {
    return false;
  }
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // ⚠️ 빈 문자열 = 이 URL 로는 이동하지 않는다. (초기 URL 이면 루트에서 시작한다)
    return isAuthCallbackUrl(path) ? '' : path;
  } catch {
    return path;
  }
}
