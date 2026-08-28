// TRIP-01 기존 모임 선택 목록.
//
// Loading / Empty / Error 를 화면이 아니라 이 컴포넌트가 그린다.
// 모임 목록은 화면의 일부라 전체 화면 상태로 처리하면 다른 선택지까지 사라진다.
// (그래서 Loading / EmptyState 를 fullScreen 이 아닌 형태로 감싼다)
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import type { Group } from '@/lib/supabase/queries/groups';

type Props = {
  groups: Group[];
  loading: boolean;
  error: boolean;
  selectedGroupId: string | null;
  onSelect: (groupId: string) => void;
  onRetry: () => void;
  /** 모임이 하나도 없을 때 "새 모임 만들기" 로 넘기기 위한 콜백 */
  onCreateNew: () => void;
  disabled?: boolean;
};

export function GroupPicker({
  groups,
  loading,
  error,
  selectedGroupId,
  onSelect,
  onRetry,
  onCreateNew,
  disabled = false,
}: Props) {
  if (loading) {
    return (
      <View className="items-center py-8">
        <Text className="text-sm text-gray-400">모임을 불러오는 중…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-6">
        <Ionicons name="alert-circle-outline" size={28} color="#f87171" />
        <Text className="text-center text-sm text-gray-600">
          모임 목록을 불러오지 못했어요.
        </Text>
        <Button label="다시 시도" variant="secondary" fullWidth={false} onPress={onRetry} />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View className="items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6">
        <Ionicons name="people-outline" size={28} color="#d1d5db" />
        <Text className="text-center text-sm text-gray-600">아직 만든 모임이 없어요.</Text>
        <Button
          label="새 모임 만들기"
          variant="secondary"
          fullWidth={false}
          onPress={onCreateNew}
        />
      </View>
    );
  }

  return (
    <View className="gap-2">
      {groups.map((group) => {
        const selected = selectedGroupId === group.id;
        return (
          <Pressable
            key={group.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={group.name}
            disabled={disabled}
            onPress={() => onSelect(group.id)}
            className={`flex-row items-center justify-between rounded-xl border px-4 py-3.5 ${
              selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white active:bg-gray-50'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <Text
              numberOfLines={1}
              className={`flex-1 text-base ${selected ? 'font-semibold text-blue-700' : 'text-gray-800'}`}
            >
              {group.name}
            </Text>
            {selected ? <Ionicons name="checkmark-circle" size={20} color="#2563eb" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
