// ============================================================================
// 카카오 로그인
//
// Supabase 공식 방식이다.
//   https://supabase.com/docs/guides/auth/social-login/auth-kakao
//   https://supabase.com/docs/guides/auth/native-mobile-deep-linking
//
//   signInWithOAuth({ skipBrowserRedirect: true })  → 인증 URL 만 받는다
//   WebBrowser.openAuthSessionAsync(url, redirectTo) → 앱 안에서 브라우저를 연다
//   돌아온 URL 의 토큰으로 setSession                → 세션이 생긴다
//
// ⚠️ 앱에는 카카오 키를 두지 않는다. REST API Key 와 Client Secret 은
//    Supabase Dashboard 의 Kakao provider 설정에만 있다. (CLAUDE.md 1장)
//
// ⚠️ 브라우저를 열기 전에 signInWithOAuth 를 부르지 않으면 안 된다.
//    그 호출이 PKCE 검증값을 저장한다. URL 을 직접 조립하면 안 된다.
// ============================================================================
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase/client';

// 웹에서 인증 창이 남아 있지 않게 정리한다. RN 에서는 아무 일도 하지 않는다.
WebBrowser.maybeCompleteAuthSession();

/**
 * 카카오가 인증을 마치고 돌아올 주소.
 *
 * ⚠️ 개발(Expo Go)에서는 `exp://…`, 빌드된 앱에서는 `trippot://` 가 나온다.
 *    **두 값 모두 Supabase Dashboard 의 Redirect URLs 에 등록돼 있어야 한다.**
 *    등록되지 않은 주소로는 Supabase 가 되돌려 보내지 않는다.
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
    provider: 'kakao',
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
