// ============================================================================
// 여행자보험 견적 계산 (INSURANCE-01)
//
// ⚠️ 순수 계산이다. DB 도 네트워크도 타지 않는다.
//
// ⚠️ **예산 화면과 같은 기준 데이터를 쓴다.** (lib/constants/destinations.ts)
//    여기서 따로 요율을 만들면 예산의 '여행자보험 42,000원' 과 보험 화면의
//    견적이 서로 다른 숫자를 말한다. 사용자는 둘 중 뭘 믿어야 할지 모른다.
//
//      기준 보험료 = INSURANCE 1인 1일 기준액 × 인원 × 일수
//      제휴사 견적 = 기준 보험료 × 보장 등급 배수 × 제휴사 요율
//
//    보장 등급 배수는 budgetProducts.ts 의 보험 상품 ratio 와 같은 값이다.
//    (COVERAGE_TIER.ratio) 그래서 예산에서 '고액 보장' 을 골랐으면 이 화면도
//    같은 배수에서 출발한다.
//
// ⚠️ **실제 보험료가 아니다.** 나이·기왕력·보장 한도로 정해지는 값이라
//    우리가 맞힐 수 없다. 화면에 '예상' 이라고 분명히 쓴다. (NFR-004 와 같은 규칙)
//
// ⚠️ 금액은 정수 원 단위다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { differenceInCalendarDays, parseISO } from 'date-fns';

import {
  getDestinationBaseline,
  getRegionBaseline,
  type DestinationCode,
  type RegionCode,
} from '@/lib/constants/destinations';
import {
  COVERAGE_TIER,
  type InsurancePartner,
} from '@/lib/constants/insurancePartners';
import { CATEGORY_CODE, type InsuranceCoverage } from '@/lib/constants/status';

export type QuoteInput = {
  /** 목록에서 고른 목적지. 직접 입력이면 null */
  destinationCode: DestinationCode | null;
  /** 직접 입력일 때의 지역 */
  region: RegionCode | null;
  /** 'YYYY-MM-DD' */
  startDate: string;
  endDate: string;
  headcount: number;
  coverage: InsuranceCoverage;
};

export type PartnerQuote = {
  partner: InsurancePartner;
  /** 인원 전체 예상 보험료 */
  totalPremium: number;
  /** 1인 예상 보험료 */
  perPersonPremium: number;
  /**
   * 이 건이 성사됐을 때 우리 예상 수수료.
   * ⚠️ 화면에 노출하지 않는다. BM 1 규모를 가늠하는 값이다.
   */
  expectedCommission: number;
};

export type InsuranceQuote = {
  days: number;
  headcount: number;
  /** 보장 등급·제휴사 배수를 얹기 전 기준 금액 */
  baseAmount: number;
  /** 계산 근거 한 줄. 화면에 그대로 쓴다 */
  formula: string;
  quotes: PartnerQuote[];
  /** 가장 싼 견적. 없으면 null */
  cheapest: PartnerQuote | null;
};

/** 1,000원 단위로 끊는다. 43,712원 같은 보험료는 사람이 못 읽는다 */
function round1k(value: number): number {
  return Math.max(0, Math.round(value / 1000) * 1000);
}

export function buildInsuranceQuote(
  input: QuoteInput,
  partners: InsurancePartner[],
): InsuranceQuote {
  const { destinationCode, region, startDate, endDate, headcount, coverage } = input;

  const nights = Math.max(0, differenceInCalendarDays(parseISO(endDate), parseISO(startDate)));
  const days = nights + 1;
  const people = Math.max(1, headcount);

  const lookup = destinationCode
    ? getDestinationBaseline(destinationCode, {
        startDate,
        endDate,
        headcount: people,
        travelStyle: 'standard',
      })
    : getRegionBaseline(region ?? 'asia', {
        startDate,
        endDate,
        headcount: people,
        travelStyle: 'standard',
      });

  const perPersonPerDay = lookup.baseline.perPersonPerDay[CATEGORY_CODE.INSURANCE];
  const baseAmount = perPersonPerDay * people * days;
  const tier = COVERAGE_TIER[coverage];

  const quotes: PartnerQuote[] = partners.map((partner) => {
    const totalPremium = round1k(baseAmount * tier.ratio * partner.priceFactor);
    return {
      partner,
      totalPremium,
      // ⚠️ 총액을 반올림한 뒤 나눈다. 1인 금액을 반올림해 곱하면 인원수만큼
      //    오차가 쌓여 카드의 총액과 '1인당' 이 서로 안 맞는다.
      perPersonPremium: Math.round(totalPremium / people),
      expectedCommission: Math.round((totalPremium * partner.commissionBp) / 10000),
    };
  });

  const cheapest =
    quotes.length > 0
      ? quotes.reduce((a, b) => (b.totalPremium < a.totalPremium ? b : a))
      : null;

  return {
    days,
    headcount: people,
    baseAmount,
    formula: `1인 1일 ${perPersonPerDay.toLocaleString('ko-KR')}원 × ${people}명 × ${days}일`,
    quotes,
    cheapest,
  };
}
