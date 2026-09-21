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
//
// ⚠️ 2026-09-21 · "혼란스럽다" 는 피드백으로 다시 짰다. 바뀐 것과 이유.
//      · 섹션 라벨(새 여행장 / 모임은 어떻게 할까요?)을 세웠다. 전에는 두 질문이
//        그냥 이어져 있어 지금 뭘 고르는 중인지 흐렸다
//      · 후보 목록을 한 덩어리 카드로 묶고 라디오를 오른쪽에 뒀다
//      · 이름 아래 '참여 중' 을 뺐다. 후보는 전부 참여 중인 가입 멤버라
//        (화면 파일이 미리 거른다) 모두에게 같은 값은 정보가 아니다
//      · 이니셜 아바타를 넣지 않았다. '김민지' 옆의 '김' 은 장식이고,
//        선택 표시와 시선을 다툰다. 후보가 2~5명이라 훑을 앵커도 필요 없다
//      · 확인 문구를 BranchNotice 박스에서 아이콘 한 줄로 낮췄다. 시트가
//        짧아져 스크롤 없이 두 선택과 버튼이 한 화면에 든다
//      · 되돌릴 수 없다는 경고를 **부제로 올렸다.** 박스를 없애면서 그 사실이
//        사라지지 않게 한 것이다. (POL-INV-005)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

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
      /*
        ⚠️ 묻지 않고 **선언한다.** '넘길까요?' 로 물으면 예/아니오 질문처럼
           읽히는데 실제로는 두 가지를 고르게 한다. (2026-09-21)
      */
      title="여행장을 넘기고 나가요"
      /*
        ⚠️ 여행장이 하는 일을 여기서 말한다. MEM-01 의 needsDelegate 갈래를
           건너뛰고 이 시트가 바로 열리기 때문이다. (2026-09-14)
        ⚠️ 여행장만 하는 일은 **참여 요청 수락** 하나뿐이다. 초대와 예산 수정은
           멤버 누구나 한다. 크게 적으면 넘기는 사람이 겁을 먹는다.
        ⚠️ **되돌릴 수 없다는 말이 여기 있다.** (POL-INV-005) 전에는 고른 뒤
           박스로 알렸는데, 그 박스를 없애면서 이 문장으로 옮겼다. 지우지 않는다.
      */
      description="여행장은 새 멤버의 참여 의사를 수락해요. 넘기면 바로 바뀌고 되돌릴 수 없어요."
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
      {/*
        ⚠️ paddingTop 이 있는 이유. 첫 섹션 라벨 위에는 부제 **문장**이 있어서,
           붙여 두면 그 문단의 마지막 줄처럼 흘러 읽힌다. 두 번째 라벨은 위가
           카드 모서리라 저절로 머리글로 서는데 첫 라벨만 그렇지 않았다.
           글씨 크기는 둘이 같다 — 떨어뜨려야 같은 깊이로 읽힌다. (2026-09-21)
      */}
      <View style={{ paddingTop: 10, paddingBottom: 8, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <SectionLabel>새 여행장</SectionLabel>

          {/*
            후보를 한 덩어리로 묶고 줄 사이를 실선으로 나눈다. 낱장 카드로
            흩어 두면 '여러 개 고를 수 있나' 로 읽힌다. 하나만 고르는 자리다.
          */}
          <View className="overflow-hidden rounded-xl border border-gray-200">
            {candidates.map((member, index) => {
              const on = member.memberId === selectedMemberId;
              return (
                <Pressable
                  key={member.memberId}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: submitting }}
                  accessibilityLabel={member.name}
                  disabled={submitting}
                  onPress={() => onSelect(member.memberId)}
                  className={`flex-row items-center px-3.5 py-3.5 active:opacity-70 ${
                    index === 0 ? "" : "border-t border-gray-100"
                  } ${on ? "bg-brand/5" : "bg-white"} ${submitting ? "opacity-40" : ""}`}
                >
                  {/* 이름만 둔다. 이니셜 아바타도 '참여 중' 도 넣지 않는다 (헤더 주석) */}
                  <Text
                    numberOfLines={1}
                    className={`flex-1 text-[15px] text-gray-900 ${on ? "font-bold" : ""}`}
                  >
                    {member.name}
                  </Text>
                  {/* 라디오는 오른쪽이다. 이름을 먼저 읽고 고른다 */}
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                      on ? "border-brand" : "border-gray-300"
                    }`}
                  >
                    {on ? <View className="h-2 w-2 rounded-full bg-brand" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/*
          ⚠️ 모임 이탈은 **여기서만 물을 수 있다.** 이 앱에 모임 나가기 통로가
             나가기 시트뿐이라, 위임 경로에서 빼면 여행장은 모임에서 나갈
             방법이 없어진다. (2026-09-15 다빈 지적)
          ⚠️ 개인 여행(groupName === null)에는 나갈 모임이 없어 그리지 않는다.
        */}
        {groupName !== null ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>모임은 어떻게 할까요?</SectionLabel>
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

        {/*
          ⚠️ 박스가 아니라 한 줄이다. (2026-09-21) 박스 두 개가 쌓이면 시트가
             길어져 두 선택과 버튼이 한 화면에 안 들어온다. 되돌릴 수 없다는
             말은 부제로 올렸으므로 여기서는 **고른 사람 이름만 되짚는다** —
             엉뚱한 사람을 고르고 넘기는 것을 막는 게 이 줄의 일이다.
        */}
        {picked || fundBalanceLabel ? (
          <View style={{ gap: 7 }}>
            {picked ? (
              <NoticeLine icon="person-outline" tone="brand">
                {`${picked.name}님이 새 여행장이 돼요`}
              </NoticeLine>
            ) : null}

            {/* ⚠️ 개인 몫을 계산하지 않는다. 총 잔액만 알리고 정산은 사람끼리 한다. (POL-MEM-006) */}
            {fundBalanceLabel ? (
              <NoticeLine icon="wallet-outline" tone="muted">
                {`지금 모인 돈이 ${fundBalanceLabel}이에요. 회원님 몫은 멤버들과 직접 정산해 주세요.`}
              </NoticeLine>
            ) : null}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** 섹션 머리. 두 질문을 눈으로 갈라 준다. */
function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#8B94A2" }}>{children}</Text>
  );
}

/** 버튼 위 확인 줄. 박스보다 가볍게 같은 말을 한다. */
function NoticeLine({
  icon,
  tone,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone: "brand" | "muted";
  children: string;
}) {
  const color = tone === "brand" ? "#6C3FA0" : "#9CA3AF";
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={15} color={color} style={{ marginTop: 1.5 }} />
      <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 19, color: "#5F6773" }}>
        {children}
      </Text>
    </View>
  );
}
