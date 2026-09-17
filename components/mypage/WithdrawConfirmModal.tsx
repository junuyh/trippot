import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  visible: boolean;
  /** 탈퇴 처리 중. 두 번 눌리지 않게 막는다. */
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 회원탈퇴 확인창.
 *
 * ⚠️ Alert.alert 를 쓰지 않는다. react-native-web 의 Alert 는 내용이 빈 함수라
 *    웹에서는 눌러도 아무 일이 없다. (components/mypage/LogoutConfirmModal 참고)
 *
 * ⚠️ 로그아웃 확인창과 다른 점은 두 가지다.
 *    1. 무슨 일이 일어나는지 한 줄 설명한다. 로그아웃은 되돌릴 수 있지만
 *       탈퇴는 사용자가 결과를 예상하기 어렵다.
 *    2. 확인 버튼이 danger 다. 실수로 누르는 자리가 아니라는 표시다.
 */
export function WithdrawConfirmModal({ visible, busy, onCancel, onConfirm }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 처리 중에는 뒤로 제스처로 닫히지 않게 한다.
      onRequestClose={busy ? () => {} : onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-8"
        onPress={busy ? () => {} : onCancel}
      >
        <Pressable className="w-full rounded-2xl bg-white p-5" onPress={() => {}}>
          <Text className="text-lg font-bold leading-7 text-pot-ink">정말 탈퇴할까요?</Text>

          {/*
            ⚠️ 지키지 못할 약속을 쓰지 않는다. 여행·모임 기록은 실제로 지우지
               않는다. 같이 여행한 다른 사람의 기록까지 깨지기 때문이다.
               "모든 정보가 삭제됩니다" 라고 쓰면 사실이 아니다.
          */}
          <Text className="mt-2 text-pot-mute" style={{ fontSize: 13, lineHeight: 20 }}>
            회원 탈퇴를 신청하면 30일 후 탈퇴가 완료됩니다.{'\n'}
            30일 이내에는 탈퇴를 취소할 수 있습니다.{'\n\n'}
            회원정보는 최종 탈퇴 후 삭제되지만,{'\n'}
            다른 멤버와 함께 만든 여행·납부·지출·정산 기록은 유지됩니다.
          </Text>

          <View className="mt-5 flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" disabled={busy} onPress={onCancel} />
            </View>
            <View className="flex-1">
              <Button label="탈퇴" variant="danger" loading={busy} onPress={onConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
