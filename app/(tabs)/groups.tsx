// ============================================================================
// GROUP-01 · /groups · MVP
// 기준: docs/09_IA_v1.md §3-1, docs/04_화면목록_v3.md GROUP-01,
//       docs/03_요구사항정의서_v1.md POL-NAV-001 / NFR-003 / NFR-005
//
// 카드에 담는 것: 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수
// 담지 않는 것: 대표 모임 여행 유형([고도화]), 생성일 · 대표 이미지 · More(IA 에 없음)
//               생성일은 표시하지 않고 정렬에만 쓴다.
//
// 편집 모드: 카드 선택 · 내 목록에서 숨김 · 숨긴 모임 다시 표시
//
// ⚠️ '목록에서 숨김' 은 삭제도 탈퇴도 아니다.
//    groups / group_members / trips / 예산 / 거래 / 결산 을 건드리지 않는다.
//    현재 사용자의 GROUP-01 표시 여부만 바꾼다. 홈과 여행 생성 화면에서는 계속 보인다.
//
// 2026-09-21 하단 [모임] 탭 화면이 상단 탭 [여행] / [모임] 두 섹션을 갖는다. (여행/모임 통합 탭)
//   [여행] = MY-02 와 같은 내 여행 목록(lib/hooks/useMyTrips + components/my/MyTripsSection · 새 쿼리 없음)
//   [모임] = 이 파일의 모임 목록(components/groups/GroupListSection · 카드 · 정렬 · 편집 · 숨김 그대로)
//   · 주소 ?tab=trips|groups 를 받는다. 없거나 모르는 값이면 [여행].
//   · 하단 모임 아이콘을 **직접 누르면**(재클릭 포함) 탭바가 ?tab=trips&reset=<시각> 으로 보내 [여행]으로 돌아온다.
//     (components/navigation/FloatingTabBar) reset 은 같은 값이 연달아 와도 알아채기 위한 도장이다.
//     상세에서 돌아오기 · 포커스 · 복원 때는 params 가 바뀌지 않으므로 보던 탭이 유지된다.
//   · 여행 상세 '<' 는 from=groups-trips 면 router.back() 으로 이 화면(보던 탭·필터)에 돌아온다.
//   · GROUP_LIST 진입 로그는 [모임] 섹션이 보일 때만 찍는다. [여행] 섹션은 로그를 찍지 않는다(별도 화면 상수 없음 · events.ts 는 공유 파일).
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/groups/ · components/my/ 에 있다. (CLAUDE.md 9장)
//
// 탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// ============================================================================
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GROUP_TOP_TAB,
  GroupListSection,
  GroupTopTabs,
  toGroupTopTab,
  type GroupTopTab,
  type GroupTravelCardData,
  type HiddenGroupItem,
} from '@/components/groups';
import { MyTripsSection } from '@/components/my';
import { SCREENS } from '@/lib/analytics/events';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { ENTRY_POINT, TRIP_STATUS } from '@/lib/constants/status';
import { MY_TRIPS_ORIGIN, useMyTrips } from '@/lib/hooks/useMyTrips';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getGroupMemberCount,
  getGroupTrips,
  getHiddenGroups,
  getMyGroupListForDisplay,
  hideGroups,
  unhideGroup,
  type GroupSortMode,
} from '@/lib/supabase/queries/groups';
import { getMyPersonalTrips } from '@/lib/supabase/queries/trips';
import { isTripOngoing } from '@/lib/trip/tripStatus';

/**
 * "이미 시작한 여행" 중 가장 늦은 start_date. 없으면 null.
 *
 * ⚠️ 앞으로 갈 여행은 세지 않는다. GROUP-01 '최근 여행순' 은
 *    "최근에 다녀온 여행이 있는 모임" 순서다. 미래 여행 때문에 모임이
 *    위로 올라오면 안 된다.
 *
 * 시작 여부는 closeTripIfEnded 와 같은 방식으로 본다.
 *   differenceInCalendarDays(오늘, start_date) >= 0  → 이미 시작
 * start_date 는 date 타입이라 시간대 변환이 없다.
 * 삭제된 여행은 getGroupTrips 가 이미 제외한다.
 */
