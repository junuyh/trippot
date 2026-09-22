import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, ErrorState, Loading } from '@/components/ui';
import type { GroupSortMode } from '@/lib/supabase/queries/groups';

import { GroupEditActionBar } from './GroupEditActionBar';
import { GroupListEmptyNotice } from './GroupListEmptyNotice';
import { GroupListHeader } from './GroupListHeader';
import { GroupTravelCardList } from './GroupTravelCardList';
import { HiddenGroupsSheet } from './HiddenGroupsSheet';
import { RemoveConfirmModal } from './RemoveConfirmModal';
import type { GroupTravelCardData, HiddenGroupItem } from './types';

type Props = {
  loadState: 'loading' | 'ready' | 'error';
  /** 정렬이 끝난 카드. 화면 파일이 정렬한다. */
  cards: GroupTravelCardData[];
  hiddenCount: number;
  sortMode: GroupSortMode;
  sortOpen: boolean;
  editMode: boolean;
  selectedIds: string[];
  saving: boolean;
  removeOpen: boolean;
  hiddenSheetOpen: boolean;
  hiddenGroups: HiddenGroupItem[];
  hiddenLoading: boolean;
  onRetry: () => void;
  onPressCreateTrip: () => void;
  onPressGroup: (card: GroupTravelCardData) => void;
  onToggleEdit: () => void;
  onPressSort: () => void;
  onSelectSort: (mode: GroupSortMode) => void;
  onCloseSort: () => void;
  onToggleSelect: (groupId: string) => void;
  onPressRemove: () => void;
  onPressHidden: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onCloseHidden: () => void;
  onPressUnhide: (groupId: string) => void;
  /** 아래로 당겨 새로고침. 화면 파일이 조용히 다시 읽는다. (2026-09-22) */
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * GROUP-01 모임 목록 본문 — 정렬 · 편집 · 숨김 · 카드. (2026-09-21 · app/(tabs)/groups.tsx 에서 UI 만 이동)
 *
 * 하단 [모임] 탭 화면이 상단 탭 [모임] 일 때 그린다. 데이터·상태·핸들러는 화면 파일이 갖고 props 로 넘긴다.
 * 카드 · 정렬 메뉴 · 편집 액션바 · 시트 · 모달의 모양은 바꾸지 않았다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function GroupListSection({
  loadState,
  cards,
  hiddenCount,
  sortMode,
  sortOpen,
  editMode,
  selectedIds,
  saving,
  removeOpen,
  hiddenSheetOpen,
  hiddenGroups,
  hiddenLoading,
  onRetry,
  onPressCreateTrip,
  onPressGroup,
  onToggleEdit,
  onPressSort,
  onSelectSort,
  onCloseSort,
  onToggleSelect,
  onPressRemove,
  onPressHidden,
  onCancelRemove,
  onConfirmRemove,
  onCloseHidden,
  onPressUnhide,
  refreshing,
  onRefresh,
}: Props) {
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  if (loadState === 'loading') {
    return (
      <View className="flex-1 bg-white">
        <Loading message="모임을 불러오고 있어요" />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View className="flex-1 bg-white">
        <ErrorState message="모임 목록을 불러오지 못했어요." onRetry={onRetry} />
      </View>
    );
  }

  // 보이는 모임이 없어도 숨긴 모임이 있으면 편집으로 되살릴 수 있어야 한다.
  if (cards.length === 0 && hiddenCount === 0) {
    // 모임은 여행 생성의 '누구와' 단계에서 만든다. 별도 모임 생성 화면은 없다. (docs/09_IA_v1.md §2-1)
    // 빈 화면에서도 당겨서 새로고침이 되게 스크롤 안에 둔다. flexGrow 로 세로를 채워 모양은 그대로다.
    return (
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={refreshControl}
      >
        <EmptyState
          icon="people-outline"
          title="아직 참여 중인 모임이 없어요"
          description="여행을 만들 때 모임을 함께 만들면 여기에 모여요."
          actionLabel="새 여행 만들기"
          onAction={onPressCreateTrip}
        />
      </ScrollView>
    );
  }

  return (
    // ⚠️ 편집 모드에서 바탕을 한 단계 어둡게 한다. 같은 pot-visual 이면 편집으로 들어간 것이 눈에 띄지 않았다.
    //    카드는 흰색 그대로라 대비가 생기고, 터치를 막는 overlay 는 두지 않는다.
    <View className={`flex-1 ${editMode ? 'bg-gray-200' : 'bg-white'}`}>
      {/* ⚠️ zIndex 로 올린다. 정렬 목록이 뒤에 오는 카드 목록에 가리면 안 된다. */}
      <View style={{ zIndex: 20 }}>
        <GroupListHeader
          sortMode={sortMode}
          editMode={editMode}
          sortOpen={sortOpen}
          onToggleEdit={onToggleEdit}
          onPressSort={onPressSort}
          onSelectSort={onSelectSort}
        />
      </View>

      {cards.length === 0 ? (
        // 여기 오는 경우는 hiddenCount > 0 뿐이다. 복구는 편집 모드에서만 한다. 문구로 경로만 알려준다.
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} refreshControl={refreshControl}>
          <GroupListEmptyNotice editMode={editMode} />
        </ScrollView>
      ) : (
        <GroupTravelCardList
          groups={cards}
          onPressGroup={onPressGroup}
          editMode={editMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          actionsDisabled={saving}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* 정렬 목록 바깥을 눌렀을 때 닫는다. 색을 주지 않는다(dim overlay 없음). 목록보다 아래(zIndex 10). */}
      {sortOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="정렬 목록 닫기"
          onPress={onCloseSort}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
        />
      ) : null}

      {editMode ? (
        <GroupEditActionBar
          selectedCount={selectedIds.length}
          hiddenCount={hiddenCount}
          saving={saving}
          onPressRemove={onPressRemove}
          onPressHidden={onPressHidden}
        />
      ) : null}

      <RemoveConfirmModal
        visible={removeOpen}
        count={selectedIds.length}
        saving={saving}
        onCancel={onCancelRemove}
        onConfirm={onConfirmRemove}
      />

      <HiddenGroupsSheet
        visible={hiddenSheetOpen}
        groups={hiddenGroups}
        loading={hiddenLoading}
        saving={saving}
        onClose={onCloseHidden}
        onPressUnhide={onPressUnhide}
      />
    </View>
  );
}
