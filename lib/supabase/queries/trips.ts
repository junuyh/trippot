// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import {
  GROUP_MEMBER_STATUS,
  TRANSACTION_TYPE,
  TRIP_STATUS,
} from "@/lib/constants/status";
import { differenceInCalendarDays, parseISO } from "date-fns";

import { supabase } from "@/lib/supabase/client";
import {
  createBudgetCategories,
  createBudgetPlanItems,
  createTripBudget,
  type BudgetCategoryInsert,
  type TripBudgetInsert,
} from "@/lib/supabase/queries/budgets";
import {
  createFundSource,
  type FundSourceInsert,
} from "@/lib/supabase/queries/funds";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type Trip = Tables<"trips">;
export type TripInsert = TablesInsert<"trips">;
export type TripUpdate = TablesUpdate<"trips">;
export type TripMember = Tables<"trip_members">;
export type TripMemberInsert = TablesInsert<"trip_members">;

/** 내가 볼 수 있는 여행 목록 (본인 개인 여행 + 소속 모임 여행). */
/**
 * 내 여행 목록. 삭제된 여행과 **취소된 여행**은 뺀다.
 * 취소된 여행은 MY-02 '취소된 여행' 탭에서 따로 본다. [팀원 개발 예정]
 */
export async function getTrips(userId: string): Promise<Trip[]> {
  // 두 번에 나눠 조회한 뒤 합친다. 개인 여행과 모임 여행은 조건이 달라
  // 한 번의 or() 로 묶으면 조인 필터가 섞여 다른 사용자 여행이 새기 쉽다.
  const { data: myGroups, error: groupError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", GROUP_MEMBER_STATUS.ACTIVE);

  if (groupError) throw groupError;
  const groupIds = (myGroups ?? []).map((row) => row.group_id);

  const { data: personal, error: personalError } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_user_id", userId)
    .not("status", "in", `(${TRIP_STATUS.DELETED},${TRIP_STATUS.CANCELED})`);

  if (personalError) throw personalError;

  let groupTrips: Trip[] = [];
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .in("group_id", groupIds)
      .not("status", "in", `(${TRIP_STATUS.DELETED},${TRIP_STATUS.CANCELED})`);
    if (error) throw error;
    groupTrips = data ?? [];
  }

  const byId = new Map<string, Trip>();
  for (const trip of [...(personal ?? []), ...groupTrips])
    byId.set(trip.id, trip);

  return [...byId.values()].sort((a, b) =>
    (b.start_date ?? "").localeCompare(a.start_date ?? ""),
  );
}

/**
 * 홈 카드에 얹는 금액. 값이 없으면 null 이고 화면이 대체 표시를 한다.
 *
 * ⚠️ currentAmount 는 **누적 모금액**이다. 입금 기록이 있으면 그 합계를 쓰고,
 *    없을 때만 fund_sources.current_amount 로 떨어진다.
 *
 *    current_amount 는 등록·동기화 시점의 **잔액**이라 여행비를 결제하면
 *    줄어든다. 그 값으로 준비율을 내면 돈을 쓸수록 준비가 뒤로 간다.
 *    여행 홈의 수하물 태그도 같은 기준을 쓴다 — 두 화면이 다른 값을 쓰면
 *    같은 여행이 홈에서 0%, 상세에서 50% 로 보인다.
 *
 * ⚠️ 직접입력 금액과 계좌 잔액을 **한 여행 안에서** 합산하지 않는다는 규칙은
 *    그대로다. (CLAUDE.md 3장) 입금 합계는 그 여행의 단일 소스에 들어온
 *    기록이라 두 소스를 섞는 것이 아니다.
 */
export type TripWithSummary = Trip & {
  /** trip_budgets.target_amount. 예산 미확정이면 0 이 들어있을 수 있다. */
  targetAmount: number | null;
  /** 누적 모금액. 입금 기록도 자금 소스도 없으면 null. */
  currentAmount: number | null;
  /** settlements.actual_amount. 결산 전(ENDED)이면 null. */
  finalAmount: number | null;
};

