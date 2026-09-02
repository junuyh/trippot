// ============================================================================
// TRIP-HOME-02 이번 여행의 한 줄 기록 (시안 v3)
//
// 숫자만 늘어놓으면 "그래서 어땠는데" 에 답이 없다. 결산 결과를 한 문장으로
// 부른다. 유형(TYPE-01)이 '어떤 여행자인가' 라면 이건 '이번 여행은 어땠나' 다.
//
// ⚠️ 문장을 하드코딩하지 않는다. 가장 크게 초과·절약한 카테고리에서 만든다.
//    (lib/budget/tripRecord.ts) 문구를 고정하면 모든 여행이 같은 말을 한다.
//
// ⚠️ 여기 쓰는 숫자는 전부 화면이 넘겨준다. 다시 계산하지 않는다.
// ============================================================================
import { Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  /** 영문 도시명. 도장에 쓴다 */
  destinationEn: string;
  /** 두 줄로 끊어 쓰는 요약 문장 */
  headline: string;
  description: string;
  /** 예산 정확도. basis point */
  accuracyBp: number;
  /** 가장 많이 쓴 카테고리 이름. 없으면 null */
  topSpentLabel: string | null;
  /** 가장 많이 아낀 카테고리 이름. 없으면 null */
  topSavedLabel: string | null;
  hashtags: string[];
};

export function TripRecordCard({
  theme,
  destinationEn,
  headline,
  description,
  accuracyBp,
  topSpentLabel,
  topSavedLabel,
  hashtags,
}: Props) {
  const accuracy = (accuracyBp / 100).toFixed(1).replace(/\.0$/, "");

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 16,
        backgroundColor: "#fff",
        padding: 16,
        overflow: "hidden",
      }}
    >
      {/* 완주 도장. 시안의 :after 를 옮겼다 */}
      <View
        style={{
          position: "absolute",
          right: 13,
          top: 12,
          width: 69,
          height: 69,
          borderRadius: 34.5,
          borderWidth: 3,
          borderColor: theme.primary + "44",
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "7deg" }],
        }}
      >
        <Text
          style={{
            fontSize: 8,
            fontWeight: "900",
            lineHeight: 11,
            textAlign: "center",
            color: theme.primary + "7A",
          }}
        >
          {destinationEn}
          {"\n"}COMPLETED
        </Text>
      </View>

      <Text
        style={{
          fontSize: 8,
          fontWeight: "900",
          letterSpacing: 0.8,
          color: theme.primary,
        }}
      >
        MY {destinationEn} SUMMARY
      </Text>
      <Text
        style={{
          width: "72%",
          marginTop: 7,
          fontSize: 17,
          lineHeight: 23,
          fontWeight: "800",
          color: "#141b28",
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          width: "70%",
          marginTop: 5,
          fontSize: 9,
          lineHeight: 14,
          color: "#7c8695",
        }}
      >
        {description}
      </Text>

      <View
        className="flex-row"
        style={{
          marginTop: 17,
          paddingTop: 14,
          borderTopWidth: 1,
          borderColor: "#e8eaee",
        }}
      >
        {[
          { label: "예산 정확도", value: `${accuracy}%` },
          { label: "최대 지출", value: topSpentLabel ?? "—" },
          { label: "절약 1위", value: topSavedLabel ?? "—" },
        ].map((cell, index) => (
          <View
            key={cell.label}
            style={{
              flex: 1,
              alignItems: "center",
              borderLeftWidth: index === 0 ? 0 : 1,
              borderColor: "#e8eaee",
            }}
          >
            <Text style={{ fontSize: 8, color: "#7c8695" }}>{cell.label}</Text>
            <Text
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: "800",
                color: "#141b28",
              }}
            >
              {cell.value}
            </Text>
          </View>
        ))}
      </View>

      <View
        className="flex-row"
        style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}
      >
        {hashtags.map((tag) => (
          <Text
            key={tag}
            style={{
              borderRadius: 20,
              backgroundColor: "#f5f6f8",
              paddingHorizontal: 8,
              paddingVertical: 6,
              fontSize: 8,
              color: "#697382",
            }}
          >
            {tag}
          </Text>
        ))}
      </View>
    </View>
  );
}
