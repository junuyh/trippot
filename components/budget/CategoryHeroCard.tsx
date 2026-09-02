// BUDGET-02 상단 예산 요약.
// HTML 시안(.hero)의 치수를 옮겼다. radius 17 · padding 19 · budget 34px
//
// ⚠️ 계획과 지출을 **중복 차감하지 않는다.** (스펙 11장)
//      계획 비율 = 선택된 계획 합계 ÷ 설정 예산
//      지출 비율 = 실제 지출 합계 ÷ 설정 예산
//      남은 금액 = 설정 예산 - 실제 지출 합계      ← 계획은 빼지 않는다
//
//    계획은 "쓰기로 한 것", 지출은 "실제로 쓴 것"이다. 둘을 함께 빼면
//    같은 돈을 두 번 차감하게 된다.
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { Button, CurrencyInput } from "@/components/ui";
import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  emoji: string;
  /** 설정 예산 (budget_categories.planned_amount) */
  budgetAmount: number;
  /** 선택된 세부 계획 합계 */
  plannedTotal: number;
  /** 실제 지출 합계 */
  spentTotal: number;
  /** 금고 배분액 */
  preparedAmount: number;
  recommendedAmount: number;

  /** 없으면 예산 수정 버튼을 감춘다 (결산 중·완료) */
  onStartEdit?: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function CategoryHeroCard({
  theme,
  emoji,
  budgetAmount,
  plannedTotal,
  spentTotal,
  preparedAmount,
  recommendedAmount,
  onStartEdit,
}: Props) {
  const planRate =
    budgetAmount > 0 ? Math.round((plannedTotal / budgetAmount) * 100) : 0;
  const spendRate =
    budgetAmount > 0 ? Math.round((spentTotal / budgetAmount) * 100) : 0;
  const remaining = budgetAmount - spentTotal;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e7e9ed",
        borderRadius: 17,
        backgroundColor: "#fff",
        padding: 19,
        shadowColor: "#162339",
        shadowOpacity: 0.07,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text style={{ fontSize: 15 }}>{emoji}</Text>
            <Text style={{ fontSize: 11, color: "#7d8797" }}>설정 예산</Text>
          </View>
          {
            <Text
              style={{
                fontSize: 34,
                lineHeight: 40,
                fontWeight: "900",
                letterSpacing: -1.7,
                color: "#121a2a",
                marginTop: 5,
              }}
            >
              {budgetAmount.toLocaleString("ko-KR")}
              <Text style={{ fontSize: 15 }}>원</Text>
            </Text>
          }
        </View>

        {
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="예산 수정"
            onPress={onStartEdit}
            style={{
              backgroundColor: "#f5f6f8",
              borderRadius: 9,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
            className="active:opacity-70"
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#5d6674" }}>
              ✎ 예산 수정
            </Text>
          </Pressable>
        }
      </View>

      {/* 설정 예산 수정은 바텀시트에서 한다 (스펙: 별도 적용 버튼 없음) */}
      {/* 계획 비율 막대 */}
      <View
        style={{
          height: 7,
          borderRadius: 8,
          backgroundColor: "#edf0f2",
          marginTop: 18,
          marginBottom: 8,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            borderRadius: 8,
            width: `${Math.min(100, planRate)}%`,
            backgroundColor: theme.primary,
          }}
        />
      </View>

      <View className="flex-row justify-between">
        <Text style={{ fontSize: 10, color: "#7d8797" }}>
          계획{" "}
          <Text style={{ color: theme.primary, fontWeight: "700" }}>
            {planRate}%
          </Text>
          {"  ·  "}지출{" "}
          <Text style={{ color: theme.primary, fontWeight: "700" }}>
            {spendRate}%
          </Text>
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: remaining < 0 ? theme.primary : "#7d8797",
          }}
        >
          {remaining < 0 ? `${won(-remaining)} 초과` : `${won(remaining)} 남음`}
        </Text>
      </View>

      {/* 금고 배분 / 세부 계획 / 실제 사용 */}
      <View
        className="flex-row"
        style={{
          marginTop: 17,
          paddingTop: 15,
          borderTopWidth: 1,
          borderColor: "#e7e9ed",
        }}
      >
        {[
          { label: "금고 배분", value: preparedAmount, danger: false },
          { label: "세부 계획", value: plannedTotal, danger: false },
          {
            label: "실제 사용",
            value: spentTotal,
            danger: spentTotal > budgetAmount,
          },
        ].map((cell, index) => (
          <View
            key={cell.label}
            style={{
              flex: 1,
              paddingLeft: index === 0 ? 0 : 11,
              borderLeftWidth: index === 0 ? 0 : 1,
              borderColor: "#e7e9ed",
            }}
          >
            <Text style={{ fontSize: 9, color: "#7d8797" }}>{cell.label}</Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                marginTop: 5,
                color: cell.danger ? theme.primary : "#121a2a",
              }}
            >
              {won(cell.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
