// FUND-01 최근 입출금 — 카테고리 구분 없이 최신순.
//
// ⚠️ 입금과 출금을 한 목록에 두되 부호로 구분한다.
//    출금만 예산 실제 사용액에 합산된다. 입금은 자금 유입이다.
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

export type RecentFundItem = {
  id: string;
  name: string | null;
  amount: number;
  deposit: boolean;
  occurredAt: string;
};

type Props = {
  theme: CountryTheme;
  transactions: RecentFundItem[];
  onSelect: (transactionId: string) => void;
};

export function RecentFundList({ theme, transactions, onSelect }: Props) {
  if (transactions.length === 0) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e8eaee",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 11, color: "#858e9c", textAlign: "center" }}>
          아직 입출금 내역이 없어요.
        </Text>
        <Text
          style={{
            marginTop: 5,
            fontSize: 10,
            color: "#a8afb9",
            textAlign: "center",
          }}
        >
          자금 추가로 모은 금액을 기록해 보세요.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {transactions.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.name ?? "이름 없는 거래"} 상세`}
          onPress={() => onSelect(item.id)}
          className="active:bg-gray-50"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            paddingHorizontal: 14,
            paddingVertical: 13,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: "#f1f3f5",
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: item.deposit ? "#e8f7f0" : "#eef2f8",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={item.deposit ? "arrow-down" : "arrow-up"}
              size={14}
              color={item.deposit ? "#2d8a63" : "#5d6674"}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, color: "#141b28" }}>
              {item.name ?? "이름 없는 거래"}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 10, color: "#858e9c" }}>
              {format(parseISO(item.occurredAt), "M월 d일")}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: item.deposit ? theme.primary : "#141b28",
            }}
          >
            {item.deposit ? "+" : "−"}
            {item.amount.toLocaleString("ko-KR")}원
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
