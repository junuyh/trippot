// ============================================================================
// 로그인 (/login)
//
// 로그인 수단은 카카오 · 구글 · 이메일 셋이다.
// (2026-09-07 카카오 단일 → 2026-09-16 확대 · 테스트 빌드 보안 점검 필수 2)
//
// ⚠️ 이메일은 **라우트를 따로 만들지 않는다.** app/_layout.tsx 가드가 'login'
//    세그먼트만 로그인 전 화면으로 열어 두어서, 새 경로를 만들면 가드까지
//    고쳐야 한다. 이 화면이 모드를 들고 LoginView ↔ EmailAuthView 를 바꿔 그린다.
//
// 로그인에 성공하면 세션이 생기고, 화면 이동은 app/_layout.tsx 의 가드가 한다.
// 여기서 router.replace 를 부르지 않는다. 두 곳이 같이 옮기면 순간적으로
// 화면이 두 번 바뀐다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
//    같은 이유로 login_completed 도 아직 쏘지 않는다. (docs/13_퍼널정의서_v1 §5)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { EmailAuthView, type EmailAuthMode } from '@/components/auth/EmailAuthView';
import { LoginView } from '@/components/auth/LoginView';
import { useAuth } from '@/lib/auth/AuthProvider';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  EMAIL_CODE_MAX,
  EMAIL_CODE_MIN,
  EMAIL_PASSWORD_MIN,
  emailAuthErrorMessage,
  isValidEmail,
  resendEmailCode,
  signInWithEmail,
  signUpWithEmail,
  verifyEmailCode,
} from '@/lib/auth/email';
import { signInWithGoogle } from '@/lib/auth/google';
import { signInWithKakao } from '@/lib/auth/kakao';

