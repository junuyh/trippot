// ============================================================================
// 구글 로그인 — Supabase 내장 Google Provider 경유
//
// 흐름과 주의사항은 lib/auth/oauth.ts 에 있다. 여기서는 공급자 이름만 정한다.
//
// ⚠️ 카카오와 달리 **내장 provider('google')** 를 그대로 쓴다. 카카오가
//    Custom OIDC 인 이유는 `account_email` 동의항목 문제였고, 구글에는 그런
//    제약이 없다. (lib/auth/kakao.ts 머리 주석)
//
// ⚠️ 켜기 전에 Supabase Dashboard → Authentication → Providers → Google 에
//    Google Cloud 의 **웹 애플리케이션** 클라이언트 ID·Secret 이 들어 있어야
//    한다. Google Cloud 쪽 승인된 리디렉션 URI 는
//    `https://<project-ref>.supabase.co/auth/v1/callback` 하나다.
//
// ⚠️ 구글은 이메일을 함께 준다. **저장하지 않는다.**
//    (lib/supabase/queries/users.ts readOAuthProfile — email · phone 을 읽지 않는다)
//    같은 이메일로 이메일 가입을 한 계정이 이미 있으면 Supabase 가 두 신원을
//    한 계정으로 잇는다. 카카오는 이메일을 받지 않아 별도 계정이 된다.
// ============================================================================
import { signInWithProvider, type SocialSignInResult } from '@/lib/auth/oauth';

const GOOGLE_PROVIDER = 'google' as const;

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  return signInWithProvider(GOOGLE_PROVIDER, '구글');
}
