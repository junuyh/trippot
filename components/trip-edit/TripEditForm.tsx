// ============================================================================
// 여행 기본 정보 수정 폼 (TRIP-HOME-01 → /trips/:tripId/edit)
//
// 일정 · 인원을 고친다. 모임은 보여주기만 한다.
// 순서는 여행 홈 티켓과 맞춘다 — 일정 → 인원 → 초대 → 모임. (2026-09-16 다빈)
//
// ⚠️ 모임은 고르는 목록이 아니라 **읽기 전용 한 줄**이다. (2026-09-15)
//    바꾸지 못하는데 라디오를 그리면 눌러 보고 헷갈린다. 왜 못 바꾸는지는
//    app/trips/[tripId]/edit.tsx 머리 주석.
//
// ⚠️ 초대 버튼은 빈자리가 없으면 꺼진다. 꺼진 이유와 켜는 법(인원 늘리기)을
//    버튼 안에 적는다. 말없이 꺼져 있으면 고장으로 읽힌다.
//
// 2026-09-09 · 흰 바탕에 라디오만 늘어서 있어 심심하다는 피드백. 다른 화면과
// 같은 언어로 바꿨다: 회색 바탕 위 흰 카드, 카드마다 영문 눈썹(SCHEDULE ·
// TRAVELERS · GROUP), 맨 위는 수하물 태그처럼 도시명이 주인공인 카드.
//
// ⚠️ **목적지는 여기서 못 바꾼다.** 목적지가 바뀌면 추천 예산의 기준 단가가
//    통째로 달라지는데, 이미 확정한 planned_amount 를 자동으로 덮어쓸 수는
//    없다. (CLAUDE.md 4장 — 사용자 확정값은 사용자만 바꾼다)
//    목적지를 바꾸려는 사람은 사실 새 여행을 만들려는 것이다.
//
// ⚠️ 일정이 바뀌어도 예산 금액은 따라 바뀌지 않는다. 그래서 화면에 그렇게 적는다.
//    말없이 안 바뀌면 사용자는 바뀐 줄 알고 예산을 다시 확인하지 않는다.
//
// ⚠️ 초대 버튼은 저장과 다른 일이다. 초대는 지금 고르고 있는 모임 기준이고,
//    저장하지 않은 일정은 초대 문구에 안 들어간다. 저장은 하단에 고정한다.
//
// supabase / track 을 직접 부르지 않는다. 화면이 부른다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { DateRangeCalendar, HeadcountStepper } from "@/components/trip-create";
import { Button } from "@/components/ui";
import { useDisplayFont } from "@/lib/hooks/useDisplayFont";
import { InviteArt } from "./inviteArt";
import { BRAND } from "@/lib/constants/brandColor";
import type { JoinRequestItem } from "@/components/invite";

/** 멤버 한 줄에 필요한 최소 모양. Trip 전체를 요구하지 않는다 */
export type TripMemberChip = {
  userId: string;
  name: string;
  isLeader: boolean;
};

/** TripPot 브랜드 보라. lib/constants/brandColor.ts */
const ACCENT = BRAND.primary;
const INK = "#111827";
const MUTED = "#7f8998";
const FAINT = "#a8afb9";
const LINE = "#e8eaee";

