// ============================================================================
// 카카오 로그인 — Supabase Custom OIDC Provider 경유
//
// 흐름(인증 URL → 앱 안 브라우저 → 토큰 → 세션)과 Redirect URL 주의사항은
// lib/auth/oauth.ts 에 모았다. 구글도 같은 흐름을 쓴다. (2026-09-16)
//   https://supabase.com/docs/guides/auth/third-party/custom-oidc
//   https://supabase.com/docs/guides/auth/native-mobile-deep-linking
//
// ⚠️ 앱에는 카카오 키를 두지 않는다. REST API Key 와 Client Secret 은
//    Supabase Dashboard 의 Provider 설정에만 있다. (CLAUDE.md 1장)
// ============================================================================
import { supabase } from '@/lib/supabase/client';
import {
  AUTH_REDIRECT_URI,
  signInWithProvider,
  type SocialSignInResult,
} from '@/lib/auth/oauth';

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
 */
/*
  ⚠️ 2026-09-21 4차 · **Custom OIDC 에서 내장 provider 로 되돌린다.**

     증상: 카카오 동의까지 끝나고 앱으로 돌아오지 못한다. 인증 자체는
     성공한다 — Supabase auth 로그에 login(custom:kakao-oidc) 이 남는다.
     그런데 /callback 의 302 가 앱이 아니라 Site URL(http://localhost:3000)
     로 가서, 브라우저에 "네트워크 서버에 연결할 수 없습니다" 만 뜨고 끝난다.
     앱은 토큰을 못 받으니 세션이 안 생긴다.

     같은 흐름을 쓰는 구글은 된다. 다른 점은 **내장 provider 냐 Custom OIDC 냐**
     하나뿐이다. Custom OIDC 는 PKCE(code_challenge)로 도는데, 우리 코드는
     돌아온 URL 에서 access_token 을 꺼내 setSession 한다. 애초에 맞물리지 않는다.

     ⚠️ KOE205(invalid_scope) 때문에 Custom OIDC 로 갔던 것인데, 그 이유가
        사라졌다. Dashboard 의 카카오 provider 에 **email_optional 이 켜져 있다.**
        account_email 을 필수로 요구하지 않으므로 비즈 앱 심사 없이 통과한다.
        (지금 원격 설정: external_kakao_enabled=true, email_optional=true)

     ⚠️⚠️ 2026-09-21 · **되돌렸다. 내장 provider 는 쓸 수 없다.**
        Dashboard 의 email_optional 은 "이메일 없는 사용자를 받아 준다" 는
        뜻이지, 카카오에 보내는 scope 에서 account_email 을 빼 주지 않는다.
        내장 provider 로 바꾸자마자 그 자리에서 KOE205 가 다시 났다.
        Custom OIDC 로 남는다. 주석 위쪽이 여전히 옳다.
*/
const OIDC_PROVIDER = 'custom:kakao-oidc' as const;

/** 예전 이름. 이미 쓰고 있는 화면이 있어 그대로 내보낸다. */
export type KakaoSignInResult = SocialSignInResult;
export { AUTH_REDIRECT_URI };

/**
 * 카카오로 로그인한다.
 *
 * 성공하면 세션이 생기고 AuthProvider 의 onAuthStateChange 가 알아서 받는다.
 * 여기서 화면을 옮기지 않는다. 라우팅은 가드가 한다.
 */
export async function signInWithKakao(): Promise<KakaoSignInResult> {
  return signInWithProvider(OIDC_PROVIDER, '카카오');
}

/** 로그아웃. 저장된 세션까지 지운다. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