/**
 * 홈(HOME-01) 카드용 여행 목록. 목표 여행비·현재 여행자금·최종 여행비를 함께 담는다.
 *
 * 여행마다 예산·자금·결산을 따로 조회하면 여행 수에 비례해 쿼리가 늘어난다(N+1).
 * 여행 id 를 모아 테이블당 한 번씩만 조회하고 메모리에서 붙인다.
 * 여행이 몇 개든 쿼리 수는 고정이다.
 *
 * ⚠️ 조회 범위는 getTrips(userId) 가 돌려준 여행으로만 한정한다.
 *    tripIds 를 받는 공개 함수로 쪼개지 않는 이유다 — 임의의 tripId 를 넘겨
 *    남의 여행 금액을 읽을 수 있는 통로를 만들지 않는다. (CLAUDE.md 7장)
 */
export async function getTripsWithSummary(
  userId: string,
): Promise<TripWithSummary[]> {
  const trips = await getTrips(userId);
  if (trips.length === 0) return [];

  const tripIds = trips.map((trip) => trip.id);

  const [budgets, funds, deposits, settlements] = await Promise.all([
    supabase
      .from("trip_budgets")
      .select("trip_id, target_amount")
      .in("trip_id", tripIds),
    supabase
      .from("fund_sources")
      .select("trip_id, current_amount")
      .in("trip_id", tripIds),
    supabase
      .from("transactions")
      .select("trip_id, amount")
      .in("trip_id", tripIds)
      .eq("transaction_type", TRANSACTION_TYPE.DEPOSIT)
      .is("deleted_at", null),
    supabase
      .from("settlements")
      .select("trip_id, actual_amount")
      .in("trip_id", tripIds),
  ]);

  if (budgets.error) throw budgets.error;
  if (funds.error) throw funds.error;
  if (deposits.error) throw deposits.error;
  if (settlements.error) throw settlements.error;

  // trip_id 가 셋 다 UNIQUE 라 여행당 최대 한 행이다.
  const targetByTrip = new Map(
    (budgets.data ?? []).map((r) => [r.trip_id, r.target_amount]),
  );
  // 여행당 여러 건이라 합계를 낸다. 위 셋과 달리 UNIQUE 가 아니다
  const depositByTrip = new Map<string, number>();
  for (const row of deposits.data ?? []) {
    depositByTrip.set(row.trip_id, (depositByTrip.get(row.trip_id) ?? 0) + row.amount);
  }
  const currentByTrip = new Map(
    (funds.data ?? []).map((r) => [
      r.trip_id,
      depositByTrip.get(r.trip_id) ?? r.current_amount,
    ]),
  );
  // 자금 소스가 아직 없어도 입금이 있으면 그 합계를 쓴다
  for (const [tripId, total] of depositByTrip) {
    if (!currentByTrip.has(tripId)) currentByTrip.set(tripId, total);
  }
  const finalByTrip = new Map(
    (settlements.data ?? []).map((r) => [r.trip_id, r.actual_amount]),
  );

  return trips.map((trip) => ({
    ...trip,
    targetAmount: targetByTrip.get(trip.id) ?? null,
    currentAmount: currentByTrip.get(trip.id) ?? null,
    finalAmount: finalByTrip.get(trip.id) ?? null,
  }));
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
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .neq("status", TRIP_STATUS.DELETED)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createTrip(input: TripInsert): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .insert(input)
    .select()
    .single();
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
export async function createTripMembers(
  inputs: TripMemberInsert[],
): Promise<TripMember[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase
    .from("trip_members")
    .insert(inputs)
    .select();
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
  members: Omit<TripMemberInsert, "trip_id">[];
  budget: Omit<TripBudgetInsert, "trip_id">;
  categories: Omit<BudgetCategoryInsert, "trip_budget_id">[];
  /**
   * 예산 구성에서 고른 상품. 카테고리가 만들어진 뒤 계획 항목으로 저장한다.
   * categoryCode 로 방금 만든 카테고리를 찾는다 — id 는 아직 없기 때문이다.
   */
  planItems?: {
    categoryCode: string;
    name: string;
    expectedAmount: number;
    sortOrder: number;
  }[];
  fund: Omit<FundSourceInsert, "trip_id">;
};

export async function createTripBundle(
  input: CreateTripBundleInput,
): Promise<Trip> {
  const trip = await createTrip(input.trip);

  try {
    await createTripMembers(
      input.members.map((m) => ({ ...m, trip_id: trip.id })),
    );

    const budget = await createTripBudget({
      ...input.budget,
      trip_id: trip.id,
    });

    const created = await createBudgetCategories(
      input.categories.map((c) => ({ ...c, trip_budget_id: budget.id })),
    );

    /**
     * 예산 구성에서 고른 상품을 **세부 계획 항목으로도 남긴다.**
     *
     * ⚠️ 지금까지는 상품이 금액 계산에만 쓰이고 사라졌다. '대형항공사 직항'
     *    을 골라 항공 예산을 240만원으로 잡아 놓고, 카테고리 상세에 들어가면
     *    세부 계획이 0건이라 무엇을 기준으로 그 금액이 됐는지 알 수 없었다.
     *    계획한 것과 실제 쓴 것을 비교하는 게 이 서비스의 핵심인데,
     *    비교할 '계획' 이 저장되지 않고 있던 셈이다.
     *
     * ⚠️ 실패해도 여행 생성을 되돌리지 않는다. 계획 항목은 나중에 화면에서
     *    직접 추가할 수 있다. 이것 때문에 여행이 통째로 안 만들어지면 손해가
     *    더 크다.
     */
    if (input.planItems?.length) {
      const idByCode = new Map(
        created.map((row) => [row.category_code, row.id]),
      );
      const rows = input.planItems
        .map((item) => {
          const categoryId = idByCode.get(item.categoryCode);
          return categoryId
            ? {
                budget_category_id: categoryId,
                name: item.name,
                expected_amount: item.expectedAmount,
                sort_order: item.sortOrder,
              }
            : null;
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (rows.length > 0) {
        await createBudgetPlanItems(rows).catch(() => undefined);
      }
    }

    await createFundSource({ ...input.fund, trip_id: trip.id });

    return trip;
  } catch (error) {
    // 보상 삭제. CASCADE 로 하위 행이 함께 지워진다.
    // 삭제 에러는 삼킨다. 원래 실패 원인을 덮어쓰면 안 된다.
    await supabase.from("trips").delete().eq("id", trip.id);
    throw error;
  }
}

export async function updateTrip(
  tripId: string,
  patch: TripUpdate,
): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .update(patch)
    .eq("id", tripId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 여행 기간이 끝났으면 상태를 ENDED 로 올린다. (CLAUDE.md 3장)
 *
 * ⚠️ **사용자가 아무것도 하지 않아도 결산으로 이어져야 한다.**
 *    지금까지는 여행이 끝나도 PLANNING 인 채로 남아, 결산 화면 주소를
 *    아는 사람만 결산을 할 수 있었다. 결산은 개인화의 입력이라
 *    여기서 끊기면 다음 여행 추천이 영영 만들어지지 않는다.
 *
 * ⚠️ ENDED 까지만 올린다. **SETTLED 로 자동 확정하지 않는다.**
 *    결산 확정은 되돌릴 수 없고 스냅샷이 남으므로 사용자 확인을 받아야 한다.
 *    (NFR-003 · CLAUDE.md 3장 "사용자 확인 후 진행한다")
 *
 * 이미 ENDED·SETTLED·DELETED 면 아무것도 하지 않는다.
 */
export async function closeTripIfEnded(trip: Trip): Promise<Trip> {
  if (
    trip.status !== TRIP_STATUS.PLANNING &&
    trip.status !== TRIP_STATUS.TRAVELING
  ) {
    return trip;
  }

  const today = new Date();

  // end_date 는 date 타입이라 시각이 없다. 종료일 **다음 날**부터 끝난 것으로 본다.
  // 종료일 당일에 끝났다고 하면 아직 여행 중인 사람에게 정산을 들이민다.
  if (trip.end_date && differenceInCalendarDays(today, parseISO(trip.end_date)) > 0) {
    return updateTrip(trip.id, { status: TRIP_STATUS.ENDED });
  }

  /**
   * 출발일이 되면 TRAVELING 으로 올린다.
   *
   * ⚠️ 지금까지 아무도 이 상태를 쓰지 않아, 여행 중인데도 PLANNING 으로
   *    남아 있었다. 홈·모임·커뮤니티가 저마다 날짜를 다시 계산해 '여행 중'
   *    을 판정하면 한 곳이 틀렸을 때 화면끼리 상태가 어긋난다.
   *    상태를 한 곳에서 올려 두면 모두가 같은 값을 읽는다.
   *
   * ⚠️ PLANNING 에서만 올린다. 이미 TRAVELING 이면 쓸 이유가 없다.
   */
  if (
    trip.status === TRIP_STATUS.PLANNING &&
    trip.start_date &&
    differenceInCalendarDays(today, parseISO(trip.start_date)) >= 0
  ) {
    return updateTrip(trip.id, { status: TRIP_STATUS.TRAVELING });
  }

  return trip;
}
