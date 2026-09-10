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
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";

import { PotMark } from "./PotMark";

type Props = {
  ownerDisplayName: string;
  destination: string;
  /** 여행 기간 표시용. 없으면 null */
  periodLabel: string | null;
  onCancelRequest: () => void;
  canceling: boolean;
};

export function JoinWaitingView({
  ownerDisplayName,
  destination,
  periodLabel,
  onCancelRequest,
  canceling,
}: Props) {
  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-7">
        <PotMark variant="waiting" size={90} />

        <Text
          style={{
            marginTop: 20,
            fontSize: 20.5,
            fontWeight: "800",
            lineHeight: 29,
            color: "#111827",
            textAlign: "center",
          }}
        >
          {ownerDisplayName}님의 확인을{"\n"}기다리고 있어요
        </Text>

        <Text
          style={{
            marginTop: 9,
            fontSize: 13.5,
            lineHeight: 22,
            color: "#4B5563",
            textAlign: "center",
          }}
        >
          수락되면 알림을 보내드릴게요.{"\n"}그때부터 여행 준비를 함께할 수 있어요.
        </Text>
      </View>

      <View className="px-5 pb-9" style={{ gap: 4 }}>
        <Button
          label="요청 취소하기"
          variant="secondary"
          loading={canceling}
          onPress={onCancelRequest}
        />
        <Text
          style={{
            marginTop: 4,
            fontSize: 11.5,
            color: "#8B94A2",
            textAlign: "center",
          }}
        >
          {destination}
          {periodLabel ? ` · ${periodLabel}` : ""}
        </Text>
      </View>
    </View>
  );
}
