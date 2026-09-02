// ============================================================================
// SETTLE-01 남은 여행자금 (시안 v2)
//
// 결산에서 사용자가 마지막으로 확인하는 것은 "그래서 얼마 남았나" 다.
//
// ⚠️ 결산 중에는 이 숫자가 **아직 확정이 아니라는 것**을 반드시 적는다.
//    확인이 안 끝난 거래와 환불 예정이 남아 있으면 최종 사용액도 잔액도
//    바뀐다. 그 사실을 안 적으면 사용자는 이 금액을 믿고 돈을 써 버린다.
//
// ⚠️ 여기서 금액을 다시 계산하지 않는다. 화면이 넘겨준 값을 그대로 그린다.
// ============================================================================
import { Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  /** 누적 모금액 − 여행 지출 */
  remainingAmount: number;
  /** 누적 모금액 */
  raisedAmount: number;
  /** 실제 사용액 */
  actualAmount: number;
  /** 아직 확인이 안 끝난 지출 합계 */
  pendingAmount: number;
  /** 환불 예정 금액 */
  refundPendingAmount: number;
  /** 결산 중인가. 확정 후에는 숫자가 더 안 바뀐다 */
  closing: boolean;
  /** 모임통장 기준인지 직접 입력 기준인지 */
  sourceLabel: string;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function RemainingFundCard({
  theme,
  remainingAmount,
  raisedAmount,
  actualAmount,
  pendingAmount,
  refundPendingAmount,
  closing,
  sourceLabel,
}: Props) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 16,
        backgroundColor: "#fff",
        padding: 16,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text style={{ fontSize: 10, color: "#7c8695" }}>현재 남은 금액</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 22,
              fontWeight: "900",
              letterSpacing: -0.8,
              color: "#141b28",
            }}
          >
            {won(remainingAmount)}
          </Text>
        </View>
        <Text
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: closing ? "#fff3e0" : theme.primarySoft,
            fontSize: 10,
            fontWeight: "800",
            color: closing ? "#8a6410" : theme.primary,
          }}
        >
          {closing ? "확인 중" : "잔액 확인"}
        </Text>
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderColor: "#eef0f3",
          gap: 9,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 11, color: "#7c8695" }}>
            미확정 카드 결제
          </Text>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#141b28" }}>
            {won(pendingAmount)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 11, color: "#7c8695" }}>환불 예정</Text>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#141b28" }}>
            {won(refundPendingAmount)}
          </Text>
        </View>
      </View>

      <Text
        style={{
          marginTop: 12,
          paddingTop: 11,
          borderTopWidth: 1,
          borderColor: "#eef0f3",
          fontSize: 10,
          lineHeight: 16,
          color: "#8d96a4",
        }}
      >
        {closing
          ? "확인이 끝나기 전에는 최종 사용액과 잔액이 달라질 수 있어요."
          : `${sourceLabel} 기준 · 누적 모금액 ${won(raisedAmount)} 중 ${won(actualAmount)}을 여행비로 사용했어요.`}
      </Text>
    </View>
  );
}
