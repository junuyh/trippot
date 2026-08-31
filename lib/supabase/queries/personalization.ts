// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
//
// ⚠️ 이 파일의 반환 타입은 대응하는 테이블이 없는 **계산 결과**다.
//    (소비 유형·개인화 추천은 settlements + budget_categories 에서 집계한다)
//    그래서 생성 타입을 Pick<> 으로 조합해 만들었다. 새 도메인 인터페이스를
//    손으로 정의하지는 않았으나, 순수 생성 타입도 아니라는 점을 알린다.
import { APPLIED_SOURCE, TRIP_STATUS } from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Json, Tables } from '@/types/database';

/**
 * 개인화 데이터의 소유 단위.
 *
 * 개인 여행 데이터는 개인에, 모임 여행 데이터는 해당 모임에만 누적한다.
 * **다른 소유 단위로 승계하지 않는다.** (docs/06 §7-6 확정 정책)
 * 따라서 과거 여행이 없는 새 모임의 첫 여행에서는 개인화가 노출되지 않는다.
 */
export type PersonalizationScope =
  | { ownerType: 'PERSONAL'; userId: string }
  | { ownerType: 'GROUP'; groupId: string };

/** 과거 결산에서 집계한 카테고리별 계획 대비 실제. */
export type SpendingProfile = {
  /** 집계에 사용한 결산 완료 여행 수. 0 이면 개인화를 노출하지 않는다. */
  basedOnTripCount: number;
  categories: Pick<
    Tables<'budget_categories'>,
    'category_code' | 'planned_amount' | 'actual_amount'
  >[];
};

/** 카테고리별 개인화 추천값. */
export type PersonalizedBudgetSuggestion = Pick<
  Tables<'budget_categories'>,
  'id' | 'category_code' | 'personalized_amount'
> & {
  /** 왜 이 금액을 제안하는지에 대한 근거. 화면에 그대로 보여준다. */
  basis: Json;
};

/**
 * scope 에 해당하는 **결산이 확정된** 여행 수.
 *
 * TRIP-01 에서 "과거 데이터를 이번 여행에 반영할까요?" 를 물을지 판단하는 값이다.
 * 0 이면 묻지 않고 넘어간다. past_data_apply_selected 의 past_trip_count 로도 쓴다.
 *
 * 개인 여행도 모임 여행과 똑같이 센다. 개인은 '본인 1명인 소유 단위'이지
 * 다르게 취급하는 대상이 아니다. (docs/README.md §5 #16)
 *
 * getSpendingProfile() 과 판정 기준이 같아야 한다 —
 * 결산 행이 있어도 confirmed_at 이 null 이면 확정 전이라 세지 않는다.
 * trips.status 만 보고 세면 결산 진행 중인 여행까지 잡혀 개수가 어긋난다.
 */
