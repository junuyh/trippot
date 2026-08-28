// ============================================================================
// 가상 여행 금고 배분
//
// 실제 계좌를 물리적으로 분리하지 않는다. **하나의 여행자금을 카테고리별로
// 논리적으로 배분**한 결과다. (CLAUDE.md 3장)
//
// ⚠️ 배분 방식: 우선순위 자동 (2026-08-28 확정 · docs/README.md §5 #8)
//
//    결제 시점이 빠른 카테고리부터 순서대로 채운다.
//    앞 카테고리를 계획액만큼 다 채운 뒤에야 다음으로 넘어간다.
//
//    왜 이 방식인가
//      · "지금 항공권은 살 수 있나?" 에 답한다. 여행 준비의 실제 질문이다.
//      · 계획 비율대로 나누면 모든 카테고리의 준비율이 전체 준비율과 같아진다.
//        그러면 금고를 카테고리로 나눠 볼 이유가 없다.
//      · 사용자 직접 배분은 손이 많이 가고 MVP 에서 아무도 만지지 않을 가능성이 크다.
//
// ⚠️ 이 계산은 화면 표시용이 아니라 budget_categories.prepared_amount 에
//    저장하는 값이다. 자금이 바뀌면 다시 계산해 저장한다.
// ============================================================================
import { CATEGORY_CODE, type CategoryCode } from '@/lib/constants/status';

/**
 * 금고를 채우는 순서. 실제 결제 시점이 빠른 것부터다.
 *
 *   항공    가장 먼저 예약한다
 *   숙소    그 다음
 *   보험    출발 직전 가입한다. 금액이 작아 빨리 채워진다
 *   액티비티 사전 예약이 섞인다
 *   교통    대부분 현지
 *   식비    전부 현지
 *   쇼핑    전부 현지. 가장 나중
 *   예비비  남는 돈이 들어간다
 *
 * ⚠️ 표시 순서(CATEGORY_ORDER)와 다르다. 화면은 표시 순서로 그리고,
 *    배분만 이 순서를 쓴다.
 */
export const VAULT_FILL_ORDER: CategoryCode[] = [
  CATEGORY_CODE.AIRFARE,
  CATEGORY_CODE.LODGING,
  CATEGORY_CODE.INSURANCE,
  CATEGORY_CODE.ACTIVITY,
  CATEGORY_CODE.TRANSPORT,
  CATEGORY_CODE.FOOD,
  CATEGORY_CODE.SHOPPING,
  CATEGORY_CODE.CONTINGENCY,
];

export type VaultAllocationInput = {
  categoryCode: CategoryCode;
  /** 사용자가 확정한 계획액 */
  plannedAmount: number;
};

export type VaultAllocation = {
  categoryCode: CategoryCode;
  /** 이 카테고리에 배분된 금액 = prepared_amount */
  preparedAmount: number;
};

/**
 * 현재 여행자금을 카테고리에 배분한다.
 *
 * @param currentAmount 현재 여행자금 (fund_sources.current_amount) — 단일 소스다
 * @param categories    계획액이 있는 카테고리들. 순서는 상관없다
 *
 * 자금이 계획 총액보다 많으면 남는 금액은 배분하지 않는다.
 * 계획을 넘겨 채우면 "준비 120%" 같은 값이 나와 사용자를 헷갈리게 한다.
 * 남는 돈은 전체 준비 현황에서 이미 보이고 있다.
 */
export function allocateVault(
  currentAmount: number,
  categories: VaultAllocationInput[],
): VaultAllocation[] {
  const plannedByCode = new Map(categories.map((c) => [c.categoryCode, c.plannedAmount]));
  let remaining = Math.max(0, currentAmount);

  const allocated = new Map<CategoryCode, number>();

  for (const categoryCode of VAULT_FILL_ORDER) {
    const planned = plannedByCode.get(categoryCode);
    // 이 여행에 없는 카테고리는 건너뛴다. (시드의 다낭처럼 8개가 아닌 여행이 있다)
    if (planned === undefined) continue;

    const fill = Math.min(remaining, planned);
    allocated.set(categoryCode, fill);
    remaining -= fill;
  }

  // 입력 순서를 그대로 돌려준다. 호출부가 표시 순서를 유지할 수 있게.
  return categories.map((c) => ({
    categoryCode: c.categoryCode,
    preparedAmount: allocated.get(c.categoryCode) ?? 0,
  }));
}

/**
 * 준비율 — 계획액 대비 배분액.
 * 계획이 0이면 나눌 수 없다. 0을 돌려준다.
 */
export function preparationRate(preparedAmount: number, plannedAmount: number): number {
  if (plannedAmount <= 0) return 0;
  return Math.min(100, Math.round((preparedAmount / plannedAmount) * 100));
}

/**
 * 사용률 — 계획액 대비 실제 사용액.
 * 100%를 넘을 수 있다. 초과 지출은 그대로 보여줘야 한다.
 */
export function usageRate(actualAmount: number, plannedAmount: number): number {
  if (plannedAmount <= 0) return 0;
  return Math.round((actualAmount / plannedAmount) * 100);
}
