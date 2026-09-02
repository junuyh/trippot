// ============================================================================
// HOME-01 대표 홈 대시보드 집계
//
// 규칙 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//     그래서 이 파일의 공개 함수는 userId 하나만 받고, 여행 id 는 안에서 구한다.
//     tripIds 를 밖에서 받으면 남의 여행 id 를 넣어 조회할 수 있다.
//
// 대표 홈은 "여러 여행 중 지금 무슨 일이 일어나고 있는가" 를 본다.
// 카테고리별 예산 관리 같은 여행 상세(TRIP-HOME-01)의 일은 여기서 하지 않는다.
// ============================================================================
import {
  CATEGORY_CODE_LABEL,
  CONTRIBUTION_STATUS,
  TRANSACTION_TYPE,
  TRIP_MEMBER_STATUS,
  TRIP_STATUS,
} from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';

import { getTrips, type Trip } from './trips';

/** 지금 챙겨야 할 것 한 줄의 종류. */
export type HomeActionKind =
  /** 목표 여행비를 아직 정하지 않았다 */
  | 'BUDGET_NOT_SET'
  /** 카테고리 금고에 배분한 금액이 계획액보다 적다 */
  | 'BUDGET_SHORTAGE'
  /** 현재 여행자금이 목표 여행자금에 못 미친다 */
  | 'FUND_SHORTAGE'
  /** 아직 입금하지 않은 멤버가 있다 */
  | 'UNPAID_CONTRIBUTION';

export type HomeAction = {
  kind: HomeActionKind;
  tripId: string;
  destination: string | null;
  startDate: string | null;
  /** BUDGET_SHORTAGE 에서 어떤 카테고리인지. 다른 종류는 null. */
  categoryCode: string | null;
  categoryLabel: string | null;
  /** 부족 금액(BUDGET_SHORTAGE) 또는 미납 합계(UNPAID_CONTRIBUTION). 원 단위 정수. */
  amount: number | null;
  /** 미납 인원(UNPAID_CONTRIBUTION). 다른 종류는 null. */
  memberCount: number | null;
};

export type HomeFundTripRate = {
  tripId: string;
  destination: string | null;
  /** 준비율(%). 목표가 없으면 null. */
  ratePercent: number | null;
};

export type HomeFundSummary = {
  /** 진행 중 여행들의 현재 여행자금 합계. */
  currentTotal: number;
  /** 이번 달 들어온 여행자금(입금 거래 합계). */
  monthlyDeposit: number;
  trips: HomeFundTripRate[];
};

/** 지난 여행에서 계획보다 많이 쓴 카테고리 하나. */
export type HomePastInsight = {
  tripId: string;
  destination: string | null;
  categoryCode: string;
  categoryLabel: string;
  /** 계획보다 더 쓴 금액. 원 단위 정수. */
  overAmount: number;
};

export type HomeDashboard = {
  /** 인사 문구에 쓰는 이름. 없으면 화면이 대체 문구를 쓴다. */
  userName: string | null;
  /** 여행별 참여 인원(ACTIVE 멤버 수). */
  memberCountByTripId: Record<string, number>;
  /** 급한 순으로 정렬돼 있다. 화면이 걸러내고 HOME_ACTION_LIMIT 만큼 자른다. */
  actions: HomeAction[];
  fund: HomeFundSummary;
  /** 확정된 결산이 없으면 null. 화면이 빈 상태를 보여준다. */
  insight: HomePastInsight | null;
};

/**
 * 홈에 보여줄 액션 개수. 더 많으면 사용자가 무엇부터 할지 못 고른다.
 *
 * 자르는 건 화면이 한다. 메인 카드와 겹치는 줄을 먼저 걸러내야 해서,
 * 여기서 미리 자르면 3개를 채우지 못한다.
 */
export const HOME_ACTION_LIMIT = 3;

/** 이번 달 1일 0시(기기 시간대 = KST). 입금 거래를 자를 기준이다. */
function startOfThisMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function isOngoing(trip: Trip): boolean {
  return trip.status === TRIP_STATUS.PLANNING || trip.status === TRIP_STATUS.TRAVELING;
}

