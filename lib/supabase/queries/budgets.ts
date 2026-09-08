// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type TripBudget = Tables<'trip_budgets'>;
export type BudgetCategory = Tables<'budget_categories'>;
export type BudgetPlanItem = Tables<'budget_plan_items'>;
export type BudgetPlanItemInsert = TablesInsert<'budget_plan_items'>;
export type BudgetPlanItemUpdate = TablesUpdate<'budget_plan_items'>;

/**
 * recommended_amount 를 타입에서 제외한다.
 * 시스템 기본 추천 원본이라 최초 생성 후 절대 덮어쓰지 않는다. (CLAUDE.md 4장)
 * 원본이 사라지면 추천 정확도·개인화 효과를 영원히 측정할 수 없다.
 */
export type BudgetCategoryUpdate = Omit<TablesUpdate<'budget_categories'>, 'recommended_amount'>;

export type TripBudgetInsert = TablesInsert<'trip_budgets'>;
export type BudgetCategoryInsert = TablesInsert<'budget_categories'>;

/** 여행 예산을 만든다. trip_budgets.trip_id 는 UNIQUE 라 여행당 하나뿐이다. */
export async function createTripBudget(input: TripBudgetInsert): Promise<TripBudget> {
  const { data, error } = await supabase.from('trip_budgets').insert(input).select().single();
  if (error) throw error;
  return data;
}

/**
 * 카테고리를 한 번에 만든다.
 *
 * ⚠️ recommended_amount 는 여기서 한 번만 쓰고 이후 덮어쓰지 않는다.
 *    사용자가 고친 값은 planned_amount 다. (CLAUDE.md 4장)
 *    그래서 BudgetCategoryUpdate 에서 recommended_amount 가 빠져 있다.
 */
export async function createBudgetCategories(
  inputs: BudgetCategoryInsert[],
): Promise<BudgetCategory[]> {
  const { data, error } = await supabase.from('budget_categories').insert(inputs).select();
  if (error) throw error;
  return data ?? [];
}

export async function getBudgetByTripId(tripId: string): Promise<TripBudget | null> {
  const { data, error } = await supabase
    .from('trip_budgets')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getBudgetCategories(budgetId: string): Promise<BudgetCategory[]> {
  // enabled = false 는 사용자가 끈 카테고리다. 화면에 보여주지 않는다.
  // (시드의 다낭처럼 카테고리가 8개가 아닌 여행도 있다)
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('trip_budget_id', budgetId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * ⚠️ planned_amount 는 **사용자 확정 행동을 통해서만** 변경한다. (CLAUDE.md 4장)
 *    AI·추천 로직이 이 함수로 planned_amount 를 바꾸지 않는다.
 *    개인화 추천은 personalized_amount 까지만 쓴다.
 *    planned_amount 를 바꿀 때는 applied_source 도 함께 맞춰준다.
 */
/**
 * 목표 예산 확정. trip_budgets 를 갱신한다.
 *
 * ⚠️ confirmed_at 이 들어가는 순간이 '사용자가 확정한 시점' 이다.
 *    null 이면 아직 예산을 정하지 않은 여행이다. (시드의 오사카)
 */
export async function updateTripBudget(
  budgetId: string,
  patch: TablesUpdate<'trip_budgets'>,
): Promise<TripBudget> {
  const { data, error } = await supabase
    .from('trip_budgets')
    .update(patch)
    .eq('id', budgetId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 가상 금고 배분액 저장.
 *
 * 현재 여행자금이 바뀌면 배분도 달라진다. 화면에서 계산한 값을 여기로 저장한다.
 * (배분 규칙은 lib/budget/vault.ts)
 *
 * ⚠️ 각 행을 따로 update 한다. supabase-js 에 다중 행 부분 update 가 없고,
 *    upsert 는 NOT NULL 칼럼(trip_budget_id / category_code)을 전부 넘겨야 해서
 *    하나라도 빠뜨리면 새 행이 생긴다. 그쪽이 더 위험하다.
 */
export async function updateBudgetCategoriesPrepared(
  items: { id: string; preparedAmount: number }[],
): Promise<void> {
  if (items.length === 0) return;

  const results = await Promise.all(
    items.map((item) =>
      supabase
        .from('budget_categories')
        .update({ prepared_amount: item.preparedAmount })
        .eq('id', item.id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function updateBudgetCategory(
  categoryId: string,
  patch: BudgetCategoryUpdate,
): Promise<BudgetCategory> {
  // ⚠️ BudgetCategoryUpdate 는 recommended_amount 를 뺀 타입이다.
  //    추천 원본은 최초 생성 후 덮어쓰지 않는다. (CLAUDE.md 4장)
  const { data, error } = await supabase
    .from('budget_categories')
    .update(patch)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 카테고리의 세부 계획 항목.
 *
 * ⚠️ 관광지 추천 목록이 아니다. **이번 여행에서 돈을 쓸 계획 항목**이다. (docs/09 §2-3)
 *    '스시로 시부야 70,000원' 처럼 사용자가 직접 적는다.
 */
/**
 * 여행 전체의 세부 계획 개수.
 *
 * 여행 유형의 '즉흥형' 판정에 쓴다. (lib/budget/travelType.ts)
 * 항목 내용은 필요 없고 개수만 필요해서 head 요청으로 센다.
 *
 * ⚠️ '여유 예산' 은 화면이 만들어 그리는 줄이라 여기 잡히지 않는다.
 *    사용자가 실제로 넣은 계획만 센다. 그게 이 판정이 보려는 값이다.
 */
export async function countPlanItems(categoryIds: string[]): Promise<number> {
  if (categoryIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('budget_plan_items')
    .select('id', { count: 'exact', head: true })
    .in('budget_category_id', categoryIds);

  if (error) throw error;
  return count ?? 0;
}

export async function getBudgetPlanItems(categoryId: string): Promise<BudgetPlanItem[]> {
  const { data, error } = await supabase
    .from('budget_plan_items')
    .select('*')
    .eq('budget_category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBudgetPlanItem(input: BudgetPlanItemInsert): Promise<BudgetPlanItem> {
  const { data, error } = await supabase
    .from('budget_plan_items')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 계획 항목을 한 번에 만든다. 여행 생성에서 고른 상품을 옮겨 담을 때 쓴다.
 */
export async function createBudgetPlanItems(
  inputs: BudgetPlanItemInsert[],
): Promise<BudgetPlanItem[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase.from('budget_plan_items').insert(inputs).select();
  if (error) throw error;
  return data ?? [];
}

export async function updateBudgetPlanItem(
  budgetItemId: string,
  patch: BudgetPlanItemUpdate,
): Promise<BudgetPlanItem> {
  const { data, error } = await supabase
    .from('budget_plan_items')
    .update(patch)
    .eq('id', budgetItemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 계획 항목 삭제.
 *
 * ⚠️ 상위 카테고리의 actual_amount 를 다시 계산하지 않는다.
 *    actual_amount 는 **거래(transactions)의 합**이지 계획 항목의 합이 아니다.
 *    계획 항목을 지워도 실제로 쓴 돈이 사라지지는 않는다.
 *    (transactions.budget_plan_item_id 는 ON DELETE SET NULL 이라
 *     거래는 남고 항목 연결만 끊긴다)
 */
export async function deleteBudgetPlanItem(budgetItemId: string): Promise<void> {
  const { error } = await supabase
    .from('budget_plan_items')
    .delete()
    .eq('id', budgetItemId);

  if (error) throw error;
}
