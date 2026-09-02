// ============================================================================
// HOME-01 · / · MVP
// 기준 문서: docs/09_IA_v2.md §1, docs/02_유저플로우_v1.md §1,
//            docs/03_요구사항정의서_v1.md REQ-HOME-001 / REQ-HOME-002 / POL-NAV-001
//
// 2026-09-02 개편 — 대표 홈을 여행 목록이 아니라 대시보드로 바꿨다.
//   1) 가장 가까운 여행  2) 준비 상태  3) 지금 해야 할 일
// 카테고리별 예산 관리는 여행 상세 홈(TRIP-HOME-01)의 일이라 여기서 반복하지 않는다.
//
// ⚠️ docs/09_IA_v2.md §1 은 아직 v1 구조(진행 중/종료된 여행 목록)를 적고 있다.
//    문서를 코드에 맞춰 고치지 않았다. 어긋난 지점은 사람에게 알린다. (CLAUDE.md 1-1)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/home/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// 여기서 <Stack.Screen options={{ title }} /> 을 쓰면 Tabs 스크린 옵션을 덮어써서
// 하단 탭 라벨까지 바뀐다.
// ============================================================================
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  HomeEmpty,
  HomeError,
  HomeLoading,
  HomeView,
  type HomeActionItem,
  type HomeEmptyVariant,
  type HomeFundSummaryData,
  type HomeGroupItem,
  type HomePastInsightData,
  type NextTripCardData,
  type OngoingTripCardData,
} from '@/components/home';
import { daysUntil } from '@/components/home/format';
import { HOME_ACTION_TINT } from '@/components/home/palette';
import { SCREENS } from '@/lib/analytics/events';
import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';
import { countryTheme } from '@/lib/constants/countryTheme';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  ENTRY_POINT,
  TRIP_OWNER_TYPE,
  TRIP_STATUS,
  type CategoryCode,
  type EntryPoint,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getMyGroups, type Group } from '@/lib/supabase/queries/groups';
import {
  getHomeDashboard,
  HOME_ACTION_LIMIT,
  type HomeAction,
  type HomeDashboard,
} from '@/lib/supabase/queries/home';
import { getTripsWithSummary, type TripWithSummary } from '@/lib/supabase/queries/trips';

type LoadState = 'loading' | 'ready' | 'error';

/** 액션 한 줄을 눌렀을 때 갈 곳. 액션 종류마다 다르다. */
const ACTION_ROUTE: Record<HomeAction['kind'], (tripId: string) => string> = {
  BUDGET_NOT_SET: (tripId) => `/trips/${tripId}/budget`,
  BUDGET_SHORTAGE: (tripId) => `/trips/${tripId}/budget`,
  FUND_SHORTAGE: (tripId) => `/trips/${tripId}/funds`,
  UNPAID_CONTRIBUTION: (tripId) => `/trips/${tripId}/contributions`,
};

/** 액션 종류별 아이콘. 카테고리 부족은 아래 CATEGORY_ICON 이 우선한다. */
const ACTION_ICON: Record<HomeAction['kind'], string> = {
  BUDGET_NOT_SET: 'calculator-outline',
  BUDGET_SHORTAGE: 'pie-chart-outline',
  FUND_SHORTAGE: 'wallet-outline',
  UNPAID_CONTRIBUTION: 'people-outline',
};

/** 카테고리별 아이콘. 어떤 예산이 모자란지 그림만 봐도 알게 한다. */
const CATEGORY_ICON: Record<CategoryCode, string> = {
  AIRFARE: 'airplane-outline',
  LODGING: 'bed-outline',
  FOOD: 'restaurant-outline',
  TRANSPORT: 'subway-outline',
  ACTIVITY: 'ticket-outline',
  SHOPPING: 'bag-handle-outline',
  INSURANCE: 'shield-checkmark-outline',
  CONTINGENCY: 'wallet-outline',
};

