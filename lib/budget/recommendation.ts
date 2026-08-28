// ============================================================================
// 예산 추천 계산
//
// 데이터(목적지 기준 금액·스타일 배수)와 계산을 분리한다.
//   lib/constants/destinations.ts     목적지·지역별 기준 금액   [데이터]
//   lib/constants/budgetMultiplier.ts 스타일 배수·반올림 규칙   [데이터]
//   이 파일                            둘을 조립하는 계산       [로직]
//
// ⚠️ DB 를 건드리지 않는다. 순수 계산이다.
//    저장은 화면이 queries/ 를 통해 한다. (CLAUDE.md 7장)
//
// ⚠️ 여기서 만드는 값은 recommended_amount 다. **불변 원본이다.**
//    사용자가 고친 값은 planned_amount 로 따로 저장한다. (CLAUDE.md 4장)
// ============================================================================
import { differenceInCalendarDays, parseISO } from 'date-fns';

import { applyStyleMultiplier, BUDGET_STYLE_MULTIPLIER } from '@/lib/constants/budgetMultiplier';
import {
  DESTINATION_BASIS,
  REGION_BASIS,
  getDestinationBaseline,
  getRegionBaseline,
  type BaselineSource,
  type DestinationCode,
  type RegionCode,
} from '@/lib/constants/destinations';
import { CATEGORY_CODE, type CategoryCode, type TravelStyle } from '@/lib/constants/status';

/**
 * 화면 표시 순서이자 budget_categories.sort_order 다.
 * supabase/seed.sql 의 순서와 같다.
 */
export const CATEGORY_ORDER: CategoryCode[] = [
  CATEGORY_CODE.AIRFARE,
  CATEGORY_CODE.LODGING,
  CATEGORY_CODE.FOOD,
  CATEGORY_CODE.TRANSPORT,
  CATEGORY_CODE.ACTIVITY,
  CATEGORY_CODE.SHOPPING,
  CATEGORY_CODE.INSURANCE,
  CATEGORY_CODE.CONTINGENCY,
];

export type RecommendedCategory = {
  categoryCode: CategoryCode;
  /** 스타일 배수까지 적용하고 1,000원 단위로 반올림한 카테고리 총액 */
  recommendedAmount: number;
  sortOrder: number;

  // ── 이 금액이 어디서 나왔는지 ──────────────────────────────────────
  // 금액만 보여주면 사용자는 믿을 근거도, 고칠 기준도 없다.
  // 화면에서 카테고리를 펼치면 아래 셋을 그대로 보여준다.

  /** 조사 근거 한 줄. 예: '인천–나리타/하네다 왕복 25~30만원대예요.' */
  basis: string;
  /** 계산식. 예: '1인 1박 80,000원 × 4명 × 3박' */
  formula: string;
  /** 배수 적용 전 금액 ('보통' 기준) */
  baseAmount: number;
  /** 적용한 스타일 배수. 1 이면 화면에 따로 표시하지 않는다 */
  multiplier: number;
};

export type BudgetRecommendation = {
  categories: RecommendedCategory[];
  totalAmount: number;
  /** 1인당 금액. 총액 ÷ 인원을 1,000원 단위로 반올림한다 */
  perPersonAmount: number;
  nights: number;
  days: number;
  /** 'baseline' 이면 추정치다. 화면에 그렇게 표시한다 (NFR-004) */
  source: BaselineSource;
  /** 목적지 기준 데이터가 없어 지역 평균을 쓴 경우 */
  isRegionAverage: boolean;
  /** 기준 시점. "2026년 8월 기준" 으로 표시한다 */
  updatedAt: string;
  /** 지역 평균일 때만 채워진다. 있으면 화면에 그대로 노출한다 */
  notice: string | null;
  /** trip_budgets.recommendation_basis_json 에 그대로 넣는다 */
  basis: {
    source: string;
    destination: string;
    nights: number;
    headcount: number;
    style: TravelStyle;
    baselineUpdatedAt: string;
    isRegionAverage: boolean;
    region: RegionCode;
  };
};

