// ============================================================================
// 초대 링크 조각 — 시트와 모달이 함께 쓴다 (2026-09-16)
//
// 초대를 권하는 자리가 둘인데, 링크 상자와 보내기 버튼이 각자 있으면 링크 문구나
// 기한 안내가 갈라진다. 한 벌만 두고 둘이 부른다.
//
//   InviteLinkSheet      BottomSheet 의 본문/푸터 슬롯에 나눠 넣는다
//   InviteNudgeModal     일러스트 아래에 위아래로 쌓는다
//
// ⚠️ 두 조각으로 나눈 이유는 **넣는 자리가 다르기 때문**이다. 시트는 보내기
//    버튼이 푸터에 고정되고, 모달은 본문에 이어 붙는다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

/**
 * 링크 상자 + 기한·인원 안내.
 *
 * ⚠️ 고른 사람이 없어도 링크는 언제나 복사할 수 있다.
 */
export function InviteLinkBox({
  inviteUrl,
  copied,
  onCopyLink,
  headcount,
}: {
  inviteUrl: string;
  copied: boolean;
  onCopyLink: () => void;
  /** 예정 인원. 그 인원까지만 수락된다는 안내에 쓴다 */
  headcount: number;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View className="flex-row items-center gap-2 rounded-xl bg-gray-100 px-3.5 py-3">
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: "#4B5563" }}>
          {inviteUrl}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="초대 링크 복사"
          onPress={onCopyLink}
          className="rounded-lg bg-white px-2.5 py-1.5 active:opacity-70"
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#4B5563" }}>
            {copied ? "복사됨" : "복사"}
          </Text>
        </Pressable>
      </View>

      {/* ⚠️ 두 줄로 나눈다. 한 줄로 두면 모달(시트보다 좁다)에서 '요' 한 글자만
             다음 줄로 넘어간다. (2026-09-16 다빈) */}
      <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
        링크는 7일간 쓸 수 있어요{"\n"}
        {headcount}명 예정이라 그 인원까지만 수락돼요
      </Text>
    </View>
  );
}

/**
 * 초대 링크 보내기. OS 공유 시트를 연다.
 *
 * ⚠️ 카카오 talk_message API 를 붙이지 않는다. 노란색은 '카카오로 보낸다' 가
 *    아니라 이 앱에서 **보내는 행동**을 뜻한다. (docs/10 §13)
 */
export function InviteSendButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const on = !disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="초대 링크 보내기"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl active:opacity-90"
      style={{ backgroundColor: on ? "#FEE500" : "#E5E8EB" }}
    >
      <Ionicons name="chatbubble" size={16} color={on ? "#191919" : "#B0B8C1"} />
      <Text style={{ fontSize: 14, fontWeight: "800", color: on ? "#191919" : "#B0B8C1" }}>
        초대 링크 보내기
      </Text>
    </Pressable>
  );
}
