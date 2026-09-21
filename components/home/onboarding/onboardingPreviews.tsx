// ============================================================================
// 신규 사용자 홈 온보딩 — 단계별 실제 화면 미리보기 (2026-09-17 v2)
//
// ⚠️ **실제 앱 화면의 컴포넌트를 그대로 가져와 작게 줄여 그린다.** 흉내 낸 그림이 아니다.
//    여행을 만든 뒤 그 화면에 들어갔을 때 "아까 본 페이지가 이거구나" 가 이어져야 한다.
//      PLAN      여행 만들기 3단계 (app/trips/new/budget-fund)  BudgetResultHero · TravelStyleSelector
//                                                              · BudgetCategoryList
//      FUND      여행 준비 홈 (app/trips/[tripId])              BaggageTagCard · FundManagerCard
//      RECORD    입출금 전체 내역 (FUND-03)                      RecentFundList (칩 · 요약 · 날짜 머리글은 재구성)
//      NEXT TRIP 여행 종료 홈 여행 유형 · 영수증 · 카테고리별 정산  TravelTypeCard · TripReceiptCard
//                                                              · SettlementVaultGrid
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
//      RECORD 같은 도쿄 여행 · 지출 5건 162,000 (10/12 130,000 · 10/13 32,000)
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
import { RecentFundList, type RecentFundItem } from '@/components/fund';
import { BaggageTagCard, FundManagerCard } from '@/components/trip-home';
import { SettlementVaultGrid, TravelTypeCard, TripReceiptCard, type SettlementVault } from '@/components/trip-type';
import { resolveTravelType } from '@/lib/budget/travelType';
import { buildTripRecord } from '@/lib/budget/tripRecord';
import { getDefaultProductIds, getProductCategory } from '@/lib/constants/budgetProducts';
import { countryTheme } from '@/lib/constants/countryTheme';
import {
  BUDGET_METHOD,
  CATEGORY_CODE,
  REFUND_STATUS,
  TRANSACTION_TYPE,
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
 *
 * ── 높이를 만드는 방법 (2026-09-21 고쳐 씀) ────────────────────────────────
 * transform 은 레이아웃 크기를 줄이지 않는다. 줄인 그림에 틀을 맞추려면 줄어든 만큼을
 * 어딘가에서 빼야 한다. 두 가지 방법이 있고, 둘의 차이가 이 버그였다.
 *
 *   (전) 바깥 틀에 height = 잰 높이 × 배율 을 직접 준다
 *        → 재는 칸이 **높이가 고정된 틀 안**에 들어간다. 그 안에서 다시 레이아웃이
 *          일어나면(카드가 제 폭을 재고 다시 그리는 경우) 잰 값이 틀 높이에 끌려
 *          점점 작아졌다. 재기 → 틀 줄이기 → 더 작게 재기 가 반복돼 미리보기가
 *          몇 줄만 남고 잘렸다. FUND · NEXT TRIP 장이 그랬다 — 두 장의 첫 카드
 *          (BaggageTagCard · TravelTypeCard)가 onLayout 으로 제 폭을 재고 다시 그린다.
 *
 *   (후) 바깥 틀 높이를 정하지 않고, **안쪽 칸의 아래 여백(marginBottom)에서 줄어든 만큼을 뺀다**
 *        → 틀 높이는 (잰 높이 − 뺀 만큼) = 줄인 그림 높이가 된다. 재는 칸은 높이가
 *          고정된 틀 안에 있지 않으므로 몇 번을 다시 재도 값이 흔들리지 않는다.
 *          margin 은 그 칸의 레이아웃 높이에 들어가지 않는다 — 그래서 되먹임이 없다.
 *
 * ⚠️ 잰 높이는 **커질 때만** 받는다. 혹시 또 작게 재는 일이 생겨도 그림이 잘리지 않고
 *    아래 흰 여백이 조금 남는 선에서 끝난다. 미리보기는 고정된 예시라 내용이 줄어들 일이 없다.
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
  /** 줄어든 만큼. 아래 여백에서 뺀다. 재기 전에는 0 이라 한 프레임 동안 실제 크기로 보인다. */
  const trim = pageHeight > 0 ? -Math.round(pageHeight * (1 - scale)) : 0;
  return (
    <View
      pointerEvents="none"
      style={{
        width: size.width,
        // ⚠️ height 를 주지 않는다. 안쪽 칸의 아래 여백이 틀 높이를 만든다. (위 주석)
        overflow: 'hidden',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
      }}
    >
      <View
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height);
          // [임시 진단 · 2026-09-21] 또 잘리면 이 줄의 숫자를 본다. 확인되면 지운다.
          if (__DEV__) console.log('[preview]', title ?? '(제목 없음)', 'height=', next, 'scale=', scale.toFixed(2));
          setPageHeight((prev) => (next > prev ? next : prev));
        }}
        style={{
          width: PAGE_WIDTH,
          paddingBottom: PAGE_BOTTOM,
          transformOrigin: 'top left',
          transform: [{ scale }],
          marginBottom: trim,
        }}
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

/** 여행 종료 홈 카테고리별 정산 8칸. NEXT TRIP 장에서 영수증 아래에 둔다. */
const SETTLEMENT_VAULTS: SettlementVault[] = HONG_KONG_ROWS.map((row) => ({
  categoryId: null,
  ...row,
}));

