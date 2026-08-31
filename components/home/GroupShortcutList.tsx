import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { HomeGroupItem } from './types';

type Props = {
  groups: HomeGroupItem[];
  onPress: (groupId: string) => void;
};

/**
 * 1-3. 모임 바로가기. (docs/09_IA_v1.md §1)
 *
 * 홈·모임 메뉴·마이페이지에서 같은 모임을 고르면 모두 같은 모임 상세로 간다.
 * (docs/03 POL-NAV-001)
 */
export function GroupShortcutList({ groups, onPress }: Props) {
  if (groups.length === 0) {
    return <Text className="text-sm text-pot-mute">아직 모임이 없어요.</Text>;
  }

  return (
    <View className="gap-2">
      {groups.map((group) => (
        <Pressable
          key={group.groupId}
          accessibilityRole="button"
          accessibilityLabel={`${group.name} 모임 상세로 이동`}
          onPress={() => onPress(group.groupId)}
          className="flex-row items-center justify-between rounded-2xl bg-pot-paper px-5 py-4 active:opacity-70"
        >
          <Text className="flex-1 pr-3 text-base font-semibold text-pot-ink" numberOfLines={1}>
            {group.name}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#8C8A85" />
        </Pressable>
      ))}
    </View>
  );
}
