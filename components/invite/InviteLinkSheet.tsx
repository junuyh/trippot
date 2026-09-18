// ============================================================================
// INV-01 초대 링크 공유 — 바텀시트
//
// 여행 초대 링크 하나를 OS 공유 시트로 보낸다. 링크는 여행 단위 하나뿐이고
// 7일간 누구나 쓸 수 있다. (docs/10_여행초대정책_v2.md §4 · §5)
//
// ⚠️ candidates · branch 는 **선택 props** 다. (2026-09-11 · Sender P0)
//    링크는 여러 사람이 쓰는 하나의 URL 이라, 고른 사람이 실제 수신자와 이어지지
//    않는다. 새 모임 분기도 발송 시점이 아니라 **여행장이 수락할 때** 실제 요청자
//    기준으로 판정한다. (§9-4 · §9-5) 그래서 sender 는 이 둘을 넘기지 않는다.
//    넘기지 않으면 후보 목록·분기 안내를 그리지 않고, 공유 버튼은 바로 열린다.
//    (props 자체는 남겨 둔다 — 수락 시점 화면이 같은 안내 블록을 쓴다)
//
//   branch 안내 (넘겼을 때만)
//     joinGroup   모임 밖 사람 + 다른 여행 없음        기존 모임에 합류
//     newGroup    모임 밖 사람 + 다른 여행 하나라도    새 모임이 만들어진다
//     ⚠️ "결산 이력" · "지난 여행 기록" 기준은 폐기됐다. (§9-2)
//
// ⚠️ 초대는 **ACTIVE 여행 멤버 누구나** 한다. 여행장 여부로 이 시트를 막지 않는다.
//    (2026-09-10 확정 · docs/10_여행초대정책_v2.md §3) 수락 권한만 여행장이 쥔다.
//    이전 주석 "초대는 여행장만 (§2-1 권한표)" 은 폐기된 과거 권한표다.
// ⚠️ supabase · track() 을 부르지 않는다. 복사·공유도 화면이 한다. (CLAUDE.md §9)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui";

import { InviteLinkBox, InviteSendButton } from "./inviteLinkParts";

import { BRAND } from "@/lib/constants/brandColor";

import type { GroupBranch, InviteCandidate } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;

  /** 초대 대상 후보. 넘기지 않으면 목록을 그리지 않는다 (multi-use 링크) */
  candidates?: InviteCandidate[];
  selectedUserIds?: string[];
  onToggle?: (userId: string) => void;

  /** 모임 분기 안내. 넘기지 않으면 그리지 않는다 — sender 는 넘기지 않는다 */
  branch?: GroupBranch;
  /** 현재 모임 이름. branch 안내 문구에 쓴다 */
  groupName?: string;
  destination: string;

  /** 초대 링크 전문. 복사 버튼이 쓴다 */
  inviteUrl: string;
  onCopyLink: () => void;
  /** 방금 복사했으면 true. 버튼 문구가 바뀐다 */
  copied: boolean;

  /**
   * 예정 인원. 안내 문구에 쓴다.
   * ⚠️ 인원이 차도 링크는 닫히지 않는다. 추가 **수락**만 제한된다. (§10)
   */
  headcount: number;

  onShareKakao: () => void;
  /** 발송 중. 중복 제출을 막는다 */
  sending: boolean;
};

export function InviteLinkSheet({
  visible,
  onClose,
  candidates,
  selectedUserIds,
  onToggle,
  branch,
  groupName,
  destination,
  inviteUrl,
  onCopyLink,
  copied,
  headcount,
  onShareKakao,
  sending,
}: Props) {
  // 후보를 받았으면 하나는 골라야 보낸다. 안 받았으면(링크만 공유) 바로 보낸다.
  const hasCandidates = candidates !== undefined;
  const selected = selectedUserIds ?? [];
  const canSend = !sending && (!hasCandidates || selected.length > 0);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="누구와 함께 갈까요?"
      description={
        hasCandidates
          ? "초대할 사람을 고르면 링크를 보내드려요."
          : "링크를 받은 사람이 참여 의사를 보내면, 여행장이 확인하고 수락할 수 있어요."
      }
      footer={
        <View style={{ gap: 8 }}>
          <InviteSendButton onPress={onShareKakao} disabled={!canSend} />
        </View>
      }
    >
      <View style={{ paddingBottom: 8, gap: 14 }}>
        {branch === "newGroup" ? (
          <BranchNotice
            tone="info"
            title="모임 밖 사람이 함께하면 새 모임이 만들어져요"
            body={`${groupName ?? "이 모임"}에는 다른 여행이 있어서, 이번 ${destination} 여행은 새 모임으로 옮겨져요. 이름은 수락할 때 정할 수 있어요.`}
          />
        ) : null}
        {branch === "joinGroup" ? (
          <BranchNotice
            tone="info"
            title={`${groupName ?? "이 모임"}에 새로 합류해요`}
            body="다른 여행이 없는 모임이라 그대로 진행돼요. 기존 멤버들에게도 알려드릴게요."
          />
        ) : null}

        {hasCandidates ? (
        <View style={{ gap: 8 }}>
          {candidates.length === 0 ? (
            <Text style={{ fontSize: 12.5, lineHeight: 19, color: "#8B94A2" }}>
              고를 수 있는 사람이 없어요. 아래 링크를 복사해 보내면 누구나 참여 의사를 보낼 수 있어요.
            </Text>
          ) : null}

          {candidates.map((candidate) => {
            const on = selected.includes(candidate.userId);
            return (
              <Pressable
                key={candidate.userId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: sending }}
                accessibilityLabel={candidate.name}
                disabled={sending}
                onPress={() => onToggle?.(candidate.userId)}
                className={`flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3 active:opacity-70 ${
                  on ? "border-brand bg-white" : "border-gray-200 bg-white"
                } ${sending ? "opacity-40" : ""}`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md ${
                    on ? "bg-brand" : "border border-gray-300 bg-white"
                  }`}
                >
                  {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
                    {candidate.name}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 11.5, color: "#8B94A2" }}>
                    {candidate.inGroup ? "모임 멤버" : "모임 밖 · 새로 초대"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        ) : null}

        {/* 링크 박스·안내는 여행 홈 모달과 같은 조각을 쓴다 (inviteLinkParts) */}
        <InviteLinkBox
          inviteUrl={inviteUrl}
          copied={copied}
          onCopyLink={onCopyLink}
          headcount={headcount}
        />
      </View>
    </BottomSheet>
  );
}

/** 안내 블록. INV-04 도 같은 모양을 쓴다 */
export function BranchNotice({
  tone,
  title,
  body,
}: {
  tone: "info" | "warn";
  title: string;
  body: string;
}) {
  const info = tone === "info";
  return (
    <View
      style={{
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 14,
        backgroundColor: info ? BRAND.primarySoft : "#FDF0F0",
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          lineHeight: 20,
          color: info ? BRAND.primary : "#B4272B",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 12,
          lineHeight: 19,
          color: info ? "#747B88" : "#C4494D", // 설명 본문은 brand 가 아니라 보조 글자색(pot.mute)
        }}
      >
        {body}
      </Text>
    </View>
  );
}
