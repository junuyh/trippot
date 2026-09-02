// ============================================================================
// BUDGET-01 카테고리별 예산 행 (시안 v3)
//
//   아이콘 · 이름 · 조정 상태 · 설정 예산 · 화살표
//
// ⚠️ 2026-09-02 · 시안 v3 · **막대와 예산 비율을 걷어냈다.**
//    여덟 행에 같은 막대가 반복되면 하나하나가 아니라 무늬로 읽힌다.
//    비율(share)도 마찬가지다 — 목표 대비 몇 퍼센트인지는 이 화면에서
//    사용자가 할 행동을 바꾸지 않는다. 준비 상태는 위쪽 준비 단계가 말한다.
//
// ⚠️ 대신 **지난 여행 분석에 따른 조정 금액**을 적는다.
//    이게 이 행에서 사용자가 판단해야 하는 유일한 정보다.
//
// ⚠️ 아이콘 뒤에 카테고리별 컬러 배경을 두지 않는다. (스펙)
//    국가 포인트 컬러 하나만 쓴다. 여덟 색이 동시에 보이면 포인트가 사라진다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import { CATEGORY_CODE_LABEL, type CategoryCode } from "@/lib/constants/status";

export type BudgetCategoryRowData = {
  id: string;
  categoryCode: CategoryCode;
  plannedAmount: number;
  preparedAmount: number;
  actualAmount: number;
  /**
   * 지난 여행 분석 추천이 적용돼 있으면 기본 추천 대비 조정액.
   * 적용돼 있지 않으면 null — '조정 없음' 으로 적는다.
   *
   * ⚠️ 여기 쓰는 값은 planned_amount − recommended_amount 다.
   *    recommended_amount 는 불변이라 이 차이가 곧 "얼마나 손댔는가" 다.
   *    (CLAUDE.md 4장)
   */
  adjustment: number | null;
};

const GREEN = "#16805d";

type Props = {
  category: BudgetCategoryRowData;
  theme: CountryTheme;
  onPress: (categoryId: string) => void;
};

export function BudgetCategoryRow({ category, theme, onPress }: Props) {
  const { adjustment } = category;
  const adjusted = adjustment !== null && adjustment !== 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 상세`}
      onPress={() => onPress(category.id)}
      className="active:bg-gray-50"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingHorizontal: 12,
        paddingVertical: 13,
      }}
    >
      <Text style={{ fontSize: 20, width: 26 }}>
        {CATEGORY_EMOJI[category.categoryCode]}
      </Text>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: "#141b28" }}>
          {CATEGORY_CODE_LABEL[category.categoryCode]}
        </Text>
        <Text
          style={{
            marginTop: 5,
            fontSize: 9,
            color: adjusted
              ? adjustment > 0
                ? theme.primary
                : GREEN
              : "#7c8695",
          }}
        >
          {adjusted
            ? `추천 반영 · ${adjustment > 0 ? "+" : "-"}${Math.abs(adjustment).toLocaleString("ko-KR")}원`
            : "조정 없음"}
        </Text>
      </View>

      {/* 금액을 축약하지 않는다. 174천이 아니라 174,000원이다 (스펙) */}
      <Text style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}>
        {category.plannedAmount.toLocaleString("ko-KR")}원
      </Text>

      <Ionicons name="chevron-forward" size={16} color="#a8afb9" />
    </Pressable>
  );
}