export default function ScreenHOME01() {
  useScreenView(SCREENS.HOME);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [trips, setTrips] = useState<TripWithSummary[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      const [nextTrips, nextGroups, nextDashboard] = await Promise.all([
        getTripsWithSummary(userId),
        getMyGroups(userId),
        getHomeDashboard(userId),
      ]);
      setTrips(nextTrips);
      setGroups(nextGroups);
      setDashboard(nextDashboard);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 액션 id → 이동할 경로. 화면이 라우트를 만든다. (CLAUDE.md 9장)
  const actionRouteById = useMemo(() => {
    const map = new Map<string, string>();
    for (const action of dashboard?.actions ?? []) {
      map.set(actionId(action), ACTION_ROUTE[action.kind](action.tripId));
    }
    return map;
  }, [dashboard]);

  function handlePressTrip(tripId: string) {
    // 진행/종료 모두 같은 라우트다. 도착 화면이 trip.status 로 분기한다. (docs/04_v3 §5)
    router.push(`/trips/${tripId}`);
  }

  function handlePressGroup(groupId: string) {
    // 홈·모임·마이페이지 어디서 눌러도 같은 모임 상세로 간다. (docs/03 POL-NAV-001)
    router.push(`/groups/${groupId}`);
  }

  function handlePressCreateTrip(entryPoint: EntryPoint) {
    // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
    // 홈에서도 track() 하면 trip_create_started 가 두 번 쌓여 퍼널이 부풀려진다.
    // (docs/README.md §5 17번 — HOME-01 담당자가 param 을 붙여달라는 요청)
    router.push(`/trips/new/owner?entryPoint=${entryPoint}`);
  }

  function handlePressAction(id: string) {
    const route = actionRouteById.get(id);
    // 목록이 새로 그려지는 사이에 눌렸으면 아무 데도 가지 않는다. (Crash 금지)
    if (route) router.push(route);
  }

  if (loadState === 'loading') {
    return <HomeLoading />;
  }

  if (loadState === 'error' || dashboard === null) {
    return <HomeError message="홈 정보를 불러오지 못했어요." onRetry={() => void load()} />;
  }

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  // trips.status / owner_type 은 DB 가 text + CHECK 라 생성 타입이 string 이다.
  // 화면에서 쓰기 전에 상수 집합으로 좁힌다. 모르는 값이면 그 행을 그리지 않는다. (Crash 금지)
  function toTripStatus(value: string): TripStatus | null {
    const known = Object.values(TRIP_STATUS) as string[];
    return known.includes(value) ? (value as TripStatus) : null;
  }

  function toBase(trip: TripWithSummary, status: TripStatus) {
    // 국기·영문명·공항코드는 목적지 상수에서 온다. 모르는 목적지면 대체값을 쓴다.
    const meta = findDestinationByName(trip.destination);
    return {
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status,
      ownerType:
        trip.owner_type === TRIP_OWNER_TYPE.GROUP
          ? TRIP_OWNER_TYPE.GROUP
          : TRIP_OWNER_TYPE.PERSONAL,
      groupName: trip.group_id ? (groupNameById.get(trip.group_id) ?? null) : null,
      destinationEn: meta?.nameEn ?? (trip.destination ?? 'TRIP').toUpperCase(),
      flag: meta?.flag ?? '🌍',
      airportCode: meta?.airportCode ?? '—',
    };
  }

  const ongoingTrips: OngoingTripCardData[] = trips.flatMap((trip) => {
    const status = toTripStatus(trip.status);
    if (status !== TRIP_STATUS.PLANNING && status !== TRIP_STATUS.TRAVELING) return [];
    return [
      {
        ...toBase(trip, status),
        theme: countryTheme(findDestinationByName(trip.destination)?.countryKo),
        targetAmount: trip.targetAmount,
        currentAmount: trip.currentAmount,
      },
    ];
  });

  // 메인 카드에 올릴 여행 하나를 고른다.
  //   1) 지금 여행 중이면 그 여행이 가장 급하다
  //   2) 아니면 출발일이 가장 가까운 여행
  //   3) 날짜가 없으면 목록 첫 여행
  const traveling = ongoingTrips.filter((trip) => trip.status === TRIP_STATUS.TRAVELING);
  const upcoming = ongoingTrips
    .filter((trip) => trip.status === TRIP_STATUS.PLANNING && trip.startDate !== null)
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  const picked = traveling[0] ?? upcoming[0] ?? ongoingTrips[0] ?? null;

  const nextTrip: NextTripCardData | null = picked
    ? { ...picked, memberCount: dashboard.memberCountByTripId[picked.tripId] ?? null }
    : null;

  const otherTrips = ongoingTrips.filter((trip) => trip.tripId !== picked?.tripId);

  // 메인 카드가 이미 '얼마 더 모으면 되는지' 를 보여준다.
  // 같은 말을 액션 줄에서 반복하지 않는다.
  const actions: HomeActionItem[] = dashboard.actions
    .filter((action) => !(action.kind === 'FUND_SHORTAGE' && action.tripId === picked?.tripId))
    .slice(0, HOME_ACTION_LIMIT)
    .map((action) => ({
      id: actionId(action),
      icon: toActionIcon(action),
      tint: HOME_ACTION_TINT[action.kind],
      subtitle: `${action.destination ?? '여행지 미정'} 여행`,
      ...toActionText(action),
    }));

  const fund: HomeFundSummaryData = {
    currentTotal: dashboard.fund.currentTotal,
    monthlyDeposit: dashboard.fund.monthlyDeposit,
    overallRatePercent: dashboard.fund.overallRatePercent,
    trips: dashboard.fund.trips.map((trip) => ({
      ...trip,
      color: countryTheme(findDestinationByName(trip.destination)?.countryKo).primary,
    })),
  };

  const insight: HomePastInsightData | null = dashboard.insight
    ? {
        tripId: dashboard.insight.tripId,
        destination: dashboard.insight.destination,
        categoryLabel: dashboard.insight.categoryLabel,
        emoji: CATEGORY_EMOJI[dashboard.insight.categoryCode as CategoryCode] ?? '📊',
        overAmount: dashboard.insight.overAmount,
      }
    : null;

  // 진행 중 여행이 없을 때 무슨 문구를 쓸지 고른다. (docs/03 REQ-HOME-002)
  // 여행을 한 번도 만들지 않았으면 first, 기록이 있으면 return 이다.
  const emptyVariant: HomeEmptyVariant = trips.length === 0 ? 'first' : 'return';

  // 여행도 모임도 없을 때만 전체 빈 상태를 보여준다.
  if (trips.length === 0 && groups.length === 0) {
    return <HomeEmpty onCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.EMPTY_STATE)} />;
  }

  return (
    <HomeView
      userName={dashboard.userName}
      daysToNextTrip={daysUntil(nextTrip?.startDate ?? null)}
      nextTrip={nextTrip}
      otherTrips={otherTrips}
      emptyVariant={emptyVariant}
      actions={actions}
      fund={fund}
      insight={insight}
      groups={groups.map<HomeGroupItem>((group) => ({ groupId: group.id, name: group.name }))}
      onPressTrip={handlePressTrip}
      onPressGroup={handlePressGroup}
      onPressCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.HOME)}
      onPressAction={handlePressAction}
      onPressAllTrips={() => router.push('/me/trips')}
      onPressInsight={(tripId) => router.push(`/trips/${tripId}/settlement`)}
    />
  );
}

