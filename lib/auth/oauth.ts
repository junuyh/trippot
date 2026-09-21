// ============================================================================
// 소셜 로그인 공통 — Supabase OAuth 를 앱 안 브라우저로 여는 흐름
//
// 카카오(Custom OIDC)와 구글이 **같은 흐름**을 쓴다. 공급자 이름만 다르다.
//
//   signInWithOAuth({ skipBrowserRedirect: true })  → 인증 URL 만 받는다
//   WebBrowser.openAuthSessionAsync(url, redirectTo) → 앱 안에서 브라우저를 연다
//   돌아온 URL 의 토큰으로 setSession                → 세션이 생긴다
//
//   [앱]  →  [Supabase]  →  [카카오 · 구글]  →  [Supabase callback]  →  [앱]
//
// ⚠️ 앱에는 공급자 키를 두지 않는다. 클라이언트 ID·Secret 은 Supabase Dashboard
//    의 Provider 설정에만 있다. (CLAUDE.md 1장)
//
// ⚠️ 브라우저를 열기 전에 signInWithOAuth 를 부르지 않으면 안 된다.
//    그 호출이 인증 URL 과 검증값을 만든다. URL 을 직접 조립하면 안 된다.
//
// ⚠️ 네이티브 SDK(구글 로그인 네이티브 · ID token) 를 쓰지 않는다. 그 방식은
//    안드로이드 SHA-1 지문과 플랫폼별 클라이언트를 따로 등록해야 해서 빌드마다
//    설정이 늘어난다. 브라우저 방식은 Expo Go · APK · IPA 가 모두 같은 코드다.
// ============================================================================
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase/client';

// 웹에서 인증 창이 남아 있지 않게 정리한다. RN 에서는 아무 일도 하지 않는다.
WebBrowser.maybeCompleteAuthSession();

/**
 * 공급자가 인증을 마치고 돌아올 주소.
 *
 * expo-auth-session 이 실행 환경을 보고 정한다. 직접 문자열을 적지 않는다.
 *   Development Build / 배포 앱   trippot://
 *   Expo Go                      exp://127.0.0.1:8081/--/
 *
 * ⚠️ **여기 나오는 값이 Supabase Dashboard 의 Redirect URLs 에 등록돼 있어야
 *    한다.** 등록되지 않은 주소로는 Supabase 가 되돌려 보내지 않는다.
 *
 * ⚠️ 공급자 콘솔(카카오 Developers · Google Cloud)에 등록하는 주소와 다른
 *    것이다. 그쪽은 공급자가 Supabase 로 돌아가는 주소
 *    (`…supabase.co/auth/v1/callback`) 이고, 이 값은 Supabase 가 앱으로
 *    돌아오는 주소다. 서로 바꿔 넣으면 안 된다.
 */
export const AUTH_REDIRECT_URI = makeRedirectUri();

/** 로그인 결과. 취소는 실패가 아니라 별개의 결과다. */
export type SocialSignInResult = 'signedIn' | 'canceled';

/**
 * 돌아온 URL 에서 토큰을 꺼내 세션을 만든다.
 *
 * ⚠️ 토큰이 URL 의 fragment(#) 로 오기도 하고 query(?) 로 오기도 한다.
 *    getQueryParams 가 둘 다 읽는다. 직접 파싱하지 않는다.
 */
async function createSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  /*
    ⚠️ **돌아오는 방식이 두 가지다.** (2026-09-21 4차)

       implicit  주소에 access_token · refresh_token 이 그대로 실려 온다
       PKCE      code 하나만 오고, 그것을 토큰으로 바꾸는 호출을 한 번 더 한다

    supabase-js v2 는 flowType 을 안 적으면 **PKCE** 다. 우리는 토큰만 꺼내
    쓰고 있어서, code 로 돌아오는 경우 "로그인 응답에 토큰이 없습니다" 로
    끝났다. 카카오(Custom OIDC)가 이 경우다.

    ⚠️ code 를 먼저 본다. 둘 다 없을 때만 오류다.
  */
  const { code, access_token, refresh_token } = params;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  if (!access_token || !refresh_token) {
    throw new Error('로그인 응답에 토큰이 없습니다.');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

/**
 * 공급자로 로그인한다.
 *
 * 성공하면 세션이 생기고 AuthProvider 의 onAuthStateChange 가 알아서 받는다.
 * 여기서 화면을 옮기지 않는다. 라우팅은 가드가 한다.
 *
 * 사용자가 창을 닫으면 'canceled' 를 돌려준다. 오류가 아니다.
 * 그 밖의 실패는 throw 한다. 화면이 안내 문구를 띄운다.
 *
 * ⚠️ scope 를 붙이지 않는다. supabase 의 `scopes` 옵션은 서버 설정에
 *    **덧붙이기만** 해서, 공급자가 허용하지 않는 값을 넣으면 그대로 오류가 된다.
 *    scope 는 Dashboard 한 곳에서만 정한다. (카카오 KOE205 사례)
 */
export async function signInWithProvider(
  provider: string,
  /** 실패 문구에 쓸 이름. '카카오' · '구글' */
  label: string,
): Promise<SocialSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    // 카카오는 Custom OIDC 라 supabase-js 의 Provider 타입에 없는 문자열이다.
    provider: provider as never,
    options: {
      redirectTo: AUTH_REDIRECT_URI,
      // 우리가 직접 브라우저를 연다. supabase-js 가 먼저 열면 안 된다.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error(`${label} 인증 주소를 받지 못했습니다.`);

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URI);

  // 'cancel' 은 사용자가 닫은 것, 'dismiss' 는 시스템이 닫은 것이다.
  // 둘 다 사용자가 로그인을 하지 않은 상태이므로 같게 다룬다.
  if (result.type !== 'success') return 'canceled';

  await createSessionFromUrl(result.url);
  return 'signedIn';
}
