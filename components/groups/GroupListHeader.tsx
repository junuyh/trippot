import { Pressable, Text, View } from 'react-native';

import type { GroupSortMode } from '@/lib/supabase/queries/groups';

const SORT_MODE_LABEL: Record<GroupSortMode, string> = {
  CREATED_AT: '모임 생성일 순',
  CUSTOM: '사용자 지정 순',
};

type Props = {
  sortMode: GroupSortMode;
  editMode: boolean;
  onToggleEdit: () => void;
};

/**
 * 목록 상단. 현재 정렬 상태 하나와 편집/완료 버튼만 둔다.
 *
 * ⚠️ 정렬 문구는 상태 표시이지 선택 버튼이 아니다.
 *    두 정렬을 동시에 보여주는 탭/토글로 만들지 않는다.
 */
export function GroupListHeader({ sortMode, editMode, onToggleEdit }: Props) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-2 pt-6">
      <Text className="text-sm text-gray-500">{SORT_MODE_LABEL[sortMode]}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={editMode ? '편집 완료' : '목록 편집'}
        hitSlop={10}
        onPress={onToggleEdit}
        className="rounded-lg px-2 py-1 active:bg-gray-100"
      >
        <Text className="text-sm font-semibold text-blue-600">
          {editMode ? '완료' : '편집'}
        </Text>
      </Pressable>
    </View>
  );
}
