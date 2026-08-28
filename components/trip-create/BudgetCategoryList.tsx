// TRIP-03 카테고리별 예산 확인·수정.
//
// ⚠️ 여기서 고친 값은 planned_amount 다. recommended_amount 는 건드리지 않는다.
//    추천 원본이 사라지면 "사용자가 자주 고치는 카테고리" 를 영원히 못 잰다.
//    (CLAUDE.md 4장)
//
// 수정한 카테고리 수는 budget_target_confirmed.edited_category_count 로 기록된다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type EditableCategory = {
  categoryCode: CategoryCode;
  /** 시스템 추천 원본. 표시용이며 절대 바뀌지 않는다 */
  recommendedAmount: number;
  /** 사용자가 확정할 값 */
  plannedAmount: number;
};

type Props = {
  categories: EditableCategory[];
  onChangeAmount: (categoryCode: CategoryCode, amount: number) => void;
  /** 펼쳐서 수정 중인 카테고리. null 이면 전부 접힌 상태 */
  editingCode: CategoryCode | null;
  onToggleEditing: (categoryCode: CategoryCode) => void;
  disabled?: boolean;
};

export function BudgetCategoryList({
  categories,
  onChangeAmount,
  editingCode,
  onToggleEditing,
  disabled = false,
}: Props) {
  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200">
      {categories.map((category, index) => {
        const edited = category.plannedAmount !== category.recommendedAmount;
        const editing = editingCode === category.categoryCode;
        const diff = category.plannedAmount - category.recommendedAmount;

        return (
          <View
            key={category.categoryCode}
            className={index > 0 ? 'border-t border-gray-100' : undefined}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 수정`}
              accessibilityState={{ expanded: editing, disabled }}
              disabled={disabled}
              onPress={() => onToggleEditing(category.categoryCode)}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                editing ? 'bg-blue-50' : 'bg-white active:bg-gray-50'
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                <Text className="text-base text-gray-800">
                  {CATEGORY_CODE_LABEL[category.categoryCode]}
                </Text>
                {edited ? (
                  <View className="rounded-full bg-blue-100 px-1.5 py-0.5">
                    <Text className="text-[10px] font-semibold text-blue-700">수정함</Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center gap-1.5">
                <Text className="text-base font-semibold text-gray-900">
                  {category.plannedAmount.toLocaleString('ko-KR')}원
                </Text>
                <Ionicons
                  name={editing ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#9ca3af"
                />
              </View>
            </Pressable>

            {editing ? (
              <View className="gap-2 bg-blue-50 px-4 pb-4">
                <CurrencyInput
                  value={category.plannedAmount}
                  onChangeValue={(value) => onChangeAmount(category.categoryCode, value ?? 0)}
                  editable={!disabled}
                />
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-gray-500">
                    추천 {category.recommendedAmount.toLocaleString('ko-KR')}원
                  </Text>
                  {diff !== 0 ? (
                    <Text
                      className={`text-xs font-medium ${
                        diff > 0 ? 'text-red-500' : 'text-blue-600'
                      }`}
                    >
                      {diff > 0 ? '+' : ''}
                      {diff.toLocaleString('ko-KR')}원
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
