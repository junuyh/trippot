// ============================================================================
// 이메일 가입 · 로그인 · 인증 코드 (로그인 화면 안에서 바꿔 끼운다)
//
// ⚠️ 새 라우트를 만들지 않는다. app/_layout.tsx 가드는 'login' 세그먼트만
//    로그인 전 화면으로 열어 두어서, 다른 경로를 만들면 가드까지 고쳐야 한다.
//    로그인 화면(app/login.tsx)이 모드를 들고 이 뷰와 LoginView 를 바꿔 그린다.
//
// ⚠️ 이미 가입된 이메일인지 말하지 않는다. (lib/auth/email.ts 머리 주석)
//
// supabase / track 을 직접 부르지 않는다. 화면이 부른다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Input } from '@/components/ui';
import { EMAIL_CODE_MAX } from '@/lib/auth/email';

export type EmailAuthMode = 'signIn' | 'signUp' | 'verify';

type Props = {
  mode: EmailAuthMode;
  email: string;
  onChangeEmail: (value: string) => void;
  password: string;
  onChangePassword: (value: string) => void;
  passwordConfirm: string;
  onChangePasswordConfirm: (value: string) => void;
  code: string;
  onChangeCode: (value: string) => void;
  /** 칸별 검증 문구. 화면이 정한다 */
  errors: { email?: string | null; password?: string | null; passwordConfirm?: string | null; code?: string | null };
  /** 칸에 속하지 않는 실패 한 줄 */
  errorMessage: string | null;
  /** 안내 한 줄 (코드를 다시 보냈어요 등) */
  noticeMessage: string | null;
  loading: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onSwitchMode: (mode: 'signIn' | 'signUp') => void;
  onResendCode: () => void;
  onBack: () => void;
};

const TITLE: Record<EmailAuthMode, string> = {
  signIn: '이메일로 로그인',
  signUp: '이메일로 가입',
  verify: '메일로 받은 코드를 입력해 주세요',
};

const SUBMIT: Record<EmailAuthMode, string> = {
  signIn: '로그인',
  signUp: '가입하기',
  verify: '인증하고 시작하기',
};

export function EmailAuthView({
  mode,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  passwordConfirm,
  onChangePasswordConfirm,
  code,
  onChangeCode,
  errors,
  errorMessage,
  noticeMessage,
  loading,
  canSubmit,
  onSubmit,
  onSwitchMode,
  onResendCode,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          onPress={onBack}
          className="-ml-2 h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>

        <Text className="mt-6 font-black text-pot-ink" style={{ fontSize: 22, letterSpacing: -0.4 }}>
          {TITLE[mode]}
        </Text>
        {mode === 'verify' ? (
          <Text className="mt-2 text-pot-mute" style={{ fontSize: 13.5, lineHeight: 20 }}>
            {email.trim()} 로 보낸 인증 코드를 입력하면 가입이 끝나요.
            메일이 안 보이면 스팸함·프로모션함도 확인해 주세요.
          </Text>
        ) : null}

        <View className="mt-8" style={{ gap: 16 }}>
          {mode === 'verify' ? (
            <Input
              label="인증 코드"
              value={code}
              onChangeText={(value) => onChangeCode(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={EMAIL_CODE_MAX}
              placeholder="메일로 받은 숫자"
              error={errors.code}
              editable={!loading}
            />
          ) : (
            <>
              <Input
                label="이메일"
                value={email}
                onChangeText={onChangeEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                placeholder="trippot@example.com"
                error={errors.email}
                editable={!loading}
              />
              <Input
                label="비밀번호"
                value={password}
                onChangeText={onChangePassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signUp' ? '8자 이상' : undefined}
                error={errors.password}
                editable={!loading}
              />
              {mode === 'signUp' ? (
                <Input
                  label="비밀번호 확인"
                  value={passwordConfirm}
                  onChangeText={onChangePasswordConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                  error={errors.passwordConfirm}
                  editable={!loading}
                />
              ) : null}
            </>
          )}
        </View>

        <View className="flex-1" />

        {errorMessage ? (
          <Text className="mb-3 mt-6 text-center text-red-500" style={{ fontSize: 12.5, lineHeight: 18 }}>
            {errorMessage}
          </Text>
        ) : noticeMessage ? (
          <Text className="mb-3 mt-6 text-center text-pot-mute" style={{ fontSize: 12.5, lineHeight: 18 }}>
            {noticeMessage}
          </Text>
        ) : (
          <View className="mt-6" />
        )}

        <Button label={SUBMIT[mode]} loading={loading} disabled={!canSubmit} onPress={onSubmit} />

        <View className="mt-5 flex-row items-center justify-center">
          {mode === 'verify' ? (
            <Text
              accessibilityRole="button"
              onPress={loading ? undefined : onResendCode}
              suppressHighlighting
              className="text-pot-mute"
              style={{ fontSize: 13 }}
            >
              코드 다시 받기
            </Text>
          ) : (
            <>
              <Text className="text-pot-faint" style={{ fontSize: 13 }}>
                {mode === 'signIn' ? '아직 계정이 없나요?' : '이미 가입했나요?'}
              </Text>
              <Text
                accessibilityRole="button"
                onPress={loading ? undefined : () => onSwitchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                suppressHighlighting
                className="ml-2 font-bold text-pot-ink"
                style={{ fontSize: 13 }}
              >
                {mode === 'signIn' ? '이메일로 가입' : '로그인'}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
