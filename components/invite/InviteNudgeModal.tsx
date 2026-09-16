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
          <View className="items-center">
            {/* ⚠️ '여행 정보 수정' 의 초대 카드와 **같은 그림**을 쓴다. 초대를 권하는
                   자리가 둘인데 그림이 다르면 다른 기능으로 읽힌다. (2026-09-16) */}
            <InviteArt width={150} height={120} style={{ marginTop: -6 }} />

            <Text
              style={{
                marginTop: 14,
                fontSize: 20,
                fontWeight: "800",
                lineHeight: 27,
                color: "#111827",
                textAlign: "center",
              }}
            >
              함께 갈 사람을{"\n"}초대해 볼까요?
            </Text>

            <Text
              style={{
                marginTop: 10,
                fontSize: 13.5,
                lineHeight: 22,
                color: "#4B5563",
                textAlign: "center",
              }}
            >
              링크를 보내면 상대가 참여를 요청하고,{"\n"}
              회원님이 수락하면 같이 준비해요.
            </Text>

            {/* 여행 이름과 기한은 한 덩어리로 묶어 칩에 넣는다. 본문과 같은 회색
                글줄로 흘리면 읽히지 않고 지나간다 */}
            <View
              className="flex-row items-center"
              style={{
                marginTop: 14,
                gap: 6,
                borderRadius: 999,
                backgroundColor: "#f1f3f7",
                paddingHorizontal: 13,
                paddingVertical: 8,
              }}
            >
              <Ionicons name="calendar-outline" size={13} color="#6b7684" />
              <Text style={{ fontSize: 12, color: "#4B5563" }}>
                {tripLabel} · 링크는 7일간 쓸 수 있어요
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 22, gap: 6 }}>
            <Button
              label={copied ? "복사했어요" : "초대 링크 복사"}
              loading={copying}
              onPress={onCopy}
            />
            <Button label="나중에 할게요" variant="ghost" disabled={copying} onPress={onClose} />
          </View>

          {/* 닫아도 길이 남는다는 것을 알린다. 안 알리면 지금 안 하면 못 하는 줄 안다 */}
          <Text
            style={{
              marginTop: 8,
              fontSize: 11.5,
              lineHeight: 18,
              color: "#8B94A2",
              textAlign: "center",
            }}
          >
            여행 정보 수정에서 언제든 초대할 수 있어요.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
