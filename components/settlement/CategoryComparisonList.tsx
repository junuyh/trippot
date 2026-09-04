// ============================================================================
// SETTLE-01 카테고리별 결산 (시안 v2)
//
// 어느 카테고리에서 계획이 빗나갔는지 보여준다.
// 이 편차가 다음 여행의 개인화 추천(personalized_amount) 근거가 된다.
// (CLAUDE.md 2장 — 결산 → 개인화 → 다음 여행)
//
// ⚠️ 2026-09-03 · 시안 v2 · 막대를 걷어냈다. 여덟 줄에 같은 막대가 반복되면
//    하나하나가 아니라 무늬로 읽힌다. 초과·절약 금액이면 충분하다.
//
// ⚠️ 카테고리를 누르면 **그 카테고리의 BUDGET-02** 로 간다.
//    전체 지출 목록으로 보내지 않는다. "숙소에서 왜 초과됐지" 의 답은
//    숙소 계획과 숙소 지출에 있지, 전체 목록에 있지 않다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import { CATEGORY_CODE_LABEL, type CategoryCode } from "@/lib/constants/status";

const GREEN = "#19865f";

export type CategoryComparison = {
  /** budget_categories.id. 눌렀을 때 갈 곳을 정한다. 스냅샷이면 null */
  categoryId: string | null;
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
};

type Props = {
  theme: CountryTheme;
  categories: CategoryComparison[];
  /** 없으면 눌리지 않는다 (결산 확정 후 스냅샷) */
  onSelect?: (categoryId: string) => void;
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

export function CategoryComparisonList({ theme, categories, onSelect }: Props) {
  // 편차가 큰 순서로 보여준다. 계획대로 쓴 항목은 볼 이유가 적다.
  const sorted = [...categories].sort(
    (a, b) =>
      Math.abs(b.actualAmount - b.plannedAmount) -
      Math.abs(a.actualAmount - a.plannedAmount),
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 16,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      {sorted.map((category, index) => {
        const diff = category.actualAmount - category.plannedAmount;
        /*
          ⚠️ 지출 기록이 없으면 '절약' 이라고 말하지 않는다.
             안 쓴 것과 아직 안 적은 것을 구분할 방법이 없다.
        */
        const label =
          category.actualAmount === 0
            ? "지출 기록 없음"
            : diff > 0
              ? `${won(diff)} 초과`
              : diff < 0
                ? `${won(diff)} 절약`
                : "예산과 동일";
        const canPress = Boolean(onSelect && category.categoryId);

        return (
          <Pressable
            key={category.categoryCode}
            accessibilityRole={canPress ? "button" : undefined}
            accessibilityLabel={
              canPress
                ? `${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 상세`
                : undefined
            }
            disabled={!canPress}
            onPress={() =>
              category.categoryId && onSelect?.(category.categoryId)
            }
            className={
              canPress
                ? "flex-row items-center active:bg-gray-50"
                : "flex-row items-center"
            }
            style={{
              gap: 10,
              paddingHorizontal: 13,
              paddingVertical: 13,
              borderTopWidth: index === 0 ? 0 : 1,
              borderColor: "#eef0f3",
            }}
          >
            <Text style={{ fontSize: 19, width: 24 }}>
              {CATEGORY_EMOJI[category.categoryCode]}
            </Text>

            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "800", color: "#141b28" }}
              >
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 9, color: "#858e9c" }}>
                예산 {won(category.plannedAmount)}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{ fontSize: 12, fontWeight: "800", color: "#141b28" }}
              >
                {won(category.actualAmount)}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 9,
                  fontWeight: diff === 0 ? "400" : "900",
                  color:
                    diff > 0 ? theme.primary : diff < 0 ? GREEN : "#858e9c",
                }}
              >
                {label}
              </Text>
            </View>

            {canPress ? (
              <Ionicons name="chevron-forward" size={15} color="#a8afb9" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
