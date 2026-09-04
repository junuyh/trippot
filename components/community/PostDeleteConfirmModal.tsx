import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** 지우는 중. 두 번 눌러 두 번 지우는 일을 막는다. */
  deleting: boolean;
  /** 실패했을 때 창 안에 그대로 보여준다. 창을 닫고 나서 알리면 무엇이 실패했는지 흐려진다. */
  error: string | null;
};

/**
 * 글 삭제 확인창. (COMM-02)
 *
 * ⚠️ Alert.alert 를 쓰지 않는다.
 *    react-native-web 의 Alert 는 `static alert() {}` — **내용이 비어 있는 함수**다.
 *    (node_modules/react-native-web/dist/exports/Alert/index.js)
 *    웹에서는 눌러도 아무 일이 없고 에러조차 나지 않는다. 실제로 이 화면에서
 *    "삭제 버튼을 눌러도 안 지워진다" 는 증상이 여기서 나왔다.
 *
 *    Modal 은 react-native-web 이 제대로 구현하고 있어 iOS·Web 이 똑같이 동작한다.
 *    (components/mypage/LogoutConfirmModal 과 같은 판단)
 *
 * ⚠️ 삭제는 되돌릴 수 없다. 그래서 확인을 한 번 받는다. (CLAUDE.md 9장)
 *    확인 버튼은 빨간색이고, 기본 위치(오른쪽)에 둔다.
 */
export function PostDeleteConfirmModal({ visible, onCancel, onConfirm, deleting, error }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 지우는 중에는 뒤로 가기로 창을 닫지 않는다. 요청은 이미 나갔다.
      onRequestClose={deleting ? () => {} : onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-8"
        onPress={deleting ? undefined : onCancel}
      >
        {/* 안쪽을 눌렀을 때 창이 닫히지 않게 이벤트를 막는다. */}
        <Pressable className="w-full rounded-2xl bg-white p-5" onPress={() => {}}>
          <Text className="text-lg font-bold leading-7 text-pot-ink">글을 지울까요?</Text>
          <Text className="mt-2 text-pot-mute" style={{ fontSize: 13, lineHeight: 19 }}>
            지운 글은 되돌릴 수 없어요.{'\n'}달린 댓글도 함께 보이지 않게 됩니다.
          </Text>

          {error ? (
            <Text className="mt-3 text-red-500" style={{ fontSize: 12.5, lineHeight: 18 }}>
              {error}
            </Text>
          ) : null}

          <View className="mt-5 flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={onCancel} disabled={deleting} />
            </View>
            <View className="flex-1">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: deleting, busy: deleting }}
                disabled={deleting}
                onPress={onConfirm}
                className="w-full flex-row items-center justify-center rounded-xl px-5 py-3.5 active:opacity-80"
                style={{ backgroundColor: '#EF4444', opacity: deleting ? 0.5 : 1 }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">삭제</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
