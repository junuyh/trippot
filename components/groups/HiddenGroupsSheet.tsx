import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { HiddenGroupItem } from './types';

type Props = {
  visible: boolean;
  groups: HiddenGroupItem[];
  loading: boolean;
  /** 다시 표시 처리 중. 중복 실행을 막는다. */
  saving: boolean;
  onClose: () => void;
  onPressUnhide: (groupId: string) => void;
};

/**
 * 숨긴 모임 바텀시트. 편집 모드에서만 열린다.
 *
 * 별도 화면(라우트)을 만들지 않는다. 화면 ID 가 늘면 담당·단계 관리가 어긋난다.
 * GroupMoreMenu 와 같은 react-native 기본 Modal 패턴이다. 새 라이브러리를 넣지 않는다.
 *
 * 카드 전체 정보를 다시 만들지 않는다. 이름과 '다시 표시' 만 있으면 된다.
 */
export function HiddenGroupsSheet({
  visible,
  groups,
  loading,
  saving,
  onClose,
  onPressUnhide,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        {/* 목록이 길어져도 화면을 넘지 않게 70% 로 막는다.
            PastTripSheet 도 같은 방식(max-h-[82%])을 쓴다. */}
        <Pressable className="max-h-[70%] rounded-t-2xl bg-white px-5 pb-9 pt-5" onPress={() => {}}>
          <Text className="text-base font-bold text-gray-900">숨긴 모임</Text>

          {loading ? (
            <Text className="mt-5 text-sm text-gray-400">불러오는 중…</Text>
          ) : groups.length === 0 ? (
            <Text className="mt-5 text-sm text-gray-400">숨긴 모임이 없어요.</Text>
          ) : (
            <ScrollView className="mt-3">
              {groups.map((group) => (
                <View
                  key={group.groupId}
                  className="flex-row items-center justify-between border-b border-gray-100 py-3.5"
                >
                  <Text numberOfLines={1} className="shrink pr-3 text-sm text-gray-800">
                    {group.name}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${group.name} 다시 표시`}
                    disabled={saving}
                    hitSlop={8}
                    onPress={() => onPressUnhide(group.groupId)}
                    className={`shrink-0 rounded-lg px-2 py-1 active:bg-gray-100 ${saving ? 'opacity-40' : ''}`}
                  >
                    <Text className="text-sm font-semibold text-blue-600">다시 표시</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            className="mt-4 items-center rounded-xl bg-gray-100 py-3.5 active:bg-gray-200"
          >
            <Text className="text-base font-medium text-gray-900">닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
