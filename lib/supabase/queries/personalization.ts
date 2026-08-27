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
 * 과거 소비 패턴 집계.
 *
 * 첫 여행 데이터부터 활용한다. 누적될수록 단일 여행 참고 → 누적 패턴 참고로 확장한다.
 * 결산이 확정된(settlements.confirmed_at is not null) 여행만 집계한다.
 */
export async function getSpendingProfile(
  scope: PersonalizationScope,
): Promise<SpendingProfile | null> {
  // TODO: scope 에 해당하는 결산 완료 여행의 budget_categories 를 집계.
  //       결산 완료 여행이 없으면 null 을 반환한다 (개인화 미노출).
  return null;
}

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
  // TODO: getSpendingProfile() 결과로 tripId 의 카테고리별 personalized_amount 를 산출.
  //       과거 데이터가 없으면 빈 배열을 반환한다 (개인화 미노출).
  return [];
}
