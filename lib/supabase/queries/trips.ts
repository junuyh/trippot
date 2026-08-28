// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { GROUP_MEMBER_STATUS, TRIP_STATUS } from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import {
  createBudgetCategories,
  createTripBudget,
  type BudgetCategoryInsert,
  type TripBudgetInsert,
} from '@/lib/supabase/queries/budgets';
import { createFundSource, type FundSourceInsert } from '@/lib/supabase/queries/funds';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type Trip = Tables<'trips'>;
export type TripInsert = TablesInsert<'trips'>;
export type TripUpdate = TablesUpdate<'trips'>;
export type TripMember = Tables<'trip_members'>;
export type TripMemberInsert = TablesInsert<'trip_members'>;

/** 내가 볼 수 있는 여행 목록 (본인 개인 여행 + 소속 모임 여행). */
export async function getTrips(userId: string): Promise<Trip[]> {
  // 두 번에 나눠 조회한 뒤 합친다. 개인 여행과 모임 여행은 조건이 달라
  // 한 번의 or() 로 묶으면 조인 필터가 섞여 다른 사용자 여행이 새기 쉽다.
  const { data: myGroups, error: groupError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('status', GROUP_MEMBER_STATUS.ACTIVE);

  if (groupError) throw groupError;
  const groupIds = (myGroups ?? []).map((row) => row.group_id);

  const { data: personal, error: personalError } = await supabase
    .from('trips')
    .select('*')
    .eq('owner_user_id', userId)
    .neq('status', TRIP_STATUS.DELETED);

  if (personalError) throw personalError;

  let groupTrips: Trip[] = [];
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .in('group_id', groupIds)
      .neq('status', TRIP_STATUS.DELETED);
    if (error) throw error;
    groupTrips = data ?? [];
  }

  const byId = new Map<string, Trip>();
  for (const trip of [...(personal ?? []), ...groupTrips]) byId.set(trip.id, trip);

  return [...byId.values()].sort((a, b) =>
    (b.start_date ?? '').localeCompare(a.start_date ?? ''),
  );
}

/**
 * 이 사용자가 만든 여행 수. trip_created.user_trip_count 에 쓴다.
 *
 * `>= 2` 인 비율이 재사용률이고 가설 5 의 직접 지표다. (docs/06 §7-1)
 * 이번에 만드는 여행을 포함한 순번이므로 **저장이 끝난 뒤** 센다.
 */
export async function getMyTripCount(userId: string): Promise<number> {
  return (await getTrips(userId)).length;
}

/** 잘못된 tripId 면 null 을 반환한다. 화면은 Empty/Error 로 처리한다. */
export async function getTripById(tripId: string): Promise<Trip | null> {
  // maybeSingle() 이라 없으면 null 이다. 잘못된 tripId 로 들어와도 던지지 않는다.
  // 화면은 null 을 Empty/Error 로 처리한다. (CLAUDE.md 9장)
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .neq('status', TRIP_STATUS.DELETED)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createTrip(input: TripInsert): Promise<Trip> {
  const { data, error } = await supabase.from('trips').insert(input).select().single();
  if (error) throw error;
  return data;
}

/**
 * 여행 동행자를 넣는다.
 *
 * ⚠️ 아직 가입하지 않은 동행자는 user_id 없이 display_name 만 저장한다.
 *    group_members 는 user_id 가 NOT NULL 이라 미가입자를 넣을 수 없다.
 *    초대를 수락하면 이 행의 user_id 를 채워 잇는다.
 *    (docs/README.md §5 #15)
 */
export async function createTripMembers(inputs: TripMemberInsert[]): Promise<TripMember[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase.from('trip_members').insert(inputs).select();
  if (error) throw error;
  return data ?? [];
}

/**
 * 여행 생성 저장 — trips → trip_members → trip_budgets → budget_categories → fund_sources
 *
 * ⚠️⚠️ supabase-js 에는 트랜잭션이 없다. ⚠️⚠️
 *
 *    중간에 실패하면 예산 없는 여행, 카테고리 없는 예산 같은 반쪽 데이터가 남는다.
 *    준비 홈은 그걸 정상 여행으로 읽고 화면 곳곳에서 깨진다.
 *
 *    trips 를 참조하는 FK 가 전부 ON DELETE CASCADE 라, **trips 한 행만 지우면**
 *    trip_members / trip_budgets / budget_categories / fund_sources 가 함께 사라진다.
 *    그래서 trips 를 만든 뒤 실패하면 그 행을 지워 되돌린다.
 *
 *    되돌리기마저 실패하면 반쪽 여행이 남는다. 그때는 원래 에러를 그대로 던지고
 *    화면이 실패로 처리한다. 조용히 성공으로 넘기지 않는다.
 *
 *    실서비스에서 원자성이 필요해지면 Edge Function 의 RPC 로 옮긴다.
 *
 * ⚠️ 신규 모임(groups) 생성은 이 함수 밖에서 먼저 한다. 모임은 여행이 실패해도
 *    남아야 하는 별개 자산이다. 사용자가 다시 시도할 때 그대로 쓴다.
 */
export type CreateTripBundleInput = {
  trip: TripInsert;
  members: Omit<TripMemberInsert, 'trip_id'>[];
  budget: Omit<TripBudgetInsert, 'trip_id'>;
  categories: Omit<BudgetCategoryInsert, 'trip_budget_id'>[];
  fund: Omit<FundSourceInsert, 'trip_id'>;
};

export async function createTripBundle(input: CreateTripBundleInput): Promise<Trip> {
  const trip = await createTrip(input.trip);

  try {
    await createTripMembers(input.members.map((m) => ({ ...m, trip_id: trip.id })));

    const budget = await createTripBudget({ ...input.budget, trip_id: trip.id });

    await createBudgetCategories(
      input.categories.map((c) => ({ ...c, trip_budget_id: budget.id })),
    );

    await createFundSource({ ...input.fund, trip_id: trip.id });

    return trip;
  } catch (error) {
    // 보상 삭제. CASCADE 로 하위 행이 함께 지워진다.
    // 삭제 에러는 삼킨다. 원래 실패 원인을 덮어쓰면 안 된다.
    await supabase.from('trips').delete().eq('id', trip.id);
    throw error;
  }
}

export async function updateTrip(tripId: string, patch: TripUpdate): Promise<Trip> {
  // TODO: trips update 후 갱신된 행 반환.
  throw new Error('[queries/trips] updateTrip 미구현');
}
