// ============================================================================
// INV-02 초대 확인 — 전체 화면 (/invite/[token] · /invite/by/[inviteId])
//
// ⚠️⚠️ 링크만 있으면 **누구나 여는 화면이다.** ⚠️⚠️
//       여행지 · 일정 · 인원 · 초대한 사람 이름까지만 보여준다.
//       예산 · 목표 금액 · 모은 돈 · 계좌 · 멤버 목록은 절대 넣지 않는다.
//       (POL-INV-020 · 021)
//
//       props 타입이 InvitePreview 인 것도 그래서다. 여기에 금액 필드가 없으면
//       나중에 누가 실수로 그려 넣을 수 없다.
//
// ⚠️ 무엇이 아직 안 보이는지 사용자에게 알린다. 안 알리면 "정보가 부실한
//    앱" 으로 읽힌다. 잠겨 있다고 말하면 수락받을 이유가 생긴다.
//
// ⚠️ 미가입자 분기는 **문구만** 바꾼다. 실제 가입 화면으로 보내는 건 화면 파일이
//    한다. (전제 ② — 호출부만 남긴다)
//
// 2026-09-16 · visual 만 바꿨다 (InviteShell: 보라 배경 + 흰 카드 + 로고 · 저금통 그림 제거).
//    문구 · 버튼 · 상태 분기 · 정보 구조는 그대로다.
// ============================================================================
import { Text, View } from "react-native";

import { InviteGhostButton, InvitePrimaryButton } from "./InviteButtons";
import { InviteShell } from "./InviteShell";
import { INVITE_THEME } from "./inviteTheme";
import type { InviteMyState, InvitePreview } from "./types";

type Props = {
  preview: InvitePreview;
  /** 여행 기간 표시용. 화면이 KST 기준으로 만들어 넘긴다. 없으면 null */
  periodLabel: string | null;
  /** 로그인 상태인가. false 면 CTA 문구가 가입 유도로 바뀐다 */
  signedIn: boolean;
  /**
   * 내가 이 여행과 어떤 관계인가. (docs/12 §3 my_state · 2026-09-13)
   *   NONE · LEFT   참여 요청 가능
   *   ACTIVE        이미 참여 중 — 요청 버튼 대신 안내 · 여행으로 가기
   * PENDING · REJECTED 는 이 화면이 아니라 화면 파일이 다른 뷰로 보낸다.
   */
  myState: Extract<InviteMyState, "NONE" | "LEFT" | "ACTIVE">;
  onRequestJoin: () => void;
  onDecline: () => void;
  /** 이미 참여 중일 때 여행으로 가기. ACTIVE 에서만 쓴다 */
  onGoToTrip?: () => void;
  /** 요청 전송 중 */
  requesting: boolean;
};

export function InviteLandingView({
  preview,
  periodLabel,
  signedIn,
  myState,
  onRequestJoin,
  onDecline,
  onGoToTrip,
  requesting,
}: Props) {
  // 인원이 찼는가. ⚠️ 링크 상태가 아니다 — 요청은 보낼 수 있고 수락만 막힌다. (docs/12 §3)
  const full = preview.activeMemberCount >= preview.headcount;

  return (
    <InviteShell>
      <View className="items-center">
        <Text style={{ marginTop: 22, fontSize: 13, fontWeight: "700", color: INVITE_THEME.primary }}>
          {preview.ownerDisplayName}님의 초대
        </Text>

        <Text
          style={{
            marginTop: 8,
            fontSize: 25,
            fontWeight: "800",
            lineHeight: 34,
            letterSpacing: -0.8,
            color: INVITE_THEME.ink,
            textAlign: "center",
          }}
        >
          {preview.destination} 여행{"\n"}같이 갈까요?
        </Text>

        <View
          className="mt-3.5 rounded-xl px-4 py-3"
          style={{ minWidth: 220, backgroundColor: INVITE_THEME.well }}
        >
          {periodLabel ? (
            <Text style={{ fontSize: 13, color: INVITE_THEME.body, textAlign: "center" }}>
              {periodLabel}
            </Text>
          ) : null}
          {/* 예정 인원과 실제 참여 인원은 다른 수다. 둘 다 적는다. (docs/11 §1-1) */}
          <Text
            style={{
              marginTop: periodLabel ? 4 : 0,
              fontSize: 13,
              color: INVITE_THEME.body,
              textAlign: "center",
            }}
          >
            {preview.headcount}명 예정 · {preview.activeMemberCount}명 참여 중
          </Text>
        </View>

        {/* 무엇이 아직 잠겨 있는지 · 어떻게 확정되는지 */}
        <Text
          style={{
            marginTop: 16,
            fontSize: 12,
            lineHeight: 19,
            color: INVITE_THEME.muted,
            textAlign: "center",
          }}
        >
          {myState === "ACTIVE"
            ? "이미 이 여행에 함께하고 있어요"
            : "참여 요청을 보내면 여행장이 확인 후 수락할 수 있어요.\n예산과 함께하는 사람은 참여가 확정되면 볼 수 있어요"}
        </Text>

        {/* 인원이 찼어도 링크를 막지 않는다. 요청은 되고, 여행장이 인원을 늘리면 수락된다. */}
        {full && myState !== "ACTIVE" ? (
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              lineHeight: 19,
              color: "#B45309",
              textAlign: "center",
            }}
          >
            지금은 예정 인원이 다 찼어요.{"\n"}요청은 보낼 수 있고, 여행장이 인원을 늘리면 수락돼요.
          </Text>
        ) : null}
      </View>

      <View className="mt-7" style={{ gap: 4 }}>
        {myState === "ACTIVE" ? (
          <InvitePrimaryButton label="여행으로 가기" onPress={onGoToTrip ?? onDecline} />
        ) : (
          <InvitePrimaryButton
            label={
              !signedIn
                ? "가입하고 참여 요청하기"
                : myState === "LEFT"
                  ? "다시 참여 요청하기"
                  : "참여 요청하기"
            }
            loading={requesting}
            onPress={onRequestJoin}
          />
        )}
        {!signedIn ? (
          <Text
            style={{
              marginTop: 4,
              fontSize: 11.5,
              lineHeight: 18,
              color: INVITE_THEME.muted,
              textAlign: "center",
            }}
          >
            TripPot이 처음이시죠? 간단한 가입 후 요청이 전달돼요.
          </Text>
        ) : null}
        <InviteGhostButton label="괜찮아요" disabled={requesting} onPress={onDecline} />
      </View>
    </InviteShell>
  );
}
