// ============================================================================
// TRIP-HOME-02 카테고리별 결산 — 4열 그리드 (시안 v3)
//
// 준비 홈의 금고 그리드와 자리는 같지만 말하는 것이 다르다.
// 준비 홈은 "얼마나 모았나", 여기는 **"계획 대비 얼마나 썼나"** 다.
//
// ⚠️ 퍼센트를 쓰지 않는다. 결산에서 사용자가 알고 싶은 건 비율이 아니라
//    "얼마 남았나 / 얼마 더 썼나" 라는 금액이다.
//
// ⚠️ 초과는 국가 포인트 컬러, 절약은 그린이다. 같은 색으로 두면
//    초과와 절약이 한눈에 안 갈린다.
// ============================================================================
import { Text, View, type LayoutChangeEvent } from "react-native";
import { useState } from "react";

import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import { CATEGORY_CODE_LABEL, type CategoryCode } from "@/lib/constants/status";

const GREEN = "#19865f";
const GAP = 8;
const COLUMNS = 4;

export type SettlementVault = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
};

type Props = {
  theme: CountryTheme;
  categories: SettlementVault[];
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

export function SettlementVaultGrid({ theme, categories }: Props) {
  const [boxWidth, setBoxWidth] = useState(0);

  // ⚠️ 퍼센트 폭 + gap 을 함께 쓰면 RN 의 반올림 때문에 마지막 칸이 접힌다.
  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setBoxWidth(Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS));
  };

  return (
    <View
      className="flex-row flex-wrap"
      style={{ gap: GAP }}
      onLayout={handleLayout}
    >
      {categories.map((category) => {
        const diff = category.actualAmount - category.plannedAmount;
        /*
          ⚠️ 지출 기록이 없으면 '절약' 이라고 말하지 않는다.
             안 쓴 것과 아직 안 적은 것을 구분할 방법이 없다.
             계획 전액이 남은 것을 절약으로 세면 기록을 덜 한 사람이
             가장 알뜰한 여행자가 된다.
        */
        const label =
          category.actualAmount === 0
            ? "지출 기록 없음"
            : diff > 0
              ? `${won(diff)} 초과`
              : diff < 0
                ? `${won(diff)} 절약`
                : "예산과 동일";

        return (
          <View
            key={category.categoryCode}
            style={{
              width: boxWidth || undefined,
              height: 102,
              borderWidth: 1,
              borderColor: "#e8eaee",
              borderRadius: 13,
              paddingVertical: 10,
              paddingHorizontal: 8,
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 20 }}>
              {CATEGORY_EMOJI[category.categoryCode]}
            </Text>
            <View>
              <Text
                numberOfLines={1}
                style={{ fontSize: 10, fontWeight: "800", color: "#141b28" }}
              >
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  fontSize: 8,
                  letterSpacing: -0.2,
                  fontWeight: diff === 0 ? "400" : "900",
                  color:
                    diff > 0 ? theme.primary : diff < 0 ? GREEN : "#7c8695",
                }}
              >
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
