// BUDGET-01 카테고리별 예산 행.
//
// 예상(계획) · 준비 · 실제 · 잔여 와 준비율/사용률을 보여준다. (REQ-BUDGET-004)
//
// 막대 두 개를 겹쳐 그린다.
//   연한 파랑  준비율 — 이 카테고리에 자금이 얼마나 배분됐나
//   진한 색    사용률 — 계획 대비 얼마나 썼나
// 계획을 넘겨 쓰면 빨강으로 바뀐다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type BudgetCategoryRowData = {
  id: string;
  categoryCode: CategoryCode;
  plannedAmount: number;
  preparedAmount: number;
  actualAmount: number;
};

type Props = {
  category: BudgetCategoryRowData;
  onPress: (categoryId: string) => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function BudgetCategoryRow({ category, onPress }: Props) {
  const { plannedAmount, preparedAmount, actualAmount } = category;

  const prepRate = plannedAmount > 0 ? Math.min(100, (preparedAmount / plannedAmount) * 100) : 0;
  const usageRate = plannedAmount > 0 ? (actualAmount / plannedAmount) * 100 : 0;
  const over = actualAmount > plannedAmount;
  const remaining = plannedAmount - actualAmount;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 상세`}
      onPress={() => onPress(category.id)}
      className="gap-2.5 px-4 py-4 active:bg-gray-50"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-medium text-gray-900">
          {CATEGORY_CODE_LABEL[category.categoryCode]}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-base font-semibold text-gray-900">{won(plannedAmount)}</Text>
          <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
        </View>
      </View>

      {/* 준비(연한) 위에 사용(진한)을 겹친다 */}
      <View className="h-2 overflow-hidden rounded-full bg-gray-100">
        <View
          className="absolute h-full rounded-full bg-blue-200"
          style={{ width: `${prepRate}%` }}
        />
        <View
          className={`absolute h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-600'}`}
          style={{ width: `${Math.min(100, usageRate)}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-3">
          <Text className="text-xs text-gray-500">
            준비 <Text className="font-medium text-blue-600">{Math.round(prepRate)}%</Text>
          </Text>
          <Text className="text-xs text-gray-500">
            사용{' '}
            <Text className={`font-medium ${over ? 'text-red-500' : 'text-gray-700'}`}>
              {Math.round(usageRate)}%
            </Text>
          </Text>
        </View>
        <Text className={`text-xs ${over ? 'text-red-500' : 'text-gray-400'}`}>
          {over ? `${won(-remaining)} 초과` : `${won(remaining)} 남음`}
        </Text>
      </View>
    </Pressable>
  );
}
