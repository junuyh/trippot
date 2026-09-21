// ============================================================================
// 내 여행 목록 — 데이터 · 상태 · 되돌리기 · 상세 이동 (2026-09-21 · app/me/trips.tsx 에서 이동)
//
// MY-02(/me/trips)와 하단 모임 탭의 [여행] 섹션(/groups?tab=trips)이 **같은 목록 · 같은 규칙**을 쓴다.
// 목록 로직을 두 벌 만들지 않으려고 화면 파일에 있던 것을 그대로 옮겼다. 쿼리 · 가공 · 탭 분류 · 정렬 ·
// 취소 여행 되돌리기(72시간) · 나간 여행 안내가 전부 여기다. 화면은 이 훅의 결과를 MyTripsSection 에 넘기기만 한다.
//
// origin
//   'my-trips'      MY-02. 여행 홈의 '<' 가 dismissTo('/me/trips?filter=…') 로 돌아온다.
//   'groups-trips'  모임 탭 [여행]. 여행 홈의 '<' 가 router.back() 으로 탭 화면(보던 탭·필터 그대로)에 돌아온다.
// ⚠️ track() 을 부르지 않는다. 화면 진입 로그(MY_TRIPS)는 /me/trips 화면 파일이 찍는다. (CLAUDE.md 8장)
// ⚠️ 여행 카드 · 여행 상세 · 되돌리기 정책은 바꾸지 않았다. 코드 이동만이다.
// ============================================================================
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { CancelChangeItem } from '@/components/cancel';
import type { MyTripFilter, MyTripItem } from '@/components/my/types';
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
import { getMyGroups, type Group } from '@/lib/supabase/queries/groups';
import {
  getCanceledTrips,
  getLeftTrips,
  advanceTripStatuses,
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
  RESTORE_WINDOW_HOURS,
  canRestoreTrip,
  restoreRemainingLabel,
  restoredRemainingAmount,
} from '@/lib/trip/cancelPolicy';
import { tripStage } from '@/lib/trip/stage';
import { isTripBeforeDeparture } from '@/lib/trip/tripStatus';
import { reconcileSpendReminders } from '@/lib/notifications/spendReminder';

/** 여행 상세 `?from=` 값. 여행 홈이 '<' 의 목적지를 이걸로 가른다. (app/trips/[tripId]/index.tsx) */
export const MY_TRIPS_ORIGIN = {
  MY: 'my-trips',
  GROUPS: 'groups-trips',
} as const;
export type MyTripsOrigin = (typeof MY_TRIPS_ORIGIN)[keyof typeof MY_TRIPS_ORIGIN];

/** 되돌리기 확인 시트(CXL-05)에 띄울 여행과, 취소 뒤 달라진 내역 전부. */
type RestoreTarget = {
  trip: Trip;
  changes: CancelChangeItem[];
};

type LoadState = 'loading' | 'ready' | 'error';

/** 지난 여행으로 볼 상태. 준비 중·여행 중은 상태 하나씩이다. DELETED 는 조회에서 이미 빠진다. */
const PAST: TripStatus[] = [TRIP_STATUS.ENDED, TRIP_STATUS.SETTLED];

/**
 * 되돌리기 마감 시각. '9월 18일 15:40'.
 *
 * ⚠️ 72시간 규칙은 lib/trip/cancelPolicy 의 RESTORE_WINDOW_HOURS 를 그대로 쓴다.
 *    여기서 숫자를 다시 적지 않는다.
 */
function restoreDeadlineLabel(canceledAt: string): string {
  const deadline = new Date(new Date(canceledAt).getTime() + RESTORE_WINDOW_HOURS * 3_600_000);
  return format(deadline, 'M월 d일 HH:mm');
}

/**
 * 되돌리기 팝업 본문.
 *
 *   9월 16일 23:37까지 되돌릴 수 있어요.
 *   취소하기 전 상태로 여행 홈에 들어가요.
 *   취소 뒤 계좌 내역 3건도 함께 반영돼요. 반영 후 남은 돈 120,000원     ← 내역이 있을 때만
 *
 * ⚠️ "멤버들에게도 알려드려요" 를 쓰지 않는다. (2026-09-16)
 *    되돌리기는 아직 알림을 보내지 않는다. (tripCancel.ts restoreCanceledTrip 의
 *    TODO: notify CANCEL_RESTORED) 알림이 붙으면 그때 줄을 되살린다.
 */
