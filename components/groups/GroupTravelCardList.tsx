import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, type LayoutChangeEvent } from 'react-native';

import { FALLBACK_GROUP_CARD_THEME, assignGroupCardThemes } from './cardTheme';
import { GroupTravelCard } from './GroupTravelCard';
import { groupTravelCardKey, type GroupTravelCardData } from './types';

type Props = {
  groups: GroupTravelCardData[];
  onPressGroup: (card: GroupTravelCardData) => void;

  // ── 편집 모드 ────────────────────────────────────────────────────────
  editMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (groupId: string) => void;
  actionsDisabled?: boolean;

  // ── 아래로 당겨 새로고침 (2026-09-22 · 팀 테스트 피드백) ─────────────────
  /** 넘기지 않으면 당겨도 아무 일도 없다(기존 동작). 화면 파일이 조용히 다시 읽는다. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** 카드 사이 가로 간격. 여행준비홈 카드 리듬과 같은 12. */
const GAP = 12;
/** 줄 사이 간격. 위 줄 태그 아래와 다음 줄 끈 끝이 붙지 않게 가로보다 넉넉히. (2026-09-18) */
const ROW_GAP = 18;

/**
 * 모임 카드 **2열 그리드**. 세로형 태그라 한 줄에 두 장. 넘치면 스크롤한다. (2026-09-18 · 1열 → 2열)
 *
 * 폭을 px 로 잡지 않는다. contentContainer 의 좌우 padding(16)만 주고, 남은 폭에서
 * GAP 을 뺀 절반이 카드 폭이다 — 기기 폭이 달라도 두 장이 늘 같은 폭이다.
 * 카드 높이는 카드가 스스로 고정한다(GroupTravelCard 높이 정책)라 같은 줄의 두 장이 같은 높이다.
 *
 * 배경은 화면이 칠한다. 편집 모드에서 배경만 옅게 바뀌고 카드는 흰색을 유지한다.
 */
export function GroupTravelCardList({
  groups,
  onPressGroup,
  editMode = false,
  selectedIds = [],
  onToggleSelect,
  actionsDisabled = false,
  refreshing,
  onRefresh,
}: Props) {
  const selected = new Set(selectedIds);

  // 카드 색은 목록 전체를 보고 한 번에 정한다. (cardTheme.assignGroupCardThemes)
  // ⚠️ groups 는 화면 정렬이 끝난 순서지만 배정 함수는 그 순서를 쓰지 않는다 —
  //    created_at 으로 다시 세우므로 정렬을 바꿔도 색은 그대로다.
  const themes = useMemo(() => assignGroupCardThemes(groups), [groups]);

  // 그리드 폭을 재서 카드 폭을 정한다. 잴 때까지는 그리지 않는다(첫 프레임 깜빡임 방지).
  const [gridWidth, setGridWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width);
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GAP) / 2) : 0;

  // ⚠️ pb-28. pb-10 이면 마지막 카드가 떠 있는 탭바(FloatingTabBar)에 가려
  //    편집 모드에서 선택조차 되지 않는다. 다른 탭 화면과 같은 값이다.
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-28 pt-1"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
      }
    >
      <View onLayout={onLayout} className="flex-row flex-wrap" style={{ columnGap: GAP, rowGap: ROW_GAP }}>
        {cardWidth > 0
          ? groups.map((group) => (
              <View key={groupTravelCardKey(group)} style={{ width: cardWidth }}>
                <GroupTravelCard
                  group={group}
                  theme={themes.get(groupTravelCardKey(group)) ?? FALLBACK_GROUP_CARD_THEME}
                  onPress={onPressGroup}
                  editMode={editMode}
                  selected={group.kind === 'GROUP' && selected.has(group.groupId)}
                  onToggleSelect={onToggleSelect}
                  actionsDisabled={actionsDisabled}
                />
              </View>
            ))
          : null}
      </View>
    </ScrollView>
  );
}
