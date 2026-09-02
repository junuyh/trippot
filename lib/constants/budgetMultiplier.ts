// ============================================================================
// travel_style 별 예산 추천 배수
//
// lib/constants/destinations.ts 의 기준 금액은 전부 travel_style = 'standard'
// 기준이다. 여기 standard 행이 전부 1.00 인 것은 그래서다.
// standard 값을 1.00 이 아닌 값으로 바꾸면 destinations.ts 의 기준값 자체가
// 다른 뜻이 된다. 바꾸지 않는다.
//
// ⚠️ 목적지 데이터와 파일을 나눈 이유
//    배수만 조정하고 싶을 때 목적지 파일을 건드리지 않기 위해서다.
//    배수는 UT 결과에 따라 자주 바뀌지만 목적지 기준값은 그렇지 않다.
//
// ⚠️ 카테고리마다 배수가 다르다. 단일 배수를 쓰지 않는다.
//    이코노미 왕복은 스타일이 바뀌어도 요금이 거의 그대로지만,
//    숙박은 게스트하우스와 특급호텔이 몇 배씩 차이난다.
//    하나의 배수로 뭉뚱그리면 '근거 있는 예산'이 성립하지 않는다.
//
// 참고 — 도쿄 4인 3박 4일 총액 (destinations.ts 기준값 × 이 배수)
//    budget 2,967,000 / standard 4,000,000 / comfort 5,324,000
//    standard 는 supabase/seed.sql 의 도쿄 recommended_amount 와 정확히 일치한다.
// ============================================================================

import type { CategoryCode, TravelStyle } from './status';

/**
 * 카테고리별 스타일 배수.
 *
 * Record<TravelStyle, Record<CategoryCode, number>> 라서
 * 스타일이나 카테고리가 추가되면 누락이 컴파일 에러로 잡힌다.
 */
export const BUDGET_STYLE_MULTIPLIER: Record<TravelStyle, Record<CategoryCode, number>> = {
  // ── 아끼는 편 — 가성비 위주, 게스트하우스·현지식 ──────────────────────
  budget: {
    // LCC·경유편으로 내려가도 한계가 있다. 항공은 절약 여지가 가장 작다
    AIRFARE: 0.95,
    // 8개 중 절감 폭이 가장 크다. 게스트하우스·도미토리는 호텔의 절반 이하다
    LODGING: 0.55,
    // 현지 식당·편의점 위주. 저녁 한 끼만 제대로 먹는 패턴
    FOOD: 0.7,
    // 대중교통만 이용하고 택시를 쓰지 않는다. 노선이 정해져 있어 절감 폭이 작다
    TRANSPORT: 0.8,
    // 무료 관람·도보 코스 위주. 유료 액티비티를 1~2개로 줄인다
    ACTIVITY: 0.7,
    // 기념품 수준으로만 쓴다. 재량 지출이라 절감 폭이 크다
    SHOPPING: 0.6,
    // 스타일과 무관하다. 아래 INSURANCE 주석 참조
    INSURANCE: 1.0,
    // 다른 카테고리가 줄면 예비비도 같이 준다. 다만 예상 밖 지출은
    // 절약 여행이라고 줄지 않으므로 감액 폭을 다른 항목보다 작게 잡았다
    CONTINGENCY: 0.75,
  },

  // ── 보통 — destinations.ts 기준값 그대로 ──────────────────────────────
  // 전부 1.00 이다. 이 행은 배수를 적용하지 않는다는 뜻이고,
  // destinations.ts 의 기준 금액이 곧 standard 추천액이다.
  standard: {
    AIRFARE: 1.0,
    LODGING: 1.0,
    FOOD: 1.0,
    TRANSPORT: 1.0,
    ACTIVITY: 1.0,
    SHOPPING: 1.0,
    INSURANCE: 1.0,
    CONTINGENCY: 1.0,
  },

  // ── 아낌없이 — 좋은 호텔, 맛집 위주 (최상위 단계) ─────────────────────
  //
  // ⚠️ 2026-09-01 · 스타일이 3단계로 줄면서 luxury 행을 지웠다. (L 승인)
  //    이제 comfort 가 최상위다. 배수는 예전 comfort 값 그대로다.
  comfort: {
    // 좌석은 그대로 이코노미다. 직항·좋은 시간대를 고르는 만큼만 오른다
    AIRFARE: 1.1,
    // 3성급 → 4~5성급. 이 단계에서 가장 크게 오르는 항목이다
    LODGING: 1.6,
    // 맛집 위주. 예약이 필요한 식당이 섞이면서 1식 단가가 오른다
    FOOD: 1.4,
    // 필요할 때 택시를 탄다. 대중교통을 완전히 대체하지는 않는다
    TRANSPORT: 1.2,
    // 유료 관람·투어를 더 넣는다. 단가보다 횟수가 늘어난다
    ACTIVITY: 1.3,
    // 기념품에서 브랜드 구매로 넘어간다
    SHOPPING: 1.4,
    INSURANCE: 1.0,
    // 지출 규모가 커지면 예상 밖 지출의 절대액도 함께 커진다
    CONTINGENCY: 1.35,
  },
};