function restoreDescription(target: RestoreTarget): string {
  const lines: string[] = [];
  if (target.trip.canceled_at) {
    lines.push(`${restoreDeadlineLabel(target.trip.canceled_at)}까지 되돌릴 수 있어요.`);
  }
  lines.push('취소하기 전 상태로 여행 홈에 들어가요.');

  const snapshot = target.trip.canceled_fund_snapshot_json as CanceledFundSnapshot | null;
  if (target.changes.length > 0) {
    const fundType = snapshot?.fund_type ?? 'ZERO';
    const after = restoredRemainingAmount(snapshot?.remaining ?? 0, target.changes);
    lines.push(
      fundType === 'ZERO'
        ? `취소 뒤 계좌 내역 ${target.changes.length}건도 함께 반영돼요.`
        : `취소 뒤 계좌 내역 ${target.changes.length}건도 함께 반영돼요. 반영 후 남은 돈 ${after.toLocaleString('ko-KR')}원`,
    );
  }
  return lines.join('\n');
}

/**
 * 어느 탭으로 열지 정한다.
 *
 * ⚠️ 'ongoing' 은 준비 중과 여행 중을 함께 부르던 예전 이름이다.
 *    그 값으로 들어오는 링크가 남아 있을 수 있어 준비 중으로 받는다.
 * ⚠️ 취소됨·나간 여행도 받는다. 여행 홈의 '<' 가 보던 탭으로 돌아올 때 이 값이 온다.
 *    빠져 있으면 취소됨 탭에서 연 여행에서 돌아와도 준비 중 탭이 열린다. (2026-09-16)
 */
export function toMyTripFilter(value: string | undefined): MyTripFilter {
  if (value === 'past') return 'past';
  if (value === 'traveling') return 'traveling';
  if (value === 'canceled') return 'canceled';
  if (value === 'left') return 'left';
  return 'planning';
}


type Options = {
  origin: MyTripsOrigin;
  /** 주소의 ?filter=. 바뀌면 탭을 맞춘다. 없으면 건드리지 않는다(사용자가 고른 탭 유지). */
  paramFilter?: string;
  /**
   * 화면이 다시 보일 때마다 조용히 다시 읽을지. 탭 화면(/groups)은 언마운트되지 않아 상세에서 돌아오거나
   * 다른 탭에서 여행을 만들고 와도 목록이 그대로라 켠다. MY-02 는 예전처럼 마운트 때만 읽는다(기본).
   */
  refreshOnFocus?: boolean;
};

