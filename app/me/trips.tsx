// ============================================================================
// MY-02 나의 여행 · /me/trips · MVP
// 기준 문서: docs/04_화면목록_v3.md MY-02, docs/09_IA_v2.md §1-1 / §1-2
//
// 홈(HOME-01)의 '진행 중인 여행 — 전체 보기' 가 여기로 들어온다.
// 홈은 지금 챙길 것만 추려 보여주고, 이 화면이 전부 훑는 자리다.
//
// ⚠️ 화면목록에서 MY-02 담당은 아직 `[미확정]` B 또는 C 다. HOME-01 과 같은 묶음이라
//    홈 담당자가 이어서 만들었다. 담당이 갈리면 사람에게 알린다. (CLAUDE.md 13장)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/my/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { MyTripListView, type MyTripFilter, type MyTripItem } from '@/components/my';
import { ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { countryTheme } from '@/lib/constants/countryTheme';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  ENTRY_POINT,
  TRIP_OWNER_TYPE,
  TRIP_OWNER_TYPE_LABEL,
  TRIP_STATUS,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getMyGroups, type Group } from '@/lib/supabase/queries/groups';
import { getTripsWithSummary, type TripWithSummary } from '@/lib/supabase/queries/trips';

type LoadState = 'loading' | 'ready' | 'error';

/** 진행 중으로 볼 상태와 지난 여행으로 볼 상태. DELETED 는 조회에서 이미 빠진다. */
const ONGOING: TripStatus[] = [TRIP_STATUS.PLANNING, TRIP_STATUS.TRAVELING];
const PAST: TripStatus[] = [TRIP_STATUS.ENDED, TRIP_STATUS.SETTLED];

export default function ScreenMY02() {
  useScreenView(SCREENS.MY_TRIPS);

  const router = useRouter();
  // 홈에서 ?filter=past 로도 들어올 수 있게 열어 둔다. 기본은 진행 중이다.
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<MyTripFilter>(
    params.filter === 'past' ? 'past' : 'ongoing',
  );

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

  if (loadState === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: '나의 여행' }} />
        <Loading message="여행을 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: '나의 여행' }} />
        <ErrorState message="여행을 불러오지 못했어요." onRetry={() => void load()} />
      </>
    );
  }

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  // trips.status 는 DB 가 text + CHECK 라 생성 타입이 string 이다.
  // 모르는 값이면 그 행을 그리지 않는다. (Crash 금지)
  function toTripStatus(value: string): TripStatus | null {
    const known = Object.values(TRIP_STATUS) as string[];
    return known.includes(value) ? (value as TripStatus) : null;
  }

  const items: MyTripItem[] = trips.flatMap((trip) => {
    const status = toTripStatus(trip.status);
    if (status === null || status === TRIP_STATUS.DELETED) return [];

    const meta = findDestinationByName(trip.destination);
    const theme = countryTheme(meta?.countryKo);

    return [
      {
        tripId: trip.id,
        destination: trip.destination,
        flag: meta?.flag ?? '🌍',
        startDate: trip.start_date,
        endDate: trip.end_date,
        status,
        ownerLabel:
          trip.owner_type === TRIP_OWNER_TYPE.GROUP
            ? (groupNameById.get(trip.group_id ?? '') ?? TRIP_OWNER_TYPE_LABEL.GROUP)
            : TRIP_OWNER_TYPE_LABEL.PERSONAL,
        currentAmount: trip.currentAmount,
        targetAmount: trip.targetAmount,
        finalAmount: trip.finalAmount,
        color: theme.primary,
        colorSoft: theme.primarySoft,
      },
    ];
  });

  const ongoing = items.filter((item) => ONGOING.includes(item.status));
  const past = items.filter((item) => PAST.includes(item.status));

  // 진행 중은 출발이 가까운 순, 지난 여행은 최근에 다녀온 순으로 본다.
  ongoing.sort((a, b) => (a.startDate ?? '9999-12-31').localeCompare(b.startDate ?? '9999-12-31'));
  past.sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));

  return (
    <>
      <Stack.Screen options={{ title: '나의 여행' }} />
      <MyTripListView
        trips={filter === 'ongoing' ? ongoing : past}
        filter={filter}
        counts={{ ongoing: ongoing.length, past: past.length }}
        onChangeFilter={setFilter}
        // 진행/종료 모두 같은 라우트다. 도착 화면이 trip.status 로 분기한다. (docs/04_v3 §5)
        onPressTrip={(tripId) => router.push(`/trips/${tripId}`)}
        // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
        onPressCreateTrip={() => router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)}
      />
    </>
  );
}
