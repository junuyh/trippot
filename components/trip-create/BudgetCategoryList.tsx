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
import { BRAND } from '@/lib/constants/brandColor';
import { CATEGORY_CODE, CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

/** 카테고리를 펼쳤을 때 고를 수 있는 근거 상품 하나. 금액은 화면이 계산해 넘긴다. */
export type CategoryProduct = {
  id: string;
  name: string;
  emoji: string;
  /** 인원·박수·일수까지 곱한 이 상품의 금액 */
  amount: number;
  selected: boolean;
  /** 어떤 선택지인지 한 줄. 여행지 맞춤 항목에만 붙는다 */
  note?: string;
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
  /**
   * 상품이 이 여행지에 맞춰 만들어졌는가.
   *
   * 카탈로그 기본값('4성급 호텔')과 여행지 맞춤('파리 시내 3성 호텔')은
   * 카드만 봐서는 구분되지 않는다. 사용자가 그 차이를 알아야 금액을 믿는다.
   */
  productsFromAi?: boolean;
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
  /**
   * 지난 여행을 반영한 금액. 반영 대상이 아니거나 사용자가 뺐으면 null.
   *
   * ⚠️ recommendedAmount 를 덮어쓰지 않는다. 사용자에게 제시한 값이 비교 기준이
   *    되어야 하는데, 기본 추천과 비교하면 손대지도 않았는데 차이가 뜬다.
   */
  personalizedAmount?: number | null;

  /**
   * 금액을 직접 정하는 중인가.
   *
   * 직접 입력을 시작하면 상품 선택도 지난 여행 반영도 금액에 관여하지 않는다.
   * 그런데 화면에 그대로 남겨 두면 셋이 함께 계산에 참여하는 것처럼 보인다.
   * 그래서 이 모드에서는 그것들을 아예 감춘다. 둘 중 하나다.
   */
  isManual?: boolean;
};

/** 예비비 비율 선택지. null 은 '추천'(기준 금액 그대로)이다. */
export type ContingencyChoice = number | null;

type Props = {
  categories: EditableCategory[];
  onChangeAmount: (categoryCode: CategoryCode, amount: number) => void;
  onToggleProduct: (categoryCode: CategoryCode, productId: string) => void;
  /** 카테고리 하나의 지난 여행 반영을 빼거나 되돌린다 */
  onToggleDrop: (categoryCode: CategoryCode) => void;
  /** 'AI 추천' 과 '직접 입력' 을 오간다 */
  onToggleManual: (categoryCode: CategoryCode) => void;

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
        product.selected ? 'border-brand' : 'border-gray-200'
      }`}
    >
      <View
        className={`h-[70px] items-center justify-center ${
          product.selected ? 'bg-brand-soft' : 'bg-gray-50'
        }`}
      >
        <Text className="text-3xl">{product.emoji}</Text>
      </View>

      <View
        className={`absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full ${
          product.selected ? 'bg-brand' : 'bg-white/90'
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
        {product.note ? (
          <Text numberOfLines={1} className="mt-0.5 text-[10px] leading-3.5 text-gray-400">
            {product.note}
          </Text>
        ) : null}
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
  onToggleManual,
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
        const isContingency = category.categoryCode === CATEGORY_CODE.CONTINGENCY;

        /**
         * 지난 여행 반영이 이 카테고리의 금액에 실제로 관여하는가.
         *
         * ⚠️ 직접 입력 중이면 관여하지 않는다. 금액은 사용자가 적은 값 그대로다.
         *    그런데도 ±% 배지를 남겨 두면, 배지가 설명하지 않는 숫자 옆에서
         *    "이 금액에 지난 여행이 반영돼 있다" 고 잘못 말하게 된다.
         */
        const pastApplies = Boolean(category.adjustmentPercent) && !category.isManual;

        /**
         * '추천보다 ±' 의 비교 기준.
         *
         * 반영이 실제로 걸려 있으면 사용자에게 제시된 값은 개인화 금액이다.
         * 직접 입력 중이면 반영이 빠지므로, 화면에 보이는 '추천 N원' 칩과 같은
         * 기본 추천이 기준이어야 한다. 안 그러면 칩의 숫자와 차이가 어긋난다.
         */
        const baseline = pastApplies
          ? (category.personalizedAmount ?? category.recommendedAmount)
          : category.recommendedAmount;
        const diff = category.plannedAmount - baseline;

        /**
         * 계산 박스에 '○○ 예산' 줄을 따로 둘지.
         *
         * 더해질 줄이 있을 때만 의미가 있다. 없으면 '선택한 상품 합계' 가 곧
         * 최종 금액이라 두 줄이 같은 숫자를 반복한다. 그때는 합계 줄 하나만
         * 남기고 결과의 무게를 그 줄에 준다.
         */
        const showTotalRow = isContingency || Boolean(category.adjustmentPercent);

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
                open ? 'bg-brand-soft' : 'bg-white active:bg-gray-50'
              }`}
            >
              <Text className="text-base text-gray-800">
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>

              <View className="flex-row items-center gap-1.5">
                {/* 지난 여행 반영 배지. 뺀 카테고리는 회색으로 남겨 뺐다는 걸 보여준다 */}
                {category.adjustmentPercent && !category.isManual ? (
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
              <View className="gap-3 bg-brand-soft pb-4">
                {/*
                  ── 근거와 기준 금액 ──
                  두 길(AI 추천 / 직접 입력) 중 무엇을 고를지 판단하려면
                  "AI 는 얼마를 추천했나" 가 근거 옆에 분명히 보여야 한다.
                  그래서 계산부 맨 아래 회색 글씨가 아니라 여기 둔다.
                */}
                <View className="gap-2 px-4 pt-1">
                  <View className="flex-row items-start gap-1.5">
                    <Ionicons name="bulb-outline" size={15} color={BRAND.primary} />
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

                  <View className="flex-row items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5">
                    <Text className="flex-1 text-[11px] text-gray-500" numberOfLines={1}>
                      {category.formula}
                    </Text>
                    <Text className="text-xs font-bold text-gray-900">
                      추천 {won(category.recommendedAmount)}
                    </Text>
                  </View>
                </View>

                {category.isManual ? (
                  /* ── 길 B · 직접 입력 ── 상품도 반영도 관여하지 않는다 ── */
                  <View className="gap-2 px-4">
                    <CurrencyInput
                      label="이 카테고리에 쓸 금액"
                      value={category.plannedAmount}
                      onChangeValue={(value) => onChangeAmount(category.categoryCode, value ?? 0)}
                      editable={!disabled}
                    />

                    {/*
                      ⚠️ 입력은 즉시 반영된다. 여기에 '저장' 을 두지 않는다.
                         이 화면의 확정 지점은 하단 '이 예산으로 여행 만들기' 하나다.
                         카테고리마다 저장 버튼을 두면 확정 지점이 8개가 되고,
                         누르지 않고 넘어간 값이 어떻게 되는지 알 수 없게 된다.

                         대신 입력한 값이 곧 이 카테고리 예산이라는 걸 그 자리에서
                         보여준다. 길 A 의 계산 박스 맨 아래 줄과 같은 모양이라
                         두 길을 오가도 결과를 읽는 자리가 바뀌지 않는다.
                    */}
                    <View className="gap-1 rounded-xl bg-white p-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-semibold text-gray-700">
                          {CATEGORY_CODE_LABEL[category.categoryCode]} 예산
                        </Text>
                        <Text className="text-sm font-bold text-brand">
                          {won(category.plannedAmount)}
                        </Text>
                      </View>

                      {diff !== 0 ? (
                        <Text
                          className={`text-right text-[11px] font-medium ${
                            diff > 0 ? 'text-red-500' : 'text-blue-600'
                          }`}
                        >
                          추천보다 {diff > 0 ? '+' : '−'}
                          {Math.abs(diff).toLocaleString('ko-KR')}원
                        </Text>
                      ) : null}
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="추천으로 돌아가기"
                      disabled={disabled}
                      onPress={() => onToggleManual(category.categoryCode)}
                      className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white active:bg-gray-100"
                    >
                      <Ionicons name="sparkles-outline" size={14} color={BRAND.primary} />
                      <Text className="text-[13px] font-bold text-brand">추천으로 돌아가기</Text>
                    </Pressable>
                  </View>
                ) : (
                  /* ── 길 A · AI 추천 ── 상품을 골라 금액을 만든다 ── */
                  <>
                    {/* 카드 줄은 좌우 여백까지 흘러 잘린 카드가 보이게 한다 */}
                    {category.productsFromAi && category.products?.length ? (
                      <View className="flex-row items-center gap-1 px-4">
                        <Ionicons name="sparkles" size={12} color={BRAND.primary} />
                        <Text className="text-[11px] font-semibold text-brand">
                          이 여행지에 맞춰 만든 선택지예요
                        </Text>
                      </View>
                    ) : null}

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
                                  ? 'border-brand bg-brand'
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

                    {/*
                      ── 계산 ── 줄들이 맨 아래 금액으로 정확히 더해진다 ──

                      ⚠️ 지난 여행 반영이 없으면 최종 금액은 상품 합계를 그대로
                         돌려준다.(budget-fund 의 computeAmount) 그래서 두 줄을
                         모두 그리면 같은 숫자가 연달아 나오고, 더하는 것도 없이
                         '= 78,000원' 만 쓴 셈이 된다. 그때는 '선택한 상품 합계'
                         한 줄만 남긴다. 금액이 어디서 나왔는지 말해 주는 쪽이
                         '○○ 예산' 이라는 되풀이보다 알려주는 것이 많다.
                         혼자 남는 줄이므로 결과의 무게(파란 굵은 글씨)를 갖는다.

                         예비비는 예외다. '다른 항목 합계' 는 비율 계산의 분모라서
                         반영이 없어도 근거로 보여야 한다.
                    */}
                    <View className="mx-4 gap-1 rounded-xl bg-white p-3">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={
                            showTotalRow
                              ? 'text-xs text-gray-500'
                              : 'text-xs font-semibold text-gray-700'
                          }
                        >
                          {isContingency ? '다른 항목 합계' : '선택한 상품 합계'}
                        </Text>
                        <Text
                          className={
                            showTotalRow
                              ? 'text-xs font-bold text-gray-900'
                              : 'text-sm font-bold text-brand'
                          }
                        >
                          {won(
                            isContingency
                              ? otherCategoriesTotal
                              : (category.productSubtotal ?? 0),
                          )}
                        </Text>
                      </View>

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

                      {showTotalRow ? (
                        <View className="mt-0.5 flex-row items-center justify-between border-t border-gray-100 pt-1.5">
                          <Text className="text-xs font-semibold text-gray-700">
                            {CATEGORY_CODE_LABEL[category.categoryCode]} 예산
                          </Text>
                          <Text className="text-sm font-bold text-brand">
                            {won(category.plannedAmount)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/*
                      길 B 로 가는 문. 여기서부터는 AI 추천도 지난 여행 반영도
                      금액에 관여하지 않는다.
                    */}
                    <View className="px-4">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="금액 직접 정하기"
                        disabled={disabled}
                        onPress={() => onToggleManual(category.categoryCode)}
                        className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 active:bg-gray-100"
                      >
                        <Ionicons name="create-outline" size={14} color="#5c6675" />
                        <Text className="text-[13px] font-bold text-gray-600">금액 직접 정하기</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