export async function getSettledTripCount(scope: PersonalizationScope): Promise<number> {
  // 조인 필터 대신 두 번에 나눠 조회한다.
  // settlements 에서 trips 를 inner join 해 거르는 편이 왕복이 적지만,
  // 소유 단위 필터가 조인 대상 테이블에 걸려 있어 조건을 한 글자만 틀려도
  // **다른 사용자의 여행이 섞인다.** (CLAUDE.md 7장)
  const tripQuery = supabase.from('trips').select('id').neq('status', TRIP_STATUS.DELETED);

  const { data: trips, error: tripError } =
    scope.ownerType === 'PERSONAL'
      ? await tripQuery.eq('owner_user_id', scope.userId)
      : await tripQuery.eq('group_id', scope.groupId);

  if (tripError) throw tripError;

  const tripIds = (trips ?? []).map((trip) => trip.id);
  if (tripIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('settlements')
    .select('id', { count: 'exact', head: true })
    .in('trip_id', tripIds)
    .not('confirmed_at', 'is', null);

  if (error) throw error;

  return count ?? 0;
}

/**
 * 과거 소비 패턴 집계.
 *
 * 첫 여행 데이터부터 활용한다. 누적될수록 단일 여행 참고 → 누적 패턴 참고로 확장한다.
 * 결산이 확정된(settlements.confirmed_at is not null) 여행만 집계한다.
 */
export async function getSpendingProfile(
  scope: PersonalizationScope,
): Promise<SpendingProfile | null> {
  // ① 소유 단위의 여행을 먼저 추린다. getSettledTripCount() 와 같은 방식이다.
  const tripQuery = supabase.from('trips').select('id').neq('status', TRIP_STATUS.DELETED);
  const { data: trips, error: tripError } =
    scope.ownerType === 'PERSONAL'
      ? await tripQuery.eq('owner_user_id', scope.userId)
      : await tripQuery.eq('group_id', scope.groupId);

  if (tripError) throw tripError;
  const tripIds = (trips ?? []).map((trip) => trip.id);
  if (tripIds.length === 0) return null;

  // ② 확정된 결산만. confirmed_at 이 null 이면 확정 전이다.
  const { data: settlements, error: settlementError } = await supabase
    .from('settlements')
    .select('trip_id, category_snapshot_json')
    .in('trip_id', tripIds)
    .not('confirmed_at', 'is', null);

  if (settlementError) throw settlementError;
  if (!settlements || settlements.length === 0) return null;

  // ③ 카테고리별로 계획·실제를 합산한다.
  //
  // ⚠️ 확정 시점의 **스냅샷**을 우선 쓴다. 지금 budget_categories 를 읽으면
  //    결산 뒤에 예산을 고쳤을 때 과거 소비 패턴이 따라 바뀐다.
  //    결산은 그 시점의 기록이어야 한다.
  //    스냅샷이 없는 과거 데이터(시드 등)만 현재 예산으로 대신한다.
  const totals = new Map<string, { planned: number; actual: number }>();
  const add = (code: string, planned: number, actual: number) => {
    const prev = totals.get(code) ?? { planned: 0, actual: 0 };
    totals.set(code, { planned: prev.planned + planned, actual: prev.actual + actual });
  };

  const needFallback: string[] = [];
  for (const settlement of settlements) {
    const snapshot = settlement.category_snapshot_json as
      | { categories?: { category_code: string; planned_amount: number; actual_amount: number }[] }
      | null;
    const rows = snapshot?.categories ?? [];
    if (rows.length === 0) {
      needFallback.push(settlement.trip_id);
      continue;
    }
    for (const row of rows) add(row.category_code, row.planned_amount, row.actual_amount);
  }

  if (needFallback.length > 0) {
    const { data: budgets, error: budgetError } = await supabase
      .from('trip_budgets')
      .select('id')
      .in('trip_id', needFallback);
    if (budgetError) throw budgetError;

    const budgetIds = (budgets ?? []).map((budget) => budget.id);
    if (budgetIds.length > 0) {
      const { data: categories, error: categoryError } = await supabase
        .from('budget_categories')
        .select('category_code, planned_amount, actual_amount')
        .in('trip_budget_id', budgetIds);
      if (categoryError) throw categoryError;

      for (const category of categories ?? []) {
        add(category.category_code, category.planned_amount, category.actual_amount);
      }
    }
  }

  if (totals.size === 0) return null;

  return {
    basedOnTripCount: settlements.length,
    categories: [...totals.entries()].map(([category_code, sum]) => ({
      category_code,
      planned_amount: sum.planned,
      actual_amount: sum.actual,
    })),
  };
}

/**
 * 계획 대비 실제의 편차. basis point(만분율) 정수다. 1250 = +12.50%
 *
 * 여러 여행을 합산한 총액끼리 나눈다. 여행별 비율을 평균 내면 금액이 작은
 * 여행의 튀는 비율이 과하게 반영된다. (5만원 예산에서 2만원 더 쓴 것과
 * 100만원 예산에서 2만원 더 쓴 것은 다르다)
 */
export function deviationBp(plannedTotal: number, actualTotal: number): number {
  if (plannedTotal <= 0) return 0;
  return Math.round(((actualTotal - plannedTotal) / plannedTotal) * 10000);
}

/**
 * 개인화 추천을 제안할 만큼 편차가 큰가.
 *
 * ±5% 미만은 노이즈다. "지난 여행보다 3% 더 쓰셨으니 예산을 3% 올리세요" 는
 * 도움이 되지 않고, 추천을 신뢰하지 못하게 만든다.
 */
export const PERSONALIZATION_MIN_BP = 500;

/**
 * 편차 상한. 한 번의 이상치가 다음 예산을 통째로 흔들지 않게 막는다.
 * 예: 예비비를 한 번 크게 쓴 여행 때문에 다음 예비비가 3배가 되는 일.
 */
export const PERSONALIZATION_MAX_BP = 5000;

/**
 * 개인화 예산 추천 생성.
 *
 * ⚠️ 이 함수는 **personalized_amount 생성까지만** 담당한다. (CLAUDE.md 1장/4장)
 *    planned_amount 를 직접 쓰지 않는다. recommended_amount 도 덮어쓰지 않는다.
 *
 *    추천 + 근거 제시 → 사용자 확인/수정 → 사용자 최종 확정
 *
 *    사용자가 확정하면 그때 화면에서 updateBudgetCategory() 로
 *    planned_amount 와 applied_source='personalized' 를 저장한다.
 */
export async function getPersonalizedBudget(
  tripId: string,
  scope: PersonalizationScope,
): Promise<PersonalizedBudgetSuggestion[]> {
  const profile = await getSpendingProfile(scope);
  // 과거 결산이 없으면 개인화를 노출하지 않는다.
  // 새 모임의 첫 여행이 여기에 해당한다. (docs/06 §7-6)
  if (!profile || profile.basedOnTripCount === 0) return [];

  const { data: budget, error: budgetError } = await supabase
    .from('trip_budgets')
    .select('id')
    .eq('trip_id', tripId)
    .maybeSingle();
  if (budgetError) throw budgetError;
  if (!budget) return [];

  const { data: categories, error: categoryError } = await supabase
    .from('budget_categories')
    .select('id, category_code, recommended_amount')
    .eq('trip_budget_id', budget.id)
    .eq('enabled', true);
  if (categoryError) throw categoryError;

  const pastByCode = new Map(profile.categories.map((c) => [c.category_code, c]));

  const suggestions: PersonalizedBudgetSuggestion[] = [];

  for (const category of categories ?? []) {
    const past = pastByCode.get(category.category_code);
    // 과거에 쓴 적 없는 카테고리는 참고할 게 없다
    if (!past || past.planned_amount <= 0) continue;

    const rawBp = deviationBp(past.planned_amount, past.actual_amount);
    // 편차가 작으면 제안하지 않는다. 노이즈다.
    if (Math.abs(rawBp) < PERSONALIZATION_MIN_BP) continue;

    // 이상치가 다음 예산을 통째로 흔들지 않게 상한을 둔다
    const clampedBp = Math.max(
      -PERSONALIZATION_MAX_BP,
      Math.min(PERSONALIZATION_MAX_BP, rawBp),
    );

    // ⚠️ **기본 추천(recommended_amount)** 에 편차를 적용한다.
    //    planned_amount 에 적용하면 사용자가 이미 손댄 값 위에 또 얹는 꼴이 된다.
    //    recommended 는 불변이라 몇 번을 다시 계산해도 같은 값이 나온다. (CLAUDE.md 4장)
    const personalized =
      Math.round((category.recommended_amount * (1 + clampedBp / 10000)) / 1000) * 1000;

    suggestions.push({
      id: category.id,
      category_code: category.category_code,
      personalized_amount: personalized,
      // 화면에 그대로 보여주는 근거. "왜 이 금액인가" 에 답해야 한다.
      basis: {
        basedOnTripCount: profile.basedOnTripCount,
        deviationBp: rawBp,
        appliedBp: clampedBp,
        clamped: rawBp !== clampedBp,
        pastPlannedAmount: past.planned_amount,
        pastActualAmount: past.actual_amount,
        recommendedAmount: category.recommended_amount,
      },
    });
  }

  // ⚠️ 비율이 아니라 **금액 영향이 큰 순서**로 정렬한다.
  //
  //    비율로 줄 세우면 예비비(-97%)가 맨 위로 온다. 예비비는 원래 안 쓰는 게
  //    정상이라 사용자에게 알려줄 게 없는데, 정작 중요한 식비(+20% · 17만원)가
  //    아래로 밀린다. 대표 항목은 배너 첫 줄에 노출되므로 순서가 곧 메시지다.
  return suggestions.sort((a, b) => {
    const impact = (sg: PersonalizedBudgetSuggestion) => {
      const basis = sg.basis as { recommendedAmount: number };
      return Math.abs((sg.personalized_amount ?? 0) - basis.recommendedAmount);
    };
    return impact(b) - impact(a);
  });
}

/**
 * 개인화 제안을 저장한다. **personalized_amount 까지만** 쓴다.
 *
 * ⚠️ planned_amount 를 건드리지 않는다. applied_source 도 바꾸지 않는다.
 *    AI·로직이 사용자 대신 확정하지 않는다. (CLAUDE.md 1장/4장)
 *    사용자가 "반영" 을 누르면 그때 화면이 applyPersonalizedBudget() 을 부른다.
 */
export async function savePersonalizedAmounts(
  suggestions: PersonalizedBudgetSuggestion[],
): Promise<void> {
  if (suggestions.length === 0) return;

  const results = await Promise.all(
    suggestions.map((suggestion) =>
      supabase
        .from('budget_categories')
        .update({ personalized_amount: suggestion.personalized_amount })
        .eq('id', suggestion.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

/**
 * 사용자가 개인화 추천을 받아들였을 때 확정한다.
 *
 * 이 함수가 planned_amount 를 쓰는 **유일한 개인화 경로**다.
 * applied_source = 'personalized' 로 남겨, 나중에 기본 추천 대비 개인화 추천이
 * 얼마나 정확했는지 잴 수 있게 한다. (CLAUDE.md 4장)
 */
export async function applyPersonalizedBudget(
  suggestions: PersonalizedBudgetSuggestion[],
): Promise<void> {
  // personalized_amount 는 DB 에서 nullable 이지만 planned_amount 는 NOT NULL 이다.
  // 값이 없는 제안은 확정할 것이 없으므로 거른다. (여기 오면 안 되는 경우다)
  const applicable = suggestions.filter(
    (suggestion): suggestion is PersonalizedBudgetSuggestion & { personalized_amount: number } =>
      suggestion.personalized_amount !== null,
  );
  if (applicable.length === 0) return;

  const results = await Promise.all(
    applicable.map((suggestion) =>
      supabase
        .from('budget_categories')
        .update({
          personalized_amount: suggestion.personalized_amount,
          planned_amount: suggestion.personalized_amount,
          applied_source: APPLIED_SOURCE.PERSONALIZED,
        })
        .eq('id', suggestion.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}
