// TRIP-HOME-02 여행 영수증.
//
// 시안의 receipt 를 옮겼다. 목표 vs 실제, 가장 큰 초과·절약, 남은 금액.
//
// ⚠️ '여행비 결산 자세히 보기' 는 영수증 안의 작은 링크가 아니라
//    영수증 **아래에 분리된 주요 CTA** 다. (스펙 4장)
//    결산은 이 화면에서 사용자가 할 수 있는 가장 중요한 행동이다.
import { Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import { CATEGORY_CODE_LABEL, type CategoryCode } from "@/lib/constants/status";

const GREEN = "#19865f";

type Props = {
  theme: CountryTheme;
  destinationEn: string;
  periodLabel: string;
  headcount: number;
  targetAmount: number;
  actualAmount: number;
  /** 가장 크게 초과한 카테고리. 없으면 null */
  topOver: { categoryCode: CategoryCode; diff: number } | null;
  /** 가장 크게 절약한 카테고리. 없으면 null */
  topSaved: { categoryCode: CategoryCode; diff: number } | null;
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

export function TripReceiptCard({
  theme,
  destinationEn,
  periodLabel,
  headcount,
  targetAmount,
  actualAmount,
  topOver,
  topSaved,
}: Props) {
  const remaining = targetAmount - actualAmount;
  const withinBudget = remaining >= 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 17,
        backgroundColor: "#fff",
        paddingHorizontal: 20,
        paddingVertical: 20,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 1.4,
          color: "#141b28",
        }}
      >
        {destinationEn} TRIP RECEIPT
      </Text>
      <Text
        style={{
          marginTop: 5,
          fontSize: 9,
          letterSpacing: 0.6,
          color: "#a8afb9",
        }}
      >
        {periodLabel} · {headcount} TRAVELERS
      </Text>

      <View
        style={{
          marginTop: 16,
          paddingTop: 15,
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderColor: "#d9dde3",
          gap: 11,
        }}
      >
        {[
          ["목표 여행비", won(targetAmount), "#141b28"],
          ["실제 여행비", won(actualAmount), "#141b28"],
        ].map(([label, value, color]) => (
          <View key={label} className="flex-row items-center justify-between">
            <Text style={{ fontSize: 11, color: "#7c8695" }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color }}>
              {value}
            </Text>
          </View>
        ))}

        {topOver ? (
          <View className="flex-row items-center justify-between">
            <Text style={{ fontSize: 11, color: "#7c8695" }}>
              가장 큰 초과 · {CATEGORY_CODE_LABEL[topOver.categoryCode]}
            </Text>
            <Text
              style={{ fontSize: 13, fontWeight: "800", color: theme.primary }}
            >
              +{won(topOver.diff)}
            </Text>
          </View>
        ) : null}

        {topSaved ? (
          <View className="flex-row items-center justify-between">
            <Text style={{ fontSize: 11, color: "#7c8695" }}>
              가장 큰 절약 · {CATEGORY_CODE_LABEL[topSaved.categoryCode]}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color: GREEN }}>
              −{won(topSaved.diff)}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          marginTop: 15,
          paddingTop: 14,
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderColor: "#d9dde3",
        }}
        className="flex-row items-center justify-between"
      >
        <Text style={{ fontSize: 11, color: "#7c8695" }}>
          {withinBudget ? "남은 금액" : "초과 금액"}
        </Text>
        <Text
          style={{
            fontSize: 17,
            fontWeight: "900",
            color: withinBudget ? GREEN : theme.primary,
          }}
        >
          {won(remaining)}
        </Text>
      </View>

      {targetAmount > 0 ? (
        <Text
          style={{
            marginTop: 10,
            fontSize: 10,
            textAlign: "center",
            color: withinBudget ? GREEN : theme.primary,
            fontWeight: "700",
          }}
        >
          {withinBudget ? "예산 안에서 여행 완료 ✓" : "예산을 넘겼어요"}
        </Text>
      ) : null}
    </View>
  );
}
