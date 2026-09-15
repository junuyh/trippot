// ============================================================================
// MEM-02 여행장(Leader) 위임 후 나가기 — 바텀시트
//
// ⚠️ 위임은 **나가기 흐름 안에서만** 일어난다. 단독 위임 기능을 만들지 않는다.
//    (POL-INV-004) 그래서 CTA 가 '넘기기' 가 아니라 '넘기고 나가기' 다.
//    두 일이 한 번에 벌어진다는 걸 버튼 문구가 말해야 한다.
//
// ⚠️ 되돌릴 수 없다. (POL-INV-005) 고른 뒤에 그 사실을 다시 알린다.
//
// ⚠️ 여기서도 개인 몫을 계산하지 않는다. 총 잔액만 알린다. (POL-MEM-006)
// ============================================================================
import { Pressable, Text, View } from "react-native";

import { BranchNotice } from "@/components/invite";
import { BottomSheet, Button } from "@/components/ui";

import { LeaveChoice } from "./LeaveTripSheet";

import type { TripMemberItem } from "./types";

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

  /** 넘길 수 있는 사람. 나와 미가입 동행자는 화면 파일이 미리 걸러 넘긴다 */
  candidates: TripMemberItem[];
  selectedMemberId: string | null;
  onSelect: (memberId: string) => void;

  /** 연결 계좌의 총 잔액. 없으면 null */
  fundBalanceLabel: string | null;

  /**
   * 모임 이름. 아래 선택지 문구에 쓴다. 개인 여행이면 null 이고 선택지를 안 그린다.
   */
  groupName: string | null;
  /**
   * 모임에서도 나갈지. null 이면 아직 안 골랐다.
   *
   * ⚠️⚠️ **위임 경로에도 반드시 묻는다.** ⚠️⚠️
   *    한동안 위임은 '여행만 나간다' 로 고정돼 있었다. 그런데 이 앱에서
   *    **모임을 나가는 통로가 나가기 시트뿐이다.** 모임 상세에도 마이페이지에도
   *    모임 나가기가 없다. 그래서 여행장이 위임하고 나가면 모임에서 나갈
   *    방법이 영영 사라졌다. (2026-09-15 다빈 지적)
   */
  alsoLeaveGroup: boolean | null;
  onChangeAlsoLeaveGroup: (value: boolean) => void;

  onSubmit: () => void;
  submitting: boolean;
};

export function DelegateLeaderSheet({
  visible,
  onClose,
  onDismiss,
  candidates,
  selectedMemberId,
  onSelect,
  fundBalanceLabel,
  groupName,
  alsoLeaveGroup,
  onChangeAlsoLeaveGroup,
  onSubmit,
  submitting,
}: Props) {
  const picked = candidates.find((c) => c.memberId === selectedMemberId) ?? null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      title="누구에게 넘길까요?"
      /*
        ⚠️ 여행장이 하는 일을 여기서 말한다. MEM-01 의 needsDelegate 갈래를
           건너뛰고 이 시트가 바로 열리기 때문이다. (2026-09-14)
        ⚠️ 여행장만 하는 일은 **참여 요청 수락** 하나뿐이다. 초대와 예산 수정은
           멤버 누구나 한다. 크게 적으면 넘기는 사람이 겁을 먹는다.
      */
      description="여행장은 참여 요청을 수락해요. 넘기면 바로 바뀌고, 회원님은 여행에서 나가요."
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="넘기고 나가기"
            variant="danger"
            loading={submitting}
            /* ⚠️ 모임 여행이면 모임 이탈까지 골라야 넘길 수 있다 */
            disabled={picked === null || (groupName !== null && alsoLeaveGroup === null)}
            onPress={onSubmit}
          />
          <Button label="닫기" variant="ghost" disabled={submitting} onPress={onClose} />
        </View>
      }
    >
      <View style={{ paddingBottom: 8, gap: 14 }}>
        <View style={{ gap: 8 }}>
          {candidates.map((member) => {
            const on = member.memberId === selectedMemberId;
            return (
              <Pressable
                key={member.memberId}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: submitting }}
                accessibilityLabel={member.name}
                disabled={submitting}
                onPress={() => onSelect(member.memberId)}
                className={`flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3 active:opacity-70 ${
                  on ? "border-blue-600 bg-white" : "border-gray-200 bg-white"
                } ${submitting ? "opacity-40" : ""}`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                    on ? "border-blue-600" : "border-gray-300"
                  }`}
                >
                  {on ? <View className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
                    {member.name}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: "#8B94A2" }}>참여 중</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/*
          ⚠️ 모임 이탈은 **여기서만 물을 수 있다.** 이 앱에 모임 나가기 통로가
             나가기 시트뿐이라, 위임 경로에서 빼면 여행장은 모임에서 나갈
             방법이 없어진다. (2026-09-15 다빈 지적)
          ⚠️ 개인 여행(groupName === null)에는 나갈 모임이 없어 그리지 않는다.
        */}
        {groupName !== null ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#8B94A2" }}>
              모임은 어떻게 할까요?
            </Text>
            <LeaveChoice
              selected={alsoLeaveGroup === false}
              disabled={submitting}
              title="이 여행에서만 나가기"
              body={`${groupName} 멤버로 남아서 다음 여행에 초대받을 수 있어요`}
              onPress={() => onChangeAlsoLeaveGroup(false)}
            />
            <LeaveChoice
              selected={alsoLeaveGroup === true}
              disabled={submitting}
              title="모임에서도 나가기"
              body="다음 여행 초대를 받지 않아요"
              onPress={() => onChangeAlsoLeaveGroup(true)}
            />
          </View>
        ) : null}

        {picked ? (
          <BranchNotice
            tone="info"
            title={`${picked.name}님이 새 여행장이 돼요`}
            /* ⚠️ 여행장만 하는 일은 '참여 요청 수락' 하나뿐이다. (LeaveTripSheet 주석 참조) */
            body={`${picked.name}님에게 알림이 가고, 참여 요청을 수락하는 일을 맡게 돼요. 되돌릴 수 없어요.`}
          />
        ) : null}

        {fundBalanceLabel ? (
          <BranchNotice
            tone="warn"
            title={`지금 모인 돈이 ${fundBalanceLabel}이에요`}
            body="회원님 몫은 멤버들과 직접 정산해 주세요."
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}
