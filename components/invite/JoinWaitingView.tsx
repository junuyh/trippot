// ============================================================================
// INV-03 요청 완료 · 대기 — 전체 화면
//
// 요청을 보낸 뒤, 그리고 PENDING 상태로 여행 라우트에 들어오려 할 때 이 화면을
// 보여준다. (POL-INV-022)
//
// ⚠️ 여기서도 여행지 · 일정까지만 보여준다. 아직 수락 전이다. (POL-INV-021)
//
// ⚠️ '요청 취소하기' 를 반드시 둔다. 취소할 길이 없으면 잘못 누른 사람이
//    영원히 대기 상태로 남고, 여행장의 요청 목록에도 계속 뜬다.
//
// 2026-09-16 · visual 만 바꿨다 (InviteShell · 저금통 그림 제거). 문구 · 버튼 · 정보는 그대로다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { InviteShell } from "./InviteShell";
import { INVITE_THEME } from "./inviteTheme";

type Props = {
  ownerDisplayName: string;
  destination: string;
  /** 여행 기간 표시용. 없으면 null */
  periodLabel: string | null;
  /**
   * 요청 취소. 넘기지 않으면 버튼을 그리지 않는다.
   * ⚠️ 취소 서버 함수(cancel_trip_join_request)가 원격에 붙기 전까지 화면이 넘기지 않는다.
   *    (2026-09-13 · PR #93 적용 후 연결) 취소할 길은 그때 열린다.
   */
  onCancelRequest?: () => void;
  canceling?: boolean;
};

export function JoinWaitingView({
  ownerDisplayName,
  destination,
  periodLabel,
  onCancelRequest,
  canceling = false,
}: Props) {
  return (
    <InviteShell
      footer={
        <View style={{ gap: 4 }}>
          {onCancelRequest ? (
            <View
              className="w-full flex-row items-center justify-center rounded-xl px-5 py-3.5"
              style={{ backgroundColor: INVITE_THEME.well, opacity: canceling ? 0.4 : 1 }}
              onTouchEnd={canceling ? undefined : onCancelRequest}
              accessibilityRole="button"
            >
              <Text className="text-base font-semibold" style={{ color: INVITE_THEME.ink }}>
                요청 취소하기
              </Text>
            </View>
          ) : null}
          {/* 초대한 사람은 여행장이 아닐 수 있다. 제목에는 '여행장' 을, 여기엔 초대자를 적는다. */}
          <Text
            style={{
              marginTop: 4,
              fontSize: 11.5,
              color: INVITE_THEME.muted,
              textAlign: "center",
            }}
          >
            {destination}
            {periodLabel ? ` · ${periodLabel}` : ""}
            {` · ${ownerDisplayName}님의 초대`}
          </Text>
        </View>
      }
    >
      <View className="items-center">
        <View
          className="mt-8 h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: INVITE_THEME.well }}
        >
          <Ionicons name="time-outline" size={26} color={INVITE_THEME.primary} />
        </View>

        <Text
          style={{
            marginTop: 18,
            fontSize: 20.5,
            fontWeight: "800",
            lineHeight: 29,
            color: INVITE_THEME.ink,
            textAlign: "center",
          }}
        >
          여행 참여 요청을 보냈어요
        </Text>

        <Text
          style={{
            marginTop: 9,
            fontSize: 13.5,
            lineHeight: 22,
            color: INVITE_THEME.body,
            textAlign: "center",
          }}
        >
          여행장이 확인하고 있어요.{"\n"}수락되면 여행 준비를 함께할 수 있어요.
        </Text>
      </View>
    </InviteShell>
  );
}
