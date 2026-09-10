// ============================================================================
// CXL-01 취소 사유 — 바텀시트
//
// 취소 흐름의 첫 화면이다. 두 가지를 한다.
//   1. **취소하지 않아도 되는 길을 먼저 보여준다** (구제 카드)
//   2. 사유를 선택 입력으로 받는다
//
// ⚠️ 구제 카드는 PLANNING · TRAVELING 에서만 그린다. ENDED 는 /edit 이 차단이라
//    누르면 갈 곳이 없다. (스펙 §7)
//
// ⚠️ 사유는 **선택**이다. 안 고르고도 진행된다. (POL-CXL-027)
//    모임 여행이면 **멤버에게 공개된다는 사실을 미리 알린다.** (POL-CXL-028)
//    동의 절차가 생기면서 멤버가 판단할 근거가 필요해졌기 때문이다.
//
// ⚠️ 취소 요청은 **여행장 전용이 아니다.** ACTIVE 멤버 누구나 한다. (POL-CXL-060)
//    이 시트에 권한 분기가 없는 이유다.
//
// ⚠️ 사유 항목을 늘리지 않는다. (types.ts 참조)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet, Button } from "@/components/ui";

import {
  CANCEL_REASON_LABEL,
  CANCEL_REASON_ORDER,
  type CancelReasonCode,
} from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;

  destination: string;
  /** 날짜가 지난 여행이면 문구가 통째로 바뀐다 */
  isEnded: boolean;
  /**
   * 동의를 받아야 하는 여행인가. 모임 여행이면 true.
   * 개인 여행은 동의 대상이 없어 바로 취소된다. (POL-CXL-066)
   */
  needsAgreement: boolean;
  /** 동의 대상 수 = ACTIVE 멤버 − 요청자 */
  voteTargetCount: number;

  /** 고른 사유. null 이면 안 골랐다 */
  reason: CancelReasonCode | null;
  /** 같은 걸 다시 누르면 해제한다 */
  onToggleReason: (code: CancelReasonCode) => void;

  /** 구제 카드. isEnded 면 그리지 않는다 */
  onEditDates: () => void;
  onEditHeadcount: () => void;

  onSubmit: () => void;
  submitting: boolean;
};

export function CancelReasonSheet({
  visible,
  onClose,
  destination,
  isEnded,
  needsAgreement,
  voteTargetCount,
  reason,
  onToggleReason,
  onEditDates,
  onEditHeadcount,
  onSubmit,
  submitting,
}: Props) {
  const title = isEnded
    ? `${destination} 여행, 안 다녀오셨나요?`
    : `${destination} 여행을 취소할까요?`;

  const lead = isEnded
    ? "안 간 여행으로 표시하면 결산하지 않아도 되고, 다음 여행 추천에도 반영되지 않아요."
    : needsAgreement
      ? `멤버 ${voteTargetCount}명이 모두 동의하면 취소돼요.`
      : "지금까지 준비한 예산과 여행 정보는 보관돼요.";

  const cta = isEnded
    ? needsAgreement
      ? "안 갔다고 요청하기"
      : "안 간 여행으로 표시하기"
    : needsAgreement
      ? "취소 요청하기"
      : "여행 취소하기";

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      description={lead}
      footer={
        <View style={{ gap: 8 }}>
          <Button label={cta} variant="danger" loading={submitting} onPress={onSubmit} />
          <Button label="계속 준비할게요" variant="ghost" disabled={submitting} onPress={onClose} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 18 }}>
        {/*
          구제 카드 — 취소하지 않아도 되는 길을 먼저 보여준다.
          ⚠️ 누르면 시트를 닫고 이동한다. 돌아올 때 다시 열지 않는다. (스펙 §7)
        */}
        {!isEnded ? (
          <View className="overflow-hidden rounded-xl bg-gray-100">
            <Text
              style={{
                paddingHorizontal: 15,
                paddingTop: 13,
                paddingBottom: 2,
                fontSize: 12.5,
                fontWeight: "600",
                color: "#4B5563",
              }}
            >
              이런 경우라면 취소하지 않아도 돼요
            </Text>
            <RescueItem
              icon="calendar-outline"
              title="일정이 안 맞나요?"
              body="날짜만 바꿀 수 있어요"
              disabled={submitting}
              onPress={onEditDates}
              first
            />
            <RescueItem
              icon="people-outline"
              title="인원이 바뀌었나요?"
              body="인원만 바꿀 수 있어요"
              disabled={submitting}
              onPress={onEditHeadcount}
            />
          </View>
        ) : null}

        {/* 사유 — 선택 입력 */}
        <View>
          <View className="flex-row items-baseline" style={{ gap: 5 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#111827" }}>
              왜 취소하시나요?
            </Text>
            <Text style={{ fontSize: 12, color: "#8B94A2" }}>선택</Text>
          </View>

          {/*
            ⚠️ 모임 여행일 때만 공개 고지를 붙인다. 개인 여행은 볼 사람이 없다.
               고지 없이 공개하면 사용자가 속았다고 느낀다. (POL-CXL-028)
          */}
          {needsAgreement ? (
            <Text style={{ marginTop: 5, fontSize: 12, lineHeight: 19, color: "#8B94A2" }}>
              선택한 사유는 멤버들에게 함께 보여요. 알리고 싶지 않으면 고르지 않아도 돼요.
            </Text>
          ) : null}

          <View style={{ marginTop: 11 }}>
            {CANCEL_REASON_ORDER.map((code, index) => {
              const on = reason === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: submitting }}
                  accessibilityLabel={CANCEL_REASON_LABEL[code]}
                  disabled={submitting}
                  onPress={() => onToggleReason(code)}
                  className="flex-row items-center active:opacity-70"
                  style={{
                    gap: 10,
                    paddingVertical: 13,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: "#EDEFF2",
                    opacity: submitting ? 0.4 : 1,
                  }}
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                      on ? "border-blue-600" : "border-gray-300"
                    }`}
                  >
                    {on ? <View className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14.5,
                      fontWeight: on ? "600" : "400",
                      color: "#111827",
                    }}
                  >
                    {CANCEL_REASON_LABEL[code]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

function RescueItem({
  icon,
  title,
  body,
  disabled,
  onPress,
  first = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
  disabled: boolean;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        gap: 11,
        paddingHorizontal: 15,
        paddingVertical: 13,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "#E6E9ED",
      }}
    >
      <Ionicons name={icon} size={17} color="#4B5563" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>{title}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: "#8B94A2" }}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color="#8B94A2" />
    </Pressable>
  );
}
