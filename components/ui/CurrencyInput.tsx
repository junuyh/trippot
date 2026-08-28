import { useMemo } from 'react';
import { Text, TextInput, View } from 'react-native';

type Props = {
  label?: string;
  /** 금액. **정수 원 단위**다. 값이 없으면 null. */
  value: number | null;
  onChangeValue: (value: number | null) => void;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  editable?: boolean;
  /** 상한. 넘으면 입력을 무시한다. 기본 1조. */
  max?: number;
};

const DEFAULT_MAX = 1_000_000_000_000;

/**
 * 금액 입력.
 *
 * ⚠️ 금액은 **정수 원 단위**다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
 *    그래서 숫자 외 문자를 전부 제거하고 정수로만 다룬다.
 *    소수점(`.`)과 음수(`-`)는 입력 단계에서 버린다.
 *
 * 표시는 천 단위 콤마, 내보내는 값은 순수 number 다.
 */
export function CurrencyInput({
  label,
  value,
  onChangeValue,
  placeholder = '0',
  error,
  required = false,
  hint,
  editable = true,
  max = DEFAULT_MAX,
}: Props) {
  const invalid = Boolean(error);
  const display = useMemo(() => (value === null ? '' : value.toLocaleString('ko-KR')), [value]);

  function handleChange(text: string) {
    // 숫자만 남긴다. 소수점·음수·공백·콤마 전부 제거.
    const digits = text.replace(/[^0-9]/g, '');
    if (digits === '') {
      onChangeValue(null);
      return;
    }
    const next = Number.parseInt(digits, 10);
    if (!Number.isSafeInteger(next) || next > max) return; // 상한 초과는 무시
    onChangeValue(next);
  }

  return (
    <View className="w-full">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? <Text className="text-red-500"> *</Text> : null}
        </Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-xl border px-4 ${
          invalid ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
        } ${editable ? '' : 'opacity-60'}`}
      >
        <TextInput
          accessibilityLabel={label}
          value={display}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          inputMode="numeric"
          editable={editable}
          className="flex-1 py-3 text-right text-base font-semibold text-gray-900"
        />
        <Text className="ml-2 text-base text-gray-500">원</Text>
      </View>

      {invalid ? (
        <Text className="mt-1.5 text-xs text-red-500">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-gray-400">{hint}</Text>
      ) : null}
    </View>
  );
}