/** 같은 여행 안에서는 아직 정하지 않은 것부터 알린다. */
const KIND_WEIGHT: Record<HomeActionKind, number> = {
  BUDGET_NOT_SET: 0,
  UNPAID_CONTRIBUTION: 1,
  BUDGET_SHORTAGE: 2,
  FUND_SHORTAGE: 3,
};

/**
 * 대표 홈이 필요한 값을 한 번에 모은다.
 *
 * 여행 수만큼 질의하지 않는다. 여행 id 를 모아 .in() 으로 한 번에 읽는다.
 * (여행이 10개면 질의도 10배가 된다)
 */
export async function getHomeDashboard(userId: string): Promise<HomeDashboard> {
  const trips = await getTrips(userId);
  const ongoing = trips.filter(isOngoing);
  const ongoingIds = ongoing.map((trip) => trip.id);
  const settledIds = trips
    .filter((trip) => trip.status === TRIP_STATUS.SETTLED)
    .map((trip) => trip.id);

  const tripById = new Map(trips.map((trip) => [trip.id, trip]));

  const [userRow, members, budgets, funds, deposits, contributions, settlements] =
    await Promise.all([
      supabase.from('users').select('name').eq('id', userId).maybeSingle(),
      ongoingIds.length
        ? supabase.from('trip_members').select('trip_id, status').in('trip_id', ongoingIds)
        : null,
      ongoingIds.length
        ? supabase
            .from('trip_budgets')
            .select('id, trip_id, target_amount')
            .in('trip_id', ongoingIds)
        : null,
      ongoingIds.length
        ? supabase.from('fund_sources').select('trip_id, current_amount').in('trip_id', ongoingIds)
        : null,
      ongoingIds.length
        ? supabase
            .from('transactions')
            .select('trip_id, amount, transaction_type, occurred_at')
            .in('trip_id', ongoingIds)
            .eq('transaction_type', TRANSACTION_TYPE.DEPOSIT)
            .gte('occurred_at', startOfThisMonth())
            .is('deleted_at', null)
        : null,
      ongoingIds.length
        ? supabase
            .from('contributions')
            .select('trip_id, status, expected_amount, paid_amount')
            .in('trip_id', ongoingIds)
        : null,
      settledIds.length
        ? supabase
            .from('settlements')
            .select('trip_id, category_snapshot_json, confirmed_at')
            .in('trip_id', settledIds)
            .not('confirmed_at', 'is', null)
            .order('confirmed_at', { ascending: false })
            .limit(1)
        : null,
    ]);

  if (userRow.error) throw userRow.error;
  if (members?.error) throw members.error;
  if (budgets?.error) throw budgets.error;
  if (funds?.error) throw funds.error;
  if (deposits?.error) throw deposits.error;
  if (contributions?.error) throw contributions.error;
  if (settlements?.error) throw settlements.error;

  // 인원
  const memberCountByTripId: Record<string, number> = {};
  for (const row of members?.data ?? []) {
    if (row.status !== TRIP_MEMBER_STATUS.ACTIVE) continue;
    memberCountByTripId[row.trip_id] = (memberCountByTripId[row.trip_id] ?? 0) + 1;
  }

  // 금액
  const targetByTripId = new Map<string, number>();
  const budgetIdToTripId = new Map<string, string>();
  for (const row of budgets?.data ?? []) {
    targetByTripId.set(row.trip_id, row.target_amount);
    budgetIdToTripId.set(row.id, row.trip_id);
  }

  const currentByTripId = new Map<string, number>();
  for (const row of funds?.data ?? []) {
    // 주의: current_amount 자체가 이미 단일 소스(계좌 또는 수기) 기준이다.
    //       여기서 더하는 건 서로 다른 여행의 금액이라 CLAUDE.md 3장의
    //       "직접입력 + 계좌 잔액 합산 금지" 에 해당하지 않는다.
    currentByTripId.set(row.trip_id, row.current_amount);
  }

  const fund: HomeFundSummary = {
    currentTotal: [...currentByTripId.values()].reduce((sum, value) => sum + value, 0),
    monthlyDeposit: (deposits?.data ?? []).reduce((sum, row) => sum + row.amount, 0),
    trips: ongoing.map((trip) => {
      const target = targetByTripId.get(trip.id) ?? 0;
      const current = currentByTripId.get(trip.id) ?? 0;
      return {
        tripId: trip.id,
        destination: trip.destination,
        // 정수 퍼센트만 만든다. 소수점 연산을 하지 않는다. (CLAUDE.md 9장)
        ratePercent: target > 0 ? Math.floor((current * 100) / target) : null,
      };
    }),
  };

  // 지금 챙겨야 할 것
  const actions: HomeAction[] = [];

  function push(trip: Trip, part: Omit<HomeAction, 'tripId' | 'destination' | 'startDate'>) {
    actions.push({
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      ...part,
    });
  }

  // 1) 목표 여행비를 아직 정하지 않은 여행
  for (const trip of ongoing) {
    const target = targetByTripId.get(trip.id);
    if (target === undefined || target <= 0) {
      push(trip, {
        kind: 'BUDGET_NOT_SET',
        categoryCode: null,
        categoryLabel: null,
        amount: null,
        memberCount: null,
      });
    }
  }

  // 2) 카테고리 금고 배분이 계획액에 못 미치는 여행
  //    여행마다 가장 크게 모자란 카테고리 하나만 알린다.
  const budgetIds = [...budgetIdToTripId.keys()];
  if (budgetIds.length > 0) {
    const { data: categories, error } = await supabase
      .from('budget_categories')
      .select('trip_budget_id, category_code, planned_amount, prepared_amount, enabled')
      .in('trip_budget_id', budgetIds);
    if (error) throw error;

    // 여행별 배분 합계. 0 이면 아직 금고에 나눠 담기 전이다.
    // 그 상태를 '부족' 이라고 알리면 모든 여행이 항상 부족으로 뜬다.
    const preparedByTripId = new Map<string, number>();
    for (const row of categories ?? []) {
      const tripId = budgetIdToTripId.get(row.trip_budget_id);
      if (!tripId) continue;
      preparedByTripId.set(tripId, (preparedByTripId.get(tripId) ?? 0) + row.prepared_amount);
    }

    const worstByTripId = new Map<string, { code: string; shortage: number }>();
    for (const row of categories ?? []) {
      if (!row.enabled) continue;
      const shortage = row.planned_amount - row.prepared_amount;
      if (shortage <= 0) continue;

      const tripId = budgetIdToTripId.get(row.trip_budget_id);
      if (!tripId) continue;
      if ((preparedByTripId.get(tripId) ?? 0) === 0) continue;

      const prev = worstByTripId.get(tripId);
      if (!prev || shortage > prev.shortage) {
        worstByTripId.set(tripId, { code: row.category_code, shortage });
      }
    }

    for (const [tripId, worst] of worstByTripId) {
      const trip = tripById.get(tripId);
      if (!trip) continue;
      push(trip, {
        kind: 'BUDGET_SHORTAGE',
        categoryCode: worst.code,
        // 모르는 코드면 라벨 없이 보낸다. 화면이 대체 문구를 쓴다.
        categoryLabel: CATEGORY_CODE_LABEL[worst.code as keyof typeof CATEGORY_CODE_LABEL] ?? null,
        amount: worst.shortage,
        memberCount: null,
      });
    }
  }

  // 3) 현재 여행자금이 목표에 못 미치는 여행
  //    메인 카드에 올라간 여행은 화면에서 걸러낸다. 카드가 이미 같은 말을 하고 있다.
  for (const trip of ongoing) {
    const target = targetByTripId.get(trip.id) ?? 0;
    const current = currentByTripId.get(trip.id) ?? 0;
    if (target <= 0 || current >= target) continue;
    push(trip, {
      kind: 'FUND_SHORTAGE',
      categoryCode: null,
      categoryLabel: null,
      amount: target - current,
      memberCount: null,
    });
  }

  // 4) 아직 입금하지 않은 멤버가 있는 여행
  const unpaidByTripId = new Map<string, { count: number; amount: number }>();
  for (const row of contributions?.data ?? []) {
    if (row.status === CONTRIBUTION_STATUS.PAID) continue;
    const prev = unpaidByTripId.get(row.trip_id) ?? { count: 0, amount: 0 };
    unpaidByTripId.set(row.trip_id, {
      count: prev.count + 1,
      amount: prev.amount + Math.max(0, row.expected_amount - row.paid_amount),
    });
  }
  for (const [tripId, unpaid] of unpaidByTripId) {
    const trip = tripById.get(tripId);
    if (!trip) continue;
    push(trip, {
      kind: 'UNPAID_CONTRIBUTION',
      categoryCode: null,
      categoryLabel: null,
      amount: unpaid.amount,
      memberCount: unpaid.count,
    });
  }

  // 출발이 가까운 여행부터. 날짜가 없는 여행은 뒤로 보낸다.
  actions.sort((a, b) => {
    const left = a.startDate ?? '9999-12-31';
    const right = b.startDate ?? '9999-12-31';
    if (left !== right) return left.localeCompare(right);
    return KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
  });

  return {
    userName: userRow.data?.name ?? null,
    memberCountByTripId,
    actions,
    fund,
    insight: await toInsight(settlements?.data ?? [], tripById),
  };
}

