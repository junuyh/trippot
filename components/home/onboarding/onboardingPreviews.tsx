// ============================================================================
// 신규 사용자 홈 온보딩 — 단계별 실제 화면 미리보기 (2026-09-17 v2)
//
// ⚠️ **실제 앱 화면의 컴포넌트를 그대로 가져와 작게 줄여 그린다.** 흉내 낸 그림이 아니다.
//    여행을 만든 뒤 그 화면에 들어갔을 때 "아까 본 페이지가 이거구나" 가 이어져야 한다.
//      PLAN      여행 만들기 3단계 (app/trips/new/budget-fund)  BudgetResultHero · TravelStyleSelector
//                                                              · BudgetCategoryList
//      FUND      여행 준비 홈 (app/trips/[tripId])              BaggageTagCard · FundManagerCard
//      RECORD    여행 종료 홈 카테고리별 결산                    SettlementVaultGrid
//      NEXT TRIP 여행 종료 홈 여행 유형 · 영수증                 TravelTypeCard · TripReceiptCard
//
// ⚠️ **금액만 예시 데이터다.** DB 를 부르지 않는다. 신규 사용자에게는 아직 여행이 없다.
//    여행 유형 · 한 줄 기록은 예시 금액을 실제 로직(resolveTravelType · buildTripRecord)에
//    넣어 만든다 — 유형과 문구를 지어내지 않는다.
// ⚠️ **다른 담당자의 컴포넌트를 고치지 않고 가져다 쓰기만 한다.** (CLAUDE.md 13장)
//    그쪽 props 가 바뀌면 여기 타입 검사가 깨져서 바로 알 수 있다.
// ⚠️ 미리보기는 눌리지 않는다(pointerEvents none). 버튼처럼 보이는 곳을 눌러도
//    어디로도 가지 않고, 캐러셀을 넘기는 손가락도 막지 않는다.
// ⚠️ 예시 숫자끼리 앞뒤가 맞아야 한다. 바꾸면 같이 고친다.
//      PLAN  항공 640,000(1인 왕복 320,000 × 2명) + 280,000 + 228,000 + 90,000 = 1,238,000 · 2명
//      FUND  480,000 / 1,238,000 = 39% (계산해서 넣는다)
//      홍콩   계획 3,648,000 · 실제 4,740,000 (129.9%) · 쇼핑 +760,000 · 최대 지출 쇼핑
//            (숙소 +100,000 · 식비 +200,000 · 교통 +34,000 · 액티비티 −52,000 · 보험 +2,000
//             · 예비비 +48,000 · 항공 동일)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import {
  BudgetCategoryList,
  BudgetResultHero,
  TravelStyleSelector,
  type EditableCategory,
} from '@/components/trip-create';
// ⚠️ trip-create 진입점(index.ts)이 이 타입을 내보내지 않는다. 다른 담당자 파일이라
//    진입점을 고치지 않고 정의된 파일에서 타입만 가져온다. (CLAUDE.md 13장)
import type { CategoryProduct } from '@/components/trip-create/BudgetCategoryList';
import { BaggageTagCard, FundManagerCard } from '@/components/trip-home';
import { SettlementVaultGrid, TravelTypeCard, TripReceiptCard, type SettlementVault } from '@/components/trip-type';
import { resolveTravelType } from '@/lib/budget/travelType';
import { buildTripRecord } from '@/lib/budget/tripRecord';
import { getDefaultProductIds, getProductCategory } from '@/lib/constants/budgetProducts';
import { countryTheme } from '@/lib/constants/countryTheme';
import {
  BUDGET_METHOD,
  CATEGORY_CODE,
  TRAVEL_STYLE,
  TRAVEL_STYLE_LABEL,
  type CategoryCode,
} from '@/lib/constants/status';

/** 미리보기 무대 바탕. 흰 페이지가 떠 보이게 한다. (pot-visual) */
export const PREVIEW_STAGE = '#EEF0F4';
/** 실제 화면을 이 폭으로 그린 뒤 무대 폭에 맞춰 줄인다. 보통 휴대폰 폭이다. */
const PAGE_WIDTH = 390;

const noop = () => {};

export type PreviewSize = { width: number };

/** 줄인 페이지 아래 여백(실제 크기 기준). 마지막 카드가 틀 끝에 붙지 않게. */
const PAGE_BOTTOM = 20;

