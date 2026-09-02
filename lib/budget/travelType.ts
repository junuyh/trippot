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
// ⚠️ 유형 코드는 lib/constants/status.ts 의 SPENDING_PROFILE_TYPE 6개다.
//    시안에는 'TYPE 09 야무지게 놀고 야무지게 아끼고' 가 있으나 이는 코드가
//    아니라 **표현**이다. 코드 6개는 그대로 두고 문구만 입힌다.
//    (코드를 늘리면 seed 의 travel_types 와 공유 상수를 함께 바꿔야 한다)
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
 * 유형으로 인정할 최소 초과 비율. 계획의 15% 를 넘겨 써야 '그 유형' 이다.
 *
 * 5% 로 잡으면 대부분의 여행이 어딘가에 걸려 유형이 매번 바뀐다.
 * 유형은 여행을 한 문장으로 부르는 이름이라 자주 바뀌면 의미가 없다.
 */
const TYPE_THRESHOLD_BP = 1500;

/** 절약형으로 볼 최소 절감 비율. 전체 실제가 계획의 85% 이하 */
const FRUGAL_THRESHOLD_BP = 8500;

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
 * 순서
 *   ① 전체를 계획의 85% 이하로 썼으면 절약형
 *   ② 대표 카테고리 중 계획을 15% 넘게 초과한 것이 있으면 그 유형
 *      (여러 개면 **금액이 큰 쪽**. 비율로 고르면 금액이 작은 카테고리가 이긴다)
 *   ③ 아니면 균형형
 *
 * ⚠️ 항공·교통·보험·예비비는 유형의 근거로 쓰지 않는다.
 *    항공은 좌석 등급이 아니라 시기에 좌우되고, 보험은 고정비다.
 *    예비비를 많이 쓴 건 취향이 아니라 사고에 가깝다.
 */
export function resolveTravelType(inputs: TypeInput[]): TravelTypeResult {
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
    .filter((row) => row.usageBp - 10000 >= TYPE_THRESHOLD_BP)
    .sort((a, b) => b.diff - a.diff);

  if (candidates.length > 0) {
    const top = candidates[0];
    return {
      type: CATEGORY_TYPE[top.categoryCode] as SpendingProfileType,
      score: Math.min(100, Math.round((top.usageBp - 10000) / 100)),
      evidence,
      accuracyBp,
    };
  }

  // ③ 뚜렷한 편차가 없다
  return {
    type: SPENDING_PROFILE_TYPE.BALANCED,
    // 계획에 가까울수록 높다. 균형형은 '정확히 맞췄다' 가 곧 점수다
    score: Math.max(0, 100 - Math.abs(accuracyBp - 10000) / 100),
    evidence,
    accuracyBp,
  };
}
