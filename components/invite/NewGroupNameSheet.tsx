// ============================================================================
// INV-05 새 모임 이름 정하기 — 바텀시트 (승인 시점)
//
// 여행장이 '수락하기' 를 눌렀는데 서버가 NEW_GROUP_NAME_REQUIRED 를 돌려줄 때만 나온다
// (CASE C: 모임 밖 사람 + 모임에 다른 여행 있음 · CASE D: 개인 여행). (docs/12 §7 · 2026-09-14)
//
// ⚠️ 이 시트의 CTA = **이 이름으로 수락**. accept_trip_join_request(requestId, name) 을 다시
//    부르고, 서버가 한 트랜잭션에서 모임 생성 · 멤버 · 여행 이동 · 수락을 함께 한다.
//    초대를 보낼 때 이름을 받던 예전 흐름(pending_group_name)은 폐기됐다.
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

  /** 지금 모임 이름. 개인 여행이면 null — 도식 왼쪽이 '개인 여행' 이 된다 */
  fromGroupName: string | null;
  destination: string;

  groupName: string;
  onChangeGroupName: (value: string) => void;
  groupNameError: string | null;
  onBlurGroupName: () => void;

  /** 추천 이름. 없으면 칩을 그리지 않는다 */
  suggestions?: string[];
  onPickSuggestion?: (value: string) => void;

  onSubmit: () => void;
  submitting: boolean;
};

export function NewGroupNameSheet({
  visible,
  onClose,
  fromGroupName,
  destination,
  groupName,
  onChangeGroupName,
  groupNameError,
  onBlurGroupName,
  suggestions = [],
  onPickSuggestion,
  onSubmit,
  submitting,
}: Props) {
  const fromLabel = fromGroupName ?? "개인 여행";
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="새 모임 이름을 정해주세요"
      description={`수락하면 ${destination} 여행을 함께할 새 모임이 만들어져요.`}
      footer={
        <Button
          label="이 이름으로 수락하기"
          loading={submitting}
          disabled={groupName.trim().length === 0}
          onPress={onSubmit}
        />
      }
    >
      <View style={{ paddingBottom: 8, gap: 14 }}>
        {/* 이동 도식 — 무엇이 어디로 가는지 그림으로 먼저 보여준다 */}
        <View className="rounded-xl bg-gray-100 p-3.5">
          <View className="flex-row items-center gap-2.5">
            <View className="flex-1 rounded-lg bg-white px-2.5 py-2.5">
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
                {fromLabel}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 11.5, color: "#8B94A2" }}>
                {fromGroupName ? "다른 여행과 멤버는 그대로" : "모임 여행이 돼요"}
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
            {fromGroupName ? ` 지난 여행 기록은 ${fromGroupName}에 남아요.` : ""}
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
              onPress={() => onPickSuggestion?.(suggestion)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 active:opacity-70"
            >
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: "#4B5563" }}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
          수락과 동시에 모임이 만들어지고 상대가 여행에 참여해요. 지금 닫으면 수락 대기 상태로 남아요.
        </Text>
      </View>
    </BottomSheet>
  );
}
