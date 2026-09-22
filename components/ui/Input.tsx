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

export function Input({
  label,
  error,
  required = false,
  hint,
  placeholder,
  style,
  ...rest
}: Props) {
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
        className={`rounded-xl border px-4 py-3 text-gray-900 ${
          invalid ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
        }`}
        /*
          ⚠️ 2026-09-22 · 'y' · 'g' 같은 글자의 **아래가 잘렸다.** (이메일 로그인)
             `text-base` 가 글자 크기와 함께 lineHeight 24 를 넣는데, iOS 의
             한 줄 TextInput 은 lineHeight 를 주면 글자를 아래로 밀어 칸 밖으로
             내보낸다. 그래서 글자 크기만 직접 주고 lineHeight 는 주지 않는다.
             칸 높이도 조금 키워 여유를 둔다.
          ⚠️ 부르는 쪽이 style 을 넘기면 그게 이긴다(뒤에 둔다).
        */
        style={[{ fontSize: 16, minHeight: 52 }, style]}
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
