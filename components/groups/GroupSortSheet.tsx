import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import type { GroupSortMode } from '@/lib/supabase/queries/groups';

/** 화면에 보이는 정렬 이름. 두 가지뿐이다. (2026-09-03 정책) */
export const GROUP_SORT_LABEL: Record<GroupSortMode, string> = {
  RECENT_TRIP: '최근 여행순',
  CREATED_AT: '모임 생성순',
};

const OPTIONS: GroupSortMode[] = ['RECENT_TRIP', 'CREATED_AT'];

type Props = {
  visible: boolean;
  current: GroupSortMode;
  onClose: () => void;
  onSelect: (mode: GroupSortMode) => void;
};

/**
 * 정렬 선택 바텀시트.
 *
 * GroupMoreMenu 와 같은 react-native 기본 Modal 패턴이다.
 * 새 라이브러리나 새 UI 패턴을 만들지 않는다.
 *
 * ⚠️ maxHeight 를 두지 않는다. 항목이 둘뿐이라 내용 높이로 충분하고,
 *    퍼센트 maxHeight 는 이 구조에서 시트를 통째로 사라지게 한다.
 *    (HiddenGroupsSheet 가 그 문제로 안 보였다)
 */
export function GroupSortSheet({ visible, current, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 바깥을 누르면 닫힌다. */}
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        {/* 시트 안쪽 터치가 바깥으로 새지 않게 Pressable 로 한 번 막는다. */}
        <Pressable className="rounded-t-2xl bg-white px-5 pb-9 pt-5" onPress={() => {}}>
          <Text className="text-sm font-medium text-gray-500">정렬</Text>

          <View className="mt-3">
            {OPTIONS.map((mode) => {
              const selected = mode === current;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={GROUP_SORT_LABEL[mode]}
                  onPress={() => onSelect(mode)}
                  className="flex-row items-center py-4 active:bg-gray-50"
                >
                  <Text
                    className={`flex-1 text-base ${
                      selected ? 'font-semibold text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {GROUP_SORT_LABEL[mode]}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={20} color="#2563eb" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
