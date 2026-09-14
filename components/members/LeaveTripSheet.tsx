// ============================================================================
// MEM-01 여행에서 나가기 — 바텀시트
//
// canLeaveTrip() 결과에 따라 셋으로 갈린다.
//
//   member         모임에서도 나갈지 함께 묻는다 → [나가기]
//   needsDelegate  여행장이고 남은 멤버가 있다   → [여행장 넘기기] → MEM-02
//   leaderAlone     여행장인데 혼자다             → 나갈 수 없다. 초대 또는 취소
//
// ⚠️ 개인 몫 정산 금액을 **계산하지 않는다.** CONTRIB-01 이 뼈대라 멤버별
//    납부액을 알 수 없다. 모르는 값을 그럴듯하게 보여주면 그 금액으로 정산한다.
//    연결 계좌면 총 잔액만 알리고 직접 정산을 안내한다. (POL-MEM-006)
//
// ⚠️ 거래·납부 기록은 지우지 않는다. 나가기는 status = LEFT 다. (POL-MEM-005)
//    화면에서 "기록이 삭제돼요" 같은 말을 쓰지 않는다.
// ============================================================================
import { Pressable, Text, View } from "react-native";

import { BranchNotice } from "@/components/invite";
import { BottomSheet, Button } from "@/components/ui";

import type { LeaveMode } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * 시트가 **완전히 내려간 뒤**(iOS). 다음 시트를 이어서 열 때 쓴다.
   *
   * ⚠️ 닫는 중에 새 Modal 을 띄우면 iOS 가 조용히 무시하고, 보이지 않는 Modal 이
   *    화면 전체의 터치를 삼킨다. 타이머로 어림잡지 말고 이 신호를 쓴다.
   */
  onDismiss?: () => void;

  mode: LeaveMode;
  destination: string;
  /** 모임 이름. 모임 이탈 선택지 문구에 쓴다 */
  groupName: string;

  /** 모임에서도 나갈지. null 이면 아직 안 골랐다 */
  alsoLeaveGroup: boolean | null;
  onChangeAlsoLeaveGroup: (value: boolean) => void;

  /**
   * 연결 계좌의 현재 총 잔액. 없으면 null.
   * ⚠️ 이건 **총액**이다. 내 몫이 아니다. 문구도 그렇게 쓴다.
   */
  fundBalanceLabel: string | null;

  onLeave: () => void;
  /** needsDelegate 일 때 MEM-02 로 */
  onOpenDelegate: () => void;
  /** leaderAlone 일 때 */
  onInvite: () => void;
  onCancelTrip: () => void;

  leaving: boolean;
};

export function LeaveTripSheet({
  visible,
  onClose,
  onDismiss,
  mode,
  destination,
  groupName,
  alsoLeaveGroup,
  onChangeAlsoLeaveGroup,
  fundBalanceLabel,
  onLeave,
  onOpenDelegate,
  onInvite,
  onCancelTrip,
  leaving,
}: Props) {
  /*
    ⚠️ 막히는 두 갈래를 함께 그린다. 이유가 다르고 문구도 다르지만, 나갈 길은
       '초대' 와 '취소' 로 같다. **안내만 하고 끝내지 않는다** — 여기서 길을
       안 주면 사용자는 할 수 있는 게 없다. (다빈 지시 2026-09-14)
  */
  if (mode === "leaderAlone" || mode === "lastMember") {
    const leader = mode === "leaderAlone";
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        onDismiss={onDismiss}
        title="지금은 나갈 수 없어요"
        description={
          leader
            ? "여행장을 넘겨줄 멤버가 없어요."
            : `${destination} 여행에 남는 사람이 없어요.`
        }
        footer={
          <View style={{ gap: 8 }}>
            <Button label="멤버 초대하기" onPress={onInvite} />
            {/* ⚠️ 바로 취소하지 않는다. CXL-01(사유) → CXL-03(확인)을 거친다 */}
            <Button label="여행 취소하기" variant="ghost" onPress={onCancelTrip} />
          </View>
        }
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <BranchNotice
            tone="warn"
            title={
              leader
                ? "이 여행에 참여한 사람이 나뿐이에요"
                : "나가면 아무도 없는 여행이 남아요"
            }
            body={
              leader
                ? "멤버를 초대해 여행장을 넘긴 뒤 나가거나, 여행을 취소해 주세요."
                : "남는 사람이 없으면 취소도 결산도 할 수 없어요. 멤버를 초대하거나, 여행을 취소해 주세요."
            }
          />
        </View>
      </BottomSheet>
    );
  }

  if (mode === "needsDelegate") {
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        onDismiss={onDismiss}
        title="여행장을 넘기고 나가야 해요"
        description={`${destination} 여행을 이어서 준비할 사람이 필요해요.`}
        footer={<Button label="여행장 넘기기" onPress={onOpenDelegate} />}
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <BranchNotice
            tone="info"
            title="여행장이 하는 일"
            body="멤버 초대와 참여 요청 수락, 여행 정보와 예산 수정이요. 넘긴 뒤에는 되돌릴 수 없어요."
          />
        </View>
      </BottomSheet>
    );
  }

  // 일반 멤버
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      title={`${destination} 여행에서 나가시나요?`}
      description="함께하는 사람들에게 알림이 가요."
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="나가기"
            variant="danger"
            loading={leaving}
            disabled={alsoLeaveGroup === null}
            onPress={onLeave}
          />
          <Button label="계속 함께할게요" variant="ghost" disabled={leaving} onPress={onClose} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <LeaveChoice
            selected={alsoLeaveGroup === false}
            disabled={leaving}
            title="이 여행에서만 나가기"
            body={`${groupName} 멤버로 남아서 다음 여행에 초대받을 수 있어요`}
            onPress={() => onChangeAlsoLeaveGroup(false)}
          />
          <LeaveChoice
            selected={alsoLeaveGroup === true}
            disabled={leaving}
            title="모임에서도 나가기"
            body="다음 여행 초대를 받지 않아요"
            onPress={() => onChangeAlsoLeaveGroup(true)}
          />
        </View>

        {/*
          ⚠️ "회원님 몫" 을 계산해 보여주지 않는다. 총 잔액만 말한다.
             멤버별 납부액을 모르기 때문이다. (POL-MEM-006)
        */}
        {fundBalanceLabel ? (
          <BranchNotice
            tone="warn"
            title={`지금 모인 돈이 ${fundBalanceLabel}이에요`}
            body="회원님 몫은 멤버들과 직접 정산해 주세요. TripPot은 돈을 옮기지 않아요."
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

function LeaveChoice({
  selected,
  disabled,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  disabled: boolean;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3 active:opacity-70 ${
        selected ? "border-blue-600 bg-white" : "border-gray-200 bg-white"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? "border-blue-600" : "border-gray-300"
        }`}
      >
        {selected ? <View className="h-2 w-2 rounded-full bg-blue-600" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-sm font-semibold text-gray-900">{title}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: "#8B94A2" }}>{body}</Text>
      </View>
    </Pressable>
  );
}
