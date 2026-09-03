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
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/groups/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// ============================================================================
import { useFocusEffect, useRouter } from 'expo-router';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GroupEditActionBar,
  GroupListEmptyNotice,
  GroupListHeader,
  GroupTravelCardList,
  HiddenGroupsSheet,
  RemoveConfirmModal,
  type GroupTravelCardData,
  type HiddenGroupItem,
} from '@/components/groups';
import { EmptyState, ErrorState, Header, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { ENTRY_POINT } from '@/lib/constants/status';
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
  useScreenView(SCREENS.GROUP_LIST);

  const router = useRouter();
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
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      // 숨김 제외·정렬·정렬 모드 판정까지 쿼리가 끝낸다.
      // getMyGroups() 는 HOME-01·TRIP-01 도 쓰므로 건드리지 않는다.
      const list = await getMyGroupListForDisplay(userId);

      // 모임 수만큼 상세 조회가 나간다. 모임은 사람당 많아야 몇 개라 그대로 둔다.
      const items = await Promise.all(
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
              groupId: entry.group.id,
              name: entry.group.name,
              createdAt: entry.group.created_at,
              memberCount,
              ongoingTrips: trips.ongoing.map((trip) => ({
                tripId: trip.id,
                destination: trip.destination,
                startDate: trip.start_date,
                endDate: trip.end_date,
              })),
              pastTripCount: trips.past.length,
            },
          };
        }),
      );

      setRows(items);
      setHiddenCount(list.hiddenCount);
      // 목록이 바뀌면 사라진 모임의 선택은 버린다.
      setSelectedIds((prev) =>
        prev.filter((id) => items.some((row) => row.card.groupId === id)),
      );
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

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
  function handlePressGroup(groupId: string) {
    // 홈·모임·마이페이지 어디서 눌러도 같은 모임 상세로 간다. (docs/03 POL-NAV-001)
    router.push(`/groups/${groupId}`);
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
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      // sort_order 를 함께 보낸다. upsert 는 빠뜨린 칼럼을 기본값으로 덮어쓴다.
      const items = rows
        .filter((row) => selectedIds.includes(row.card.groupId))
        .map((row) => ({ groupId: row.card.groupId, sortOrder: row.sortOrder }));

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
  }, [load, recoverFromFailure, rows, saving, selectedIds]);

  // ── 숨긴 모임 ──────────────────────────────────────────────────────────
  const loadHiddenGroups = useCallback(async () => {
    setHiddenLoading(true);
    try {
      // TODO: 로그인 연동 시 교체
      const groups = await getHiddenGroups(DEV_USER_ID);
      setHiddenGroups(groups.map((group) => ({ groupId: group.id, name: group.name })));
    } catch {
      setHiddenGroups([]);
    } finally {
      setHiddenLoading(false);
    }
  }, []);

  function handleOpenHidden() {
    setHiddenSheetOpen(true);
    void loadHiddenGroups();
  }

  const handleUnhide = useCallback(
    async (groupId: string) => {
      if (saving) return;

      setSaving(true);
      try {
        // TODO: 로그인 연동 시 교체
        const userId = DEV_USER_ID;

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
    [load, loadHiddenGroups, recoverFromFailure, saving],
  );

  // ── 4상태 ──────────────────────────────────────────────────────────────
  //
  // 상단바는 로딩·오류·빈 상태에서도 같은 자리에 있어야 한다.
  // 커뮤니티·마이페이지와 같은 공통 Header 다. 같은 컴포넌트라 높이가 같다.
  const header = (
    <View className="bg-white" style={{ paddingTop: insets.top }}>
      <Header title="모임" showBack={false} />
    </View>
  );

  if (loadState === 'loading') {
    return (
      <View className="flex-1 bg-pot-visual">
        {header}
        <Loading message="모임을 불러오고 있어요" />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View className="flex-1 bg-pot-visual">
        {header}
        <ErrorState message="모임 목록을 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  // 보이는 모임이 없어도 숨긴 모임이 있으면 편집으로 되살릴 수 있어야 한다.
  if (rows.length === 0 && hiddenCount === 0) {
    // 모임은 여행 생성의 '누구와' 단계에서 만든다. 별도 모임 생성 화면은 없다.
    // (docs/09_IA_v1.md §2-1)
    return (
      <View className="flex-1 bg-pot-visual">
        {header}
        <EmptyState
          icon="people-outline"
          title="아직 참여 중인 모임이 없어요"
          description="여행을 만들 때 모임을 함께 만들면 여기에 모여요."
          actionLabel="새 여행 만들기"
          onAction={() => router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)}
        />
      </View>
    );
  }

  return (
    // ⚠️ 편집 모드에서 바탕을 한 단계 어둡게 한다. 같은 pot-visual 이면
    //    편집으로 들어간 것이 눈에 띄지 않았다. 카드는 흰색 그대로라
    //    대비가 생기고, 터치를 막는 overlay 는 두지 않는다.
    //    gray-200(#E5E7EB) 은 pot-line(#E5E8EC) 과 사실상 같은 값이라
    //    앱의 뉴트럴 단계에서 벗어나지 않는다.
    <View className={`flex-1 ${editMode ? 'bg-gray-200' : 'bg-pot-visual'}`}>
      {header}

      {/* ⚠️ zIndex 로 올린다. 정렬 목록이 뒤에 오는 카드 목록에 가리면 안 된다.
          RN 은 형제끼리 나중에 그린 것이 위로 올라온다. */}
      <View style={{ zIndex: 20 }}>
        <GroupListHeader
          sortMode={sortMode}
          editMode={editMode}
          sortOpen={sortOpen}
          onToggleEdit={handleToggleEdit}
          onPressSort={() => setSortOpen((prev) => !prev)}
          onSelectSort={(mode) => {
            setSortMode(mode);
            setSortOpen(false);
          }}
        />
      </View>

      {rows.length === 0 ? (
        // 여기 오는 경우는 hiddenCount > 0 뿐이다. 참여 중인 모임이 아예 없는 상태는
        // 위에서 이미 걸러졌다. 화면이 통째로 비면 왜 안 보이는지 알 수 없어 안내를 둔다.
        // ⚠️ 일반 모드에 '숨긴 모임 보기' 버튼을 두지 않는다. 복구는 편집 모드에서만 한다.
        //    그래서 문구로 경로만 알려준다.
        <GroupListEmptyNotice editMode={editMode} />
      ) : (
        <GroupTravelCardList
          groups={sortedRows.map((row) => row.card)}
          onPressGroup={handlePressGroup}
          editMode={editMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          actionsDisabled={saving}
        />
      )}

      {/*
        정렬 목록 바깥을 눌렀을 때 닫는다.
        ⚠️ 색을 주지 않는다. dim overlay 를 쓰지 않기로 했다.
           목록보다 아래(zIndex 10), 카드 목록보다 위에 깔린다.
      */}
      {sortOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="정렬 목록 닫기"
          onPress={() => setSortOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
        />
      ) : null}

      {editMode ? (
        <GroupEditActionBar
          selectedCount={selectedIds.length}
          hiddenCount={hiddenCount}
          saving={saving}
          onPressRemove={() => setRemoveOpen(true)}
          onPressHidden={handleOpenHidden}
        />
      ) : null}

      <RemoveConfirmModal
        visible={removeOpen}
        count={selectedIds.length}
        saving={saving}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => void handleConfirmRemove()}
      />

      <HiddenGroupsSheet
        visible={hiddenSheetOpen}
        groups={hiddenGroups}
        loading={hiddenLoading}
        saving={saving}
        onClose={() => setHiddenSheetOpen(false)}
        onPressUnhide={(groupId) => void handleUnhide(groupId)}
      />
    </View>
  );
}
