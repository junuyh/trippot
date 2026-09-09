// ============================================================================
// 여행 유형 산출 — 규칙 기반 (rule_version v1)
//
// 결산이 확정된 여행의 **계획 대비 실제**로 유형을 정한다.
//
// ⚠️ 순수 계산이다. DB 를 타지 않는다. 저장은 queries/travelTypes.ts 가 한다.
//
// ⚠️ AI 를 쓰지 않는다. 첫 여행 한 건으로도 결과가 나와야 하고,
//    "왜 이 유형인가" 를 카테고리별 숫자로 그대로 보여줘야 하기 때문이다.
//    근거를 설명하지 못하는 유형은 사용자가 믿지 않는다.
//
// ⚠️ 유형 코드는 lib/constants/status.ts 의 SPENDING_PROFILE_TYPE 9개다.
//    (2026-09-08 · 6개 → 9개. seed 의 travel_types 도 함께 늘렸다)
//
// ============================================================================
// 왜 6개로는 부족했는가
// ============================================================================
//
//   축이 "어디에 더 썼나" 하나뿐이었다. 그래서 특정 카테고리를 넘기지 않은
//   여행은 전부 균형형으로 떨어졌다. 20% 더 쓴 여행도, 계획과 1% 차이로
//   맞춘 여행도, 계획을 아예 안 짠 여행도 모두 '균형형' 이었다.
//   유형이 여섯인데 실제로는 둘만 보였다.
//
//   세 개를 갈라 냈다.
//     통 큰 여행자  전체를 15% 넘게 초과       (얼마나 썼나)
//     계획파        계획과 ±5% 이내로 일치      (얼마나 맞췄나)
//     즉흥형        세부 계획을 거의 안 세움     (어떻게 준비했나)
//
//   ⚠️ 즉흥형만 **지출이 아니라 준비 행동**을 본다. 계획을 안 짜는 사람에게도
//      결과가 나와야 결산까지 오게 된다.
// ============================================================================
import {
  CATEGORY_CODE,
  SPENDING_PROFILE_TYPE,
  type CategoryCode,
  type SpendingProfileType,
} from "@/lib/constants/status";

export type TypeInput = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
};

export type TypeEvidence = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
  /** 계획 대비 실제. basis point 정수. 1200 = 112% 사용 */
  usageBp: number;
  /** 실제 − 계획. 양수면 초과 */
  diff: number;
};

export type TravelTypeResult = {
  type: SpendingProfileType;
  /** 0~100. 유형이 얼마나 뚜렷한가 */
  score: number;
  /** 근거. 금액 영향이 큰 순서 */
  evidence: TypeEvidence[];
  /** 예산 정확도 = 실제 ÷ 계획. basis point */
  accuracyBp: number;
};

/**
 * 성향으로 인정할 최소 초과 비율. **전체 정확도보다** 15%p 더 써야 한다.
 *
 * ⚠️ 계획 대비가 아니라 **전체 대비**로 잰다.
 *    계획 대비로 재면, 여행 전체가 20% 초과했을 때 모든 카테고리가 20%
 *    초과이므로 아무 카테고리나 걸린다. 실제로 그렇게 나왔다 —
 *    전체가 균일하게 20% 넘은 여행이 '숙박 중시형' 으로 잡혔다.
 *    그건 숙소를 중시한 게 아니라 그냥 전체를 더 쓴 것이다.
 *
 *    전체 대비로 재면 "다른 데보다 **유독** 여기에 썼다" 만 성향이 된다.
 *
 * 5%p 로 잡으면 대부분의 여행이 어딘가에 걸려 유형이 매번 바뀐다.
 * 유형은 여행을 한 문장으로 부르는 이름이라 자주 바뀌면 의미가 없다.
 */
const TYPE_THRESHOLD_BP = 1500;

/** 절약형으로 볼 최소 절감 비율. 전체 실제가 계획의 85% 이하 */
const FRUGAL_THRESHOLD_BP = 8500;

/** 통 큰 여행자로 볼 최소 초과 비율. 전체 실제가 계획의 115% 이상 */
const BIG_SPENDER_THRESHOLD_BP = 11500;

/**
 * 계획파로 볼 오차. 계획의 ±5% 안이면 '맞췄다' 로 본다.
 *
 * 여행 예산에서 5% 는 꽤 정확한 편이다. 1% 로 조이면 아무도 안 걸리고,
 * 10% 로 풀면 균형형과 구분이 안 된다.
 */
const PLANNER_TOLERANCE_BP = 500;

