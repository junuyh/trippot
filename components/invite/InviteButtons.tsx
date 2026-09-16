// 초대 카드 안의 버튼. 공용 Button 은 variant 색이 고정(파랑)이라 초대 primary 를 못 입힌다.
// 새 variant 를 공용에 넣으면 초대 전용 색이 앱 전체 버튼에 들어가므로 여기서만 쓴다.
// 높이 · 모서리 · 로딩 처리는 공용 Button 과 같다. 동작(onPress)은 호출부 그대로다.
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { INVITE_THEME } from './inviteTheme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function InvitePrimaryButton({ label, onPress, loading = false, disabled = false }: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      // 배경은 tailwind brand 토큰(= INVITE_THEME.primary) — 눌린 동안만 brand-pressed(#521080).
      // style 함수로 backgroundColor 를 주면 NativeWind className 과 섞여 배경이 사라진다.
      className="w-full flex-row items-center justify-center rounded-xl bg-brand px-5 py-3.5 active:bg-brand-pressed"
      style={{ opacity: off ? 0.4 : 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={INVITE_THEME.onPrimary} />
      ) : (
        <Text className="text-base font-semibold" style={{ color: INVITE_THEME.onPrimary }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function InviteGhostButton({ label, onPress, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="w-full flex-row items-center justify-center rounded-xl px-5 py-3.5 active:opacity-60"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text className="text-base font-semibold" style={{ color: INVITE_THEME.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}
