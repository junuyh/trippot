import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger';

const BASE = 'flex-row items-center justify-center rounded-xl px-5 py-3.5';

const VARIANT: Record<Variant, { box: string; label: string }> = {
  primary: { box: 'bg-brand active:bg-brand-pressed', label: 'text-white' },
  /**
   * primary 와 같은 브랜드 CTA (#64139E · 눌림 #521080). PR #122 에서 먼저 쓴 이름이라 남겨 둔다.
   * primary 는 generic 기본 동작 색이고, 사용처 어디도 국가 테마 색을 넘기지 않아 둘 다 브랜드다.
   * 국가 테마(theme.primary) 버튼은 이 컴포넌트를 쓰지 않는다. (2026-09-16 Final Color System)
   */
  brand: { box: 'bg-brand active:bg-brand-pressed', label: 'text-white' },
  secondary: { box: 'bg-gray-100 active:bg-gray-200', label: 'text-gray-900' },
  ghost: { box: 'bg-transparent active:bg-gray-100', label: 'text-brand' },
  danger: { box: 'bg-red-600 active:bg-red-700', label: 'text-white' },
};

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  /** 저장 중 중복 제출 방지. true 면 스피너가 뜨고 눌리지 않는다. (CLAUDE.md 9장) */
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  ...rest
}: Props) {
  const off = disabled || loading;
  const v = VARIANT[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      className={`${BASE} ${v.box} ${fullWidth ? 'w-full' : 'self-start'} ${off ? 'opacity-40' : ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? '#111827' : '#ffffff'} />
      ) : (
        <Text className={`text-base font-semibold ${v.label}`}>{label}</Text>
      )}
    </Pressable>
  );
}