/**
 * 즉흥형으로 볼 최대 세부 계획 수.
 *
 * 여행 생성 때 자동으로 들어가는 '여유 예산' 같은 항목이 있어서 0 으로
 * 잡으면 아무도 안 걸린다. 2개 이하면 사실상 안 짠 것으로 본다.
 */
const SPONTANEOUS_MAX_PLAN_ITEMS = 2;

/**
 * 미리미리형으로 볼 최소 여유. 입금이 목표액에 닿은 날이 출발 30일 전이면.
 *
 * 한 달은 "미리 준비했다" 고 부를 수 있는 가장 짧은 단위다. 일주일이면
 * 항공권 결제 직전에 넣은 사람도 걸리고, 두 달이면 거의 아무도 안 걸린다.
 */
const EARLY_SAVER_MIN_DAYS = 30;

/** 카테고리 → 그 카테고리를 대표하는 유형 */
const CATEGORY_TYPE: Partial<Record<CategoryCode, SpendingProfileType>> = {
  [CATEGORY_CODE.FOOD]: SPENDING_PROFILE_TYPE.GOURMET,
  [CATEGORY_CODE.LODGING]: SPENDING_PROFILE_TYPE.LODGING_FOCUSED,
  [CATEGORY_CODE.ACTIVITY]: SPENDING_PROFILE_TYPE.EXPERIENCE,
  [CATEGORY_CODE.SHOPPING]: SPENDING_PROFILE_TYPE.SHOPPING,
};

/**
 * 계획 대비 실제로 유형을 정한다.
 *
 * 순서 — **지출 신호가 준비 행동보다 앞선다.**
 *   ① 전체를 계획의 85% 이하로 썼으면            절약형
 *   ② 대표 카테고리를 **전체보다** 15%p 넘게 더 썼으면   그 유형
 *      (여러 개면 **금액이 큰 쪽**. 비율로 고르면 금액이 작은 카테고리가 이긴다)
 *   ③ 전체를 15% 넘게 초과했으면                통 큰 여행자
 *   ④ 세부 계획이 2개 이하면                    즉흥형
 *   ⑤ 여행자금을 출발 30일 전에 다 모았으면        미리미리형
 *   ⑥ 계획과 ±5% 이내면                        계획파
 *   ⑦ 아니면                                  균형형
 *
 * ⚠️ ⑤ 를 ⑥ 앞에 두는 이유: 한 달 전에 다 모은 사람은 계획파보다 드물고,
 *    이 서비스가 가장 바라는 행동이다. 둘 다 해당하면 더 드문 쪽을 부른다.
 *
 * ⚠️ ④ 를 ② 뒤에 두는 이유: 계획을 안 짰어도 식비를 몰아 썼으면 그 사람은
 *    '즉흥형' 이기 전에 '미식형' 이다. 무엇을 했는지가 어떻게 준비했는지보다
 *    그 여행을 더 잘 설명한다.
 *
 * ⚠️ 항공·교통·보험·예비비는 유형의 근거로 쓰지 않는다.
 *    항공은 좌석 등급이 아니라 시기에 좌우되고, 보험은 고정비다.
 *    예비비를 많이 쓴 건 취향이 아니라 사고에 가깝다.
 */
