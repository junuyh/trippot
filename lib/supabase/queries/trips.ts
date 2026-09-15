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
  TRIP_MEMBER_STATUS,
  TRIP_OWNER_TYPE,
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
/**
 * 내가 소유한 **개인 여행**. GROUP-01 이 실제 모임 옆에 함께 보여준다.
 * (docs/11_모임정책_v1.md §2 · 2026-09-12)
 *
 * ⚠️ 개인 여행은 groups 행이 없다. owner_type = PERSONAL · owner_user_id = 나 ·
 *    group_id = null 이 전부다. (trips_owner_shape CHECK) 그래서 group_members 로는
 *    절대 잡히지 않고, 여기서 trips 를 직접 읽는다.
 *
 * ⚠️ 상태 필터는 getTrips 와 같다. DELETED · CANCELED 만 뺀다. 새 규칙을 만들지 않는다.
 */
export async function getMyPersonalTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_type", TRIP_OWNER_TYPE.PERSONAL)
    .eq("owner_user_id", userId)
    .not("status", "in", `(${TRIP_STATUS.DELETED},${TRIP_STATUS.CANCELED})`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

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

// ── 여행 참가자 (trip_members) ───────────────────────────────────────────────
//
// 2026-09-09 확정 정책.
//
//   group_members  모임 여행을 **볼 수 있는** 권한
//   trip_members   특정 여행을 **수정할 수 있는** 권한
//
// ⚠️ trip_members 에는 unique (trip_id, user_id) 가 없다. 같은 사람이 한 여행에
//    여러 행을 가질 수 있으므로, 아래 함수들은 전부 "ACTIVE 행이 하나 이상"
//    기준으로 판단하고 갱신할 때도 여러 행을 한 번에 다룬다.
//    (unique 제약 추가는 초대·재참여 구현 시 별도 hardening 대상)

/**
 * 내가 지금 참가 중인 여행 id 집합.
 *
 * ⚠️ **한 번의 질의로 끝낸다.** 여행마다 참가 여부를 묻지 않는다(N+1 금지).
 *    GROUP 카드 · 계좌 시트 · 여행 나가기 노출이 모두 이 값을 함께 쓴다.
 *
 * ⚠️ INVITED · LEFT 는 참가자가 아니다. ACTIVE 만 센다.
 */
export async function getMyParticipatingTripIds(
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId)
    .eq("status", TRIP_MEMBER_STATUS.ACTIVE);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.trip_id));
}

/**
 * 이 여행에 참여 중인 **가입자** 수. 초대할 빈자리가 있는지 가리는 값이다.
 *
 * ⚠️ 서버의 참가 수락(accept_trip_join_request)과 **같은 기준**이다.
 *    ACTIVE · user_id 있음 · 같은 사람은 한 번. 이 값이 headcount 이상이면
 *    수락이 HEADCOUNT_REACHED 로 막힌다. (20260913000001_trip_join_request_rpcs.sql)
 *    미가입 동행자(user_id null)는 초대로 들어올 사람이라 세지 않는다.
 *
 * ⚠️ trip_members 는 unique (trip_id, user_id) 가 없어 행을 그대로 세면 부풀려진다.
 *    user_id 를 받아 겹침을 지운다.
 */
export async function getJoinedTripMemberCount(tripId: string): Promise<number> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("status", TRIP_MEMBER_STATUS.ACTIVE)
    .not("user_id", "is", null);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.user_id)).size;
}

/**
 * MY 전용 — 내가 실제로 참가 중인 여행만.
 *
 * ⚠️ getTrips 의 의미를 바꾸지 않는다. 그 함수는 HOME · 커뮤니티 글쓰기도
 *    함께 쓰고 있어서, 거기까지 기준이 바뀌면 이번에 정하지 않은 정책이
 *    따라 움직인다. (2026-09-09 확정 · B안) 그래서 **여기서 한 겹 걸러낸다.**
 *
 * ⚠️ 개인 여행도 그대로 남는다. 여행을 만들 때 본인이 trip_members 에
 *    ACTIVE 로 들어간다. (app/trips/new/budget-fund.tsx · seed.sql 다낭)
 */
export async function getMyParticipatingTrips(userId: string): Promise<Trip[]> {
  const [trips, participating] = await Promise.all([
    getTrips(userId),
    getMyParticipatingTripIds(userId),
  ]);
  return trips.filter((trip) => participating.has(trip.id));
}

/** MY 전용 — 위와 같은 기준에 금액 요약을 붙인 것. */
export async function getMyParticipatingTripsWithSummary(
  userId: string,
): Promise<TripWithSummary[]> {
  const [trips, participating] = await Promise.all([
    getTripsWithSummary(userId),
    getMyParticipatingTripIds(userId),
  ]);
  return trips.filter((trip) => participating.has(trip.id));
}

/**
 * 나 말고 이 여행에 남아 있는 참가자 수. (ACTIVE 만)
 *
 * ⚠️ **마지막 참가자인지 가리는 값이다.** 0 이면 나 혼자다.
 *    (2026-09-10 확정) 마지막 참가자는 여행에서 나갈 수 없다. 여행을 그만두려면
 *    '여행 취소' 를 쓴다 — 그건 다른 담당 기능이고 여기서 건드리지 않는다.
 *
 * ⚠️ 전체 ACTIVE 행을 세지 않는다. unique (trip_id, user_id) 가 없어서 내
 *    행이 중복으로 있으면 전체 개수가 부풀려지고, 혼자인데도 "혼자가 아니다"
 *    로 읽힌다. **내 행을 빼고** 세면 중복이 있어도 답이 맞는다.
 *
 * ⚠️ user_id 가 null 인 행은 남긴다. 아직 가입하지 않은 동행자를
 *    display_name 으로 넣어 둔 행이고, 그 사람도 이 여행의 참가자다.
 *    (`user_id.neq` 만 쓰면 null 행이 통째로 빠진다 — SQL 에서 null 비교는
 *    참이 되지 않는다. 그래서 or 로 null 을 따로 살린다.)
 */
