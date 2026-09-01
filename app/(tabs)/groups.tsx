// ============================================================================
// GROUP-01 · /groups · MVP
// 기준: docs/09_IA_v1.md §3-1, docs/04_화면목록_v3.md GROUP-01,
//       docs/03_요구사항정의서_v1.md POL-NAV-001 / NFR-003 / NFR-005
//
// 카드에 담는 것: 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수
// 담지 않는 것: 대표 모임 여행 유형([고도화]), 생성일 · 대표 이미지 · More(IA 에 없음)
//               생성일은 표시하지 않고 정렬에만 쓴다.
//
// 편집 모드: 카드 선택 · Chevron 순서 변경 · 내 목록에서 제거 · 숨긴 모임 복구
//
// ⚠️ '내 목록에서 제거' 는 삭제도 탈퇴도 아니다.
//    groups / group_members / trips / 예산 / 거래 / 결산 을 건드리지 않는다.
//    현재 사용자의 GROUP-01 표시 여부만 바꾼다. 홈과 여행 생성 화면에서는 계속 보인다.
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/groups/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// ============================================================================
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

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
import { EmptyState, ErrorState, Loading } from '@/components/ui';
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
  resetGroupOrder,
  saveGroupOrder,
  swapGroupOrder,
  unhideGroup,
  type GroupSortMode,
} from '@/lib/supabase/queries/groups';

type LoadState = 'loading' | 'ready' | 'error';

/** 화면이 들고 있는 한 행. 카드에 그릴 값과 저장에 필요한 순서를 함께 둔다. */
type Row = {
  card: GroupTravelCardData;
  /** null 이면 사용자가 이 모임의 순서를 지정한 적이 없다. */
  sortOrder: number | null;
};

export default function ScreenGROUP01() {
  useScreenView(SCREENS.GROUP_LIST);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [rows, setRows] = useState<Row[]>([]);
  const [sortMode, setSortMode] = useState<GroupSortMode>('CREATED_AT');
  const [hiddenCount, setHiddenCount] = useState(0);

  // ── 편집 모드 ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

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
      setSortMode(list.sortMode);
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

  // ── 순서 변경 ──────────────────────────────────────────────────────────
  const move = useCallback(
    async (groupId: string, direction: -1 | 1) => {
      if (saving) return;

      const index = rows.findIndex((row) => row.card.groupId === groupId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= rows.length) return;

      // 순서가 하나라도 비어 있으면 전체를 1..N 으로 정규화한다.
      // 일부에만 값을 넣으면 NULL 과 숫자가 섞여 정렬이 정의되지 않는다.
      const needsInit = rows.some((row) => row.sortOrder === null);

      // 위치를 먼저 바꾼 뒤 순서값을 자리에 맞춰 다시 붙인다.
      const moved = [...rows];
      const [picked] = moved.splice(index, 1);
      moved.splice(target, 0, picked);

      const originalOrders = rows.map((row) => row.sortOrder);
      const next: Row[] = moved.map((row, i) => ({
        ...row,
        sortOrder: needsInit ? i + 1 : originalOrders[i],
      }));

      // 낙관적 반영. 실패하면 load() 로 되돌린다.
      setRows(next);
      setSaving(true);
      try {
        // TODO: 로그인 연동 시 교체
        const userId = DEV_USER_ID;

        if (needsInit) {
          // 최초 1회. 전체 저장과 교환을 두 요청으로 나누지 않는다.
          await saveGroupOrder(userId, next.map((row) => row.card.groupId));
        } else {
          const a = rows[index];
          const b = rows[target];
          await swapGroupOrder(
            userId,
            { groupId: a.card.groupId, sortOrder: b.sortOrder as number },
            { groupId: b.card.groupId, sortOrder: a.sortOrder as number },
          );
        }
        setSortMode('CUSTOM');
      } catch {
        await recoverFromFailure();
      } finally {
        setSaving(false);
      }
    },
    [recoverFromFailure, rows, saving],
  );

  const handleMoveUp = useCallback((groupId: string) => void move(groupId, -1), [move]);
  const handleMoveDown = useCallback((groupId: string) => void move(groupId, 1), [move]);

  // ── 내 목록에서 제거 ───────────────────────────────────────────────────
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
        //   기본 정렬       → null. groups.created_at 자리로 들어간다.
        //   사용자 지정 순  → 보이는 목록의 마지막 + 1. 맨 아래에 붙는다.
        const maxOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder ?? 0), 0);
        const nextOrder = sortMode === 'CUSTOM' ? maxOrder + 1 : null;

        await unhideGroup(userId, groupId, nextOrder);
        await load();
        await loadHiddenGroups();
      } catch {
        await recoverFromFailure();
      } finally {
        setSaving(false);
      }
    },
    [load, loadHiddenGroups, recoverFromFailure, rows, saving, sortMode],
  );

  // ── 정렬 초기화 ────────────────────────────────────────────────────────
  const handleResetOrder = useCallback(async () => {
    if (saving) return;

    setSaving(true);
    try {
      // TODO: 로그인 연동 시 교체
      // sort_order 만 지운다. hidden 은 건드리지 않는다.
      await resetGroupOrder(DEV_USER_ID);
      await load();
    } catch {
      await recoverFromFailure();
    } finally {
      setSaving(false);
    }
  }, [load, recoverFromFailure, saving]);

  // ── 4상태 ──────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return <Loading message="모임을 불러오고 있어요" />;
  }

  if (loadState === 'error') {
    return <ErrorState message="모임 목록을 불러오지 못했어요." onRetry={() => void load()} />;
  }

  // 보이는 모임이 없어도 숨긴 모임이 있으면 편집으로 되살릴 수 있어야 한다.
  if (rows.length === 0 && hiddenCount === 0) {
    // 모임은 여행 생성의 '누구와' 단계에서 만든다. 별도 모임 생성 화면은 없다.
    // (docs/09_IA_v1.md §2-1)
    return (
      <EmptyState
        icon="people-outline"
        title="아직 참여 중인 모임이 없어요"
        description="여행을 만들 때 모임을 함께 만들면 여기에 모여요."
        actionLabel="새 여행 만들기"
        onAction={() => router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)}
      />
    );
  }

  return (
    <View className={`flex-1 ${editMode ? 'bg-gray-50' : 'bg-white'}`}>
      <GroupListHeader
        sortMode={sortMode}
        editMode={editMode}
        onToggleEdit={handleToggleEdit}
      />

      {rows.length === 0 ? (
        // 여기 오는 경우는 hiddenCount > 0 뿐이다. 참여 중인 모임이 아예 없는 상태는
        // 위에서 이미 걸러졌다. 화면이 통째로 비면 왜 안 보이는지 알 수 없어 안내를 둔다.
        // ⚠️ 일반 모드에 '숨긴 모임 보기' 버튼을 두지 않는다. 복구는 편집 모드에서만 한다.
        //    그래서 문구로 경로만 알려준다.
        <GroupListEmptyNotice editMode={editMode} />
      ) : (
        <GroupTravelCardList
          groups={rows.map((row) => row.card)}
          onPressGroup={handlePressGroup}
          editMode={editMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          actionsDisabled={saving}
        />
      )}

      {editMode ? (
        <GroupEditActionBar
          selectedCount={selectedIds.length}
          hiddenCount={hiddenCount}
          canResetOrder={sortMode === 'CUSTOM'}
          saving={saving}
          onPressRemove={() => setRemoveOpen(true)}
          onPressHidden={handleOpenHidden}
          onPressResetOrder={() => void handleResetOrder()}
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