function latestStartedTripDate(trips: { start_date: string | null }[]): string | null {
  const today = new Date();
  let latest: string | null = null;

  for (const trip of trips) {
    if (!trip.start_date) continue;
    if (differenceInCalendarDays(today, parseISO(trip.start_date)) < 0) continue;
    if (latest === null || trip.start_date > latest) latest = trip.start_date;
  }
  return latest;
}

type LoadState = 'loading' | 'ready' | 'error';

/** 화면이 들고 있는 한 행. 카드에 그릴 값과 저장에 필요한 순서를 함께 둔다. */
type Row = {
  card: GroupTravelCardData;
  /** null 이면 사용자가 이 모임의 순서를 지정한 적이 없다. */
  sortOrder: number | null;
  /**
   * '최근 여행순' 정렬 키 — **이미 시작한 여행 중 가장 늦은 start_date**.
   *
   * ⚠️ 앞으로 갈 여행은 세지 않는다. "최근에 다녀온 여행이 있는 모임" 순서다.
   *    미래 여행이 잡혔다고 모임이 위로 올라오면 안 된다.
   *    시작 여부는 closeTripIfEnded 와 같은 방식으로 본다.
   *    (differenceInCalendarDays — 오늘이면 이미 시작한 것으로 본다)
   *
   * 다녀온 여행이 없거나 start_date 가 전부 null 이면 null 이고 맨 아래로 간다.
   */
  lastStartedTripDate: string | null;
};

