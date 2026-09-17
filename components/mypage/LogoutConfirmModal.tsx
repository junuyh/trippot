import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 로그아웃 확인창.
 *
 * ⚠️ Alert.alert 를 쓰지 않는다.
 *    react-native-web 의 Alert 는 `static alert() {}` — **내용이 비어 있는 함수**다.
 *    (node_modules/react-native-web/dist/exports/Alert/index.js)
 *    그래서 웹에서는 눌러도 아무 일도 일어나지 않고, 에러조차 나지 않는다.
 *
 *    Modal 은 react-native-web 이 제대로 구현하고 있어 iOS·Web 이 똑같이 동작한다.
 *    platform 분기 없이 한 벌로 끝난다.
 *
 * 모양은 components/groups/RemoveConfirmModal 과 같은 패턴이다.
 * (transparent Modal + 어두운 배경 + 취소/확인 두 버튼) 새 라이브러리를 넣지 않는다.
 */
export function LogoutConfirmModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* 바깥을 누르면 닫힌다. 안쪽 Pressable 이 이벤트를 막는다. */}
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-8" onPress={onCancel}>
        <Pressable className="w-full rounded-2xl bg-white p-5" onPress={() => {}}>
          <Text className="text-lg font-bold leading-7 text-pot-ink">로그아웃 할까요?</Text>

          <View className="mt-5 flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={onCancel} />
            </View>
            <View className="flex-1">
              <Button label="로그아웃" variant="brand" onPress={onConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