// ── INSURANCE 가 모든 스타일에서 1.00 인 이유 ──────────────────────────────
//
// 여행자보험료는 목적지·여행일수·연령으로 정해진다.
// 숙소 등급이나 식사 수준과 무관하다. 럭셔리 여행이라고 보험료가 오르지 않는다.
//
// 배수를 곱하면 BM 1(여행자보험 제휴) 전환율의 분모가 스타일별로 달라져
// 스타일 간 비교가 깨진다. 보험은 목적지별 기준값(destinations.ts)만으로 정한다.
//
// 보장금액을 올리는 고급 상품은 존재하지만, 그건 스타일이 아니라
// 사용자가 보험 화면에서 직접 고르는 값이다. 예산 추천이 대신 정하지 않는다.

// ============================================================================
// 반올림
// ============================================================================

/** 추천 금액을 떨어뜨리는 단위. */
export const AMOUNT_ROUNDING_UNIT = 1_000;

/**
 * 1,000원 단위 반올림. 0.5 는 올린다. (60,000 × 0.55 = 33,000)
 *
 * 금액은 원 단위 정수여야 하는데 배수를 곱하면 소수가 나온다. (CLAUDE.md 9장)
 * 화면에 3,456,789 원 같은 값을 추천액으로 내밀면 실제로 계산된 값처럼 보인다.
 * 추정치라는 사실이 숫자 모양에서 드러나야 한다. (NFR-004)
 *
 * ⚠️ 반올림은 **최종 카테고리 금액에서 한 번만** 한다.
 *    1인 1일 요율에서 먼저 반올림하면 오차가 인원 × 일수만큼 증폭된다.
 *      도쿄 INSURANCE 3,750/인/일 → 요율에서 반올림 4,000
 *        → × 4인 × 4일 = 64,000  (시드 60,000 과 어긋난다)
 *      최종 금액에서 반올림 → 3,750 × 16 = 60,000 ✓
 */
export function roundToThousand(amount: number): number {
  return Math.round(amount / AMOUNT_ROUNDING_UNIT) * AMOUNT_ROUNDING_UNIT;
}

/**
 * 기준 금액에 스타일 배수를 적용하고 1,000원 단위로 반올림한다.
 *
 * baseAmount 는 **인원·일수를 이미 곱한 카테고리 총액**이다.
 * 1인 1일 요율을 그대로 넣으면 위 주석의 증폭 문제가 그대로 생긴다.
 *
 *   AIRFARE   airfarePerPerson × 인원
 *   LODGING   lodgingPerNight  × 인원 × 박수
 *   나머지 6개  perPersonPerDay  × 인원 × 일수
 *
 * 인원·일수를 조립하는 예산 산출 자체는 여기가 아니라 추천 로직(TRIP-03 /
 * BUDGET-01)에 있다. 이 파일은 배수와 반올림 규칙만 들고 있다.
 */
export function applyStyleMultiplier(
  baseAmount: number,
  style: TravelStyle,
  categoryCode: CategoryCode,
): number {
  return roundToThousand(baseAmount * BUDGET_STYLE_MULTIPLIER[style][categoryCode]);
}
