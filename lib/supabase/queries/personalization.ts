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
import { TRIP_STATUS } from '@/lib/constants/status';
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
