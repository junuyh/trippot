import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { GroupSortMode } from '@/lib/supabase/queries/groups';

import { GROUP_SORT_LABEL } from './GroupSortSheet';

type Props = {
  sortMode: GroupSortMode;
  editMode: boolean;
  onToggleEdit: () => void;
  /** 정렬 문구를 눌렀을 때. 화면이 선택 시트를 연다. */
  onPressSort: () => void;
};

/**
 * 목록 상단. 왼쪽 정렬 선택, 오른쪽 편집/완료.
 *
 * ⚠️ 정렬 문구는 이제 상태 표시가 아니라 **버튼**이다. 목록 화면에서 바로
 *    정렬을 바꾼다. 편집 모드로 들어갈 필요가 없다. (2026-09-03 정책)
 *    두 정렬을 동시에 늘어놓는 탭·토글은 만들지 않는다. 현재 값만 보여주고
 *    누르면 시트에서 고른다.
 */
export function GroupListHeader({ sortMode, editMode, onToggleEdit, onPressSort }: Props) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2.5 pt-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`정렬 ${GROUP_SORT_LABEL[sortMode]}. 눌러서 변경`}
        hitSlop={8}
        onPress={onPressSort}
        className="-ml-1 flex-row items-center rounded-lg px-1 py-1 active:opacity-60"
      >
        <Text className="text-pot-mute" style={{ fontSize: 12.5 }}>
          {GROUP_SORT_LABEL[sortMode]}
        </Text>
        <Ionicons name="chevron-down" size={13} color="#747B88" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={editMode ? '편집 완료' : '목록 편집'}
        hitSlop={10}
        onPress={onToggleEdit}
        className="rounded-lg px-2 py-1 active:opacity-60"
      >
        <Text className="font-semibold text-pot-ink" style={{ fontSize: 12.5 }}>
          {editMode ? '완료' : '편집'}
        </Text>
      </Pressable>
    </View>
  );
}
