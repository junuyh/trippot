// FUND-01 최근 입출금 — 카테고리 구분 없이 최신순.
//
// ⚠️ 입금과 출금을 한 목록에 두되 부호로 구분한다.
//    출금만 예산 실제 사용액에 합산된다. 입금은 자금 유입이다.
//
// ⚠️ 아이콘·부호·상태 문구는 transactionIcon.ts 하나에서 정한다. (시안 v1)
//    전체 내역(FUND-03)과 같은 거래가 다른 그림으로 보이면 안 된다.
import { format, parseISO } from "date-fns";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  amountSign,
  statusLabel,
  transactionIcon,
  type IconInput,
} from "@/lib/constants/transactionIcon";

export type RecentFundItem = IconInput & {
  id: string;
  name: string | null;
  amount: number;
  occurredAt: string;
  /** 확인이 필요한 거래인가 */
  needsReview: boolean;
  /**
   * 이 거래를 손으로 적은 사람의 이름. 날짜 아래에 붙는다.
   *
   * ⚠️ 모임 여행에서만 채운다. 개인 여행은 적은 사람이 나 하나라 이름이
   *    줄마다 반복될 뿐이다. 계좌에서 들어온 거래와 옛 기록은 null 이다 —
   *    모르는 것을 지어내지 않는다. (2026-09-21 테스트)
   */
  authorName?: string | null;
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
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: "#f5f7f9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16 }}>{transactionIcon(item)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, color: "#141b28" }}>
              {item.name ?? "이름 없는 거래"}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 10, color: "#858e9c" }}>
              {format(parseISO(item.occurredAt), "M월 d일")}
              {item.authorName ? ` · ${item.authorName}` : ""}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: amountSign(item) === "+" ? theme.primary : "#141b28",
              }}
            >
              {amountSign(item)}
              {item.amount.toLocaleString("ko-KR")}원
            </Text>
            <Text
              style={{
                marginTop: 3,
                fontSize: 9,
                fontWeight: "700",
                color: item.needsReview ? "#e83d4d" : "#a3a9b3",
              }}
            >
              {statusLabel(item)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
