// TRIP-01 기존 모임 선택.
//
// 모임은 가로 스크롤 칩으로 늘어놓고, 고른 모임의 멤버를 그 아래에 펼친다.
// 세로 목록이면 모임이 늘어날수록 아래 입력이 화면 밖으로 밀린다.
//
// Loading / Empty / Error 를 화면이 아니라 이 컴포넌트가 그린다.
// 모임 목록은 화면의 일부라 전체 화면 상태로 처리하면 다른 선택지까지 사라진다.
// (그래서 Loading / EmptyState 를 fullScreen 이 아닌 형태로 감싼다)
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

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

  /** 고른 모임의 참여 멤버 이름. 아직 안 골랐으면 빈 배열이다. */
  memberNames: string[];
  membersLoading: boolean;

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
  memberNames,
  membersLoading,
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
    <View>
      {/* 칩 줄은 카드 좌우 여백(p-4)까지 밀어내 화면 끝까지 흐르게 한다.
          여백 안에 가두면 마지막 칩이 잘려 더 있다는 게 보이지 않는다. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerClassName="gap-1.5 px-4"
      >
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
              className={`rounded-full border px-3.5 py-2.5 ${
                selected
                  ? 'border-brand bg-brand'
                  : 'border-gray-200 bg-white active:bg-gray-50'
              }`}
            >
              <Text
                numberOfLines={1}
                className={`text-xs font-bold ${selected ? 'text-white' : 'text-gray-600'}`}
              >
                {group.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-3.5">
        {selectedGroupId === null ? (
          <Text className="text-xs leading-5 text-gray-400">함께 갈 모임을 골라주세요.</Text>
        ) : membersLoading ? (
          <Text className="text-xs leading-5 text-gray-400">멤버를 불러오는 중…</Text>
        ) : memberNames.length === 0 ? (
          // 멤버 조회가 실패해도 모임 선택 자체는 유효하다. 여기서 막지 않는다.
          <Text className="text-xs leading-5 text-gray-400">
            멤버를 불러오지 못했어요. 인원은 다음 단계에서 정할 수 있어요.
          </Text>
        ) : (
          <View className="flex-row flex-wrap items-center gap-1.5">
            {memberNames.map((name, index) => (
              <View key={`${name}-${index}`} className="rounded-full bg-gray-100 px-2.5 py-1.5">
                <Text className="text-xs font-bold text-gray-700">{name}</Text>
              </View>
            ))}
            <Text className="ml-auto text-xs font-bold text-gray-400">
              {memberNames.length}명
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
