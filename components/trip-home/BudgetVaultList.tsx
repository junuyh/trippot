// TRIP-HOME 가상 여행 금고 — 카테고리 8개.
//
// 실제 계좌를 물리적으로 분리하지 않는다. 하나의 여행자금을 카테고리별로
// **논리적으로 배분**한 것이다. (CLAUDE.md 3장)
//
// ⚠️ prepared_amount(배분액)를 아직 보여주지 않는다.
//    배분 방식(우선순위 자동 / 균등 / 사용자 직접)이 미확정이라 지금은 전부 0 이다.
//    (docs/README.md §5 #8 — BUDGET-01 구현 시 결정)
//    0 을 '준비 0원' 으로 보여주면 사용자는 자금을 하나도 안 모은 것으로 읽는다.
//    그래서 계획액과 실제 사용액만 보여준다. 배분이 정해지면 여기에 더한다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type VaultCategory = {
  id: string;
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
};

type Props = {
  categories: VaultCategory[];
  onSelect: (categoryId: string) => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function BudgetVaultList({ categories, onSelect }: Props) {
  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200">
      {categories.map((category, index) => {
        // 계획이 0이면 사용률을 낼 수 없다. 0으로 두고 막대를 그리지 않는다.
        const rate =
          category.plannedAmount > 0
            ? Math.round((category.actualAmount / category.plannedAmount) * 100)
            : 0;
        const over = category.actualAmount > category.plannedAmount;

        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 상세`}
            onPress={() => onSelect(category.id)}
            className={`gap-2 px-4 py-3.5 active:bg-gray-50 ${
              index > 0 ? 'border-t border-gray-100' : ''
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-gray-800">
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-sm text-gray-500">
                  {won(category.actualAmount)}
                  <Text className="text-gray-400"> / {won(category.plannedAmount)}</Text>
                </Text>
                <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
              </View>
            </View>

            {category.plannedAmount > 0 ? (
              <View className="flex-row items-center gap-2">
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <View
                    className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, rate)}%` }}
                  />
                </View>
                <Text
                  className={`w-12 text-right text-xs font-medium ${
                    over ? 'text-red-500' : 'text-gray-400'
                  }`}
                >
                  {rate}%
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
