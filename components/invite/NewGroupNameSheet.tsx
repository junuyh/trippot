// ============================================================================
// INV-05 새 모임 이름 정하기 — 바텀시트
//
// 모임 밖 사람이 합류하는데 그 모임에 결산 이력이 있을 때만 나온다.
//
// ⚠️⚠️ 이 시트의 CTA 를 눌러도 **모임을 만들지 않는다.** ⚠️⚠️
//       trips.pending_group_name 에 저장만 하고 링크를 보낸다. 실제 생성·이동은
//       상대가 수락할 때 acceptRequest() 안에서 일어난다. (POL-INV-035)
//
//       초대 발송 시점에 옮기면, 상대가 거절하거나 응답하지 않을 때 여행이
//       새 모임에 혼자 남는다. 이전 모임과의 연결은 끊겼는데 새 멤버는
//       들어오지 않은 상태다.
//
// ⚠️ 여행에 연결한 계좌는 묻지 않는다. 계좌는 여행 소유라 여행을 그대로
//    따라간다. (전제 ⑤ · POL-INV-034)
// ============================================================================
import { Pressable, Text, View } from "react-native";

import { BottomSheet, Button, Input } from "@/components/ui";

const MAX_NAME = 20;

type Props = {
  visible: boolean;
  onClose: () => void;

  /** 이전 모임 이름. 이동 도식 왼쪽 */
  fromGroupName: string;
  destination: string;
  /** 이전 모임에 남는 지난 여행을 한 줄로. 예) "대만 여행만 남아요" */
  remainingLabel: string;

  groupName: string;
  onChangeGroupName: (value: string) => void;
  groupNameError: string | null;
  onBlurGroupName: () => void;

  /** 추천 이름 3개 */
  suggestions: string[];
  onPickSuggestion: (value: string) => void;

  onSubmit: () => void;
  submitting: boolean;
};

export function NewGroupNameSheet({
  visible,
  onClose,
  fromGroupName,
  destination,
  remainingLabel,
  groupName,
  onChangeGroupName,
  groupNameError,
  onBlurGroupName,
  suggestions,
  onPickSuggestion,
  onSubmit,
  submitting,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="새 모임 이름을 정해주세요"
      description={`${destination} 여행을 함께할 새 모임이 만들어져요.`}
      footer={
        <Button
          label="이 이름으로 만들기"
          loading={submitting}
          disabled={groupName.trim().length === 0}
          onPress={onSubmit}
        />
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
        {/* 이동 도식 — 무엇이 어디로 가는지 그림으로 먼저 보여준다 */}
        <View className="rounded-xl bg-gray-100 p-3.5">
          <View className="flex-row items-center gap-2.5">
            <View className="flex-1 rounded-lg bg-white px-2.5 py-2.5">
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
                {fromGroupName}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 11.5, color: "#8B94A2" }}>
                {remainingLabel}
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: "#8B94A2" }}>→</Text>
            <View className="flex-1 rounded-lg bg-white px-2.5 py-2.5">
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>새 모임</Text>
              <Text style={{ marginTop: 2, fontSize: 11.5, color: "#8B94A2" }}>
                {destination} 여행이 옮겨져요
              </Text>
            </View>
          </View>
          <Text style={{ marginTop: 11, fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
            {destination} 여행에 연결한 계좌와 모은 돈, 지출 기록은 여행을 그대로 따라가요.
            지난 여행 기록은 {fromGroupName}에 남아요.
          </Text>
        </View>

        <View>
          <Input
            label="모임 이름"
            required
            value={groupName}
            onChangeText={onChangeGroupName}
            onBlur={onBlurGroupName}
            placeholder={`예) ${destination} 가는 사람들`}
            error={groupNameError}
            editable={!submitting}
            maxLength={MAX_NAME}
            returnKeyType="done"
          />
          <Text style={{ marginTop: 6, fontSize: 11, color: "#8B94A2", textAlign: "right" }}>
            {groupName.length}/{MAX_NAME}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              accessibilityLabel={suggestion}
              disabled={submitting}
              onPress={() => onPickSuggestion(suggestion)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 active:opacity-70"
            >
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: "#4B5563" }}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>

        {/*
          ⚠️ 이 문장을 빼지 말 것. 누르면 모임이 바로 생긴다고 읽히면,
             수락 전에 모임 목록을 열어보고 없다고 오류로 신고한다.
        */}
        <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
          모임은 상대가 참여를 수락할 때 만들어져요. 아무도 수락하지 않으면 지금 모임 그대로예요.
        </Text>
      </View>
    </BottomSheet>
  );
}
