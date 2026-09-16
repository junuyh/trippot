// ============================================================================
// 여행을 만든 뒤 처음 여행 홈에 들어왔을 때 한 번 뜨는 초대 권유 모달
//
// 여행 만들기에서 동행자 이름을 미리 받지 않게 되면서(2026-09-16) 새로 만든
// 여행에는 나 혼자만 있다. 그대로 두면 사용자가 초대하는 길을 못 찾는다.
// 초대 진입점이 '여행 정보 수정' 맨 아래 하나뿐이기 때문이다.
//
// ⚠️ **한 번만 뜬다.** 매번 뜨면 여행 홈에 들어올 때마다 막힌다.
//    띄웠다는 기록은 lib/invite/inviteNudge 가 기기에 남긴다.
//
// ⚠️ 닫아도 초대할 길은 남는다. '여행 정보 수정 > 여행 멤버 초대하기' 가 상시
//    열려 있다. (여행 홈 상단 배너는 담당자와 상의 후 별도 작업 · 2026-09-16)
//
// ⚠️ 여기서 **다른 시트를 열지 않는다.** 복사까지 이 모달 안에서 끝낸다.
//    닫는 중에 새 Modal 을 띄우면 iOS 가 조용히 무시한다. 이번 프로젝트에서
//    CXL-01 구제 카드가 같은 이유로 안 눌렸다. (2026-09-15)
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { InviteArt } from "@/components/trip-edit/inviteArt";

type Props = {
  visible: boolean;
  /** "{여행지} 여행" 같은 이름. 문구에 쓴다 */
  tripLabel: string;
  /** 링크를 만들고 복사하는 중 */
  copying: boolean;
  /** 복사에 성공했다. 버튼 문구가 바뀐다 */
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
};

export function InviteNudgeModal({
  visible,
  tripLabel,
  copying,
  copied,
  onCopy,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* ⚠️ 바깥을 눌러도 닫힌다. 답을 강요하지 않는다 — 초대는 나중에도 할 수 있다 */}
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={copying ? undefined : onClose}
        accessibilityLabel="닫기"
      >
        {/* 카드 안을 눌렀을 때 바깥 닫기로 번지지 않게 한 번 받는다 */}
        <Pressable className="w-full max-w-sm rounded-3xl bg-white px-6 pb-5 pt-6" onPress={() => {}}>
          {/*
            ⚠️ 닫는 길이 이미 둘(나중에 할게요 · 바깥 탭)인데도 X 를 둔다.
               바깥 탭은 모르는 사람이 많고, '나중에 할게요' 는 거절처럼 읽혀서
               그냥 닫고 싶은 사람에게 부담이 된다. (2026-09-16 다빈)
            ⚠️ 복사 중에는 막는다. 링크를 만드는 사이에 닫히면 복사가 끊긴다.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            disabled={copying}
            onPress={onClose}
            hitSlop={10}
            className={copying ? "" : "active:opacity-70"}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 1,
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f1f3f7",
              opacity: copying ? 0.4 : 1,
            }}
          >
            <Ionicons name="close" size={17} color="#6b7684" />
          </Pressable>

          <View className="items-center">
            {/* ⚠️ '여행 정보 수정' 의 초대 카드와 **같은 그림**을 쓴다. 초대를 권하는
                   자리가 둘인데 그림이 다르면 다른 기능으로 읽힌다. (2026-09-16) */}
            <InviteArt width={150} height={120} style={{ marginTop: -6 }} />

            {/* ⚠️ 크기·색은 components/home/InviteModal 과 맞춘다. 같은 앱에서
                   같은 성격의 모달이 다르게 생기지 않게. (2026-09-16 다빈) */}
            <Text className="mt-4 text-center text-lg font-bold text-pot-ink">
              함께 갈 사람을{"\n"}초대해 볼까요?
            </Text>
            <Text className="mt-1.5 text-center text-sm leading-5 text-pot-mute">
              링크를 보내면 상대가 참여를 요청하고,{"\n"}
              회원님이 수락하면 같이 준비해요.
            </Text>

            {/*
              ⚠️ 상황 설명은 회색 박스 하나에 모은다. InviteModal 이 초대한 사람·
                 여행지·날짜를 같은 방식으로 담는다.
              ⚠️ 버튼 **아래에는 아무것도 두지 않는다.** 행동을 고르고 난 자리에
                 글이 더 있으면 다 읽고도 끝난 느낌이 안 난다. (2026-09-16 다빈)
            */}
            <View className="mt-5 w-full rounded-2xl bg-pot-visual px-4 py-3.5">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name="calendar-outline" size={13} color="#747B88" />
                <Text className="flex-1 text-[12.5px] text-pot-mute">
                  {tripLabel} · 링크는 7일간 쓸 수 있어요
                </Text>
              </View>
              <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name="create-outline" size={13} color="#747B88" />
                <Text className="flex-1 text-[12.5px] text-pot-mute">
                  여행 정보 수정에서 언제든 초대할 수 있어요
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-5" style={{ gap: 6 }}>
            <Button
              label={copied ? "복사했어요" : "초대 링크 복사"}
              loading={copying}
              onPress={onCopy}
            />
            <Button label="나중에 할게요" variant="ghost" disabled={copying} onPress={onClose} />
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}
