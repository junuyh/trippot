// TRIP-03 카테고리별 예산 — 근거 확인과 수정.
//
// ⚠️ 항목을 펼치면 금액 입력만 나오는 게 아니라 **이 금액이 어디서 나왔는지**를
//    먼저 보여준다. 이 프로젝트의 핵심은 '근거 있는 예산'이다.
//    금액만 있으면 사용자는 그 숫자를 믿을 근거도, 고칠 기준도 없다.
//
//      근거   인천–나리타/하네다 왕복 25~30만원대예요.
//      상품   저비용 항공 직항 / 대형항공사 직항 / 프리미엄 이코노미
//      계산   1인 왕복 275,000원 × 4명
//      = 1,210,000원
//
// ⚠️ 여기서 고친 값은 planned_amount 다. recommended_amount 는 건드리지 않는다.
//    추천 원본이 사라지면 "사용자가 자주 고치는 카테고리" 를 영원히 못 잰다.
//    (CLAUDE.md 4장)
//
// 실제 항목("○○항공 왕복 31만원")은 BUDGET-02 에서 budget_plan_items 로 넣는다.
// 여기는 계획을 세우는 자리고, 거기가 계획을 실제로 채우는 자리다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { CATEGORY_CODE, CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

/** 카테고리를 펼쳤을 때 고를 수 있는 근거 상품 하나. 금액은 화면이 계산해 넘긴다. */
export type CategoryProduct = {
  id: string;
  name: string;
  emoji: string;
  /** 인원·박수·일수까지 곱한 이 상품의 금액 */
  amount: number;
  selected: boolean;
};

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

  // ── 근거 상품 ────────────────────────────────────────────────────────
  // 예비비에는 없다. 다른 항목 합계의 비율로 정해지는 값이라 쪼갤 것이 없다.
  products?: CategoryProduct[];
  /** 상품 목록 위 한 줄 안내 */
  productHint?: string;
  /** true 면 상품을 하나만 고를 수 있다 */
  singleSelect?: boolean;
  /**
   * 지금 고른 상품들의 합계. 지난 여행 반영을 얹기 **전** 금액이다.
   * 계산부의 출발점이라 항상 그린다. 이 줄이 없으면 상품을 바꿔도 그 숫자가
   * 어디에도 안 나와서 선택이 반영되지 않은 것처럼 보인다.
   * 예비비처럼 상품이 없는 카테고리는 넘기지 않는다.
   */
  productSubtotal?: number;

  // ── 지난 여행 반영 ───────────────────────────────────────────────────
  // 편차가 ±5% 미만인 카테고리에는 아예 붙지 않는다. 노이즈다.
  /** 부호 있는 퍼센트. +22 / -11 */
  adjustmentPercent?: number;
  /** 반영으로 늘거나 줄어든 금액. 부호를 갖는다 */
  adjustmentAmount?: number;
  /** 사용자가 이 카테고리만 반영에서 뺐는가 */
  adjustmentDropped?: boolean;
};

/** 예비비 비율 선택지. null 은 '추천'(기준 금액 그대로)이다. */
export type ContingencyChoice = number | null;

type Props = {
  categories: EditableCategory[];
  onChangeAmount: (categoryCode: CategoryCode, amount: number) => void;
  onToggleProduct: (categoryCode: CategoryCode, productId: string) => void;
  /** 카테고리 하나의 지난 여행 반영을 빼거나 되돌린다 */
  onToggleDrop: (categoryCode: CategoryCode) => void;

  /** 예비비를 뺀 나머지 합계. 비율 계산의 분모다 */
  otherCategoriesTotal: number;
  contingencyChoice: ContingencyChoice;
  onChangeContingency: (choice: ContingencyChoice) => void;

  editingCode: CategoryCode | null;
  onToggleEditing: (categoryCode: CategoryCode) => void;
  disabled?: boolean;
};

const CONTINGENCY_OPTIONS: { label: string; value: ContingencyChoice }[] = [
  { label: '추천', value: null },
  { label: '없음', value: 0 },
  { label: '3%', value: 3 },
  { label: '5%', value: 5 },
  { label: '10%', value: 10 },
];

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/**
 * 근거 상품 카드 한 장.
 *
 * ⚠️ 카드에 적히는 금액은 1,000원 단위로 반올림한 표시값이다.
 *    카테고리 총액은 상품별로 반올림한 뒤 더하지 않고 **한 번만** 반올림한다.
 *    그래서 카드 금액을 눈으로 더하면 총액과 몇 백 원 어긋날 수 있다.
 *    상품마다 반올림하면 오차가 상품 수만큼 쌓여 추천 금액이 달라진다. 총액이 기준이다.
 */
