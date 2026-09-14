// ============================================================================
// MY-02 나의 여행 · /me/trips · MVP
// 기준 문서: docs/04_화면목록_v3.md MY-02, docs/09_IA_v2.md §1-1 / §1-2
//
// 홈(HOME-01)의 '준비 중인 여행 — 전체 보기' 가 여기로 들어온다.
// 홈은 지금 챙길 것만 추려 보여주고, 이 화면이 전부 훑는 자리다.
//
// 탭은 준비 중 / 여행 중 / 지난 여행 셋이다. 준비 중과 여행 중을 한 탭에 묶으면
// 지금 떠나 있는 여행이 아직 출발도 안 한 여행 사이에 섞인다. (components/my/types.ts)
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
import { ConfirmModal } from '@/components/mypage';
import { ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { countryTheme } from '@/lib/constants/countryTheme';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
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
import {
  getCanceledTrips,
  getLeftTrips,
  getMyParticipatingTripsWithSummary,
  type Trip,
  type TripWithSummary,
} from '@/lib/supabase/queries/trips';
import { isTripBeforeDeparture } from '@/lib/trip/tripStatus';

type LoadState = 'loading' | 'ready' | 'error';

/** 지난 여행으로 볼 상태. 준비 중·여행 중은 상태 하나씩이다. DELETED 는 조회에서 이미 빠진다. */
const PAST: TripStatus[] = [TRIP_STATUS.ENDED, TRIP_STATUS.SETTLED];

/**
 * 어느 탭으로 열지 정한다.
 *
 * ⚠️ 'ongoing' 은 준비 중과 여행 중을 함께 부르던 예전 이름이다.
 *    그 값으로 들어오는 링크가 남아 있을 수 있어 준비 중으로 받는다.
 */
function toFilter(value: string | undefined): MyTripFilter {
  if (value === 'past') return 'past';
  if (value === 'traveling') return 'traveling';
  return 'planning';
}

export default function ScreenMY02() {
  const userId = useCurrentUserId();
  useScreenView(SCREENS.MY_TRIPS);

  const router = useRouter();
  // 홈에서 ?filter=past 로도 들어올 수 있게 열어 둔다. 기본은 준비 중이다.
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<MyTripFilter>(() => toFilter(params.filter));

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [trips, setTrips] = useState<TripWithSummary[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  /**
   * 취소된 여행과 나간 여행.
   *
   * ⚠️ getTripsWithSummary 로는 안 나온다. 취소된 여행은 그 쿼리가 일부러
   *    걸러내고, 나간 여행은 owner·group 어느 쪽으로도 안 걸린다.
   *    (lib/supabase/queries/trips 의 getCanceledTrips·getLeftTrips 주석)
   * ⚠️ 금액 요약을 붙이지 않는다. 두 탭 카드는 금액을 그리지 않는다.
   */
  const [canceledTrips, setCanceledTrips] = useState<Trip[]>([]);
  const [leftTrips, setLeftTrips] = useState<Trip[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      if (!userId) return;

      const [nextTrips, nextGroups, nextCanceled, nextLeft] = await Promise.all([
        getMyParticipatingTripsWithSummary(userId),
        getMyGroups(userId),
        getCanceledTrips(userId),
        getLeftTrips(userId),
      ]);
      setTrips(nextTrips);
      setGroups(nextGroups);
      setCanceledTrips(nextCanceled);
      setLeftTrips(nextLeft);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadState === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: '내 여행', headerTitleAlign: 'center' }} />
        <Loading message="여행을 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: '내 여행', headerTitleAlign: 'center' }} />
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

  /**
   * 취소된 여행·나간 여행을 카드 모양으로 바꾼다.
   *
   * ⚠️ 금액을 넣지 않는다. 취소된 여행의 예산은 확정된 값이 아니고, 나간
   *    여행의 금액은 더 이상 내 몫이 아니다. 카드가 '—' 를 그린다.
   * @param left 내가 나간 여행인가. 카드가 색을 뺄지 정하는 데 쓴다.
   */
  function toArchivedItems(rows: Trip[], left: boolean): MyTripItem[] {
    return rows.flatMap((trip) => {
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
          currentAmount: null,
          targetAmount: null,
          finalAmount: null,
          color: theme.primary,
          colorSoft: theme.primarySoft,
          left,
        },
      ];
    });
  }

  // ⚠️ 취소 요청 중(CANCEL_PENDING)도 준비 중이다. (POL-CXL-006)
  const planning = items.filter((item) => isTripBeforeDeparture(item.status));
  const traveling = items.filter((item) => item.status === TRIP_STATUS.TRAVELING);
  const past = items.filter((item) => PAST.includes(item.status));
  const left = toArchivedItems(leftTrips, true);

  /**
   * 취소된 여행.
   *
   * ⚠️ 나간 여행과 겹칠 수 있다. 내가 나간 뒤 남은 사람들이 취소한 경우다.
   *    그때는 **'나간 여행' 쪽에만** 둔다 — 나에게는 '내가 나갔다' 가 먼저고,
   *    한 여행이 두 탭에 다 보이면 목록이 두 배로 보인다.
   */
  const leftIds = new Set(left.map((item) => item.tripId));
  const canceled = toArchivedItems(canceledTrips, false).filter(
    (item) => !leftIds.has(item.tripId),
  );

  // 준비 중은 출발이 가까운 순, 여행 중은 먼저 돌아오는 순,
  // 지난 여행은 최근에 다녀온 순으로 본다. 탭마다 급한 것이 다르다.
  planning.sort((a, b) => (a.startDate ?? '9999-12-31').localeCompare(b.startDate ?? '9999-12-31'));
  traveling.sort((a, b) => (a.endDate ?? '9999-12-31').localeCompare(b.endDate ?? '9999-12-31'));
  past.sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));
  // 취소·나간 여행도 최근 것부터. 출발일이 없는 여행이 있어 시작일로 센다.
  canceled.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  left.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

  const BY_FILTER: Record<MyTripFilter, MyTripItem[]> = {
    planning,
    traveling,
    past,
    canceled,
    left,
  };
  const visible = BY_FILTER[filter];

  /** 나간 여행 카드를 눌렀을 때 안내. (2026-09-14 확정 정책 · docs/11 v2 §6-2) */
  const [leftNoticeOpen, setLeftNoticeOpen] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: '내 여행', headerTitleAlign: 'center' }} />
      <MyTripListView
        trips={visible}
        filter={filter}
        onChangeFilter={setFilter}
        // 준비 중·여행 중·종료 모두 같은 라우트다. 도착 화면이 trip.status 로 분기한다. (docs/04_v3 §5)
        // ⚠️ 나간 여행은 열지 않는다 — 목록 이력으로만 보인다. 모임 상세와 같은 안내만 띄운다.
        onPressTrip={(tripId) =>
          leftIds.has(tripId) ? setLeftNoticeOpen(true) : router.push(`/trips/${tripId}`)
        }
        // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
        onPressCreateTrip={() => router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)}
      />

      <ConfirmModal
        visible={leftNoticeOpen}
        title="나간 여행이에요"
        description="이 여행은 더 이상 볼 수 없어요."
        confirmLabel="확인"
        hideCancel
        busy={false}
        onCancel={() => setLeftNoticeOpen(false)}
        onConfirm={() => setLeftNoticeOpen(false)}
      />
    </>
  );
}
