// ============================================================================
// 카카오 로그인 — Supabase Custom OIDC Provider 경유
//
// Supabase 공식 방식이다.
//   https://supabase.com/docs/guides/auth/third-party/custom-oidc
//   https://supabase.com/docs/guides/auth/native-mobile-deep-linking
//
//   signInWithOAuth({ skipBrowserRedirect: true })  → 인증 URL 만 받는다
//   WebBrowser.openAuthSessionAsync(url, redirectTo) → 앱 안에서 브라우저를 연다
//   돌아온 URL 의 토큰으로 setSession                → 세션이 생긴다
//
//   [앱]  →  [Supabase]  →  [카카오]  →  [Supabase callback]  →  [앱]
//
// ⚠️ 앱에는 카카오 키를 두지 않는다. REST API Key 와 Client Secret 은
//    Supabase Dashboard 의 Provider 설정에만 있다. (CLAUDE.md 1장)
//
// ⚠️ 브라우저를 열기 전에 signInWithOAuth 를 부르지 않으면 안 된다.
//    그 호출이 인증 URL 과 검증값을 만든다. URL 을 직접 조립하면 안 된다.
// ============================================================================
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase/client';

// 웹에서 인증 창이 남아 있지 않게 정리한다. RN 에서는 아무 일도 하지 않는다.
WebBrowser.maybeCompleteAuthSession();

/**
 * Supabase 에 만들어 둔 Custom OIDC Provider 의 식별자.
 *
 * ⚠️ 내장 카카오 provider(`'kakao'`) 를 쓰지 않는다. 내장 provider 는
 *    `account_email` 을 항상 요청하는데, 그 동의항목은 비즈 앱 심사를 거쳐야
 *    켤 수 있어서 KOE205(invalid_scope) 로 막힌다. Custom OIDC 는 Dashboard 에
 *    적어 둔 scope(openid · profile_nickname · profile_image) 만 요청한다.
 *
 * ⚠️ **Dashboard 에 실제로 만들어진 이름과 한 글자도 달라선 안 된다.**
 *    `custom:kakao` 도 아니고 `kakao-oidc` 도 아니다. 이 값이 곧 Supabase 가
 *    찾는 Provider 키다.
 *
 * ⚠️ scope 를 여기서 덧붙이지 않는다. supabase 의 `scopes` 옵션은 서버 설정에
 *    **덧붙이기만** 해서, `account_email` 을 한 글자라도 넣으면 그대로 KOE205 가
 *    된다. scope 는 Dashboard 한 곳에서만 정한다.
 */
const OIDC_PROVIDER = 'custom:kakao-oidc' as const;

/**
 * 카카오가 인증을 마치고 돌아올 주소.
 *
 * expo-auth-session 이 실행 환경을 보고 정한다. 직접 문자열을 적지 않는다.
 *   Development Build / 배포 앱   trippot://
 *   Expo Go                      exp://127.0.0.1:8081/--/
 *
 * ⚠️ **여기 나오는 값이 Supabase Dashboard 의 Redirect URLs 에 등록돼 있어야
 *    한다.** 등록되지 않은 주소로는 Supabase 가 되돌려 보내지 않는다.
 *
 * ⚠️ 카카오 Developers 에 등록하는 주소와 다른 것이다. 그쪽은 카카오가
 *    Supabase 로 돌아가는 주소(`…supabase.co/auth/v1/callback`) 이고,
 *    이 값은 Supabase 가 앱으로 돌아오는 주소다. 서로 바꿔 넣으면 안 된다.
 */
export const AUTH_REDIRECT_URI = makeRedirectUri();

/** 로그인 결과. 취소는 실패가 아니라 별개의 결과다. */
export type KakaoSignInResult = 'signedIn' | 'canceled';

/**
 * 돌아온 URL 에서 토큰을 꺼내 세션을 만든다.
 *
 * ⚠️ 토큰이 URL 의 fragment(#) 로 오기도 하고 query(?) 로 오기도 한다.
 *    getQueryParams 가 둘 다 읽는다. 직접 파싱하지 않는다.
 */
async function createSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) {
    throw new Error('로그인 응답에 토큰이 없습니다.');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

/**
 * 카카오로 로그인한다.
 *
 * 성공하면 세션이 생기고 AuthProvider 의 onAuthStateChange 가 알아서 받는다.
 * 여기서 화면을 옮기지 않는다. 라우팅은 가드가 한다.
 *
 * 사용자가 창을 닫으면 'canceled' 를 돌려준다. 오류가 아니다.
 * 그 밖의 실패는 throw 한다. 화면이 안내 문구를 띄운다.
 */
export async function signInWithKakao(): Promise<KakaoSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: OIDC_PROVIDER,
    options: {
      redirectTo: AUTH_REDIRECT_URI,
      // 우리가 직접 브라우저를 연다. supabase-js 가 먼저 열면 안 된다.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('카카오 인증 주소를 받지 못했습니다.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URI);

  // 'cancel' 은 사용자가 닫은 것, 'dismiss' 는 시스템이 닫은 것이다.
  // 둘 다 사용자가 로그인을 하지 않은 상태이므로 같게 다룬다.
  if (result.type !== 'success') return 'canceled';

  await createSessionFromUrl(result.url);
  return 'signedIn';
}

/** 로그아웃. 저장된 세션까지 지운다. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