export default function ScreenGROUP01() {
  // 로그인한 사용자. 가드가 미로그인 상태를 막고 있어 여기서는 항상 값이 있다.
  const userId = useCurrentUserId();
  const router = useRouter();

  // ── 상단 탭 [여행] / [모임] ────────────────────────────────────────────
  const params = useLocalSearchParams<{ tab?: string; filter?: string; reset?: string }>();
  const [tab, setTab] = useState<GroupTopTab>(() => toGroupTopTab(params.tab));
  // 주소의 tab 이 바뀌거나(딥링크 · 모임 상세의 replace) 탭바가 reset 도장을 새로 찍으면 맞춘다.
  // ⚠️ params 가 그대로면 건드리지 않는다 — 상세에서 돌아올 때 보던 탭을 지킨다.
  useEffect(() => {
    if (params.tab) setTab(toGroupTopTab(params.tab));
  }, [params.tab, params.reset]);
  function changeTab(next: GroupTopTab) {
    setTab(next);
    router.setParams({ tab: next });
  }

  // GROUP_LIST 는 [모임] 섹션이 보일 때만. (docs/06 · CLAUDE.md 8장 — 화면 상수를 새로 만들지 않는다)
  useScreenView(SCREENS.GROUP_LIST, null, { enabled: tab === GROUP_TOP_TAB.GROUPS });

  // [여행] 섹션 — MY-02 와 같은 훅. 탭 화면은 언마운트되지 않아 다시 보일 때 조용히 갱신한다.
  const myTrips = useMyTrips({
    origin: MY_TRIPS_ORIGIN.GROUPS,
    paramFilter: params.filter,
    refreshOnFocus: true,
  });

  // 탭 헤더를 껐다. 상태바 높이만큼은 여기서 띄운다. (커뮤니티·마이페이지와 같은 방식)
  const insets = useSafeAreaInsets();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [rows, setRows] = useState<Row[]>([]);
  const [sortMode, setSortMode] = useState<GroupSortMode>('RECENT_TRIP');
  const [hiddenCount, setHiddenCount] = useState(0);

  // ── 편집 모드 ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const [sortOpen, setSortOpen] = useState(false);
  const [hiddenSheetOpen, setHiddenSheetOpen] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState<HiddenGroupItem[]>([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);

  // useFocusEffect 안에서 최신 editMode 를 읽기 위한 거울.
  const editModeRef = useRef(false);
  editModeRef.current = editMode;

  const load = useCallback(async () => {
    try {
      if (!userId) return;

      /**
       * 카드 대표 여행 = **여행 중(TRAVELING) 이 준비 중보다 먼저.** HOME-01 의 진행 중 정렬과 같은 규칙.
       * (app/(tabs)/index.tsx ongoingTrips · "지금 여행 중인 여행이 가장 급하다") 그 안의 순서는
       * 쿼리가 준 그대로(start_date 최신순)다. 상태는 DB 값만 본다 — 날짜로 다시 판정하지 않는다. (2026-09-18)
       */
      const travelingFirst = <T extends { status: string }>(list: T[]): T[] =>
        [...list].sort(
          (a, b) =>
            Number(b.status === TRIP_STATUS.TRAVELING) - Number(a.status === TRIP_STATUS.TRAVELING),
        );

      // 숨김 제외·정렬·정렬 모드 판정까지 쿼리가 끝낸다.
      // getMyGroups() 는 HOME-01·TRIP-01 도 쓰므로 건드리지 않는다.
      // 실제 모임과 개인 여행을 같이 읽는다. (docs/11_모임정책_v1.md §2)
      // ⚠️ 개인 여행은 groups 행이 없어 getMyGroupListForDisplay 로는 절대 안 잡힌다.
      //    DB 에 가짜 모임을 만들지 않고, 여기 display model 단계에서만 합친다.
      const [list, personalTrips] = await Promise.all([
        getMyGroupListForDisplay(userId),
        getMyPersonalTrips(userId),
      ]);

      // 모임 수만큼 상세 조회가 나간다. 모임은 사람당 많아야 몇 개라 그대로 둔다.
      const groupItems = await Promise.all(
        list.entries.map(async (entry): Promise<Row> => {
          // 진행 중(PLANNING·TRAVELING) / 지난(ENDED·SETTLED) 분류는 쿼리가 한다.
          // HOME-01 과 같은 기준이다. (app/(tabs)/index.tsx)
          const [memberCount, trips] = await Promise.all([
            // 인원은 모임원 데이터에서 센 결과다. 사용자가 직접 넣는 값이 아니다.
            getGroupMemberCount(entry.group.id),
            getGroupTrips(entry.group.id),
          ]);

          return {
            sortOrder: entry.sortOrder,
            lastStartedTripDate: latestStartedTripDate([...trips.ongoing, ...trips.past]),
            card: {
              kind: 'GROUP',
              groupId: entry.group.id,
              name: entry.group.name,
              createdAt: entry.group.created_at,
              memberCount,
              ongoingTrips: travelingFirst(trips.ongoing).map((trip) => ({
                tripId: trip.id,
                status: trip.status,
                destination: trip.destination,
                startDate: trip.start_date,
                endDate: trip.end_date,
              })),
              pastTripCount: trips.past.length,
            },
          };
        }),
      );

      /**
       * 개인 여행 카드 — 내 개인 여행 **전부를 하나로** 묶는다. (docs/11 §2)
       *
       * ⚠️ 여행마다 카드를 만들지 않는다. 몇 개든 '개인 여행' 카드는 최대 1장이다.
       *    실제 모임 카드와 같은 규칙으로 요약한다:
       *      진행 중 줄   PLANNING · TRAVELING 여행 (start_date 최신순 · getGroupTrips 와 같다)
       *      지난 여행 수  ENDED · SETTLED 수
       * ⚠️ 정렬 키도 가짜를 만들지 않는다.
       *      최근 여행순   개인 여행 중 이미 시작한 것의 가장 늦은 start_date
       *      생성순        개인 여행 중 가장 최근 trips.created_at
       */
      const personalOngoing = personalTrips
        .filter(
          (trip) =>
            // ⚠️ 취소 요청 중도 진행 중이다. 모임 카드에서 사라지면 안 된다
            isTripOngoing(trip.status),
        )
        .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
      const personalPastCount = personalTrips.filter(
        (trip) => trip.status === TRIP_STATUS.ENDED || trip.status === TRIP_STATUS.SETTLED,
      ).length;
      const personalItems: Row[] =
        personalTrips.length === 0
          ? []
          : [
              {
                sortOrder: null,
                lastStartedTripDate: latestStartedTripDate(personalTrips),
                card: {
                  kind: 'PERSONAL',
                  name: '개인 여행',
                  createdAt: personalTrips
                    .map((trip) => trip.created_at)
                    .sort()
                    .at(-1) as string,
                  // 카드 CREATED = 가장 먼저 만든 개인 여행의 created_at. (2026-09-15)
                  // 여행은 PLANNING 으로 생성되므로(trips.status default) 이 값이 곧
                  // "처음 개인 여행을 준비하기 시작한 날" 이다. 정렬 키(createdAt · 최근)와 별개.
                  firstCreatedAt: personalTrips
                    .map((trip) => trip.created_at)
                    .sort()
                    .at(0) as string,
                  ongoingTrips: travelingFirst(personalOngoing).map((trip) => ({
                    tripId: trip.id,
                    status: trip.status,
                    destination: trip.destination,
                    startDate: trip.start_date,
                    endDate: trip.end_date,
                  })),
                  pastTripCount: personalPastCount,
                },
              },
            ];

      const items = [...groupItems, ...personalItems];

      setRows(items);
      setHiddenCount(list.hiddenCount);
      // 목록이 바뀌면 사라진 모임의 선택은 버린다. (개인 여행은 선택 대상이 아니다)
      setSelectedIds((prev) =>
        prev.filter((id) =>
          items.some((row) => row.card.kind === 'GROUP' && row.card.groupId === id),
        ),
      );
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  // 여행 생성에서 모임을 새로 만들고 탭으로 돌아오면 목록이 달라져 있다.
  // ⚠️ 편집 중에는 다시 읽지 않는다. 선택과 순서를 잡아둔 상태가 초기화된다.
  useFocusEffect(
    useCallback(() => {
      if (editModeRef.current) return;
      void load();
    }, [load]),
  );

  /** 저장 실패는 자체 롤백하지 않고 DB 를 다시 읽어 화면을 진실에 맞춘다. */
  const recoverFromFailure = useCallback(async () => {
    Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
    await load();
  }, [load]);

  // ── 일반 모드 ──────────────────────────────────────────────────────────
  function handlePressGroup(card: GroupTravelCardData) {
    if (card.kind === 'PERSONAL') {
      // 개인 여행에는 모임 상세가 없다. groupId 가 없으니 GROUP-02 로 갈 수 없고,
      // 가짜 id 를 만들지 않는다. 개인 여행 상세(내 개인 여행 전부)로 간다.
      // (docs/11_모임정책_v1.md §2-3 · 2026-09-12)
      router.push('/groups/personal');
      return;
    }
    // 홈·모임·마이페이지 어디서 눌러도 같은 모임 상세로 간다. (docs/03 POL-NAV-001)
    router.push(`/groups/${card.groupId}`);
  }

  function handleToggleEdit() {
    setEditMode((prev) => {
      if (prev) setSelectedIds([]);
      return !prev;
    });
  }

  function handleToggleSelect(groupId: string) {
    setSelectedIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  }

  // ── 정렬 ───────────────────────────────────────────────────────────────
  //
  // 화면에서 정렬한다. 여행 날짜가 필요해 쿼리 단계에서는 못 정한다.
  // 정렬 값은 저장하지 않는다. user_group_list_preferences.sort_order 는
  // 더 이상 읽지도 쓰지도 않는다. (컬럼과 migration 은 그대로 둔다)
  const sortedRows = useMemo(() => {
    const next = [...rows];
    if (sortMode === 'CREATED_AT') {
      next.sort((a, b) => b.card.createdAt.localeCompare(a.card.createdAt));
      return next;
    }

    // 최근 여행순 — 다녀온 여행이 최신인 모임이 위로.
    // 다녀온 여행이 없는 모임은 맨 아래로 보내고, 그 안에서는 생성 최신순으로 둔다.
    next.sort((a, b) => {
      const x = a.lastStartedTripDate;
      const y = b.lastStartedTripDate;
      if (x === null && y === null) return b.card.createdAt.localeCompare(a.card.createdAt);
      if (x === null) return 1;
      if (y === null) return -1;
      // 같은 날짜면 생성 최신순으로 고정한다. 순서가 흔들리지 않게 한다.
      return y.localeCompare(x) || b.card.createdAt.localeCompare(a.card.createdAt);
    });
    return next;
  }, [rows, sortMode]);

  // ── 내 목록에서 숨김 ───────────────────────────────────────────────────
  const handleConfirmRemove = useCallback(async () => {
    if (saving || selectedIds.length === 0) return;

    setSaving(true);
    try {
      if (!userId) return;

      // sort_order 를 함께 보낸다. upsert 는 빠뜨린 칼럼을 기본값으로 덮어쓴다.
      const items = rows.flatMap((row) =>
        row.card.kind === 'GROUP' && selectedIds.includes(row.card.groupId)
          ? [{ groupId: row.card.groupId, sortOrder: row.sortOrder }]
          : [],
      );

      await hideGroups(userId, items);
      setRemoveOpen(false);
      setSelectedIds([]);
      await load();
    } catch {
      setRemoveOpen(false);
      await recoverFromFailure();
    } finally {
      setSaving(false);
    }
  }, [load, recoverFromFailure, rows, saving, selectedIds, userId]);

  // ── 숨긴 모임 ──────────────────────────────────────────────────────────
  const loadHiddenGroups = useCallback(async () => {
    setHiddenLoading(true);
    try {
      if (!userId) return;
      const groups = await getHiddenGroups(userId);
      setHiddenGroups(groups.map((group) => ({ groupId: group.id, name: group.name })));
    } catch {
      setHiddenGroups([]);
    } finally {
      setHiddenLoading(false);
    }
  }, [userId]);

  function handleOpenHidden() {
    setHiddenSheetOpen(true);
    void loadHiddenGroups();
  }

  const handleUnhide = useCallback(
    async (groupId: string) => {
      if (saving) return;

      setSaving(true);
      try {
        if (!userId) return;

        // 원래 위치로 되돌리지 않는다. '목록에 다시 추가' 다.
        // ⚠️ sort_order 는 항상 null 로 둔다. GROUP-01 정렬에서 더 이상 쓰지 않는다.
        //    컬럼은 남겨 두되 이 화면이 값을 새로 쓰지 않는다. (2026-09-03 정책)
        await unhideGroup(userId, groupId, null);
        await load();
        await loadHiddenGroups();
      } catch {
        await recoverFromFailure();
      } finally {
        setSaving(false);
      }
    },
    [load, loadHiddenGroups, recoverFromFailure, saving, userId],
  );

  // ── 렌더 ─────────────────────────────────────────────────────────────
  //
  // 헤더(= [여행] [모임] 텍스트 탭)는 로딩·오류·빈 상태에서도 같은 자리에 있어야 한다.
  // 공통 Header 와 같은 높이(56)라 다른 탭 화면과 줄이 맞는다. 제목 '모임' 줄은 두지 않는다 — 탭과 뜻이 겹친다.
  return (
    <View className="flex-1 bg-white">
      {/* 탭 헤더를 껐다. 상태바 높이만큼은 여기서 띄운다. (커뮤니티·마이페이지와 같은 방식) */}
      <View className="bg-white" style={{ paddingTop: insets.top }}>
        <GroupTopTabs value={tab} onChange={changeTab} />
      </View>

      {tab === GROUP_TOP_TAB.TRIPS ? (
        // 헤더 탭과 필터 알약 사이 16(= 8 + TripFilterTabs 의 pt-2). [모임] 쪽 '최근 여행순' 줄(pt-4)과 시작 높이를 맞춘다.
        // 하단 탭바가 떠 있어 목록 아래 여백을 준다(pb-28 = 112 · GroupTravelCardList 와 같은 규칙).
        <View className="flex-1 bg-gray-50" style={{ paddingTop: 8 }}>
          <MyTripsSection {...myTrips} contentBottomPadding={112} />
        </View>
      ) : (
        <GroupListSection
          loadState={loadState}
          cards={sortedRows.map((row) => row.card)}
          hiddenCount={hiddenCount}
          sortMode={sortMode}
          sortOpen={sortOpen}
          editMode={editMode}
          selectedIds={selectedIds}
          saving={saving}
          removeOpen={removeOpen}
          hiddenSheetOpen={hiddenSheetOpen}
          hiddenGroups={hiddenGroups}
          hiddenLoading={hiddenLoading}
          onRetry={() => void load()}
          onPressCreateTrip={() => router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)}
          onPressGroup={handlePressGroup}
          onToggleEdit={handleToggleEdit}
          onPressSort={() => setSortOpen((prev) => !prev)}
          onSelectSort={(mode) => {
            setSortMode(mode);
            setSortOpen(false);
          }}
          onCloseSort={() => setSortOpen(false)}
          onToggleSelect={handleToggleSelect}
          onPressRemove={() => setRemoveOpen(true)}
          onPressHidden={handleOpenHidden}
          onCancelRemove={() => setRemoveOpen(false)}
          onConfirmRemove={() => void handleConfirmRemove()}
          onCloseHidden={() => setHiddenSheetOpen(false)}
          onPressUnhide={(groupId) => void handleUnhide(groupId)}
        />
      )}
    </View>
  );
}
