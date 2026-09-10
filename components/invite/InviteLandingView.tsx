// ============================================================================
// INV-02 초대 확인 — 전체 화면 (/invite/[token])
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
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";

import { PotMark } from "./PotMark";
import type { InvitePreview } from "./types";

type Props = {
  preview: InvitePreview;
  /** 여행 기간 표시용. 화면이 KST 기준으로 만들어 넘긴다. 없으면 null */
  periodLabel: string | null;
  /** 로그인 상태인가. false 면 CTA 문구가 가입 유도로 바뀐다 */
  signedIn: boolean;
  onRequestJoin: () => void;
  onDecline: () => void;
  /** 요청 전송 중 */
  requesting: boolean;
};

export function InviteLandingView({
  preview,
  periodLabel,
  signedIn,
  onRequestJoin,
  onDecline,
  requesting,
}: Props) {
  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-7">
        <PotMark variant="live" />

        <Text style={{ marginTop: 20, fontSize: 13, fontWeight: "700", color: "#0043D1" }}>
          {preview.ownerDisplayName}님의 초대
        </Text>

        <Text
          style={{
            marginTop: 8,
            fontSize: 25,
            fontWeight: "800",
            lineHeight: 34,
            letterSpacing: -0.8,
            color: "#111827",
            textAlign: "center",
          }}
        >
          {preview.destination} 여행{"\n"}같이 갈까요?
        </Text>

        <View
          className="mt-3.5 rounded-xl bg-gray-50 px-4 py-3"
          style={{ minWidth: 220 }}
        >
          {periodLabel ? (
            <Text style={{ fontSize: 13, color: "#4B5563", textAlign: "center" }}>
              {periodLabel}
            </Text>
          ) : null}
          <Text
            style={{
              marginTop: periodLabel ? 4 : 0,
              fontSize: 13,
              color: "#4B5563",
              textAlign: "center",
            }}
          >
            {preview.headcount}명이 함께 가는 여행이에요
          </Text>
        </View>

        {/* 무엇이 아직 잠겨 있는지 */}
        <Text
          style={{
            marginTop: 16,
            fontSize: 12,
            lineHeight: 19,
            color: "#8B94A2",
            textAlign: "center",
          }}
        >
          예산과 함께하는 사람은{"\n"}참여가 확정되면 볼 수 있어요
        </Text>
      </View>

      <View className="px-5 pb-9" style={{ gap: 4 }}>
        <Button
          label={signedIn ? "참여 요청하기" : "가입하고 참여 요청하기"}
          loading={requesting}
          onPress={onRequestJoin}
        />
        {!signedIn ? (
          <Text
            style={{
              marginTop: 4,
              fontSize: 11.5,
              lineHeight: 18,
              color: "#8B94A2",
              textAlign: "center",
            }}
          >
            TripPot이 처음이시죠? 간단한 가입 후 요청이 전달돼요.
          </Text>
        ) : null}
        <Button
          label="괜찮아요"
          variant="ghost"
          disabled={requesting}
          onPress={onDecline}
        />
      </View>
    </View>
  );
}
