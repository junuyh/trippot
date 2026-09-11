// ============================================================================
// INV-01 초대 링크 공유 — 바텀시트
//
// 초대할 사람을 고르면 카카오톡으로 링크를 보낸다. 고른 사람에 따라 모임이
// 어떻게 되는지 **누르기 전에** 알린다.
//
//   모임 밖 사람 없음                 안내 없음
//   모임 밖 사람 + 결산 이력 없음      기존 모임에 합류
//   모임 밖 사람 + 결산 이력 있음      새 모임이 만들어진다 → 다음 단계 INV-05
//
// ⚠️ 초대는 **ACTIVE 여행 멤버 누구나** 한다. 여행장 여부로 이 시트를 막지 않는다.
//    (2026-09-10 확정 · docs/10_여행초대정책_v2.md §3) 수락 권한만 여행장이 쥔다.
//    이전 주석 "초대는 여행장만 (§2-1 권한표)" 은 폐기된 과거 권한표다.
// ⚠️ supabase · track() 을 부르지 않는다. 복사·공유도 화면이 한다. (CLAUDE.md §9)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui";

import type { GroupBranch, InviteCandidate } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;

  /** 초대 대상 후보. 모임 멤버 + 모임 밖 사람 */
  candidates: InviteCandidate[];
  selectedUserIds: string[];
  onToggle: (userId: string) => void;

  branch: GroupBranch;
  /** 현재 모임 이름. branch 안내 문구에 쓴다 */
  groupName: string;
  destination: string;

  /** 초대 링크 전문. 복사 버튼이 쓴다 */
  inviteUrl: string;
  onCopyLink: () => void;
  /** 방금 복사했으면 true. 버튼 문구가 바뀐다 */
  copied: boolean;

  /** 인원이 차면 링크가 자동으로 닫힌다는 안내에 쓴다 */
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
  const canSend = selectedUserIds.length > 0 && !sending;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="누구와 함께 갈까요?"
      description="초대할 사람을 고르면 카카오톡으로 링크를 보내드려요."
      footer={
        <View style={{ gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카카오톡으로 초대 보내기"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={onShareKakao}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl active:opacity-90"
            style={{ backgroundColor: canSend ? "#FEE500" : "#E5E8EB" }}
          >
            <Ionicons name="chatbubble" size={16} color={canSend ? "#191919" : "#B0B8C1"} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "800",
                color: canSend ? "#191919" : "#B0B8C1",
              }}
            >
              카카오톡으로 초대 보내기
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
        {branch === "newGroup" ? (
          <BranchNotice
            tone="info"
            title="모임 밖 사람이 함께하면 새 모임이 만들어져요"
            body={`${groupName}에는 지난 여행 기록이 있어서, 이번 ${destination} 여행은 새 모임으로 옮겨져요. 다음 단계에서 이름을 정할 수 있어요.`}
          />
        ) : null}
        {branch === "joinGroup" ? (
          <BranchNotice
            tone="info"
            title={`${groupName}에 새로 합류해요`}
            body="지난 여행 기록이 없는 모임이라 그대로 진행돼요. 기존 멤버들에게도 알려드릴게요."
          />
        ) : null}

        <View style={{ gap: 8 }}>
          {candidates.length === 0 ? (
            <Text style={{ fontSize: 12.5, lineHeight: 19, color: "#8B94A2" }}>
              고를 수 있는 사람이 없어요. 아래 링크를 복사해 보내면 누구나 참여를 요청할 수 있어요.
            </Text>
          ) : null}

          {candidates.map((candidate) => {
            const on = selectedUserIds.includes(candidate.userId);
            return (
              <Pressable
                key={candidate.userId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: sending }}
                accessibilityLabel={candidate.name}
                disabled={sending}
                onPress={() => onToggle(candidate.userId)}
                className={`flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3 active:opacity-70 ${
                  on ? "border-blue-600 bg-white" : "border-gray-200 bg-white"
                } ${sending ? "opacity-40" : ""}`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md ${
                    on ? "bg-blue-600" : "border border-gray-300 bg-white"
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

        {/* 링크 박스. 고른 사람이 없어도 링크는 언제나 복사할 수 있다 */}
        <View className="flex-row items-center gap-2 rounded-xl bg-gray-100 px-3.5 py-3">
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 12, color: "#4B5563" }}
          >
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

        <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
          링크는 7일간 쓸 수 있어요 · {headcount}명이 차면 자동으로 닫혀요
        </Text>
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
        backgroundColor: info ? "#EBF1FF" : "#FDF0F0",
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          lineHeight: 20,
          color: info ? "#0043D1" : "#B4272B",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 12,
          lineHeight: 19,
          color: info ? "#3C6FD8" : "#C4494D",
        }}
      >
        {body}
      </Text>
    </View>
  );
}