export default function ScreenLogin() {
  const router = useRouter();
  // 초대 링크에서 왔는가. 가드가 /login?next=/invite/:token 으로 보낸다. (app/_layout.tsx)
  // next 를 여기서 소비하지 않는다 — 복귀는 가드가 한다. 문구만 바꾼다. (docs/14 · 2026-09-16)
  const { next } = useLocalSearchParams<{ next?: string }>();
  const inviteContext = typeof next === 'string' && next.startsWith('/invite/');
  const { enterPreview } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** null 이면 소셜 로그인 화면, 값이 있으면 이메일 화면이다. */
  const [emailMode, setEmailMode] = useState<EmailAuthMode | null>(null);
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string | null;
    password?: string | null;
    passwordConfirm?: string | null;
    nickname?: string | null;
    code?: string | null;
  }>({});
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  /**
   * 소셜 로그인 공통 처리.
   *
   * ⚠️ 사용자가 창을 닫은 것은 오류가 아니다. 아무 말도 하지 않는다.
   *    실패했다고 알리면 스스로 취소한 사람에게 문제가 생긴 것처럼 보인다.
   */
  async function handleSocial(signIn: () => Promise<'signedIn' | 'canceled'>) {
    // 연타로 인증 창이 두 번 열리지 않게 한다.
    if (loading) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      await signIn();
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

  function openEmail(mode: EmailAuthMode) {
    setEmailMode(mode);
    setErrorMessage(null);
    setNoticeMessage(null);
    setFieldErrors({});
  }

  function closeEmail() {
    setEmailMode(null);
    setNickname('');
    setPassword('');
    setPasswordConfirm('');
    setCode('');
    setFieldErrors({});
    setNoticeMessage(null);
    setErrorMessage(null);
  }

  /** 입력 검증. 통과하면 true. 서버에 보내기 전에 여기서 먼저 막는다. */
  function validate(mode: EmailAuthMode): boolean {
    if (mode === 'verify') {
      // ⚠️ 자리수를 앱에서 단정하지 않는다. 대시보드 설정에 따라 6~10 자리다.
      const length = code.trim().length;
      const ok = length >= EMAIL_CODE_MIN && length <= EMAIL_CODE_MAX;
      setFieldErrors({ code: ok ? null : '메일로 받은 숫자를 그대로 입력해 주세요.' });
      return ok;
    }

    const next: typeof fieldErrors = {
      email: isValidEmail(email) ? null : '이메일 주소를 확인해 주세요.',
      password:
        password.length >= EMAIL_PASSWORD_MIN
          ? null
          : `비밀번호는 ${EMAIL_PASSWORD_MIN}자 이상으로 정해 주세요.`,
    };
    if (mode === 'signUp') {
      next.passwordConfirm =
        password === passwordConfirm ? null : '비밀번호가 서로 달라요.';
      /*
        ⚠️ 닉네임을 받는다. 없으면 users.name 이 전부 '여행자' 가 돼서 모임
           멤버 목록에서도 입금 기록자에서도 서로 구분이 안 됐다.
           (2026-09-21 테스트) 카카오·구글은 닉네임을 주므로 이 칸이 없다.
      */
      next.nickname =
        nickname.trim().length > 0 ? null : '앱에서 보일 닉네임을 정해 주세요.';
    }
    setFieldErrors(next);
    return (
      !next.email && !next.password && !next.passwordConfirm && !next.nickname
    );
  }

  async function handleEmailSubmit() {
    if (loading || emailMode === null) return;
    if (!validate(emailMode)) return;

    setLoading(true);
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      if (emailMode === 'verify') {
        await verifyEmailCode(email, code);
        // 성공. 세션이 생기면 가드가 옮긴다.
        return;
      }

      const result =
        emailMode === 'signUp'
          ? await signUpWithEmail(email, password, nickname)
          : await signInWithEmail(email, password);

      // 인증을 켠 프로젝트면 메일로 코드가 간다. 코드 화면으로 넘어간다.
      // 인증을 끈 프로젝트면 이미 세션이 생겼고 가드가 옮긴다.
      if (result === 'needsVerification') {
        setCode('');
        setFieldErrors({});
        setEmailMode('verify');
        setNoticeMessage('메일로 인증 코드를 보냈어요.');
      }
    } catch (error) {
      setErrorMessage(emailAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      await resendEmailCode(email);
      setNoticeMessage('코드를 다시 보냈어요.');
    } catch (error) {
      setErrorMessage(emailAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** 보낼 수 있는 상태인가. 자세한 이유는 누른 뒤 칸 아래에 뜬다. */
  const canSubmitEmail =
    emailMode === 'verify'
      ? code.trim().length > 0
      : email.trim().length > 0 &&
        password.length > 0 &&
        // 가입은 닉네임까지 채워야 보낼 수 있다
        (emailMode !== 'signUp' || nickname.trim().length > 0);

  if (emailMode !== null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <EmailAuthView
          mode={emailMode}
          email={email}
          onChangeEmail={setEmail}
          nickname={nickname}
          onChangeNickname={setNickname}
          password={password}
          onChangePassword={setPassword}
          passwordConfirm={passwordConfirm}
          onChangePasswordConfirm={setPasswordConfirm}
          code={code}
          onChangeCode={setCode}
          errors={fieldErrors}
          errorMessage={errorMessage}
          noticeMessage={noticeMessage}
          loading={loading}
          canSubmit={canSubmitEmail}
          onSubmit={() => void handleEmailSubmit()}
          onSwitchMode={openEmail}
          onResendCode={() => void handleResendCode()}
          onBack={closeEmail}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginView
        loading={loading}
        errorMessage={errorMessage}
        onPressKakao={() => void handleSocial(signInWithKakao)}
        onPressGoogle={() => void handleSocial(signInWithGoogle)}
        onPressEmail={() => openEmail('signIn')}
        inviteContext={inviteContext}
        onPressTerms={() => router.push('/me/settings/terms')}
        onPressPrivacy={() => router.push('/me/settings/privacy')}
        // ⚠️ __DEV__ 는 production 번들에서 false 로 굳는다. 그래서 개발용
        //    미리보기는 배포된 앱에 아예 그려지지 않는다. (AuthProvider 가
        //    enterPreview 안에서도 한 번 더 막는다)
        showDevPreview={__DEV__}
        onPressDevPreviewNewUser={handlePressNewUserPreview}
      />
    </>
  );
}
