import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  visible: boolean;
  /** 선택한 모임 수. 1개면 문구에 개수를 넣지 않는다. */
  count: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 목록에서 제거 확인. (NFR-003 — 되돌리기 어려운 동작은 사전 확인)
 *
 * ⚠️ '삭제' 라고 쓰지 않는다. 실제로 지워지는 데이터가 없기 때문이다.
 *    모임·여행 데이터는 그대로 있고 현재 사용자의 목록에서만 숨겨진다.
 *
 * 프로젝트에 BottomSheet / Dialog 공통 컴포넌트가 없어 react-native 기본 Modal 로
 * 최소 구현했다. GroupRenameModal 과 같은 패턴이다. 새 라이브러리를 넣지 않는다.
 */
export function RemoveConfirmModal({ visible, count, saving, onCancel, onConfirm }: Props) {
  const title =
    count > 1
      ? `선택한 ${count}개의 모임을 목록에서 제거할까요?`
      : '내 모임 목록에서 제거할까요?';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-8" onPress={onCancel}>
        <Pressable className="w-full rounded-2xl bg-white p-5" onPress={() => {}}>
          <Text className="text-lg font-bold leading-7 text-gray-900">{title}</Text>

          <Text className="mt-3 text-sm leading-5 text-gray-500">
            이 모임은 목록에서 숨겨집니다.{'\n'}
            모임과 여행 데이터는 삭제되지 않으며,{'\n'}
            편집 &gt; 숨긴 모임에서 다시 표시할 수 있습니다.
          </Text>

          <View className="mt-5 flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={onCancel} disabled={saving} />
            </View>
            <View className="flex-1">
              <Button label="목록에서 제거" onPress={onConfirm} loading={saving} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
