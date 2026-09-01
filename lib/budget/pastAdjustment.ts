// ============================================================================
// 지난 여행 반영 — 순수 계산
//
// 결산이 확정된 과거 여행의 "계획 대비 실제" 편차를 이번 여행 추천에 얹는다.
//
// ⚠️ DB 를 건드리지 않는다. 집계는 queries/personalization.ts 의
//    getSpendingProfile() 이 하고, 이 파일은 그 결과를 금액으로 바꾸기만 한다.
//
// ⚠️ 왜 여기에 따로 있는가
//    queries/personalization.ts 의 getPersonalizedBudget() 은 **이미 만들어진 여행**
//    의 budget_categories 행을 읽는다. 그런데 TRIP-03 은 마지막에 여행을 만들기
//    때문에 그 시점에는 읽을 행이 없다.
//    생성 중에도 같은 규칙을 쓰려면 DB 를 타지 않는 계산이 필요하다.
//
//    ⚠️ 계산 규칙(최소 편차·상한·적용 대상·정렬)은 getPersonalizedBudget() 과
//       **같아야 한다.** 한쪽만 고치면 생성 중에 본 금액과 생성 뒤에 보는 금액이
//       달라진다. 나중에 getPersonalizedBudget() 이 이 파일을 쓰도록 합치는 게 맞다.
// ============================================================================
import {
  PERSONALIZATION_MAX_BP,
  PERSONALIZATION_MIN_BP,
  deviationBp,
  type SpendingProfile,
} from '@/lib/supabase/queries/personalization';
import type { CategoryCode } from '@/lib/constants/status';

export type PastAdjustment = {
  categoryCode: CategoryCode;
  /** 과거 편차. 상한을 적용하기 전 원본이다. 화면에 근거로 보여준다 */
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

/**
 * 카테고리별 지난 여행 반영값을 만든다.
 *
 * 편차가 ±5% 미만인 카테고리는 아예 넣지 않는다. 노이즈이고,
 * "지난 여행보다 3% 더 쓰셨으니 예산을 3% 올리세요" 는 신뢰를 깎는다.
 *
 * ⚠️ **기본 추천(recommendedAmount)** 에 편차를 적용한다.
 *    사용자가 이미 손댄 값에 적용하면 그 위에 또 얹는 꼴이 된다.
 *    추천 원본은 불변이라 몇 번을 다시 계산해도 같은 값이 나온다. (CLAUDE.md 4장)
 */
export function buildPastAdjustments(
  categories: { categoryCode: CategoryCode; recommendedAmount: number }[],
  profile: SpendingProfile,
): PastAdjustment[] {
  const pastByCode = new Map(profile.categories.map((c) => [c.category_code, c]));
  const adjustments: PastAdjustment[] = [];

  for (const category of categories) {
    const past = pastByCode.get(category.categoryCode);
    // 과거에 쓴 적 없는 카테고리는 참고할 게 없다
    if (!past || past.planned_amount <= 0) continue;

    const rawBp = deviationBp(past.planned_amount, past.actual_amount);
    if (Math.abs(rawBp) < PERSONALIZATION_MIN_BP) continue;

    const appliedBp = Math.max(-PERSONALIZATION_MAX_BP, Math.min(PERSONALIZATION_MAX_BP, rawBp));

    adjustments.push({
      categoryCode: category.categoryCode,
      rawBp,
      appliedBp,
      clamped: rawBp !== appliedBp,
      pastPlannedAmount: past.planned_amount,
      pastActualAmount: past.actual_amount,
      recommendedAmount: category.recommendedAmount,
      personalizedAmount: applyBp(category.recommendedAmount, appliedBp),
    });
  }

  // ⚠️ 비율이 아니라 **금액 영향이 큰 순서**로 정렬한다.
  //    비율로 줄 세우면 예비비(-97%)가 맨 위로 온다. 예비비는 원래 안 쓰는 게
  //    정상이라 알려줄 게 없는데, 정작 중요한 식비(+20% · 17만원)가 아래로 밀린다.
  //    대표 항목이 요약 문구 첫 줄에 나가므로 순서가 곧 메시지다.
  return adjustments.sort(
    (a, b) =>
      Math.abs(b.personalizedAmount - b.recommendedAmount) -
      Math.abs(a.personalizedAmount - a.recommendedAmount),
  );
}

/** 금액에 편차(basis point)를 적용하고 1,000원 단위로 반올림한다. */
export function applyBp(amount: number, bp: number): number {
  return Math.round((amount * (1 + bp / 10000)) / 1000) * 1000;
}

/** 화면 표시용 퍼센트. 1250 → 13 (반올림). 부호는 따로 다룬다 */
export function bpToPercent(bp: number): number {
  return Math.round(Math.abs(bp) / 100);
}
