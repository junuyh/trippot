// ============================================================================
// 이메일 가입 · 로그인 — Supabase 이메일/비밀번호
//
// 필수 2 방향 변경 (2026-09-15): 이메일 가입을 끄지 않고 로그인 수단으로 연다.
// 카카오 · 이메일 · (구글 예정) 세 가지다.
//
// ⚠️ **인증은 메일 링크가 아니라 6자리 코드로 받는다.**
//    링크 방식은 메일 앱 → 브라우저 → 앱(trippot:// · Expo Go 는 exp://…)으로
//    돌아와야 해서, 실행 환경마다 Redirect URL 을 등록하고 딥링크에서 토큰을
//    꺼내는 처리가 따로 필요하다. 코드는 앱 안에서 verifyOtp 한 번이면 끝난다.
//    ⚠️ 메일에 코드가 찍히려면 Supabase Dashboard 의 Confirm signup 템플릿에
//       {{ .Token }} 이 들어 있어야 한다. (기본 템플릿은 링크만 있다)
//
// ⚠️ 가입 인증을 끈 프로젝트(mailer_autoconfirm)에서는 signUp 이 바로 세션을
//    준다. 그때는 코드 화면 없이 로그인된다. 두 경우를 모두 받는다.
//
// ⚠️ 이미 가입된 이메일인지 알려주지 않는다. Supabase 도 인증을 켠 상태에서는
//    같은 응답을 준다. 알려주면 공개 키로 누가 가입했는지 떠볼 수 있다.
//
// 화면 이동은 하지 않는다. 세션이 생기면 app/_layout.tsx 가드가 옮긴다.
// ============================================================================
import { supabase } from '@/lib/supabase/client';

/** 비밀번호 최소 길이. 서버는 6자까지 받지만 앱은 8자부터 받는다. */
export const EMAIL_PASSWORD_MIN = 8;
/**
 * 인증 코드 자리수.
 *
 * ⚠️ **대시보드 설정값(Authentication → Sessions/Email OTP length)에 따라 달라진다.**
 *    이 프로젝트는 8자리다(2026-09-16 확인). 6으로 고정했다가 8자리 코드를 못 넣는
 *    일이 있었다. 범위로 받아 두고, 정확한 판정은 서버(verifyOtp)에 맡긴다.
 */
export const EMAIL_CODE_MIN = 6;
export const EMAIL_CODE_MAX = 10;

export type EmailAuthResult = 'signedIn' | 'needsVerification';

/** 흔한 오타만 거른다. 진짜 검증은 인증 코드가 한다. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * 가입한다.
 * 인증을 켠 프로젝트면 세션 없이 돌아오고, 메일로 코드가 간다.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data.session ? 'signedIn' : 'needsVerification';
}

/**
 * 로그인한다.
 * 가입만 하고 인증을 안 끝낸 계정이면 코드 화면으로 보낸다.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    if (error.code === 'email_not_confirmed') return 'needsVerification';
    throw error;
  }
  return 'signedIn';
}

/** 메일로 받은 코드로 가입 인증을 끝낸다. 성공하면 세션이 생긴다. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
}

/** 인증 코드를 다시 보낸다. */
export async function resendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  if (error) throw error;
}

/**
 * 오류를 사용자 문구로 바꾼다.
 *
 * ⚠️ 서버 메시지를 그대로 보여주지 않는다. 영어이고, 내부 사정이 섞여 있다.
 *    코드 목록: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
export function emailAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'invalid_credentials':
      return '이메일 또는 비밀번호가 맞지 않아요.';
    case 'weak_password':
      return `비밀번호는 ${EMAIL_PASSWORD_MIN}자 이상으로 정해 주세요.`;
    case 'otp_expired':
      return '코드가 맞지 않거나 만료됐어요. 코드를 다시 받아 주세요.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return '요청이 많아 잠시 막혔어요. 조금 뒤에 다시 시도해 주세요.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return '지금은 이메일 가입을 받지 않고 있어요.';
    case 'email_address_invalid':
      return '이메일 주소를 확인해 주세요.';
    default:
      return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}
