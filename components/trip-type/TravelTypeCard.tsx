// TRIP-HOME-02 여행 유형 카드.
//
// 결산이 확정된 뒤에만 보여준다. 결산 중에는 임시 유형을 확정 결과처럼
// 노출하지 않는다. (IA v2 §2-6-3)
import { Image, Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import { TRAVEL_TYPE_COPY } from "@/lib/constants/travelTypeCopy";
import type { SpendingProfileType } from "@/lib/constants/status";

type Props = {
  theme: CountryTheme;
  code: SpendingProfileType;
  /** 예산 정확도. basis point. 9960 = 99.6% */
  accuracyBp: number;
  onPress: () => void;
};

export function TravelTypeCard({ theme, code, accuracyBp, onPress }: Props) {
  const copy = TRAVEL_TYPE_COPY[code];
  const accuracy = (accuracyBp / 100).toFixed(1).replace(/\.0$/, "");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="여행 유형 자세히 보기"
      onPress={onPress}
      className="active:opacity-80"
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 18,
        backgroundColor: "#fff",
        padding: 20,
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "900",
          letterSpacing: 1.2,
          color: theme.primary,
        }}
      >
        TRIPPOT TRAVEL TYPE
      </Text>

      <View
        className="flex-row items-center"
        style={{ marginTop: 14, gap: 14 }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "900",
              color: "#a8afb9",
              letterSpacing: 1,
            }}
          >
            TYPE {copy.no}
          </Text>
          <Text
            style={{
              marginTop: 5,
              fontSize: 22,
              lineHeight: 30,
              fontWeight: "900",
              letterSpacing: -0.8,
              color: "#141b28",
            }}
          >
            {copy.headline}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 11,
              lineHeight: 17,
              color: "#7c8695",
            }}
          >
            {copy.description}
          </Text>
        </View>

        {/* 캐릭터가 없는 유형은 이모지로 대신한다 */}
        {copy.image ? (
          <Image
            source={copy.image}
            style={{ width: 96, height: 84 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={{ fontSize: 54 }}>{copy.emoji}</Text>
        )}
      </View>

      <View
        className="flex-row items-center justify-between"
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderColor: "#eef0f3",
        }}
      >
        <View className="flex-row items-baseline" style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: "900",
              letterSpacing: 1,
              color: "#a8afb9",
            }}
          >
            BUDGET ACCURACY
          </Text>
          <Text
            style={{ fontSize: 15, fontWeight: "900", color: theme.primary }}
          >
            {accuracy}%
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: "#a8afb9" }}>›</Text>
      </View>
    </Pressable>
  );
}
