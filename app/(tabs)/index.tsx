// ============================================================================
// HOME-01 · / · MVP
// 기준 문서: docs/09_IA_v1.md §1, docs/02_유저플로우_v1.md §1,
//            docs/03_요구사항정의서_v1.md REQ-HOME-001 / REQ-HOME-002 / POL-NAV-001
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/home/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// 여기서 <Stack.Screen options={{ title }} /> 을 쓰면 Tabs 스크린 옵션을 덮어써서
// 하단 탭 라벨까지 바뀐다.
// ============================================================================
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { HomeView, type EndedTripCardData, type HomeGroupItem, type OngoingTripCardData } from '@/components/home';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  ENTRY_POINT,
  TRIP_OWNER_TYPE,
  TRIP_STATUS,
  type EntryPoint,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getMyGroups, type Group } from '@/lib/supabase/queries/groups';
import { getTripsWithSummary, type TripWithSummary } from '@/lib/supabase/queries/trips';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenHOME01() {
  useScreenView(SCREENS.HOME);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [trips, setTrips] = useState<TripWithSummary[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      const [nextTrips, nextGroups] = await Promise.all([
        getTripsWithSummary(userId),
        getMyGroups(userId),
      ]);
      setTrips(nextTrips);
      setGroups(nextGroups);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handlePressTrip(tripId: string) {
    // 진행/종료 모두 같은 라우트다. 도착 화면이 trip.status 로 분기한다. (docs/04_v3 §5)
    router.push(`/trips/${tripId}`);
  }

  function handlePressGroup(groupId: string) {
    // 홈·모임·마이페이지 어디서 눌러도 같은 모임 상세로 간다. (docs/03 POL-NAV-001)
    router.push(`/groups/${groupId}`);
  }

  function handlePressCreateTrip(entryPoint: EntryPoint) {
    track(EVENTS.TRIP_CREATE_STARTED, { entry_point: entryPoint });
    router.push('/trips/new/owner');
  }

  if (loadState === 'loading') {
    return <Loading message="여행을 불러오고 있어요" />;
  }

  if (loadState === 'error') {
    return <ErrorState message="여행 목록을 불러오지 못했어요." onRetry={() => void load()} />;
  }

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  // trips.status / owner_type 은 DB 가 text + CHECK 라 생성 타입이 string 이다.
  // 화면에서 쓰기 전에 상수 집합으로 좁힌다. 모르는 값이면 그 행을 그리지 않는다. (Crash 금지)
  function toTripStatus(value: string): TripStatus | null {
    const known = Object.values(TRIP_STATUS) as string[];
    return known.includes(value) ? (value as TripStatus) : null;
  }

  function toBase(trip: TripWithSummary, status: TripStatus) {
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
    };
  }

  const ongoingTrips: OngoingTripCardData[] = trips.flatMap((trip) => {
    const status = toTripStatus(trip.status);
    if (status !== TRIP_STATUS.PLANNING && status !== TRIP_STATUS.TRAVELING) return [];
    return [
      {
        ...toBase(trip, status),
        targetAmount: trip.targetAmount,
        currentAmount: trip.currentAmount,
      },
    ];
  });

  const endedTrips: EndedTripCardData[] = trips.flatMap((trip) => {
    const status = toTripStatus(trip.status);
    if (status !== TRIP_STATUS.ENDED && status !== TRIP_STATUS.SETTLED) return [];
    return [
      {
        ...toBase(trip, status),
        // ENDED(결산 전)는 settlements 행이 없어 null 이고, 카드가 '결산 전' 으로 표시한다.
        finalAmount: trip.finalAmount,
      },
    ];
  });

  // 여행도 모임도 없을 때만 전체 빈 상태를 보여준다.
  // TODO: REQ-HOME-002(Should) — 최초 방문과 재방문 빈 상태를 구분한다.
  //       무엇으로 구분하는지 문서에 정의가 없어 지금은 한 가지만 보여준다.
  // 종료된 여행이나 모임이 있으면 본문을 그리고, 진행 중 여행 자리에만 안내를 둔다.
  if (trips.length === 0 && groups.length === 0) {
    return (
      <EmptyState
        icon="airplane-outline"
        title="아직 준비 중인 여행이 없어요"
        description="여행을 만들면 목표 여행비와 준비율을 여기서 볼 수 있어요."
        actionLabel="새 여행 만들기"
        onAction={() => handlePressCreateTrip(ENTRY_POINT.EMPTY_STATE)}
      />
    );
  }

  return (
    <HomeView
      ongoingTrips={ongoingTrips}
      endedTrips={endedTrips}
      groups={groups.map<HomeGroupItem>((group) => ({ groupId: group.id, name: group.name }))}
      onPressTrip={handlePressTrip}
      onPressGroup={handlePressGroup}
      onPressCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.HOME)}
    />
  );
}