export async function getOtherActiveTripMemberCount(
  tripId: string,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("status", TRIP_MEMBER_STATUS.ACTIVE)
    /**
     * ⚠️⚠️ 미가입 동행자(user_id 가 null)를 **세지 않는다.** ⚠️⚠️
     *    예전에는 `user_id.is.null` 로 함께 셌다. 그래서 '여행장 + 미가입
     *    동행자 1명' 여행이 others = 1 이 되어 나가기가 허용됐고, **여행장이
     *    나가고 계정 없는 사람만 남는 여행**이 만들어졌다. 그 여행은 취소할
     *    사람도 결산할 사람도 없다. (2026-09-14)
     *
     * ⚠️ 이 값은 "나 말고 이 여행을 이어받을 수 있는 사람이 있는가" 를 묻는다.
     *    인원 수가 아니다. 인원은 trips.headcount 가 따로 센다.
     */
    .not("user_id", "is", null)
    .neq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * 이 여행에서 나간다. (본인)
 *
 * ⚠️ status 를 LEFT 로 바꿀 뿐이다. 행을 지우지 않는다.
 *
 * ⚠️ **금융 데이터를 하나도 건드리지 않는다.** contributions · transactions ·
 *    fund_sources · settlements 어디에도 접근하지 않는다. 이미 낸 돈이 있어도
 *    나가기를 막지 않고, 자동 환불·재분배도 하지 않는다. (2026-09-09 확정)
 *
 * ⚠️ group_members 도 건드리지 않는다. 모임에서 나가는 것이 아니다.
 *
 * ⚠️ ACTIVE 행이 여러 개일 수 있어 `.eq('status', ACTIVE)` 로 **전부** 바꾼다.
 *    하나만 바꾸면 참가자로 남는 행이 생긴다.
 */
/**
 * @deprecated 2026-09-14 · `lib/supabase/queries/tripMembers.ts` 의 leaveTrip 을 쓴다.
 *
 * ⚠️ **새로 쓰지 말 것.** 이 함수는 left_at 을 안 찍고, 모임 이탈을 못 하고,
 *    무엇보다 **여행장 판정과 취소 동의 재판정을 하지 않는다.** 실제로 그래서
 *    오사카 여행의 여행장이 그냥 빠져나갔고, 그 여행은 초대를 수락할 사람도
 *    위임받을 사람도 없는 상태가 됐다.
 *
 * ⚠️ 호출부는 lib/hooks/useLeaveTrip.ts 로 옮겼다. 지금 이 함수를 부르는 곳은
 *    없다. 지우지 않고 두는 것은 L 복귀 후 판단할 재료로 남기기 위해서다.
 *    (다빈 결정)
 */
export async function leaveTrip(tripId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("trip_members")
    .update({ status: TRIP_MEMBER_STATUS.LEFT })
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .eq("status", TRIP_MEMBER_STATUS.ACTIVE);

  if (error) throw error;
}

/**
 * 취소된 여행. (MY-02 '취소된 여행' 탭 · 2026-09-11)
 *
 * ⚠️ **getTrips 로는 안 나온다.** 그 함수가 CANCELED 를 일부러 걸러내기
 *    때문이다. 홈·모임 목록에 취소된 여행이 섞이면 안 되므로 그 동작은
 *    그대로 두고, 취소된 여행만 따로 보는 함수를 여기에 둔다.
 *
 * ⚠️ 조회 범위는 getTrips 와 같은 규칙이다 — 내가 주인인 개인 여행과
 *    내가 속한 모임의 여행. 남의 여행을 읽을 수 있는 통로를 만들지 않는다.
 *    (CLAUDE.md 7장)
 */
export async function getCanceledTrips(userId: string): Promise<Trip[]> {
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
    .eq("status", TRIP_STATUS.CANCELED);

  if (personalError) throw personalError;

  let groupTrips: Trip[] = [];
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .in("group_id", groupIds)
      .eq("status", TRIP_STATUS.CANCELED);
    if (error) throw error;
    groupTrips = data ?? [];
  }

  const byId = new Map<string, Trip>();
  for (const trip of [...(personal ?? []), ...groupTrips]) byId.set(trip.id, trip);
  return [...byId.values()];
}

/**
 * 내가 나간 여행. (MY-02 '나간 여행' 탭 · 2026-09-11)
 *
 * ⚠️ **trips.status 로는 알 수 없다.** 여행 자체는 살아 있고 나만 빠진
 *    것이라 trip_members 를 봐야 한다.
 *
 * ⚠️ getTrips 로도 안 나온다. 그 함수는 owner_user_id 와 group_id 로만 찾는데,
 *    나간 사람은 둘 다에서 빠지기 때문이다. (개인 여행이면 주인이 아니고,
 *    모임을 나갔으면 group_members 에도 없다)
 *
 * ⚠️ 지워진 여행은 빼고 보여준다. 취소된 여행은 남긴다 — 내가 나간 뒤에
 *    남은 사람들이 취소했을 수 있고, 그것도 내 기록이다.
 */
export async function getLeftTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("trips!inner(*)")
    .eq("user_id", userId)
    .eq("status", TRIP_MEMBER_STATUS.LEFT)
    .neq("trips.status", TRIP_STATUS.DELETED);

  if (error) throw error;

  const byId = new Map<string, Trip>();
  for (const row of data ?? []) {
    const trip = row.trips as Trip | null;
    if (trip) byId.set(trip.id, trip);
  }
  return [...byId.values()];
}