type Props = {
  /** 화면 맨 위에 띄우는 여행 이름. 읽기 전용이다 */
  destination: string;
  /** 'OSAKA'. 모르는 목적지면 null */
  destinationEn: string | null;
  flag: string | null;

  startDate: string | null;
  endDate: string | null;
  onChangeDates: (next: {
    startDate: string | null;
    endDate: string | null;
  }) => void;

  headcount: number;
  onChangeHeadcount: (value: number) => void;

  /** 모임 이름. 개인 여행이면 '개인 여행' */
  groupLabel: string;
  isGroupTrip: boolean;
  /** 참여 중인 가입자 수. 못 읽었으면 null */
  joinedCount: number | null;
  /**
   * 참여 중인 **가입** 멤버. 못 읽었으면 null 이고 목록을 그리지 않는다.
   * 미가입 동행자는 화면 파일이 이미 걸러서 넘긴다.
   */
  members: TripMemberChip[] | null;
  /** 초대할 빈자리가 있는가. 없으면 버튼을 끈다 */
  canInvite: boolean;

  /** 여행 멤버 초대하기. 지난 여행 유무 판단과 그 뒤 일은 화면이 한다 */
  onInvite: () => void;
  /** 지난 여행을 확인하는 중 */
  inviting: boolean;

  /**
   * 대기 중인 참여 요청. **여행장에게만** 온다 — 화면이 leader_user_id 로 걸러 넘긴다.
   * 여행장이 아니면 빈 배열이고 아무것도 그리지 않는다. (docs/12 §6 · 2026-09-14)
   */
  joinRequests: JoinRequestItem[];
  /** 요청 한 건을 눌렀을 때. 수락·거절 시트는 화면이 연다 */
  onPressJoinRequest: (request: JoinRequestItem) => void;

  /** 저장 가능한 상태인가. 검증은 화면이 한다 */
  canSubmit: boolean;
  saving: boolean;
  /** 저장 실패 안내. 없으면 null */
  errorMessage: string | null;
  onSubmit: () => void;
};

