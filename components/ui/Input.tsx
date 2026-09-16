import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { useDeferredPlaceholder } from '@/lib/hooks/useDeferredPlaceholder';

type Props = TextInputProps & {
  label?: string;
  /** 검증 실패 메시지. 있으면 테두리가 빨갛게 변하고 아래에 표시된다. */
  error?: string | null;
  /** 라벨 옆 * 표시. */
  required?: boolean;
  hint?: string;
};

export function Input({ label, error, required = false, hint, placeholder, ...rest }: Props) {
  const invalid = Boolean(error);
  // ⚠️ 첫 그림에서 플레이스홀더가 번진다. 한 틱 뒤에 넣어 다시 그리게 한다.
  const deferredPlaceholder = useDeferredPlaceholder(placeholder);

  return (
    <View className="w-full">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? <Text className="text-red-500"> *</Text> : null}
        </Text>
      ) : null}

      <TextInput
        accessibilityLabel={label}
        placeholder={deferredPlaceholder}
        placeholderTextColor="#9ca3af"
        className={`rounded-xl border px-4 py-3 text-base text-gray-900 ${
          invalid ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
        }`}
        {...rest}
      />

      {invalid ? (
        <Text className="mt-1.5 text-xs text-red-500">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-gray-400">{hint}</Text>
      ) : null}
    </View>
  );
}
