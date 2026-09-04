// ============================================================================
// BUDGET-02 상단 예산 요약 (시안 v3)
//
//   설정 예산 (큰 숫자) · 세부 계획 · 미계획 예산 · 실제 사용
//
// ⚠️ 2026-09-02 · 시안 v3 · **계획·지출 막대를 걷어냈다.**
//    한 막대에 계획 비율과 지출 비율을 겹쳐 놓으면, 둘을 더해서 읽어야 하는지
//    따로 읽어야 하는지가 안 보인다. 네 숫자를 나란히 두는 쪽이 정확하다.
//
// ⚠️ 계획과 지출을 **중복 차감하지 않는다.** (스펙 11장)
//    계획은 "쓰기로 한 것", 지출은 "실제로 쓴 것"이다. 둘을 함께 빼면
//    같은 돈을 두 번 차감하게 된다.
//      미계획 예산 = 설정 예산 − 세부 계획 합계   ← 지출은 빼지 않는다
//
// ⚠️ '금고 배분' 칸을 뺐다. 금고 배분은 결제 예정 순서에 따른 가상 배분이라
//    이 카테고리에 실제로 떼어 둔 돈이 아니다. 네 숫자 사이에 섞이면
//    "이 카테고리에 62만원이 있다" 로 잘못 읽힌다. (BUDGET-01 준비 단계 참고)
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

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
  onStartEdit,
}: Props) {
  // 미계획 예산 = 아직 어디에 쓸지 정하지 않은 금액. 음수가 될 수 없다.
  const unplanned = Math.max(0, budgetAmount - plannedTotal);

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

        {/*
          ⚠️ onStartEdit 이 없으면 **버튼 자체를 그리지 않는다.**
             예전에는 onPress 만 undefined 로 넘겨서, 여행이 끝난 뒤에도
             버튼이 그대로 보이고 눌러도 아무 일이 없었다.
             누를 수 없는 버튼을 보여주는 것이 없는 것보다 나쁘다.
        */}
        {onStartEdit ? (
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
        ) : null}
      </View>

      {/* 설정 예산 수정은 바텀시트에서 한다 (스펙: 별도 적용 버튼 없음) */}

      {/* 세부 계획 / 미계획 예산 / 실제 사용 */}
      <View className="flex-row" style={{ marginTop: 15 }}>
        {[
          { label: "세부 계획", value: plannedTotal, danger: false },
          { label: "미계획 예산", value: unplanned, danger: false },
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

      {/*
        ── 예산 대비 결과 ──
        ⚠️ 지출이 하나라도 있을 때만 그린다. 아직 아무것도 안 쓴 카테고리에
           "예산 전액을 아꼈다" 고 말하면, 기록을 안 한 사람이 가장 알뜰한
           여행자가 된다. (SETTLE-01 · 한 줄 기록과 같은 기준)

        ⚠️ 계획이 아니라 **설정 예산**과 비교한다. 사용자가 이 화면에서 묻는 것은
           "내가 잡은 예산 안에서 썼나" 이지 "계획대로 썼나" 가 아니다.
      */}
      {spentTotal > 0 ? (
        <View
          className="flex-row items-center"
          style={{
            gap: 7,
            marginTop: 14,
            borderRadius: 11,
            backgroundColor: spentTotal > budgetAmount ? "#fff2f2" : "#eef8f2",
            paddingHorizontal: 13,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 13 }}>
            {spentTotal > budgetAmount ? "⚠️" : "✅"}
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: "700",
              color: spentTotal > budgetAmount ? "#b3403f" : "#1c6f4f",
            }}
          >
            {spentTotal > budgetAmount
              ? `예산보다 ${won(spentTotal - budgetAmount)} 더 썼어요`
              : spentTotal === budgetAmount
                ? "예산에 딱 맞췄어요"
                : `예산보다 ${won(budgetAmount - spentTotal)} 아꼈어요`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
