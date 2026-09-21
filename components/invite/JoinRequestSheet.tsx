// ============================================================================
// INV-04 참여 요청 관리 — 바텀시트 (여행장만)
//
// 수락하기 전에 **무엇이 공개되는지 여행장에게 먼저 알린다.** 이 안내가
// POL-INV-021(수락 전에는 금액·멤버를 숨긴다)의 짝이다. 숨겨 두기만 하고
// 언제 풀리는지 알리지 않으면, 여행장은 자기가 무엇을 여는지 모른 채 누른다.
//
// ⚠️ 모임 안내는 **예정형**으로 쓴다. 이 시점에는 아직 아무것도 안 바뀌었다.
//    "옮겨졌어요"(완료형)로 쓰면 거절했을 때 말이 어긋난다. (POL-INV-035)
//
// ⚠️ 새 모임 이름은 **여기서 받지 않는다.** (2026-09-14 · docs/12 §7)
//    수락을 눌렀을 때 서버가 NEW_GROUP_NAME_REQUIRED 를 돌려주면 그때 NewGroupNameSheet 가
//    묻는다. 초대를 보낼 때도, 요청을 볼 때도 이름을 정하지 않는다.
//    trips.pending_group_name 은 읽지 않는다.
//
// ⚠️ 거절 사유를 묻지도 전달하지도 않는다. (POL-INV-051)
// ============================================================================
import { Text, View } from "react-native";

import { BottomSheet, Button } from "@/components/ui";

import { BranchNotice } from "./InviteLinkSheet";
import type { JoinRequestItem } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;

  request: JoinRequestItem;
  /** 요청 일시를 KST 로 바꾼 표시용 문자열. 화면이 만들어 넘긴다 */
  requestedAtLabel: string;

  destination: string;
  /**
   * 여행에 계좌가 연결돼 있으면 마스킹된 계좌 표시. 없으면 null.
   * ⚠️ 잔액을 넘기지 않는다. 여기서 필요한 건 "무엇이 보이게 되는가" 뿐이다.
   */
  accountLabel: string | null;

  /**
   * 수락하면 새 모임이 만들어질 것으로 보이는가. 서버 hint(needs_new_group) 그대로.
   * true 면 예정형으로 안내만 한다 — 이름은 수락 때 서버가 요구하면 그때 묻는다.
   */
  needsNewGroup: boolean;
  /** 지금 모임 이름. 개인 여행이면 null. */
  fromGroupName: string | null;

  onAccept: () => void;
  onReject: () => void;
  /** 처리 중. 두 버튼 모두 잠근다 */
  deciding: boolean;
};

export function JoinRequestSheet({
  visible,
  onClose,
  request,
  requestedAtLabel,
  destination,
  accountLabel,
  needsNewGroup,
  fromGroupName,
  onAccept,
  onReject,
  deciding,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${request.name}님이 참여 의사를 보냈어요`}
      description="함께할지 확인해 주세요."
      footer={
        <View style={{ gap: 8 }}>
          <View className="flex-row" style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="거절하기"
                variant="secondary"
                disabled={deciding}
                onPress={onReject}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="수락하기" loading={deciding} onPress={onAccept} />
            </View>
          </View>
          <Text
            style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2", textAlign: "center" }}
          >
            거절하면 {request.name}님에게도 알려드려요. 이 초대에는 다시 응답할 수 없어요.
          </Text>
        </View>
      }
    >
      <View style={{ paddingBottom: 8, gap: 14 }}>
        <View className="rounded-xl border border-gray-200 bg-white px-3.5 py-3">
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#111827" }}>
            {request.name}
          </Text>
          <Text style={{ marginTop: 3, fontSize: 12, color: "#8B94A2" }}>
            {requestedAtLabel} · 초대 링크로 참여 의사 보냄
          </Text>
        </View>

        {/*
          안내 A — 무엇이 공개되는가.
          계좌를 연결한 여행이면 잔액과 입출금 내역까지 포함된다. 이걸 빼면
          여행장은 돈이 보이는 줄 모르고 수락한다.
        */}
        <BranchNotice
          tone="info"
          title={`수락하면 ${request.name}님도 이걸 볼 수 있어요`}
          body={
            accountLabel
              ? `여행 예산과 계획, 함께하는 사람, 그리고 ${accountLabel}의 잔액과 입출금 내역이요.`
              : "여행 예산과 계획, 함께하는 사람, 모은 돈 현황이요."
          }
        />

        {/* 안내 B — 새 모임. 예정형이다. 이름은 수락을 누른 뒤 묻는다 */}
        {needsNewGroup ? (
          <BranchNotice
            tone="info"
            title="수락하면 이 여행을 위한 새 모임이 만들어져요"
            body={
              fromGroupName
                ? `${request.name}님은 ${fromGroupName} 멤버가 아니라서, 이 여행에 함께하는 사람들과 ${request.name}님으로 새 모임이 만들어져요. ${fromGroupName}의 다른 여행과 멤버는 그대로예요. 모임 이름은 수락할 때 정해요.`
                : `개인 여행에 다른 사람이 들어오면 모임 여행이 돼요. 이 여행에 함께하는 사람들과 ${request.name}님으로 새 모임이 만들어져요. 모임 이름은 수락할 때 정해요.`
            }
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}