export function resolveTravelType(
  inputs: TypeInput[],
  /**
   * 세부 계획(budget_plan_items) 개수. 즉흥형 판정에만 쓴다.
   * 넘기지 않으면 즉흥형을 판정하지 않는다 — 계획 수를 모르는 채로
   * '계획을 안 세웠다' 고 단정하면 안 된다.
   */
  planItemCount?: number,
  /**
   * 입금이 목표액에 닿은 날부터 출발일까지의 일수. 미리미리형 판정에만 쓴다.
   * 목표에 못 닿았거나 모르면 넘기지 않는다 — 안 넘기면 판정하지 않는다.
   */
  fundReadyDaysBefore?: number,
): TravelTypeResult {
  const usable = inputs.filter((row) => row.plannedAmount > 0);

  const plannedTotal = usable.reduce((sum, row) => sum + row.plannedAmount, 0);
  const actualTotal = usable.reduce((sum, row) => sum + row.actualAmount, 0);
  const accuracyBp =
    plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 10000) : 0;

  const evidence: TypeEvidence[] = usable
    /**
     * ⚠️ 예비비·보험은 **근거에서도** 뺀다.
     *
     *    예비비를 0% 썼다는 건 절약이 아니라 '쓸 일이 없었다' 는 뜻이라
     *    "이 유형이 나온 이유" 의 첫 줄이 '예비비 0%' 가 되면
     *    미식형이라는 결론과 아무 상관 없는 숫자가 맨 위에 온다.
     *    보험도 고정비라 취향을 말해주지 않는다.
     */
    .filter(
      (row) =>
        row.categoryCode !== CATEGORY_CODE.CONTINGENCY &&
        row.categoryCode !== CATEGORY_CODE.INSURANCE,
    )
    .map((row) => ({
      categoryCode: row.categoryCode,
      plannedAmount: row.plannedAmount,
      actualAmount: row.actualAmount,
      usageBp: Math.round((row.actualAmount / row.plannedAmount) * 10000),
      diff: row.actualAmount - row.plannedAmount,
    }))
    // 근거는 **금액 영향이 큰 순서**로 보여준다. 비율로 줄 세우면
    // 5만원짜리 카테고리의 +50% 가 100만원짜리의 +10% 를 이긴다.
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // ① 전체를 아껴 썼는가
  if (plannedTotal > 0 && accuracyBp <= FRUGAL_THRESHOLD_BP) {
    return {
      type: SPENDING_PROFILE_TYPE.FRUGAL,
      score: Math.min(100, Math.round((10000 - accuracyBp) / 100)),
      evidence,
      accuracyBp,
    };
  }

  // ② 대표 카테고리를 뚜렷하게 넘겼는가
  const candidates = evidence
    .filter((row) => CATEGORY_TYPE[row.categoryCode])
    // ⚠️ 10000(계획)이 아니라 accuracyBp(전체)와 견준다. 위 상수 주석 참조.
    .filter((row) => row.usageBp - accuracyBp >= TYPE_THRESHOLD_BP)
    .sort((a, b) => b.diff - a.diff);

  if (candidates.length > 0) {
    const top = candidates[0];
    return {
      type: CATEGORY_TYPE[top.categoryCode] as SpendingProfileType,
      score: Math.min(100, Math.round((top.usageBp - accuracyBp) / 100)),
      evidence,
      accuracyBp,
    };
  }

  // ③ 전체를 크게 넘겼는가
  if (plannedTotal > 0 && accuracyBp >= BIG_SPENDER_THRESHOLD_BP) {
    return {
      type: SPENDING_PROFILE_TYPE.BIG_SPENDER,
      score: Math.min(100, Math.round((accuracyBp - 10000) / 100)),
      evidence,
      accuracyBp,
    };
  }

  // ④ 계획을 거의 안 세웠는가
  if (planItemCount !== undefined && planItemCount <= SPONTANEOUS_MAX_PLAN_ITEMS) {
    return {
      type: SPENDING_PROFILE_TYPE.SPONTANEOUS,
      // 계획이 적을수록 뚜렷하다. 0개면 100, 2개면 33
      score: Math.round(
        ((SPONTANEOUS_MAX_PLAN_ITEMS + 1 - planItemCount) /
          (SPONTANEOUS_MAX_PLAN_ITEMS + 1)) *
          100,
      ),
      evidence,
      accuracyBp,
    };
  }

  // ⑤ 여행자금을 미리 다 모았는가
  if (fundReadyDaysBefore !== undefined && fundReadyDaysBefore >= EARLY_SAVER_MIN_DAYS) {
    return {
      type: SPENDING_PROFILE_TYPE.EARLY_SAVER,
      // 30일이면 50, 60일 이상이면 100
      score: Math.min(100, Math.round((fundReadyDaysBefore / (EARLY_SAVER_MIN_DAYS * 2)) * 100)),
      evidence,
      accuracyBp,
    };
  }

  // ⑥ 계획과 거의 일치하는가
  if (plannedTotal > 0 && Math.abs(accuracyBp - 10000) <= PLANNER_TOLERANCE_BP) {
    return {
      type: SPENDING_PROFILE_TYPE.PLANNER,
      // 오차가 0 에 가까울수록 100
      score: Math.round(
        100 - (Math.abs(accuracyBp - 10000) / PLANNER_TOLERANCE_BP) * 100,
      ),
      evidence,
      accuracyBp,
    };
  }

  // ⑦ 뚜렷한 편차가 없다
  return {
    type: SPENDING_PROFILE_TYPE.BALANCED,
    // 계획에 가까울수록 높다. 균형형은 '정확히 맞췄다' 가 곧 점수다
    score: Math.max(0, 100 - Math.abs(accuracyBp - 10000) / 100),
    evidence,
    accuracyBp,
  };
}
