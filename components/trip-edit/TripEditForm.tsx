// ============================================================================
// 여행 기본 정보 수정 폼 (TRIP-HOME-01 → /trips/:tripId/edit)
//
// 일정 · 인원 · 모임을 고친다. 모임 아래에 '여행 멤버 초대하기' 가 있다.
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
//    저장하지 않은 일정·인원은 초대 문구에 안 들어간다. 그래서 모임 카드 안에
//    두고, 저장은 맨 아래 따로 둔다.
//
// supabase / track 을 직접 부르지 않는다. 화면이 부른다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { DateRangeCalendar, HeadcountStepper } from "@/components/trip-create";
import { Button } from "@/components/ui";
import { useDisplayFont } from "@/lib/hooks/useDisplayFont";
import type { Group } from "@/lib/supabase/queries/groups";

import { GroupChoiceList } from "./GroupChoiceList";

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

  groups: Group[];
  groupsLoading: boolean;
  /** null 이면 개인 여행 */
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;

  /** 여행 멤버 초대하기. 지난 여행 유무 판단과 그 뒤 일은 화면이 한다 */
  onInvite: () => void;
  /** 지난 여행을 확인하는 중 */
  inviting: boolean;

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
  groups,
  groupsLoading,
  selectedGroupId,
  onSelectGroup,
  onInvite,
  inviting,
  canSubmit,
  saving,
  errorMessage,
  onSubmit,
}: Props) {
  const { fontFamily } = useDisplayFont();
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  return (
    <View style={{ gap: 14 }}>
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
              marginTop: 10,
              fontFamily,
              fontSize: 44,
              lineHeight: 46,
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
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderStyle: "dashed",
            borderColor: "#cfd5dc",
          }}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: MUTED }}>
            일정과 인원, 함께 가는 모임을 고칠 수 있어요. 여행지를 바꾸려면 새 여행을
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

      {/* ── 모임 + 초대 ────────────────────────────────────────────── */}
      <Section
        eyebrow="GROUP"
        title="모임"
        hint={selectedGroup ? selectedGroup.name : "개인 여행"}
      >
        <GroupChoiceList
          groups={groups}
          loading={groupsLoading}
          selectedGroupId={selectedGroupId}
          onSelect={onSelectGroup}
        />

        {/*
          초대 자리. 점선 테두리라 "여기에 사람을 더 넣는다" 로 읽힌다.
          지난 여행이 있는 모임이면 화면이 새 모임 생성으로 보낸다.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="여행 멤버 초대하기"
          disabled={inviting}
          onPress={onInvite}
          className="flex-row items-center active:opacity-70"
          style={{
            gap: 12,
            marginTop: 2,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: "#c8ced6",
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 13,
            opacity: inviting ? 0.6 : 1,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f3f5f7",
            }}
          >
            {inviting ? (
              <ActivityIndicator size="small" color={INK} />
            ) : (
              <Ionicons name="person-add-outline" size={15} color={INK} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: INK }}>여행 멤버 초대하기</Text>
            <Text style={{ marginTop: 3, fontSize: 11, lineHeight: 15, color: MUTED }}>
              {selectedGroup
                ? "초대 링크를 보내면 상대가 참여를 요청하고, 수락하면 합류해요. 이미 다녀온 여행이 있는 모임이면 새 모임을 만들어요."
                : "먼저 모임을 고르거나, 새 모임을 만들어 초대해요."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={FAINT} />
        </Pressable>
      </Section>

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
  );
}
