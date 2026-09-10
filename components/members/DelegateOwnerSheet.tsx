// ============================================================================
// MEM-02 여행장 위임 후 나가기 — 바텀시트
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

import type { TripMemberItem } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;

  /** 넘길 수 있는 사람. 나와 미가입 동행자는 화면 파일이 미리 걸러 넘긴다 */
  candidates: TripMemberItem[];
  selectedMemberId: string | null;
  onSelect: (memberId: string) => void;

  /** 연결 계좌의 총 잔액. 없으면 null */
  fundBalanceLabel: string | null;

  onSubmit: () => void;
  submitting: boolean;
};

export function DelegateOwnerSheet({
  visible,
  onClose,
  candidates,
  selectedMemberId,
  onSelect,
  fundBalanceLabel,
  onSubmit,
  submitting,
}: Props) {
  const picked = candidates.find((c) => c.memberId === selectedMemberId) ?? null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="누구에게 넘길까요?"
      description="넘기면 바로 여행장이 바뀌고, 회원님은 여행에서 나가요."
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="넘기고 나가기"
            variant="danger"
            loading={submitting}
            disabled={picked === null}
            onPress={onSubmit}
          />
          <Button label="닫기" variant="ghost" disabled={submitting} onPress={onClose} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
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

        {picked ? (
          <BranchNotice
            tone="info"
            title={`${picked.name}님이 새 여행장이 돼요`}
            body={`${picked.name}님에게 알림이 가고, 멤버 초대와 여행 정보 수정을 맡게 돼요. 되돌릴 수 없어요.`}
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
