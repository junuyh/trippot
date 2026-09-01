// BUDGET-01 상단 요약 — 목표 여행비 티켓.
//
// 시안(.ticket)을 옮겼다. 위쪽은 옅은 회색에 목표 여행비, 아래쪽은 흰 바탕에
// 준비된 자금과 앞으로 필요한 금액, 그리고 준비율 경로.
//
// ⚠️ 금액을 축약하지 않는다. 174천이 아니라 174,000원이다. (스펙)
// ⚠️ 실제 지출 그래프를 넣지 않는다. 이 화면은 계획을 보는 자리다.
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  /** 카테고리별 설정 예산의 합계 */
  targetAmount: number;
  /**
   * 누적 모금액. 지금까지 실제로 모은 총금액이다.
   * ⚠️ 모임통장에서 결제해도 이 값은 줄지 않는다. (스펙 데이터 정의)
   */
  raisedAmount: number;
  /** 0~100 */
  progress: number;
  destinationKo: string;
  /** '현재 준비된 자금' 을 누르면 여행자금 관리(FUND-01)로 간다 */
  onPressFund?: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function BudgetTicketCard({
  theme,
  targetAmount,
  raisedAmount,
  progress,
  destinationKo,
  onPressFund,
}: Props) {
  const needed = Math.max(0, targetAmount - raisedAmount);
  const percent = Math.round(progress);
  const done = needed === 0 && targetAmount > 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 17,
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      <View
        style={{
          backgroundColor: "#f6f7f9",
          paddingHorizontal: 18,
          paddingTop: 17,
          paddingBottom: 15,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: "900",
            letterSpacing: 1.1,
            color: theme.primary,
          }}
        >
          TRIP BUDGET · {done ? "READY" : "PREPARING"}
        </Text>
        <Text style={{ marginTop: 13, fontSize: 11, color: "#7c8695" }}>
          목표 여행비
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
          {targetAmount.toLocaleString("ko-KR")}
          <Text style={{ fontSize: 14, letterSpacing: 0 }}>원</Text>
        </Text>
      </View>

      <View
        style={{ paddingHorizontal: 18, paddingTop: 15, paddingBottom: 17 }}
      >
        <View className="flex-row">
          {/* 자금을 더하거나 뺄 곳이 필요하다. 목록만 보는 화면이 아니다 */}
          <Pressable
            accessibilityRole={onPressFund ? "button" : undefined}
            accessibilityLabel={onPressFund ? "여행자금 관리" : undefined}
            disabled={!onPressFund}
            onPress={onPressFund}
            style={{ flex: 1 }}
            className={onPressFund ? "active:opacity-60" : undefined}
          >
            <Text style={{ fontSize: 10, color: "#7c8695" }}>
              현재 준비된 자금
            </Text>
            <View
              className="flex-row items-center"
              style={{ gap: 3, marginTop: 3 }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "800", color: "#141b28" }}
              >
                {won(raisedAmount)}
              </Text>
              {onPressFund ? (
                <Ionicons name="chevron-forward" size={13} color="#a8afb9" />
              ) : null}
            </View>
          </Pressable>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, color: "#7c8695" }}>
              앞으로 필요한 금액
            </Text>
            <Text
              style={{
                marginTop: 3,
                fontSize: 14,
                fontWeight: "800",
                color: theme.primary,
              }}
            >
              {done ? "다 모았어요" : won(needed)}
            </Text>
          </View>
        </View>

        {/* 준비율 경로. TRIP-HOME 보딩패스와 같은 은유를 쓴다 */}
        <View style={{ height: 25, marginTop: 11, justifyContent: "center" }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 12,
              borderTopWidth: 2,
              borderStyle: "dashed",
              borderColor: "#d9dde3",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 11,
              height: 3,
              borderRadius: 3,
              width: `${percent}%`,
              backgroundColor: theme.primary,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: `${percent}%`,
              top: 1,
              marginLeft: -11.5,
              width: 23,
              height: 23,
              borderRadius: 11.5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.primary,
            }}
          >
            <Ionicons name="airplane" size={12} color={theme.onPrimary} />
          </View>
        </View>

        <View className="flex-row justify-between">
          <Text style={{ fontSize: 9, color: "#9aa2ad" }}>{percent}% 준비</Text>
          <Text style={{ fontSize: 9, color: "#9aa2ad" }}>
            {destinationKo} 출발
          </Text>
        </View>
      </View>
    </View>
  );
}
