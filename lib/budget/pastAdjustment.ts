// ============================================================================
// 지난 여행 반영 — 화면 표시용 가공
//
// ⚠️ 계산 규칙은 여기 없다. queries/personalization.ts 의 personalizeFromProfile()
//    이 유일한 기준이다. TRIP-03(생성)과 BUDGET-01(예산 상세)이 같은 함수를 써야
//    "만들 때 본 금액" 과 "나중에 제안받는 금액" 이 어긋나지 않는다.
//
//    이 파일은 그 결과를 화면이 쓰기 좋은 모양으로 바꾸기만 한다.
//    (2026-09-01 develop 병합 — 자체 계산을 걷어내고 공용 함수로 통일했다)
// ============================================================================
import {
  personalizeFromProfile,
  type SpendingProfile,
} from '@/lib/supabase/queries/personalization';
import type { CategoryCode } from '@/lib/constants/status';

export type PastAdjustment = {
  categoryCode: CategoryCode;
  /** 과거 편차. 상한을 적용하기 전 원본이다. 근거 시트에 그대로 보여준다 */
  rawBp: number;
  /** 실제로 적용한 편차. 상한에 걸렸으면 rawBp 와 다르다 */
  appliedBp: number;
  clamped: boolean;
  pastPlannedAmount: number;
  pastActualAmount: number;
  /** 기본 추천 원본 */
  recommendedAmount: number;
  /** 기본 추천에 편차를 적용한 값. budget_categories.personalized_amount 로 저장한다 */
  personalizedAmount: number;
};

/** personalizeFromProfile() 의 basis 에 담기는 값. Json 이라 타입을 좁혀 쓴다. */
type PersonalizationBasis = {
  deviationBp: number;
  appliedBp: number;
  clamped: boolean;
  pastPlannedAmount: number;
  pastActualAmount: number;
  recommendedAmount: number;
};

/**
 * 카테고리별 지난 여행 반영값을 만든다.
 *
 * 계산은 personalizeFromProfile() 이 한다. 여기서는 basis 를 펼쳐 담을 뿐이다.
 * 반환 순서도 그 함수가 정한다 — 비율이 아니라 **금액 영향이 큰 순서**다.
 */
export function buildPastAdjustments(
  categories: { categoryCode: CategoryCode; recommendedAmount: number }[],
  profile: SpendingProfile,
): PastAdjustment[] {
  return personalizeFromProfile(
    profile,
    categories.map((category) => ({
      key: category.categoryCode,
      categoryCode: category.categoryCode,
      recommendedAmount: category.recommendedAmount,
    })),
  ).map((result) => {
    const basis = result.basis as PersonalizationBasis;
    return {
      categoryCode: result.categoryCode as CategoryCode,
      rawBp: basis.deviationBp,
      appliedBp: basis.appliedBp,
      clamped: basis.clamped,
      pastPlannedAmount: basis.pastPlannedAmount,
      pastActualAmount: basis.pastActualAmount,
      recommendedAmount: basis.recommendedAmount,
      personalizedAmount: result.personalizedAmount,
    };
  });
}

/** 금액에 편차(basis point)를 적용하고 1,000원 단위로 반올림한다. */
export function applyBp(amount: number, bp: number): number {
  return Math.round((amount * (1 + bp / 10000)) / 1000) * 1000;
}

/** 화면 표시용 퍼센트. 1250 → 13 (반올림). 부호는 따로 다룬다 */
export function bpToPercent(bp: number): number {
  return Math.round(Math.abs(bp) / 100);
}
