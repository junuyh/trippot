// ============================================================================
// 함께하는 사람 — 여행 멤버 현황
//
// ⚠️⚠️ 역할에 따라 보이는 것이 다르다. ⚠️⚠️
//
//                        여행장   멤버
//   여행·모임·인원 요약     ✅      ✅
//   참여 중 목록           ✅      ✅
//   참여 요청 N건          ✅      ❌
//   초대 보냄              ✅      ❌
//   [멤버 초대하기]        ✅      ❌   ← 초대는 여행장만 (§2-1 권한표)
//   [여행에서 나가기]      ✅      ✅
//
//   멤버에게 초대 버튼을 그려 두고 눌렀을 때 막으면, 왜 안 되는지 모른 채
//   같은 버튼을 계속 누른다. 아예 그리지 않는다.
//
// ⚠️ 인원은 "N명 예정 · M명 참여 중" 으로 쓴다. 두 수를 합치지 않는다.
//    예정 인원은 예산의 근거고 참여 인원은 지금 상태다. (POL-INV-042)
//
// ⚠️ supabase · track() 을 부르지 않는다. (CLAUDE.md §9)
// ============================================================================
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui";
import type { JoinRequestItem } from "@/components/invite";

import type { TripMemberItem } from "./types";

type Props = {
  destination: string;
  /** 모임 여행이면 모임 이름, 개인 여행이면 null */
  groupName: string | null;
  /** 예산 계산용 예정 인원. 실제 참여 인원과 다르다 */
  headcount: number;

  members: TripMemberItem[];
  /** 내가 이 여행의 여행장인가. 이 값 하나로 화면이 갈린다 */
  isOwnerView: boolean;

  /** 여행장에게만 보이는 대기 요청. 멤버에게는 빈 배열을 넘긴다 */
  pendingRequests: JoinRequestItem[];
  onOpenRequest: (requestId: string) => void;

  /** 링크를 보냈지만 아직 아무도 안 들어온 상태를 알린다. 없으면 false */
  inviteSent: boolean;

  onInvite: () => void;
  onLeave: () => void;
};

export function TripMemberListView({
  destination,
  groupName,
  headcount,
  members,
  isOwnerView,
  pendingRequests,
  onOpenRequest,
  inviteSent,
  onInvite,
  onLeave,
}: Props) {
  const activeCount = members.length;
  const alone = activeCount <= 1;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pt-4 pb-6">
        {/* 요약 */}
        <View className="rounded-2xl bg-white px-4 py-4">
          <SummaryRow label="여행" value={destination} />
          <View className="my-2 h-px bg-gray-100" />
          <SummaryRow label="모임" value={groupName ?? "개인 여행"} />
          <View className="my-2 h-px bg-gray-100" />
          <SummaryRow label="인원" value={`${headcount}명 예정 · ${activeCount}명 참여 중`} />
        </View>

        {/*
          나만 참여 중일 때. "개인 여행으로 바꿀까요?" 를 묻지 않는다.
          답을 정하지 않은 질문이다. (POL-INV-043)
        */}
        {alone ? (
          <Text style={{ marginTop: 10, fontSize: 12, lineHeight: 19, color: "#8B94A2" }}>
            {headcount}명 예정인데 나만 참여 중이에요. 멤버를 초대하거나 여행 정보에서 인원을 바꿀 수 있어요.
          </Text>
        ) : null}

        <SectionTitle>참여 중 {activeCount}명</SectionTitle>
        <View className="overflow-hidden rounded-2xl bg-white">
          {members.map((member, index) => (
            <View
              key={member.memberId}
              className="flex-row items-center px-4 py-3.5"
              style={{
                gap: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: "#F1F3F6",
              }}
            >
              <View style={{ flex: 1 }}>
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
                    {member.name}
                  </Text>
                  {member.isTripOwner ? <Badge tone="brand">여행장</Badge> : null}
                </View>
                <Text style={{ marginTop: 2, fontSize: 12, color: "#8B94A2" }}>
                  {member.isTripOwner
                    ? "이 여행을 만들었어요"
                    : member.userId === null
                      ? "아직 가입하지 않았어요"
                      : "참여 중"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 여행장만 — 참여 요청 */}
        {isOwnerView && pendingRequests.length > 0 ? (
          <>
            <SectionTitle>참여 요청 {pendingRequests.length}건</SectionTitle>
            <View className="overflow-hidden rounded-2xl bg-white">
              {pendingRequests.map((request, index) => (
                <View
                  key={request.requestId}
                  className="flex-row items-center px-4 py-3.5"
                  style={{
                    gap: 10,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: "#F1F3F6",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-center" style={{ gap: 5 }}>
                      <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">
                        {request.name}
                      </Text>
                      <Badge tone="wait">대기</Badge>
                    </View>
                    <Text style={{ marginTop: 2, fontSize: 12, color: "#8B94A2" }}>
                      초대 링크로 들어옴
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${request.name} 참여 요청 보기`}
                    onPress={() => onOpenRequest(request.requestId)}
                    className="rounded-lg bg-blue-600 px-3 py-2 active:opacity-80"
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>보기</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* 여행장만 — 보낸 초대 */}
        {isOwnerView && inviteSent ? (
          <>
            <SectionTitle>초대 보냄</SectionTitle>
            <View className="rounded-2xl bg-white px-4 py-3.5">
              <Text style={{ fontSize: 12.5, lineHeight: 19, color: "#8B94A2" }}>
                초대 링크를 보냈어요 · 7일간 유효해요. 상대가 참여를 요청하면 여기에 표시돼요.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View className="border-t border-gray-100 bg-white px-5 pb-8 pt-3" style={{ gap: 6 }}>
        {/* 초대는 여행장만. 멤버에게는 아예 그리지 않는다 */}
        {isOwnerView ? <Button label="멤버 초대하기" onPress={onInvite} /> : null}
        <Button label="여행에서 나가기" variant="ghost" onPress={onLeave} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 10 }}>
      <Text style={{ fontSize: 13.5, color: "#4B5563" }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: "#111827", textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={{ marginTop: 18, marginBottom: 7, fontSize: 12.5, fontWeight: "700", color: "#8B94A2" }}>
      {children}
    </Text>
  );
}

function Badge({ tone, children }: { tone: "brand" | "wait"; children: string }) {
  const brand = tone === "brand";
  return (
    <View
      className="shrink-0 rounded px-1.5 py-0.5"
      style={{ backgroundColor: brand ? "#EBF1FF" : "#FFF7E8" }}
    >
      <Text style={{ fontSize: 10, fontWeight: "800", color: brand ? "#0043D1" : "#8A5A00" }}>
        {children}
      </Text>
    </View>
  );
}
