// ============================================================================
// TRIP-HOME-01 여행자금 관리 카드 (시안 v4)  → FUND-01
//
// 보딩패스가 "얼마나 모였는가" 를 말한다면 이 카드는 "무엇을 할 수 있는가" 다.
// 계좌를 연결하지 않은 사용자에게는 자금을 넣고 빼는 유일한 입구라,
// 내역이 하나도 없어도 이 카드를 숨기지 않는다.
//
// ⚠️ 여기서 금액을 다시 계산하지 않는다. 화면이 넘겨준 값을 그대로 그린다.
// ============================================================================
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  /** '직접 입력' 또는 연결한 기관명 */
  sourceLabel: string;
  /**
   * 가장 최근 입출금. 없으면 null.
   * amount 는 항상 양수이고 부호는 isDeposit 이 정한다.
   */
  latest: { amount: number; isDeposit: boolean } | null;
  /** 전체 입출금 건수 */
  totalCount: number;
  onPress: () => void;
};

export function FundManagerCard({
  theme,
  sourceLabel,
  latest,
  totalCount,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="여행자금 관리"
      onPress={onPress}
      className="active:opacity-90"
      style={{
        borderWidth: 1,
        borderColor: "#dfe3e8",
        borderRadius: 17,
        backgroundColor: "#fff",
        overflow: "hidden",
        shadowColor: "#111827",
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <View
        className="flex-row items-center"
        style={{
          gap: 11,
          paddingHorizontal: 15,
          paddingTop: 16,
          paddingBottom: 13,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: theme.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ fontSize: 19, fontWeight: "900", color: theme.onPrimary }}
          >
            ₩
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#111827" }}>
            입금·지출 내역을 한곳에서
          </Text>
          <Text
            style={{
              fontSize: 10,
              lineHeight: 15,
              color: "#788393",
              marginTop: 5,
            }}
          >
            직접 기록한 금액과 연결된 거래를 관리해요.
          </Text>
        </View>
        <View
          style={{
            width: 25,
            height: 25,
            borderRadius: 12.5,
            backgroundColor: theme.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: "900", color: theme.primary }}
          >
            ›
          </Text>
        </View>
      </View>

      <View
        className="flex-row"
        style={{
          marginHorizontal: 15,
          marginBottom: 15,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: "#e6e9ed",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, color: "#929ba8" }}>현재 관리 방식</Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: "#111827",
              marginTop: 5,
            }}
          >
            {sourceLabel}
          </Text>
        </View>
        <View
          style={{
            flex: 1.15,
            paddingLeft: 10,
            borderLeftWidth: 1,
            borderLeftColor: "#e6e9ed",
          }}
        >
          <Text style={{ fontSize: 9, color: "#929ba8" }}>최근 기록</Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: "800",
              marginTop: 5,
              color: latest
                ? latest.isDeposit
                  ? theme.primary
                  : "#111827"
                : "#929ba8",
            }}
          >
            {latest
              ? `${latest.isDeposit ? "+" : "−"}${latest.amount.toLocaleString("ko-KR")}원`
              : "아직 없어요"}
          </Text>
        </View>
        <View
          style={{
            flex: 0.72,
            paddingLeft: 10,
            borderLeftWidth: 1,
            borderLeftColor: "#e6e9ed",
          }}
        >
          <Text style={{ fontSize: 9, color: "#929ba8" }}>전체 내역</Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: "#111827",
              marginTop: 5,
            }}
          >
            {totalCount}건
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
