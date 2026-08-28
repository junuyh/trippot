// SETTLE-01 카테고리별 예상 vs 실제.
//
// 어느 카테고리에서 계획이 빗나갔는지 보여준다.
// 이 편차가 다음 여행의 개인화 추천(personalized_amount) 근거가 된다.
// (CLAUDE.md 2장 — 결산 → 개인화 → 다음 여행)
import { Text, View } from 'react-native';

import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type CategoryComparison = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
};

type Props = {
  categories: CategoryComparison[];
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function CategoryComparisonList({ categories }: Props) {
  // 편차가 큰 순서로 보여준다. 계획대로 쓴 항목은 볼 이유가 적다.
  const sorted = [...categories].sort(
    (a, b) =>
      Math.abs(b.actualAmount - b.plannedAmount) - Math.abs(a.actualAmount - a.plannedAmount),
  );

  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {sorted.map((category, index) => {
        const diff = category.actualAmount - category.plannedAmount;
        const over = diff > 0;
        const rate =
          category.plannedAmount > 0
            ? Math.round((category.actualAmount / category.plannedAmount) * 100)
            : 0;

        return (
          <View
            key={category.categoryCode}
            className={`gap-2 px-4 py-3.5 ${index > 0 ? 'border-t border-gray-100' : ''}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-gray-800">
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>
              {diff !== 0 ? (
                <Text
                  className={`text-sm font-semibold ${over ? 'text-red-500' : 'text-blue-600'}`}
                >
                  {over ? '+' : ''}
                  {diff.toLocaleString('ko-KR')}원
                </Text>
              ) : (
                <Text className="text-sm font-medium text-gray-400">그대로</Text>
              )}
            </View>

            <View className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <View
                className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, rate)}%` }}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-400">
                계획 {won(category.plannedAmount)} → 실제 {won(category.actualAmount)}
              </Text>
              <Text className={`text-xs ${over ? 'text-red-500' : 'text-gray-400'}`}>{rate}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
