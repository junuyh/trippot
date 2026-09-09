// ============================================================================
// 여행 멤버 초대 시트 (TRIP-02 여행 정보 수정)
//
// 선택한 모임에 **지난 여행이 없을 때만** 열린다. 지난 여행이 있는 모임은
// 이미 사람이 모인 모임이라, 새 사람은 새 모임으로 초대한다. (화면이 판단)
//
//   카카오톡으로 초대하기   초대 문구 + 링크를 공유 시트로 보낸다
//   초대 링크 복사          같은 문구 + 링크를 클립보드에 (링크만 달랑 보내면
//                          받는 쪽이 뭔지 모른다. 2026-09-09 링크 미리보기 상자는 뺐다)
//
// ⚠️ [검토 필요] "카카오톡으로" 는 OS 공유 시트를 연다. 카카오톡이 깔려 있으면
//    거기서 고른다. 카카오톡 대화방 선택 화면으로 바로 들어가려면 카카오 SDK
//    네이티브 모듈이 필요해 Expo Go 에서는 못 쓴다. (dev build 로 갈 때 붙인다)
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 공유·복사도 화면이
//    한다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui";

type Props = {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  onShareKakao: () => void;
  onCopyLink: () => void;
  /** 방금 복사했으면 true. 버튼 문구가 바뀐다 */
  copied: boolean;
};

export function InviteMembersSheet({
  visible,
  onClose,
  groupName,
  onShareKakao,
  onCopyLink,
  copied,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="여행 멤버 초대하기"
      description={`${groupName} 모임으로 초대해요. 링크를 받은 사람은 모임에 들어와 이 여행을 함께 준비해요.`}
    >
      <View style={{ gap: 10, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="카카오톡으로 초대하기"
          onPress={onShareKakao}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl active:opacity-90"
          style={{ backgroundColor: "#FEE500" }}
        >
          <Ionicons name="chatbubble" size={16} color="#191919" />
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#191919" }}>카카오톡으로 초대하기</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="초대 링크 복사"
          onPress={onCopyLink}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white active:bg-gray-50"
        >
          <Ionicons name={copied ? "checkmark" : "link-outline"} size={16} color="#111827" />
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
            {copied ? "복사했어요" : "초대 링크 복사"}
          </Text>
        </Pressable>

        <Text style={{ fontSize: 11, lineHeight: 16, color: "#98a1ad", textAlign: "center", marginTop: 2 }}>
          복사하면 초대 문구와 링크가 함께 들어가요. 카톡·문자 어디든 붙여 넣으면 돼요.
        </Text>
      </View>
    </BottomSheet>
  );
}