// ── 03 RECORD — 입출금 전체 내역 (FUND-03) ──────────────────────────────────
// ⚠️ 2026-09-21 세 번째 교체다.
//    ① 카테고리별 정산 격자 → 여행이 끝난 뒤 화면이라 04 장으로 옮겼다
//    ② 여행 중 홈(오늘 쓸 수 있는 돈) → 기록한 결과라 '기록해요' 와 맞지 않았다
//    ③ 지출 기록 시트 → 기록하는 순간만 보여 무엇이 쌓이는지 안 보였다
//    지금은 **기록이 쌓인 전체 내역 화면**이다. 날짜별로 묶인 지출이 한눈에 보인다.
//
// ⚠️ 실제 화면의 목록 줄은 그 화면 파일 안에 스와이프 동작과 함께 들어 있어 꺼내 쓸 수 없다.
//    그래서 줄은 **여행자금 화면과 같은 RecentFundList** 로 그리고, 보기 칩 · 요약 줄 ·
//    날짜 머리글은 같은 문구 · 같은 크기로 다시 세웠다. 그쪽 화면이 바뀌면 여기도 같이 본다.
//
// 예시 — FUND 장의 도쿄 여행. 출발 전 항공 · 숙소부터 여행 이틀째 점심까지 7건.
const RECORD_SPENDS: {
  name: string;
  amount: number;
  occurredAt: string;
  categoryCode: CategoryCode;
}[] = [
  { name: '회전초밥 점심', amount: 24_000, occurredAt: '2026-10-13T12:40:00', categoryCode: CATEGORY_CODE.FOOD },
  { name: '편의점 아침', amount: 8_000, occurredAt: '2026-10-13T08:50:00', categoryCode: CATEGORY_CODE.FOOD },
  { name: '스카이트리 전망대', amount: 56_000, occurredAt: '2026-10-12T17:20:00', categoryCode: CATEGORY_CODE.ACTIVITY },
  { name: '라멘', amount: 24_000, occurredAt: '2026-10-12T20:30:00', categoryCode: CATEGORY_CODE.FOOD },
  { name: '스이카 충전', amount: 50_000, occurredAt: '2026-10-12T11:10:00', categoryCode: CATEGORY_CODE.TRANSPORT },
];

/** 날짜별로 묶는다. 실제 화면과 같은 방식이다 — 최신 날짜가 위. */
const RECORD_SECTIONS = [
  { title: '10월 13일', rows: RECORD_SPENDS.filter((s) => s.occurredAt.startsWith('2026-10-13')) },
  { title: '10월 12일', rows: RECORD_SPENDS.filter((s) => s.occurredAt.startsWith('2026-10-12')) },
];

function toFundItem(spend: (typeof RECORD_SPENDS)[number], index: number): RecentFundItem {
  return {
    id: `record-${index}`,
    name: spend.name,
    amount: spend.amount,
    occurredAt: spend.occurredAt,
    transactionType: TRANSACTION_TYPE.WITHDRAWAL,
    refundStatus: REFUND_STATUS.NONE,
    categoryCode: spend.categoryCode,
    needsReview: false,
  };
}

/** 보기 칩. 실제 화면과 같은 네 가지다. '지출' 을 고른 상태로 둔다. */
const RECORD_CHIPS = [
  { key: 'ALL', label: `전체 ${RECORD_SPENDS.length + 2}` },
  { key: 'DEPOSIT', label: '입금 2' },
  { key: 'SPEND', label: `지출 ${RECORD_SPENDS.length}` },
  { key: 'REVIEW', label: '확인 필요' },
] as const;

const RECORD_TOTAL = RECORD_SPENDS.reduce((sum, s) => sum + s.amount, 0);

export function RecordPreview({ size }: { size: PreviewSize }) {
  return (
    <MiniPage size={size} title="입출금 전체 내역">
      {/* 보기 칩 */}
      <View className="flex-row" style={{ gap: 7, paddingHorizontal: 16, paddingTop: 12 }}>
        {RECORD_CHIPS.map((chip) => {
          const active = chip.key === 'SPEND';
          return (
            <View
              key={chip.key}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: active ? TOKYO.primary : '#e5e8ec',
                backgroundColor: active ? TOKYO.primarySoft : '#fff',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: active ? '800' : '400',
                  color: active ? TOKYO.primary : '#687281',
                }}
              >
                {chip.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 요약 줄 */}
      <View
        className="flex-row items-center justify-between"
        style={{
          marginHorizontal: 16,
          marginTop: 12,
          paddingHorizontal: 13,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: '#f5f6f8',
        }}
      >
        <Text style={{ fontSize: 11, color: '#687281' }}>지출 합계</Text>
        <Text style={{ fontSize: 13, fontWeight: '900', color: '#121a2a' }}>
          {RECORD_TOTAL.toLocaleString('ko-KR')}원
        </Text>
      </View>

      {/* 날짜별 목록 */}
      {RECORD_SECTIONS.map((section) => (
        <View key={section.title}>
          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#121a2a' }}>{section.title}</Text>
            <Text style={{ fontSize: 11, color: '#8b94a2' }}>
              지출 {section.rows.reduce((sum, s) => sum + s.amount, 0).toLocaleString('ko-KR')}원
            </Text>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <RecentFundList
              theme={TOKYO}
              transactions={section.rows.map(toFundItem)}
              onSelect={noop}
            />
          </View>
        </View>
      ))}
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
        {/* 실제 여행 종료 홈처럼 영수증 아래에 카테고리별 정산 (app/trips/[tripId]/index.tsx) */}
        <View className="gap-2.5">
          <View className="flex-row items-end justify-between" style={{ marginHorizontal: 4, marginBottom: 11 }}>
            <Text className="text-[17px] font-extrabold" style={{ color: HONG_KONG.neutral }}>
              홍콩 여행, 이렇게 다녀왔어요
            </Text>
            <Text className="text-[10px] text-gray-400">카테고리별 정산</Text>
          </View>
          <SettlementVaultGrid theme={HONG_KONG} categories={SETTLEMENT_VAULTS} />
        </View>
      </View>
    </MiniPage>
  );
}
