// ============================================================================
// CXL-04 요청 완료 / 취소 완료 — 전체 화면
//
// **같은 라우트를 결과로 분기한다.** 스펙 §7 의 지시다.
//   requested  모임 여행에서 취소를 요청했다 → 동의를 기다린다
//   canceled   전원 동의로 확정됐거나, 개인 여행이라 바로 취소됐다
//
// ⚠️ 두 경우의 다음 행동이 완전히 다르다.
//     requested → 동의 현황 보기 (CXL-07)
//     canceled  → 취소 되돌리기 (CXL-05)
//    같은 화면처럼 보이지만 CTA 를 헷갈리면 안 된다.
//
// ⚠️ canceled 의 되돌리기는 **CXL-05 를 항상 거친다.** 여기서 바로 실행하지
//    않는다. (POL-CXL-036)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "@/components/ui";

type Props = {
  kind: "requested" | "canceled";

  destination: string;
  /** requested 일 때 동의 대상 수 */
  voteTargetCount: number;
  /** requested 일 때 만료일 표시용 */
  expiresAtLabel: string;

  /** requested → CXL-07 */
  onOpenProgress: () => void;
  onGoTripHome: () => void;

  /** canceled → CXL-05 */
  onOpenRestore: () => void;
  onGoCanceledTrip: () => void;
};

export function CancelDoneView({
  kind,
  destination,
  voteTargetCount,
  expiresAtLabel,
  onOpenProgress,
  onGoTripHome,
  onOpenRestore,
  onGoCanceledTrip,
}: Props) {
  const requested = kind === "requested";

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-7">
        <View
          className="items-center justify-center rounded-full bg-gray-100"
          style={{ width: 62, height: 62 }}
        >
          <Ionicons
            name={requested ? "paper-plane-outline" : "archive-outline"}
            size={26}
            color="#4B5563"
          />
        </View>

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
          {requested ? "취소 요청을 보냈어요" : `${destination} 여행을\n취소했어요`}
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
          {requested
            ? `멤버 ${voteTargetCount}명이 모두 동의하면\n여행이 취소돼요.`
            : "지금까지 준비한 예산과 여행 정보는\n그대로 보관해 뒀어요."}
        </Text>
      </View>

      <View className="px-5 pb-9" style={{ gap: 8 }}>
        {requested ? (
          <>
            <Button label="동의 현황 보기" onPress={onOpenProgress} />
            <Button label="여행 홈으로" variant="ghost" onPress={onGoTripHome} />
            <Text
              style={{
                fontSize: 11.5,
                lineHeight: 18,
                color: "#8B94A2",
                textAlign: "center",
              }}
            >
              {expiresAtLabel}까지 동의가 모이지 않으면 요청이 자동으로 취소돼요.
            </Text>
          </>
        ) : (
          <>
            {/* ⚠️ 여기서 바로 되돌리지 않는다. CXL-05 를 거친다 */}
            <Button label="취소 되돌리기" variant="secondary" onPress={onOpenRestore} />
            <Button label="취소된 여행 보기" onPress={onGoCanceledTrip} />
            <Text
              style={{
                fontSize: 11.5,
                lineHeight: 18,
                color: "#8B94A2",
                textAlign: "center",
              }}
            >
              3일 안에는 되돌릴 수 있어요.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