/** 흰 카드 한 장. 영문 눈썹 + 한글 제목 + 내용 */
function Section({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: LINE,
        borderRadius: 18,
        backgroundColor: "#fff",
        padding: 16,
        gap: 12,
      }}
    >
      <View className="flex-row items-end justify-between">
        <View>
          <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.2, color: FAINT }}>
            {eyebrow}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 15, fontWeight: "800", color: INK }}>{title}</Text>
        </View>
        {hint ? <Text style={{ fontSize: 11, color: MUTED }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function TripEditForm({
  destination,
  destinationEn,
  flag,
  startDate,
  endDate,
  onChangeDates,
  headcount,
  onChangeHeadcount,
  groupLabel,
  isGroupTrip,
  joinedCount,
  canInvite,
  members,
  onInvite,
  inviting,
  joinRequests,
  onPressJoinRequest,
  canSubmit,
  saving,
  errorMessage,
  onSubmit,
}: Props) {
  const { fontFamily } = useDisplayFont();
  const inviteDisabled = inviting || !canInvite;

  return (
    /*
      ⚠️ 스크롤과 '저장하기' 를 여기서 함께 그린다. (2026-09-16)
         저장 버튼이 내용 맨 아래 흐르면 내용이 길 때 스크롤해야 보인다.
         고정하려면 스크롤 영역 **바깥**에 있어야 해서 화면 파일에서 이리 옮겼다.
    */
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 머리: 수하물 태그의 축소판. 도시명이 주인공 ─────────────── */}
        <View
          style={{
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 18,
            backgroundColor: "#fff",
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 18,
            overflow: "hidden",
          }}
        >
          <View className="flex-row items-start justify-between">
            <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: FAINT }}>
              TRIP INFO
            </Text>
            {flag ? (
              <Text
                style={{
                  borderRadius: 5,
                  backgroundColor: INK,
                  color: "#fff",
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  fontSize: 11,
                  fontWeight: "900",
                }}
              >
                {flag} {destinationEn ?? ""}
              </Text>
            ) : null}
          </View>
          {destinationEn ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 8,
                fontFamily,
                fontSize: 34,
                lineHeight: 36,
                letterSpacing: 0.5,
                color: INK,
              }}
            >
              {destinationEn}
            </Text>
          ) : null}
          <Text
            style={{
              marginTop: destinationEn ? 2 : 10,
              fontSize: destinationEn ? 14 : 22,
              fontWeight: "800",
              color: destinationEn ? MUTED : INK,
            }}
          >
            {destination}
          </Text>
          <View
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: "#cfd5dc",
            }}
          >
            <Text style={{ fontSize: 12, lineHeight: 18, color: MUTED }}>
              일정과 인원을 고칠 수 있어요. 여행지와 모임을 바꾸려면 새 여행을
              만들어 주세요.
            </Text>
          </View>
        </View>

        {/* ── 일정 ───────────────────────────────────────────────────── */}
        <Section eyebrow="SCHEDULE" title="여행 일정">
          <DateRangeCalendar
            startDate={startDate}
            endDate={endDate}
            onChange={onChangeDates}
            // 이미 시작한 여행의 시작일을 고치는 일이 있다. 과거를 막지 않는다.
            disablePast={false}
          />
          <Text style={{ fontSize: 11, lineHeight: 17, color: FAINT }}>
            일정을 바꿔도 이미 정한 예산 금액은 그대로예요. 필요하면 전체 예산에서
            직접 고쳐 주세요.
          </Text>
        </Section>

        {/* ── 인원 ───────────────────────────────────────────────────── */}
        <Section eyebrow="TRAVELERS" title="인원">
          <HeadcountStepper value={headcount} onChange={onChangeHeadcount} />
        </Section>

        {/* ── 초대 ───────────────────────────────────────────────────
             인원 바로 아래에 둔다. 빈자리를 늘려야 초대가 켜지므로 인과가
             붙어 읽힌다. 여행 홈 티켓도 DATE → TRAVELERS 순이라 같이 맞춘다.
             (2026-09-16 다빈) */}
        <Section eyebrow="INVITE" title="여행 멤버">
          {/*
            ⚠️ 설명 옆에 편지 그림을 둔다. 글자만 있으면 카드가 설정 목록처럼
               읽혀서 초대가 '할 수 있는 일' 로 안 보인다. (2026-09-16 다빈)
            ⚠️ 그림은 꺼졌을 때 함께 채도가 빠진다. 버튼만 회색이면 카드가
               반만 쉬는 것처럼 어정쩡하다.
          */}
          <View className="flex-row items-start" style={{ gap: 4 }}>
            <Text
              style={{
                flex: 1,
                marginTop: 2,
                fontSize: 12.5,
                lineHeight: 20,
                color: MUTED,
              }}
            >
              {canInvite
                ? "초대 링크를 받은 사람이 수락하면,\n여행장이 확인 후 승인할 수 있어요.\n링크는 7일간 쓸 수 있어요."
                : `인원 ${headcount}명이 모두 참여 중이에요.\n위에서 인원을 늘리면 초대할 수 있어요.`}
            </Text>
            <InviteArt width={112} height={90} muted={!canInvite} style={{ marginTop: -8 }} />
          </View>

          {/*
            ⚠️ 눌리는 버튼으로 보이게 한다. 점선 카드였을 때는 장식으로 읽혀
               있는 줄도 몰랐다. 켜짐·꺼짐이 색으로 바로 갈린다.
            ⚠️ 꺼지는 조건은 **빈자리 없음** 하나다. 인원을 늘리면 켜진다.
               모임을 안 골랐어도 링크는 나간다 — 모임 정리는 수락할 때 한다.
               (docs/10_여행초대정책_v2.md §9-5)
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="여행 멤버 초대하기"
            accessibilityState={{ disabled: inviteDisabled }}
            disabled={inviteDisabled}
            onPress={onInvite}
            className={`flex-row items-center ${inviteDisabled ? "" : "active:opacity-85"}`}
            style={{
              marginTop: 6,
              height: 56,
              borderRadius: 16,
              paddingLeft: 18,
              paddingRight: 8,
              backgroundColor: canInvite ? ACCENT : "#eef0f3",
            }}
          >
            <View className="flex-1 flex-row items-center justify-center" style={{ gap: 8 }}>
              {inviting ? (
                <ActivityIndicator size="small" color={canInvite ? "#fff" : MUTED} />
              ) : (
                <Ionicons
                  name="person-add-outline"
                  size={17}
                  color={canInvite ? "#fff" : "#9aa3ae"}
                />
              )}
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: canInvite ? "#fff" : "#9aa3ae",
                }}
              >
                여행 멤버 초대하기
              </Text>
            </View>

            {/* 오른쪽 원형 화살표 — 이 버튼이 어디로 데려간다는 신호 */}
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: canInvite ? "rgba(255,255,255,0.22)" : "#e4e7ea",
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={canInvite ? "#fff" : "#9aa3ae"}
              />
            </View>
          </Pressable>

          {/*
            지금 함께하는 사람. 숫자만 보여주면 "3명 참여 중" 이 누구인지 모른다.
            ⚠️ 미가입 동행자는 여기 없다. 알림·투표·위임·나가기 판정에서 이미
               빠져 있어서, 목록에만 넣으면 거기서만 멤버처럼 보인다. (2026-09-16)
          */}
          {members !== null && members.length > 0 ? (
            <View style={{ marginTop: 14, gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.3 }}>
                함께하는 사람 {members.length}명
              </Text>
              {members.map((member) => (
                <View
                  key={member.userId}
                  className="flex-row items-center"
                  style={{
                    gap: 10,
                    borderRadius: 12,
                    backgroundColor: "#f7f8fa",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Ionicons name="person-circle-outline" size={20} color={FAINT} />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 13, fontWeight: "700", color: INK }}
                  >
                    {member.name}
                  </Text>
                  {member.isLeader ? (
                    <Text
                      style={{
                        borderRadius: 6,
                        backgroundColor: BRAND.primarySoft,
                        color: BRAND.primary,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        fontSize: 10.5,
                        fontWeight: "800",
                      }}
                    >
                      여행장
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/*
            참여 요청 (INV-04 진입점). 초대 자리 바로 아래 — 링크를 보낸 사람이 답을 기다리는 곳이다.
            여행장에게만 데이터가 오므로 다른 멤버 화면엔 아무것도 없다. 누르면 수락·거절 시트.
          */}
          {joinRequests.length > 0 ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.3 }}>
                승인 대기 {joinRequests.length}건
              </Text>
              {joinRequests.map((request) => (
                <Pressable
                  key={request.requestId}
                  accessibilityRole="button"
                  accessibilityLabel={`${request.name}님의 초대 수락 보기`}
                  onPress={() => onPressJoinRequest(request)}
                  className="flex-row items-center active:opacity-70"
                  style={{
                    gap: 12,
                    borderWidth: 1,
                    borderColor: "#e5e8ec",
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: "#fff",
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: BRAND.primarySoft,
                    }}
                  >
                    <Ionicons name="hand-right-outline" size={15} color={BRAND.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "800", color: INK }}>
                      {request.name}님이 초대를 수락했어요
                    </Text>
                    <Text style={{ marginTop: 3, fontSize: 11, lineHeight: 15, color: MUTED }}>
                      {request.needsNewGroup
                        ? "수락하면 새 모임이 만들어져요 · 눌러서 확인"
                        : "눌러서 수락하거나 거절해요"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={FAINT} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </Section>

        {/* ── 모임 ───────────────────────────────────────────────────── */}
        <Section eyebrow="GROUP" title="모임">
          <View
            accessible
            accessibilityLabel={`모임 ${groupLabel}. 이 화면에서는 바꿀 수 없어요`}
            className="flex-row items-center"
            style={{
              gap: 12,
              borderRadius: 14,
              backgroundColor: "#f7f8fa",
              paddingHorizontal: 14,
              paddingVertical: 13,
            }}
          >
            <Ionicons
              name={isGroupTrip ? "people-outline" : "person-outline"}
              size={16}
              color={INK}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: INK }}>
                {groupLabel}
              </Text>
              <Text style={{ marginTop: 3, fontSize: 11, color: MUTED }}>
                여행을 만든 뒤에는 모임을 바꿀 수 없어요
              </Text>
            </View>
            <Ionicons name="lock-closed-outline" size={14} color={FAINT} />
          </View>
        </Section>

      </ScrollView>

      {/* ── 하단 고정: 저장하기 ─────────────────────────────────────── */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: LINE,
          backgroundColor: "#ffffff",
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 28,
          gap: 8,
        }}
      >
        {errorMessage ? (
          <Text style={{ fontSize: 12, color: "#d1373f" }}>{errorMessage}</Text>
        ) : null}

        <Button
          label="저장하기"
          loading={saving}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}
