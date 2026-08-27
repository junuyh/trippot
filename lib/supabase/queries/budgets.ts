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

export async function getBudgetByTripId(tripId: string): Promise<TripBudget | null> {
  // TODO: trip_budgets 단건 조회 (trip_id UNIQUE). .maybeSingle() 사용.
  return null;
}

export async function getBudgetCategories(budgetId: string): Promise<BudgetCategory[]> {
  // TODO: budget_categories 조회. trip_budget_id = budgetId, enabled = true.
  //       sort_order 오름차순 정렬.
  return [];
}

/**
 * ⚠️ planned_amount 는 **사용자 확정 행동을 통해서만** 변경한다. (CLAUDE.md 4장)
 *    AI·추천 로직이 이 함수로 planned_amount 를 바꾸지 않는다.
 *    개인화 추천은 personalized_amount 까지만 쓴다.
 *    planned_amount 를 바꿀 때는 applied_source 도 함께 맞춰준다.
 */
export async function updateBudgetCategory(
  categoryId: string,
  patch: BudgetCategoryUpdate,
): Promise<BudgetCategory> {
  // TODO: budget_categories update 후 갱신된 행 반환.
  throw new Error('[queries/budgets] updateBudgetCategory 미구현');
}

export async function getBudgetPlanItems(categoryId: string): Promise<BudgetPlanItem[]> {
  // TODO: budget_plan_items 조회. budget_category_id = categoryId, sort_order 오름차순.
  return [];
}

export async function createBudgetPlanItem(input: BudgetPlanItemInsert): Promise<BudgetPlanItem> {
  // TODO: budget_plan_items insert 후 생성된 행 반환.
  throw new Error('[queries/budgets] createBudgetPlanItem 미구현');
}

export async function updateBudgetPlanItem(
  budgetItemId: string,
  patch: BudgetPlanItemUpdate,
): Promise<BudgetPlanItem> {
  // TODO: budget_plan_items update 후 갱신된 행 반환.
  throw new Error('[queries/budgets] updateBudgetPlanItem 미구현');
}

export async function deleteBudgetPlanItem(budgetItemId: string): Promise<void> {
  // TODO: budget_plan_items 삭제. 삭제 후 상위 카테고리 actual_amount 재계산이 필요한지 확인.
  return;
}