function ProductCard({
  product,
  disabled,
  onPress,
}: {
  product: CategoryProduct;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: product.selected, disabled }}
      accessibilityLabel={`${product.name} ${won(product.amount)}`}
      disabled={disabled}
      onPress={onPress}
      className={`w-[136px] overflow-hidden rounded-2xl border-2 bg-white ${
        product.selected ? 'border-blue-600' : 'border-gray-200'
      }`}
    >
      <View
        className={`h-[70px] items-center justify-center ${
          product.selected ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        <Text className="text-3xl">{product.emoji}</Text>
      </View>

      <View
        className={`absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full ${
          product.selected ? 'bg-blue-600' : 'bg-white/90'
        }`}
      >
        <Ionicons
          name={product.selected ? 'checkmark' : 'add'}
          size={12}
          color={product.selected ? '#ffffff' : '#a5acb7'}
        />
      </View>

      <View className="px-2.5 pb-2.5 pt-2">
        <Text numberOfLines={2} className="text-[11.5px] font-bold leading-4 text-gray-900">
          {product.name}
        </Text>
        <Text className="mt-1.5 text-[12.5px] font-black text-gray-900">{won(product.amount)}</Text>
      </View>
    </Pressable>
  );
}

export function BudgetCategoryList({
  categories,
  onChangeAmount,
  onToggleProduct,
  onToggleDrop,
  otherCategoriesTotal,
  contingencyChoice,
  onChangeContingency,
  editingCode,
  onToggleEditing,
  disabled = false,
}: Props) {
  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200">
      {categories.map((category, index) => {
        const open = editingCode === category.categoryCode;
        const diff = category.plannedAmount - category.recommendedAmount;
        const isContingency = category.categoryCode === CATEGORY_CODE.CONTINGENCY;

        return (
          <View
            key={category.categoryCode}
            className={index > 0 ? 'border-t border-gray-100' : undefined}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 근거 보기`}
              accessibilityState={{ expanded: open, disabled }}
              disabled={disabled}
              onPress={() => onToggleEditing(category.categoryCode)}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                open ? 'bg-blue-50' : 'bg-white active:bg-gray-50'
              }`}
            >
              <Text className="text-base text-gray-800">
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>

              <View className="flex-row items-center gap-1.5">
                {/* 지난 여행 반영 배지. 뺀 카테고리는 회색으로 남겨 뺐다는 걸 보여준다 */}
                {category.adjustmentPercent ? (
                  <View
                    className={`rounded-md px-1.5 py-0.5 ${
                      category.adjustmentDropped
                        ? 'bg-gray-100'
                        : category.adjustmentPercent > 0
                          ? 'bg-red-50'
                          : 'bg-emerald-50'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-black ${
                        category.adjustmentDropped
                          ? 'text-gray-400'
                          : category.adjustmentPercent > 0
                            ? 'text-red-600'
                            : 'text-emerald-700'
                      }`}
                    >
                      {category.adjustmentPercent > 0 ? '+' : '−'}
                      {Math.abs(category.adjustmentPercent)}%
                    </Text>
                  </View>
                ) : null}

                <Text className="text-base font-semibold text-gray-900">
                  {won(category.plannedAmount)}
                </Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
              </View>
            </Pressable>

            {open ? (
              <View className="gap-3 bg-blue-50 pb-4">
                {/* ── 근거 한 줄 ── */}
                <View className="px-4 pt-1">
                  <View className="flex-row items-start gap-1.5">
                    <Ionicons name="bulb-outline" size={15} color="#2563eb" />
                    <Text className="flex-1 text-xs leading-5 text-gray-700">
                      {/*
                        예비비는 basis 를 쓰지 않는다. basis 는 기준 금액을 어떻게
                        뽑았는지("항공·숙소를 뺀 지출의 약 5%")를 말하는데, 화면의
                        비율 계산은 항공·숙소를 포함한 전체 합계를 분모로 쓴다.
                        그대로 두면 문구와 숫자가 서로 다른 말을 한다.
                      */}
                      {isContingency
                        ? '예상하지 못한 지출에 대비하는 여유 금액이에요. 다른 항목 합계의 비율로 정해요.'
                        : (category.productHint ?? category.basis)}
                    </Text>
                  </View>
                </View>

                {/* ── 근거 상품 ── 카드 줄은 좌우 여백까지 흘러 잘린 카드가 보이게 한다 ── */}
                {category.products && category.products.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 px-4"
                  >
                    {category.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        disabled={disabled}
                        onPress={() => onToggleProduct(category.categoryCode, product.id)}
                      />
                    ))}
                  </ScrollView>
                ) : null}

                {/* ── 예비비 비율 ── 상품 대신 비율로 정한다 ── */}
                {isContingency ? (
                  <View className="flex-row gap-1.5 px-4">
                    {CONTINGENCY_OPTIONS.map((option) => {
                      const selected = contingencyChoice === option.value;
                      return (
                        <Pressable
                          key={option.label}
                          accessibilityRole="radio"
                          accessibilityState={{ selected, disabled }}
                          accessibilityLabel={`예비비 ${option.label}`}
                          disabled={disabled}
                          onPress={() => onChangeContingency(option.value)}
                          className={`flex-1 items-center justify-center rounded-xl border py-2.5 ${
                            selected
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-gray-200 bg-white active:bg-gray-100'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              selected ? 'text-white' : 'text-gray-600'
                            }`}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {/* ── 계산 ── */}
                <View className="mx-4 gap-1 rounded-xl bg-white p-3">
                  {/*
                    ⚠️ 계산식 옆에 금액을 두지 않는다.
                       그 값(baseAmount)은 스타일 배수를 적용하기 전 중간값이라
                       화면 어디에도 쓰이지 않는다. '보통' 에서는 추천 금액과
                       같은 숫자라 중복으로 보이고, 다른 스타일에서는 상품 합계와도
                       추천 금액과도 다른 제3의 숫자가 되어 더 헷갈린다.
                       단가가 어디서 나왔는지는 계산식 문장만으로 충분하다.

                       예비비는 예외다. 첫 줄이 비율 계산의 분모라 금액이 필요하다.
                  */}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-gray-500">
                      {isContingency ? '다른 항목 합계' : category.formula}
                    </Text>
                    {isContingency ? (
                      <Text className="text-xs font-medium text-gray-700">
                        {won(otherCategoriesTotal)}
                      </Text>
                    ) : null}
                  </View>

                  {/* 지금 고른 상품이 얼마인지. 예비비에는 상품이 없다. */}
                  {category.productSubtotal !== undefined ? (
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-gray-500">선택한 상품 합계</Text>
                      <Text className="text-xs font-bold text-gray-900">
                        {won(category.productSubtotal)}
                      </Text>
                    </View>
                  ) : null}

                  {/* ── 지난 여행 반영 ── 뺄 수 있고 되돌릴 수 있다 ── */}
                  {category.adjustmentPercent ? (
                    <View className="flex-row items-center justify-between gap-2">
                      <Text
                        className={`flex-1 text-xs ${
                          category.adjustmentDropped ? 'text-gray-400' : 'text-gray-500'
                        }`}
                        numberOfLines={1}
                      >
                        지난 여행 반영 {category.adjustmentPercent > 0 ? '+' : '−'}
                        {Math.abs(category.adjustmentPercent)}%
                      </Text>

                      <Text
                        className={`text-xs font-medium ${
                          category.adjustmentDropped ? 'text-gray-400' : 'text-gray-700'
                        }`}
                      >
                        {category.adjustmentDropped
                          ? '제외됨'
                          : `${(category.adjustmentAmount ?? 0) > 0 ? '+' : '−'}${Math.abs(
                              category.adjustmentAmount ?? 0,
                            ).toLocaleString('ko-KR')}원`}
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          category.adjustmentDropped
                            ? '지난 여행 반영 되돌리기'
                            : '지난 여행 반영 빼기'
                        }
                        disabled={disabled}
                        onPress={() => onToggleDrop(category.categoryCode)}
                        className="rounded-lg border border-gray-200 px-2 py-1 active:bg-gray-100"
                      >
                        <Text className="text-[10px] font-bold text-gray-600">
                          {category.adjustmentDropped ? '되돌리기' : '빼기'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/*
                    맨 아래는 확정될 금액이다. 위 줄들이 이 숫자로 수렴한다.
                    추천 금액은 비교 기준으로 그 아래 작게 둔다. 불변 원본이라
                    사용자가 무엇을 고르든 움직이지 않는다. (CLAUDE.md 4장)
                  */}
                  <View className="mt-0.5 flex-row items-center justify-between border-t border-gray-100 pt-1.5">
                    <Text className="text-xs font-semibold text-gray-700">
                      {CATEGORY_CODE_LABEL[category.categoryCode]} 예산
                    </Text>
                    <Text className="text-sm font-bold text-blue-700">
                      {won(category.plannedAmount)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] text-gray-400">추천 금액</Text>
                    <Text className="text-[11px] font-medium text-gray-400">
                      {won(category.recommendedAmount)}
                      {diff !== 0
                        ? `  ${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('ko-KR')}`
                        : '  그대로'}
                    </Text>
                  </View>
                </View>

                {/* ── 직접 수정 ── 상품으로 안 맞을 때를 위해 남겨 둔다 ── */}
                <View className="px-4">
                  <CurrencyInput
                    label="이 금액으로 잡을게요"
                    value={category.plannedAmount}
                    onChangeValue={(value) => onChangeAmount(category.categoryCode, value ?? 0)}
                    editable={!disabled}
                  />

                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