/**
 * 가장 최근 확정 결산에서 계획보다 가장 많이 쓴 카테고리를 찾는다.
 *
 * 주의: 확정 시점의 **스냅샷**만 쓴다. 지금 budget_categories 를 읽으면
 *       결산 뒤 예산을 고쳤을 때 과거 기록이 따라 바뀐다.
 *       (personalization.ts 의 getSpendingProfile 과 같은 원칙)
 *       스냅샷이 비어 있는 과거 데이터(시드 등)만 지금 예산으로 대신한다.
 */
async function toInsight(
  rows: { trip_id: string; category_snapshot_json: unknown }[],
  tripById: Map<string, Trip>,
): Promise<HomePastInsight | null> {
  const row = rows[0];
  if (!row) return null;

  const snapshot = row.category_snapshot_json as
    | { categories?: { category_code: string; planned_amount: number; actual_amount: number }[] }
    | null;
  const categories = snapshot?.categories?.length
    ? snapshot.categories
    : await fallbackCategories(row.trip_id);
  if (categories.length === 0) return null;

  let worst: { code: string; over: number } | null = null;
  for (const category of categories) {
    const over = category.actual_amount - category.planned_amount;
    if (over <= 0) continue;
    if (!worst || over > worst.over) worst = { code: category.category_code, over };
  }
  if (!worst) return null;

  const trip = tripById.get(row.trip_id);
  return {
    tripId: row.trip_id,
    destination: trip?.destination ?? null,
    categoryCode: worst.code,
    categoryLabel:
      CATEGORY_CODE_LABEL[worst.code as keyof typeof CATEGORY_CODE_LABEL] ?? worst.code,
    overAmount: worst.over,
  };
}

/**
 * 결산 스냅샷이 비어 있는 여행만 지금 예산에서 값을 읽는다.
 *
 * 스냅샷이 있으면 절대 여기로 오지 않는다. 과거 기록이 지금 예산을 따라
 * 바뀌면 안 되기 때문이다. (personalization.ts 의 needFallback 과 같은 처리)
 */
async function fallbackCategories(
  tripId: string,
): Promise<{ category_code: string; planned_amount: number; actual_amount: number }[]> {
  const { data: budget, error: budgetError } = await supabase
    .from('trip_budgets')
    .select('id')
    .eq('trip_id', tripId)
    .maybeSingle();
  if (budgetError) throw budgetError;
  if (!budget) return [];

  const { data, error } = await supabase
    .from('budget_categories')
    .select('category_code, planned_amount, actual_amount')
    .eq('trip_budget_id', budget.id);
  if (error) throw error;

  return data ?? [];
}