/** 같은 여행에 같은 종류의 액션은 하나뿐이라 이 조합이 키가 된다. */
function actionId(action: HomeAction): string {
  return `${action.kind}:${action.tripId}`;
}

function toActionIcon(action: HomeAction): string {
  if (action.kind === 'BUDGET_SHORTAGE' && action.categoryCode) {
    return CATEGORY_ICON[action.categoryCode as CategoryCode] ?? ACTION_ICON.BUDGET_SHORTAGE;
  }
  return ACTION_ICON[action.kind];
}

/**
 * 액션 한 줄의 문장. 강조할 숫자를 따로 떼어서 넘긴다.
 *
 * 컴포넌트가 아니라 여기서 만든다. 금액·단위·라벨을 한곳에서 다루려는 것이다.
 */
function toActionText(action: HomeAction): {
  textBefore: string;
  highlight: string | null;
  textAfter: string;
} {
  const amount = action.amount === null ? null : `${action.amount.toLocaleString('ko-KR')}원`;

  switch (action.kind) {
    case 'BUDGET_NOT_SET':
      return { textBefore: '목표 여행자금을 아직 정하지 않았어요', highlight: null, textAfter: '' };
    case 'BUDGET_SHORTAGE':
      return {
        textBefore: `${action.categoryLabel ?? '예산'} 예산이 `,
        highlight: amount,
        textAfter: ' 부족해요',
      };
    case 'FUND_SHORTAGE':
      return { textBefore: '여행자금이 ', highlight: amount, textAfter: ' 더 필요해요' };
    case 'UNPAID_CONTRIBUTION':
      return {
        textBefore: '멤버 ',
        highlight: `${action.memberCount ?? 0}명`,
        textAfter: '이 아직 입금하지 않았어요',
      };
  }
}
