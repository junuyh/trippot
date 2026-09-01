import { ScrollView, View } from 'react-native';

import { GroupTravelCard } from './GroupTravelCard';
import type { GroupTravelCardData } from './types';

type Props = {
  groups: GroupTravelCardData[];
  onPressGroup: (groupId: string) => void;

  // ── 편집 모드 ────────────────────────────────────────────────────────
  editMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (groupId: string) => void;
  onMoveUp?: (groupId: string) => void;
  onMoveDown?: (groupId: string) => void;
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
  onMoveUp,
  onMoveDown,
  actionsDisabled = false,
}: Props) {
  const selected = new Set(selectedIds);

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
      <View className="gap-3">
        {groups.map((group, index) => (
          <GroupTravelCard
            key={group.groupId}
            group={group}
            onPress={onPressGroup}
            editMode={editMode}
            selected={selected.has(group.groupId)}
            onToggleSelect={onToggleSelect}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={index > 0}
            canMoveDown={index < groups.length - 1}
            actionsDisabled={actionsDisabled}
          />
        ))}
      </View>
    </ScrollView>
  );
}
