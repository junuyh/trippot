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
// 2026-09-16 취소된 여행 카드에 '되돌리기' 를 넣었다.
//   누르면 CXL-05 확인 시트(components/cancel/RestoreConfirmSheet)를 거쳐 되돌린다.
//   여행 홈(TRIP-HOME-03)의 되돌리기와 같은 함수 · 같은 시트 · 같은 72시간 규칙이다.
//   ⚠️ 이벤트를 찍지 않는다. TRIP_RESTORE_* 의 entry 값에 이 목록이 없고
//      (done_screen | canceled_home), 여행 홈도 아직 찍지 않는다. (CLAUDE.md 8장)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/my/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { format, parseISO } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { RestoreConfirmSheet, type CancelChangeItem } from '@/components/cancel';
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
  TRANSACTION_TYPE,
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
import {
  getChangesSinceCancel,
  restoreCanceledTrip,
  type CanceledFundSnapshot,
} from '@/lib/supabase/queries/tripCancel';
import {
  canRestoreTrip,
  restoreRemainingLabel,
  restoredRemainingAmount,
} from '@/lib/trip/cancelPolicy';
import { isTripBeforeDeparture } from '@/lib/trip/tripStatus';

/** 되돌리기 확인 시트(CXL-05)에 띄울 여행과, 취소 뒤 달라진 내역 전부. */
type RestoreTarget = {
  trip: Trip;
  changes: CancelChangeItem[];
};

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
  /**
   * 나간 여행 카드를 눌렀을 때 안내. (2026-09-14 확정 정책 · docs/11 v2 §6-2)
   * ⚠️ 다른 hook 과 같이 맨 위에 둔다. 아래 loading/error 의 early return 뒤에 두면
   *    렌더마다 hook 수가 달라져 React 가 막는다. (Rules of Hooks)
   */
  const [leftNoticeOpen, setLeftNoticeOpen] = useState(false);
  /** 되돌리기 확인 시트에 올린 여행. 닫혀 있으면 null. (위와 같은 이유로 맨 위에 둔다) */
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  /** 시트를 열기 전 내역을 불러오는 중인 여행. 그 카드 버튼에 스피너가 뜬다. */
  const [preparingRestoreTripId, setPreparingRestoreTripId] = useState<string | null>(null);
  /** 되돌리는 중. 중복 실행 방지. */
  const [restoring, setRestoring] = useState(false);

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

  /**
   * 되돌리기 버튼. 바로 되돌리지 않고 CXL-05 확인 시트를 연다. (POL-CXL-036)
   *
   * 시트는 취소 뒤 달라진 계좌 내역 **전부**가 필요하다. 먼저 불러온 뒤에 연다.
   * ⚠️ 누르는 순간 72시간을 다시 본다. 목록을 띄워 둔 사이 기간이 지났을 수 있다.
   */
  async function handleOpenRestore(tripId: string) {
    if (preparingRestoreTripId || restoring) return;
    const trip = canceledTrips.find((row) => row.id === tripId);
    if (!trip) return;

    const status = trip.status as TripStatus;
    if (!trip.canceled_at || !canRestoreTrip({ status, canceledAt: trip.canceled_at, now: new Date() })) {
      Alert.alert('되돌릴 수 없어요', '되돌릴 수 있는 기간(3일)이 지났어요.');
      void load();
      return;
    }

    setPreparingRestoreTripId(tripId);
    try {
      const rows = await getChangesSinceCancel(trip.id, trip.canceled_at);
      // ⚠️ 부호 있는 값으로 바꾼다. DB 는 금액을 양수로 두고 방향을 transaction_type 으로
      //    가른다. 그대로 넘기면 출금이 잔액을 늘린다. (여행 홈과 같은 변환)
      const changes: CancelChangeItem[] = rows.map((row) => ({
        id: row.id,
        dateLabel: format(parseISO(row.occurred_at), 'M월 d일'),
        name: row.name ?? '내역 없음',
        amount: row.transaction_type === TRANSACTION_TYPE.WITHDRAWAL ? -row.amount : row.amount,
      }));
      setRestoreTarget({ trip, changes });
    } catch {
      Alert.alert('되돌리기를 준비하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setPreparingRestoreTripId(null);
    }
  }

  /** 되돌리기 실행. 동의를 받지 않는다. (POL-CXL-038) 여행 홈과 같은 함수다. */
  async function handleRestore() {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      await restoreCanceledTrip(restoreTarget.trip.id);
      setRestoreTarget(null);
      // 되살아난 여행은 준비 중으로 돌아간다. 그 탭에서 바로 보이게 한다.
      // ⚠️ 날짜가 이미 지난 여행이면 여행 홈에 들어갈 때 상태가 다시 계산된다.
      //    (restoreCanceledTrip 주석 · closeTripIfEnded)
      setFilter('planning');
      await load();
      Alert.alert('다시 준비해요', '취소하기 전 상태로 돌아왔어요.');
    } catch {
      Alert.alert('되돌리지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setRestoring(false);
    }
  }

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
  const now = new Date();
  const canceledAtById = new Map(canceledTrips.map((trip) => [trip.id, trip.canceled_at]));
  const canceled = toArchivedItems(canceledTrips, false)
    .filter((item) => !leftIds.has(item.tripId))
    .map((item) => {
      // 되돌리기 가능 여부는 여행 홈과 같은 규칙(72시간)으로 정한다. (lib/trip/cancelPolicy)
      const canceledAt = canceledAtById.get(item.tripId) ?? null;
      const restorable = canRestoreTrip({ status: item.status, canceledAt, now });
      return {
        ...item,
        restorable,
        restoreRemainingLabel:
          restorable && canceledAt ? restoreRemainingLabel(canceledAt, now) : null,
      };
    });

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
        onRestoreTrip={(tripId) => void handleOpenRestore(tripId)}
        preparingRestoreTripId={preparingRestoreTripId}
      />

      {/*
        CXL-05 되돌리기 확인. 여행 홈과 같은 시트다.
        ⚠️ 취소 시점 스냅샷을 그대로 읽는다. 다시 계산하지 않는다. (POL-CXL-011)
           스냅샷이 없으면 남은 돈 0 · ZERO 로 보고 요약 행을 숨긴다.
        ⚠️ 남은 돈은 보이는 5건이 아니라 **내역 전부**로 계산한다.
      */}
      {restoreTarget ? (
        <RestoreConfirmSheet
          visible
          onClose={() => {
            if (!restoring) setRestoreTarget(null);
          }}
          destination={restoreTarget.trip.destination ?? '여행'}
          isGroupTrip={Boolean(restoreTarget.trip.group_id)}
          changes={restoreTarget.changes}
          afterLabel={`${restoredRemainingAmount(
            (restoreTarget.trip.canceled_fund_snapshot_json as CanceledFundSnapshot | null)
              ?.remaining ?? 0,
            restoreTarget.changes,
          ).toLocaleString('ko-KR')}원`}
          fundType={
            (restoreTarget.trip.canceled_fund_snapshot_json as CanceledFundSnapshot | null)
              ?.fund_type ?? 'ZERO'
          }
          onRestore={() => void handleRestore()}
          restoring={restoring}
        />
      ) : null}

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
