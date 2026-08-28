// TRIP-03 카테고리별 예산 — 근거 확인과 수정.
//
// ⚠️ 항목을 펼치면 금액 입력만 나오는 게 아니라 **이 금액이 어디서 나왔는지**를
//    먼저 보여준다. 이 프로젝트의 핵심은 '근거 있는 예산'이다.
//    금액만 있으면 사용자는 그 숫자를 믿을 근거도, 고칠 기준도 없다.
//
//      근거   인천–나리타/하네다 왕복 25~30만원대예요.
//      계산   1인 왕복 275,000원 × 4명
//      스타일 '편하게' 기준 ×1.1
//      = 1,210,000원
//
// ⚠️ 여기서 고친 값은 planned_amount 다. recommended_amount 는 건드리지 않는다.
//    추천 원본이 사라지면 "사용자가 자주 고치는 카테고리" 를 영원히 못 잰다.
//    (CLAUDE.md 4장)
//
// 실제 항목("○○항공 왕복 31만원")은 BUDGET-02 에서 budget_plan_items 로 넣는다.
// 여기는 계획을 세우는 자리고, 거기가 계획을 실제로 채우는 자리다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { CATEGORY_CODE_LABEL, type CategoryCode, type TravelStyle } from '@/lib/constants/status';
import { TRAVEL_STYLE_LABEL } from '@/lib/constants/status';

export type EditableCategory = {
  categoryCode: CategoryCode;
  /** 시스템 추천 원본. 표시용이며 절대 바뀌지 않는다 */
  recommendedAmount: number;
  /** 사용자가 확정할 값 */
  plannedAmount: number;
  /** 조사 근거 한 줄 */
  basis: string;
  /** 계산식 */
  formula: string;
  /** 배수 적용 전 금액 */
  baseAmount: number;
  /** 스타일 배수. 1 이면 표시하지 않는다 */
  multiplier: number;
};

type Props = {
  categories: EditableCategory[];
  travelStyle: TravelStyle;
  onChangeAmount: (categoryCode: CategoryCode, amount: number) => void;
  editingCode: CategoryCode | null;
  onToggleEditing: (categoryCode: CategoryCode) => void;
  disabled?: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function BudgetCategoryList({
  categories,
  travelStyle,
  onChangeAmount,
  editingCode,
  onToggleEditing,
  disabled = false,
}: Props) {
  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200">
      {categories.map((category, index) => {
        const editing = editingCode === category.categoryCode;
        const diff = category.plannedAmount - category.recommendedAmount;
        const styled = category.multiplier !== 1;

        return (
          <View
            key={category.categoryCode}
            className={index > 0 ? 'border-t border-gray-100' : undefined}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 근거 보기`}
              accessibilityState={{ expanded: editing, disabled }}
              disabled={disabled}
              onPress={() => onToggleEditing(category.categoryCode)}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                editing ? 'bg-blue-50' : 'bg-white active:bg-gray-50'
              }`}
            >
              <Text className="text-base text-gray-800">
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>

              <View className="flex-row items-center gap-1.5">
                <Text className="text-base font-semibold text-gray-900">
                  {won(category.plannedAmount)}
                </Text>
                <Ionicons
                  name={editing ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#9ca3af"
                />
              </View>
            </Pressable>

            {editing ? (
              <View className="gap-3 bg-blue-50 px-4 pb-4">
                {/* ── 이 금액이 어디서 나왔는지 ── */}
                <View className="gap-2 rounded-xl bg-white p-3">
                  <View className="flex-row items-start gap-1.5">
                    <Ionicons name="bulb-outline" size={15} color="#2563eb" />
                    <Text className="flex-1 text-xs leading-5 text-gray-700">
                      {category.basis}
                    </Text>
                  </View>

                  <View className="h-px bg-gray-100" />

                  <View className="gap-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-gray-500">{category.formula}</Text>
                      <Text className="text-xs font-medium text-gray-700">
                        {won(category.baseAmount)}
                      </Text>
                    </View>

                    {styled ? (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-gray-500">
                          ‘{TRAVEL_STYLE_LABEL[travelStyle]}’ 기준 ×{category.multiplier}
                        </Text>
                        <Text className="text-xs font-medium text-gray-700">
                          {won(category.recommendedAmount)}
                        </Text>
                      </View>
                    ) : null}

                    <View className="mt-0.5 flex-row items-center justify-between border-t border-gray-100 pt-1.5">
                      <Text className="text-xs font-semibold text-gray-700">추천 금액</Text>
                      <Text className="text-sm font-bold text-blue-700">
                        {won(category.recommendedAmount)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ── 수정 ── */}
                <CurrencyInput
                  label="이 금액으로 잡을게요"
                  value={category.plannedAmount}
                  onChangeValue={(value) => onChangeAmount(category.categoryCode, value ?? 0)}
                  editable={!disabled}
                />

                {diff !== 0 ? (
                  <Text
                    className={`-mt-1 text-right text-xs font-medium ${
                      diff > 0 ? 'text-red-500' : 'text-blue-600'
                    }`}
                  >
                    추천보다 {diff > 0 ? '+' : ''}
                    {diff.toLocaleString('ko-KR')}원
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
