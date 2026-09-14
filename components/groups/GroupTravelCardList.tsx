import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

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
};

/**
 * 모임 카드 1열 목록. 세로로 쌓이고 넘치면 스크롤한다.
 *
 * 폭을 px 로 잡지 않는다. contentContainer 의 좌우 padding(20px)만 주고
 * 카드는 남은 폭을 그대로 채운다. 기기 폭이 달라도 항상 화면 폭 - 40 이다.
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
}: Props) {
  const selected = new Set(selectedIds);

  // 카드 색은 목록 전체를 보고 한 번에 정한다. (cardTheme.assignGroupCardThemes)
  // ⚠️ groups 는 화면 정렬이 끝난 순서지만 배정 함수는 그 순서를 쓰지 않는다 —
  //    created_at 으로 다시 세우므로 정렬을 바꿔도 색은 그대로다.
  const themes = useMemo(() => assignGroupCardThemes(groups), [groups]);

  // ⚠️ pb-28. pb-10 이면 마지막 카드가 떠 있는 탭바(FloatingTabBar)에 가려
  //    편집 모드에서 선택조차 되지 않는다. 다른 탭 화면과 같은 값이다.
  // 카드 사이 20. (2026-09-13 · 12 → 20) 실물 카드처럼 한 장씩 읽히려면 그림자가
  //    다음 카드에 닿지 않을 만큼 띄워야 한다. 12 에서는 목록이 한 덩어리로 보였다.
  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-28 pt-2">
      <View className="gap-5">
        {groups.map((group) => (
          <GroupTravelCard
            key={groupTravelCardKey(group)}
            group={group}
            theme={themes.get(groupTravelCardKey(group)) ?? FALLBACK_GROUP_CARD_THEME}
            onPress={onPressGroup}
            editMode={editMode}
            selected={group.kind === 'GROUP' && selected.has(group.groupId)}
            onToggleSelect={onToggleSelect}
            actionsDisabled={actionsDisabled}
          />
        ))}
      </View>
    </ScrollView>
  );
}
