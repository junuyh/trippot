import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BASE = 'flex-row items-center justify-center rounded-xl px-5 py-3.5';

const VARIANT: Record<Variant, { box: string; label: string }> = {
  primary: { box: 'bg-blue-600 active:bg-blue-700', label: 'text-white' },
  secondary: { box: 'bg-gray-100 active:bg-gray-200', label: 'text-gray-900' },
  ghost: { box: 'bg-transparent active:bg-gray-100', label: 'text-blue-600' },
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
