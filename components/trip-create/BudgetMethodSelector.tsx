// TRIP-03 예산 설정 방식. 추천받기 / 직접 입력.
//
// ⚠️ 두 경로 모두 **예상 여행비 비교로 수렴한다.** (AC-01, REQ-BUDGET-001)
//    직접 입력을 골라도 시스템 추천액을 함께 보여준다. 그래야
//    "사용자가 직접 정한 예산이 추천 대비 얼마나 높/낮았나" 를 잴 수 있다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BRAND } from '@/lib/constants/brandColor';
import { BUDGET_METHOD, type BudgetMethod } from '@/lib/constants/status';

const OPTIONS: {
  value: BudgetMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: BUDGET_METHOD.RECOMMENDED,
    label: '추천받고 정할래요',
    description: '여행지·일정·인원에 맞춰 계산해 드려요',
    icon: 'sparkles-outline',
  },
  {
    value: BUDGET_METHOD.USER_DEFINED,
    label: '정해둔 예산이 있어요',
    description: '총액을 입력하면 추천과 비교해 드려요',
    icon: 'create-outline',
  },
];

type Props = {
  value: BudgetMethod | null;
  onChange: (value: BudgetMethod) => void;
  disabled?: boolean;
};

export function BudgetMethodSelector({ value, onChange, disabled = false }: Props) {
  return (
    <View className="gap-3">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`flex-row items-center gap-3 rounded-2xl border px-4 py-4 ${
              selected ? 'border-brand bg-brand-soft' : 'border-gray-200 bg-white active:bg-gray-50'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <View
              className={`h-10 w-10 items-center justify-center rounded-full ${
                selected ? 'bg-brand' : 'bg-gray-100'
              }`}
            >
              <Ionicons name={option.icon} size={20} color={selected ? '#ffffff' : '#6b7280'} />
            </View>
            <View className="flex-1">
              <Text
                className={`text-base font-semibold ${selected ? 'text-brand' : 'text-gray-900'}`}
              >
                {option.label}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">{option.description}</Text>
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={22} color={BRAND.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