export type RecommendationInput = {
  /** 목록에서 고른 목적지. 직접 입력이면 null */
  destinationCode: DestinationCode | null;
  /** 직접 입력일 때 사용자가 고른 지역 */
  region: RegionCode | null;
  /** trips.destination 에 저장할 한글명 */
  destinationName: string;
  /** 'YYYY-MM-DD' */
  startDate: string;
  endDate: string;
  headcount: number;
  travelStyle: TravelStyle;
};

/**
 * 목적지·일정·인원·스타일로 카테고리 8개의 추천 금액을 만든다.
 *
 * 산출 단위 (destinations.ts 주석 참조)
 *   AIRFARE   1인 왕복        × 인원
 *   LODGING   1인 1박         × 인원 × 박수
 *   나머지 6개  1인 1일         × 인원 × 일수
 *
 * 스타일 배수는 **인원·일수를 곱한 뒤** 적용하고 거기서 한 번만 반올림한다.
 * 요율에서 먼저 반올림하면 오차가 인원 × 일수만큼 증폭된다.
 * (budgetMultiplier.ts 의 applyStyleMultiplier 주석)
 */
export function buildBudgetRecommendation(input: RecommendationInput): BudgetRecommendation {
  const { destinationCode, region, destinationName, startDate, endDate, headcount, travelStyle } =
    input;

  const nights = Math.max(
    0,
    differenceInCalendarDays(parseISO(endDate), parseISO(startDate)),
  );
  const days = nights + 1;

  const lookup = destinationCode
    ? getDestinationBaseline(destinationCode, { startDate, endDate, headcount, travelStyle })
    : getRegionBaseline(region ?? 'asia', { startDate, endDate, headcount, travelStyle });

  const { baseline } = lookup;

  const basisMap = destinationCode
    ? DESTINATION_BASIS[destinationCode]
    : REGION_BASIS[lookup.region];

  const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

  const categories: RecommendedCategory[] = CATEGORY_ORDER.map((categoryCode, index) => {
    let base: number;
    let formula: string;

    if (categoryCode === CATEGORY_CODE.AIRFARE) {
      base = baseline.airfarePerPerson * headcount;
      formula = `1인 왕복 ${won(baseline.airfarePerPerson)} × ${headcount}명`;
    } else if (categoryCode === CATEGORY_CODE.LODGING) {
      base = baseline.lodgingPerNight * headcount * nights;
      formula = `1인 1박 ${won(baseline.lodgingPerNight)} × ${headcount}명 × ${nights}박`;
    } else {
      const perDay = baseline.perPersonPerDay[categoryCode];
      base = perDay * headcount * days;
      formula = `1인 1일 ${won(perDay)} × ${headcount}명 × ${days}일`;
    }

    return {
      categoryCode,
      recommendedAmount: applyStyleMultiplier(base, travelStyle, categoryCode),
      sortOrder: index + 1,
      basis: basisMap[categoryCode],
      formula,
      baseAmount: base,
      multiplier: BUDGET_STYLE_MULTIPLIER[travelStyle][categoryCode],
    };
  });

  const totalAmount = categories.reduce((sum, c) => sum + c.recommendedAmount, 0);

  return {
    categories,
    totalAmount,
    perPersonAmount: perPerson(totalAmount, headcount),
    nights,
    days,
    source: lookup.source,
    isRegionAverage: lookup.isRegionAverage,
    updatedAt: lookup.updatedAt,
    notice: lookup.notice,
    basis: {
      source: 'default_rule',
      destination: destinationName,
      nights,
      headcount,
      style: travelStyle,
      baselineUpdatedAt: lookup.updatedAt,
      isRegionAverage: lookup.isRegionAverage,
      region: lookup.region,
    },
  };
}

/**
 * 1인당 금액. 1,000원 단위로 반올림한다.
 *
 * ⚠️ 인원수로 나누면 대개 소수가 나온다. 금액은 원 단위 정수여야 하고
 *    화면에 1,050,000 같은 값이 떨어져야 한다. (CLAUDE.md 9장, NFR-001)
 *    반올림 때문에 per_person × 인원 ≠ 총액이 될 수 있다.
 *    **총액이 기준이고 1인당 금액은 표시·납부 안내용이다.**
 */
export function perPerson(totalAmount: number, headcount: number): number {
  if (headcount <= 0) return 0;
  return Math.round(totalAmount / headcount / 1000) * 1000;
}