export function useMyTrips({ origin, paramFilter, refreshOnFocus = false }: Options) {
  const userId = useCurrentUserId();
  const router = useRouter();

  const [filter, setFilter] = useState<MyTripFilter>(() => toMyTripFilter(paramFilter));
  /**
   * 주소의 filter 가 바뀌면 탭을 맞춘다. (2026-09-17)
   * ⚠️ useState 초기값은 화면이 처음 만들어질 때 한 번만 읽힌다. 화면이 스택에 살아 있으면 ?filter=past 로
   *    다시 와도 재사용돼 전에 보던 탭이 그대로였다.
   * ⚠️ filter 가 없을 때는 건드리지 않는다. 사용자가 탭을 눌러 바꾼 상태를 되돌리면 안 된다.
   */
  useEffect(() => {
    if (paramFilter) setFilter(toMyTripFilter(paramFilter));
  }, [paramFilter]);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [trips, setTrips] = useState<TripWithSummary[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  /**
   * 취소된 여행과 나간 여행.
   * ⚠️ getTripsWithSummary 로는 안 나온다. 취소된 여행은 그 쿼리가 일부러 걸러내고, 나간 여행은
   *    owner·group 어느 쪽으로도 안 걸린다. 금액 요약을 붙이지 않는다 — 두 탭 카드는 금액을 그리지 않는다.
   */
  const [canceledTrips, setCanceledTrips] = useState<Trip[]>([]);
  const [leftTrips, setLeftTrips] = useState<Trip[]>([]);
  /** 나간 여행 카드를 눌렀을 때 안내. (2026-09-14 확정 정책 · docs/11 v2 §6-2) */
  const [leftNoticeOpen, setLeftNoticeOpen] = useState(false);
  /** 되돌리기 확인 시트에 올린 여행. 닫혀 있으면 null. */
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  /** 시트를 열기 전 내역을 불러오는 중인 여행. 그 카드에 스피너가 뜬다. */
  const [preparingRestoreTripId, setPreparingRestoreTripId] = useState<string | null>(null);
  /** 되돌리는 중. 중복 실행 방지. */
  const [restoring, setRestoring] = useState(false);

  /** @param silent 이미 목록이 떠 있을 때 조용히 갱신(로딩 화면으로 바꾸지 않는다) */
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoadState('loading');
      try {
        if (!userId) return;

        const [nextTrips, nextGroups, nextCanceled, nextLeft] = await Promise.all([
          getMyParticipatingTripsWithSummary(userId),
          getMyGroups(userId),
          getCanceledTrips(userId),
          getLeftTrips(userId),
        ]);
        // 홈과 같다 — 날짜가 지난 여행의 상태를 목록에 뜨기 전에 올린다. (2026-09-21 · develop 5f44425 를 그대로 옮김)
        setTrips(await advanceTripStatuses(nextTrips).catch(() => nextTrips));
        setGroups(nextGroups);
        setCanceledTrips(nextCanceled);
        setLeftTrips(nextLeft);
        setLoadState('ready');
      } catch {
        // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
        if (!silent) setLoadState('error');
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!refreshOnFocus) void load();
  }, [load, refreshOnFocus]);

  // 탭 화면용 — 처음은 로딩으로, 이후 다시 보일 때는 조용히.
  // ⚠️ ref 다. state 로 두면 값이 바뀌는 순간 콜백이 새로 만들어져 useFocusEffect 가 한 번 더 돈다.
  const loadedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!refreshOnFocus) return;
      void load(loadedOnceRef.current).then(() => {
        loadedOnceRef.current = true;
      });
    }, [load, refreshOnFocus]),
  );

  /**
   * 되돌릴 수 있는 취소 여행 카드를 눌렀을 때. 바로 되돌리지 않고 확인 팝업을 연다. (POL-CXL-036)
   * 팝업은 취소 뒤 달라진 계좌 내역 전부가 필요하다(건수·남은 돈). 먼저 불러온 뒤에 연다.
   * ⚠️ 누르는 순간 72시간을 다시 본다. 목록을 띄워 둔 사이 기간이 지났을 수 있다.
   */
  async function handleOpenRestore(tripId: string) {
    if (preparingRestoreTripId || restoring) return;
    const trip = canceledTrips.find((row) => row.id === tripId);
    if (!trip) return;

    const status = trip.status as TripStatus;
    if (!trip.canceled_at || !canRestoreTrip({ status, canceledAt: trip.canceled_at, now: new Date() })) {
      Alert.alert('되돌릴 수 없어요', '되돌릴 수 있는 기간(3일)이 지났어요.');
      void load(true);
      return;
    }

    setPreparingRestoreTripId(tripId);
    try {
      const rows = await getChangesSinceCancel(trip.id, trip.canceled_at);
      // ⚠️ 부호 있는 값으로 바꾼다. DB 는 금액을 양수로 두고 방향을 transaction_type 으로 가른다.
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
      const tripId = restoreTarget.trip.id;
      await restoreCanceledTrip(tripId);
      // 되살린 여행의 지출 리마인드를 다시 잡는다(권한이 이미 있으면). 알림 계층만. (2026-09-21)
      if (userId) reconcileSpendReminders(userId).catch(() => undefined);
      setRestoreTarget(null);
      /*
        되살린 여행의 홈으로 바로 들어간다. (2026-09-16)
        ⚠️ 목록을 먼저 '준비 중' 탭으로 돌려 두고 params 도 맞춘다. MY-02 는 여행 홈의 '<' 가
           dismissTo('/me/trips?filter=planning') 로 돌아오는데, params 가 canceled 로 남아 있으면 사본을 하나 더 만든다.
        ⚠️ 날짜가 이미 지난 여행이면 여행 홈에 들어갈 때 상태가 다시 계산된다. (closeTripIfEnded)
      */
      setFilter('planning');
      router.setParams({ filter: 'planning' });
      void load(true);
      router.push(`/trips/${tripId}?from=${origin}&filter=planning`);
    } catch {
      Alert.alert('되돌리지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setRestoring(false);
    }
  }

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  // trips.status 는 DB 가 text + CHECK 라 생성 타입이 string 이다. 모르는 값이면 그 행을 그리지 않는다. (Crash 금지)
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
        stage: tripStage({ status, hasPlan: trip.hasPlan, hasExpense: trip.hasExpense }),
      },
    ];
  });

  /**
   * 취소된 여행·나간 여행을 카드 모양으로 바꾼다.
   * ⚠️ 금액을 넣지 않는다. 취소된 여행의 예산은 확정된 값이 아니고, 나간 여행의 금액은 더 이상 내 몫이 아니다.
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
   * 취소된 여행. ⚠️ 나간 여행과 겹칠 수 있다(내가 나간 뒤 남은 사람들이 취소). 그때는 '나간 여행' 쪽에만 둔다.
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
        restoreDeadlineLabel: restorable && canceledAt ? restoreDeadlineLabel(canceledAt) : null,
      };
    });

  const restorableIds = new Set(canceled.filter((item) => item.restorable).map((item) => item.tripId));

  // 준비 중은 출발이 가까운 순, 여행 중은 먼저 돌아오는 순, 지난 여행은 최근에 다녀온 순. 탭마다 급한 것이 다르다.
  planning.sort((a, b) => (a.startDate ?? '9999-12-31').localeCompare(b.startDate ?? '9999-12-31'));
  traveling.sort((a, b) => (a.endDate ?? '9999-12-31').localeCompare(b.endDate ?? '9999-12-31'));
  past.sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));
  // 취소·나간 여행도 최근 것부터. 출발일이 없는 여행이 있어 시작일로 센다.
  canceled.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  left.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

  const BY_FILTER: Record<MyTripFilter, MyTripItem[]> = { planning, traveling, past, canceled, left };
  const visible = BY_FILTER[filter];

  /** 탭을 바꾼다. ⚠️ params 에도 적는다 — MY-02 는 여행 홈의 '<' (dismissTo) 가 params 까지 맞아야 이 화면을 찾는다. */
  function changeFilter(next: MyTripFilter) {
    setFilter(next);
    router.setParams({ filter: next });
  }

  /**
   * 카드를 눌렀을 때. 준비 중·여행 중·종료 모두 같은 라우트다. 도착 화면이 trip.status 로 분기한다.
   * ⚠️ 나간 여행은 열지 않는다 — 안내만. ⚠️ 되돌릴 수 있는 취소 여행은 확인 시트부터 연다.
   * ⚠️ from=origin 을 붙인다. 여행 홈이 집 대신 '<' 로 목록에 돌아온다.
   */
  function pressTrip(tripId: string) {
    if (leftIds.has(tripId)) {
      setLeftNoticeOpen(true);
      return;
    }
    if (restorableIds.has(tripId)) {
      void handleOpenRestore(tripId);
      return;
    }
    router.push(`/trips/${tripId}?from=${origin}&filter=${filter}`);
  }

  // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
  function pressCreateTrip() {
    router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`);
  }

  return {
    loadState,
    retry: () => void load(),
    filter,
    changeFilter,
    visible,
    preparingRestoreTripId,
    restoreTarget,
    restoreDescription: restoreTarget ? restoreDescription(restoreTarget) : null,
    restoring,
    cancelRestore: () => {
      if (!restoring) setRestoreTarget(null);
    },
    confirmRestore: () => void handleRestore(),
    leftNoticeOpen,
    closeLeftNotice: () => setLeftNoticeOpen(false),
    pressTrip,
    pressCreateTrip,
  };
}

export type MyTripsSectionModel = ReturnType<typeof useMyTrips>;
