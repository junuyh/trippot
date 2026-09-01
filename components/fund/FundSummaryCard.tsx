// FUND-01 현재 여행자금.
//
// ⚠️ 누적 모금액과 현재 잔액을 **둘 다** 보여준다. (IA v2 §2-4-1)
//    하나만 보여주면 "800,000원 모았다는데 왜 20,000원밖에 없지" 를 설명할 수 없다.
//    큰 숫자는 누적 모금액이다 — 준비 진행률의 기준이라 이게 대표값이다.
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  /** 누적 모금액. 결제해도 줄지 않는다 */
  raisedAmount: number;
  /** 현재 잔액 = 누적 모금액 − 출금 합계 */
  balanceAmount: number;
  targetAmount: number;
  spentAmount: number;
  onAdd: () => void;
  onSubtract: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function FundSummaryCard({
  theme,
  raisedAmount,
  balanceAmount,
  targetAmount,
  spentAmount,
  onAdd,
  onSubtract,
}: Props) {
  const needed = Math.max(0, targetAmount - raisedAmount);
  const percent =
    targetAmount > 0
      ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100))
      : 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 17,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor: "#f6f7f9",
          paddingHorizontal: 18,
          paddingTop: 17,
          paddingBottom: 16,
        }}
      >
        <Text style={{ fontSize: 11, color: "#7c8695" }}>
          지금까지 모은 여행자금
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontSize: 33,
            lineHeight: 39,
            fontWeight: "900",
            letterSpacing: -1.5,
            color: "#141b28",
          }}
        >
          {raisedAmount.toLocaleString("ko-KR")}
          <Text style={{ fontSize: 14, letterSpacing: 0 }}>원</Text>
        </Text>

        <View
          style={{
            height: 6,
            borderRadius: 6,
            backgroundColor: "#e6e9ed",
            marginTop: 14,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 6,
              backgroundColor: theme.primary,
            }}
          />
        </View>
        <View className="flex-row justify-between" style={{ marginTop: 7 }}>
          <Text
            style={{ fontSize: 10, fontWeight: "800", color: theme.primary }}
          >
            {percent}% 준비
          </Text>
          <Text style={{ fontSize: 10, color: "#858e9c" }}>
            {targetAmount > 0 ? `목표 ${won(targetAmount)}` : "목표 미설정"}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingVertical: 14,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, color: "#858e9c" }}>현재 잔액</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "800",
              color: "#141b28",
            }}
          >
            {won(balanceAmount)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 9, color: "#858e9c" }}>쓴 금액</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "800",
              color: "#141b28",
            }}
          >
            {won(spentAmount)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, color: "#858e9c" }}>더 모아야 해요</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "800",
              color: theme.primary,
            }}
          >
            {needed > 0 ? won(needed) : "다 모았어요"}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderColor: "#eceef1",
        }}
      >
        {[
          {
            label: "자금 추가",
            icon: "add-circle-outline" as const,
            onPress: onAdd,
            tone: theme.primary,
          },
          {
            label: "자금 차감",
            icon: "remove-circle-outline" as const,
            onPress: onSubtract,
            tone: "#66707e",
          },
        ].map((action, index) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            className="active:bg-gray-50"
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              paddingVertical: 14,
              borderLeftWidth: index === 1 ? 1 : 0,
              borderColor: "#eceef1",
            }}
          >
            <Ionicons name={action.icon} size={15} color={action.tone} />
            <Text
              style={{ fontSize: 12, fontWeight: "800", color: action.tone }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