/**
 * 휴대폰 화면 한 장을 줄여 보여주는 틀.
 *
 * 실제 폭(390)으로 그린 다음 왼쪽 위를 기준으로 줄인다.
 *
 * ⚠️ **아래를 자르지 않는다.** (2026-09-17) 전에는 무대 높이에서 잘라 "스크롤하면 더 있는
 *    페이지" 로 보이게 했는데, 영수증 · 정산 격자처럼 끝까지 봐야 뜻이 통하는 카드가
 *    반쯤 잘려 망가진 화면처럼 보였다. 이제 내용 높이를 재서 전부 그린다.
 *    길어지면 온보딩 페이지가 그 장 안에서 세로로 스크롤한다. (OnboardingView)
 * ⚠️ transform 은 레이아웃 크기를 줄이지 않는다. 그래서 줄이기 전 높이를 onLayout 으로 재고
 *    틀 높이를 (그 높이 × 배율) 로 직접 준다.
 */
function MiniPage({
  size,
  title,
  children,
}: {
  size: PreviewSize;
  /** 위 앱바 제목. 실제 화면에 앱바가 없으면 null */
  title: string | null;
  children: ReactNode;
}) {
  const scale = size.width / PAGE_WIDTH;
  /** 줄이기 전 페이지 높이. 재기 전에는 0 이다. */
  const [pageHeight, setPageHeight] = useState(0);
  return (
    <View
      pointerEvents="none"
      style={{
        width: size.width,
        height: Math.ceil(pageHeight * scale),
        overflow: 'hidden',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
      }}
    >
      <View
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
        style={{ width: PAGE_WIDTH, paddingBottom: PAGE_BOTTOM, transformOrigin: 'top left', transform: [{ scale }] }}
      >
        {title ? (
          <View className="flex-row items-center border-b border-gray-100 px-3" style={{ height: 48 }}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
            <Text className="flex-1 text-center text-[17px] font-semibold text-gray-900" style={{ marginRight: 24 }}>
              {title}
            </Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

// ── 01 PLAN — 여행 만들기 · 예산 (TRIP-03) ─────────────────────────────────
const PLAN_HEADCOUNT = 2;
/** 1인 왕복 항공권 기준 금액. 항공 상품 카드 금액이 여기서 나온다. */
const PLAN_AIRFARE_PER_PERSON = 320_000;

/**
 * 펼쳐 둔 항공 카테고리의 상품 카드. (2026-09-17)
 *
 * ⚠️ 상품명 · 이모지 · 비율 · 안내 문구는 **실제 카탈로그(budgetProducts)** 에서 가져온다.
 *    금액 계산도 실제 화면과 같다 — 1인 왕복 × 비율 × 인원, 1,000원 단위 반올림.
 *    기본 선택은 '보통' 스타일의 기본 상품(대형항공사 직항)이다.
 */
const AIRFARE_CATALOG = getProductCategory(CATEGORY_CODE.AIRFARE);
const AIRFARE_DEFAULTS = getDefaultProductIds(TRAVEL_STYLE.STANDARD);
const AIRFARE_PRODUCTS: CategoryProduct[] = (AIRFARE_CATALOG?.products ?? []).map((product) => ({
  id: product.id,
  name: product.name,
  emoji: product.emoji,
  amount: Math.round((PLAN_AIRFARE_PER_PERSON * product.ratio * PLAN_HEADCOUNT) / 1000) * 1000,
  selected: AIRFARE_DEFAULTS.has(product.id),
}));
const PLAN_AIRFARE = PLAN_AIRFARE_PER_PERSON * PLAN_HEADCOUNT;

const PLAN_AMOUNTS: [CategoryCode, number][] = [
  [CATEGORY_CODE.AIRFARE, PLAN_AIRFARE],
  [CATEGORY_CODE.LODGING, 280_000],
  [CATEGORY_CODE.FOOD, 228_000],
  [CATEGORY_CODE.TRANSPORT, 90_000],
];
const PLAN_TOTAL = PLAN_AMOUNTS.reduce((sum, [, amount]) => sum + amount, 0);
const PLAN_CATEGORIES: EditableCategory[] = PLAN_AMOUNTS.map(([categoryCode, amount]) => {
  const base: EditableCategory = {
    categoryCode,
    recommendedAmount: amount,
    plannedAmount: amount,
    basis: '',
    formula: '',
    baseAmount: amount,
    multiplier: 1,
  };
  if (categoryCode !== CATEGORY_CODE.AIRFARE || !AIRFARE_CATALOG) return base;
  return {
    ...base,
    // 실제 화면의 계산식 문구와 같다. (lib/budget/recommendation.ts)
    formula: `1인 왕복 ${PLAN_AIRFARE_PER_PERSON.toLocaleString('ko-KR')}원 × ${PLAN_HEADCOUNT}명`,
    products: AIRFARE_PRODUCTS,
    productHint: AIRFARE_CATALOG.hint,
    singleSelect: AIRFARE_CATALOG.single,
    productSubtotal: amount,
  };
});
/** 여행자금 예시 — 목표의 약 40% 를 모았다. */
const FUND_RAISED = 480_000;

export function PlanPreview({ size }: { size: PreviewSize }) {
  return (
    <MiniPage size={size} title="여행 만들기">
      <View className="px-5">
        <BudgetResultHero
          method={BUDGET_METHOD.RECOMMENDED}
          totalAmount={PLAN_TOTAL}
          headcount={PLAN_HEADCOUNT}
          perPersonAmount={Math.round(PLAN_TOTAL / PLAN_HEADCOUNT)}
          styleLabel={TRAVEL_STYLE_LABEL.standard}
          pastApplied={false}
          onToggleMethod={noop}
          amountEditing={false}
          onStartEditAmount={noop}
          userTotalDraft={null}
          onChangeUserTotalDraft={noop}
          onApplyUserTotal={noop}
        />
        {/* 실제 화면처럼 총액과 예산 구성 사이에 여행 스타일을 둔다. 항공 상품의 기본 선택이 '보통' 기준이다 */}
        <View className="mt-6">
          <Text className="mb-2.5 text-base font-semibold text-gray-900">어떤 여행을 원하세요?</Text>
          <View className="rounded-2xl border border-gray-200 bg-white p-3.5">
            <TravelStyleSelector value={TRAVEL_STYLE.STANDARD} onChange={noop} />
          </View>
        </View>
        <View className="mt-6">
          <Text className="mb-2 text-base font-semibold text-gray-900">예산 구성</Text>
          {/* 실제 화면(app/trips/new/budget-fund.tsx)의 안내 줄과 같다 */}
          <Text className="mx-0.5 mb-2 text-[11px] text-gray-400">
            항목을 눌러 추천 근거와 금액을 조정할 수 있어요.
          </Text>
          {/* 항공을 펼쳐 둔다 — 추천 근거 · 상품 카드가 이 서비스의 '근거 있는 예산' 이다 */}
          <BudgetCategoryList
            categories={PLAN_CATEGORIES}
            onChangeAmount={noop}
            onToggleProduct={noop}
            onToggleDrop={noop}
            onToggleManual={noop}
            otherCategoriesTotal={PLAN_TOTAL}
            contingencyChoice={null}
            onChangeContingency={noop}
            editingCode={CATEGORY_CODE.AIRFARE}
            onToggleEditing={noop}
          />
        </View>
      </View>
    </MiniPage>
  );
}

// ── 02 FUND — 여행 준비 홈 · 여행자금 (TRIP-HOME-01) ───────────────────────
const TOKYO = countryTheme('일본');

export function FundPreview({ size }: { size: PreviewSize }) {
  return (
    <MiniPage size={size} title={null}>
      <View className="gap-6 px-4 pt-4">
        <BaggageTagCard
          theme={TOKYO}
          flag="🇯🇵"
          countryCode={TOKYO.code}
          destinationEn="TOKYO"
          airportCode="NRT"
          dateLabel="10.12–10.14"
          headcount={PLAN_HEADCOUNT}
          groupLabel="개인 여행"
          dDay={{ label: 'D-24', ongoing: false }}
          raisedAmount={FUND_RAISED}
          targetAmount={PLAN_TOTAL}
          progress={Math.round((FUND_RAISED / PLAN_TOTAL) * 100)}
          onPressFund={noop}
          onPressEdit={noop}
        />
        <View className="gap-2.5">
          <View style={{ marginHorizontal: 4, marginBottom: 11 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.1, color: TOKYO.primary }}>
              TRAVEL FUND
            </Text>
            <Text className="mt-1.5 text-[17px] font-extrabold" style={{ color: TOKYO.neutral }}>
              여행자금 관리
            </Text>
          </View>
          <FundManagerCard
            theme={TOKYO}
            sourceLabel="직접 입력"
            latest={{ amount: 200_000, isDeposit: true }}
            totalCount={3}
            onPress={noop}
          />
        </View>
      </View>
    </MiniPage>
  );
}

// ── 홍콩 여행 예시 결산 — RECORD · NEXT TRIP 이 같은 여행을 본다 ─────────────
const HONG_KONG = countryTheme('홍콩');
/** 계획 합 3,648,000 · 실제 합 4,740,000 */
/** 실제 결산 화면과 같은 카테고리 순서다. 격자가 이 순서대로 그린다. */
const HONG_KONG_ROWS: { categoryCode: CategoryCode; plannedAmount: number; actualAmount: number }[] = [
  { categoryCode: CATEGORY_CODE.AIRFARE, plannedAmount: 1_050_000, actualAmount: 1_050_000 },
  { categoryCode: CATEGORY_CODE.LODGING, plannedAmount: 1_100_000, actualAmount: 1_200_000 },
  { categoryCode: CATEGORY_CODE.FOOD, plannedAmount: 600_000, actualAmount: 800_000 },
  { categoryCode: CATEGORY_CODE.TRANSPORT, plannedAmount: 120_000, actualAmount: 154_000 },
  { categoryCode: CATEGORY_CODE.ACTIVITY, plannedAmount: 188_000, actualAmount: 136_000 },
  { categoryCode: CATEGORY_CODE.SHOPPING, plannedAmount: 490_000, actualAmount: 1_250_000 },
  { categoryCode: CATEGORY_CODE.INSURANCE, plannedAmount: 40_000, actualAmount: 42_000 },
  { categoryCode: CATEGORY_CODE.CONTINGENCY, plannedAmount: 60_000, actualAmount: 108_000 },
];
const HONG_KONG_TARGET = HONG_KONG_ROWS.reduce((sum, row) => sum + row.plannedAmount, 0);
const HONG_KONG_ACTUAL = HONG_KONG_ROWS.reduce((sum, row) => sum + row.actualAmount, 0);
const HONG_KONG_RECORD = buildTripRecord(HONG_KONG_ROWS);
/** 여행 종료 홈과 같은 계산이다. (app/trips/[tripId]/index.tsx provisionalType) */
const HONG_KONG_TYPE = resolveTravelType(HONG_KONG_ROWS);
/** 영수증의 가장 많이 초과 · 절약한 카테고리. 실제 화면(app/trips/[tripId]/index.tsx)과 같은 방식이다. */
const HONG_KONG_DIFFS = HONG_KONG_ROWS.filter((row) => row.plannedAmount > 0 && row.actualAmount > 0).map(
  (row) => ({ categoryCode: row.categoryCode, diff: row.actualAmount - row.plannedAmount }),
);
const HONG_KONG_TOP_OVER =
  HONG_KONG_DIFFS.filter((row) => row.diff > 0).sort((a, b) => b.diff - a.diff)[0] ?? null;
const HONG_KONG_TOP_SAVED =
  HONG_KONG_DIFFS.filter((row) => row.diff < 0).sort((a, b) => a.diff - b.diff)[0] ?? null;

// ── 03 RECORD — 여행 종료 홈 · 카테고리별 결산 ──────────────────────────────
/** 실제 화면처럼 8칸을 모두 보여준다. 네 칸만 두면 격자가 잘린 것처럼 보인다. */
const RECORD_VAULTS: SettlementVault[] = HONG_KONG_ROWS.map((row) => ({
  categoryId: null,
  ...row,
}));

export function RecordPreview({ size }: { size: PreviewSize }) {
  return (
    <MiniPage size={size} title={null}>
      <View className="gap-2.5 px-4 pt-5">
        {/* 실제 화면(app/trips/[tripId]/index.tsx)의 제목 줄과 같다 */}
        <View className="flex-row items-end justify-between" style={{ marginHorizontal: 4, marginBottom: 11 }}>
          <Text className="text-[17px] font-extrabold" style={{ color: HONG_KONG.neutral }}>
            홍콩 여행, 이렇게 다녀왔어요
          </Text>
          <Text className="text-[10px] text-gray-400">카테고리별 정산</Text>
        </View>
        <SettlementVaultGrid theme={HONG_KONG} categories={RECORD_VAULTS} />
      </View>
    </MiniPage>
  );
}

// ── 04 NEXT TRIP — 여행 종료 홈 · 여행 유형 · 영수증 ────────────────────────
// 실제 화면과 같은 순서다 — 유형 카드가 위, 영수증이 아래.
// 미리보기는 아래가 잘리므로 가장 눈에 띄는 유형 카드가 먼저 보인다.
export function NextTripPreview({ size }: { size: PreviewSize }) {
  return (
    <MiniPage size={size} title={null}>
      <View className="gap-6 px-4 pt-4">
        <TravelTypeCard
          code={HONG_KONG_TYPE.type}
          accuracyBp={HONG_KONG_TYPE.accuracyBp}
          periodLabel="2026.09.12 – 09.16"
          topSpentLabel={HONG_KONG_RECORD.topSpentLabel}
          topSavedLabel={HONG_KONG_RECORD.topSavedLabel}
          destinationEn="HONG KONG"
          onPress={noop}
        />
        <TripReceiptCard
          theme={HONG_KONG}
          destinationEn="HONG KONG"
          periodLabel="12 SEP — 16 SEP"
          headcount={PLAN_HEADCOUNT}
          targetAmount={HONG_KONG_TARGET}
          actualAmount={HONG_KONG_ACTUAL}
          topOver={HONG_KONG_TOP_OVER}
          topSaved={HONG_KONG_TOP_SAVED}
        />
      </View>
    </MiniPage>
  );
}
