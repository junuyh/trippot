// ============================================================================
// TRIP-HOME-02 여행 유형 카드 — 여행자 신분증 (2026-09-08 v2)
//
// 결산이 확정된 여행이 어떤 여행이었는지를 **유형색 바탕 위의 신분증**으로
// 보여준다. 누르면 TYPE-01 이 오버레이로 올라온다.
//
// v1 은 노란 잡지 표지였다. 유형이 달라도 같은 노란색이라 "무슨 유형인지" 가
// 색으로 안 갈렸고, 공유 이미지(TypeStoryCard)와 얼굴이 달랐다.
// 이제 홈 · 오버레이 · 공유 이미지가 같은 TypeIdCard 를 쓴다.
//
// ⚠️ 이 카드는 국가 포인트 컬러가 아니라 **유형색**을 쓴다. (travelTypeTheme)
//    나라가 바뀌어도 유형이 같으면 같은 색이다.
//
// ⚠️ 정확도 배지의 숫자는 **결산 확정 시점의 기록**이다. (queries/travelTypes.ts)
//    나중에 예산을 고쳐도 바뀌지 않는다.
//
// ⚠️ 도트 배경은 SVG Pattern 으로 그린다. RN 에는 radial-gradient 가 없다.
// ============================================================================
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { TRAVEL_TYPE_COPY } from "@/lib/constants/travelTypeCopy";
import { travelTypeTheme } from "@/lib/constants/travelTypeTheme";

import { TypeIdCard, type TypeIdCardProps } from "./TypeIdCard";

/** 열 유형 중 몇 번째인지 표시할 때 쓰는 총 개수 */
export const TYPE_COUNT = 10;

type Props = Omit<TypeIdCardProps, "tilted"> & {
  onPress: () => void;
};

export function TravelTypeCard({ onPress, ...card }: Props) {
  const copy = TRAVEL_TYPE_COPY[card.code];
  const theme = travelTypeTheme(card.code);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`여행 유형 ${copy.headline.replace("\n", " ")} 자세히 보기`}
      onPress={onPress}
      className="active:opacity-90"
      style={{
        borderRadius: 19,
        backgroundColor: theme.bg,
        padding: 18,
        overflow: "hidden",
      }}
    >
      {/* 도트 바탕 */}
      <Svg
        width="100%"
        height="100%"
        style={{ position: "absolute", left: 0, top: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <Pattern id="type-home-dots" width={15} height={15} patternUnits="userSpaceOnUse">
            <Circle cx={1.3} cy={1.3} r={1.3} fill={theme.ink} opacity={0.14} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#type-home-dots)" />
      </Svg>

      <View className="flex-row items-center justify-between">
        <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: theme.ink }}>
          TRIPPOT · TRAVEL TYPE
        </Text>
        <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1, color: theme.ink }}>
          NO. {copy.no} / {TYPE_COUNT}
        </Text>
      </View>

      <Text style={{ marginTop: 14, fontSize: 11, fontWeight: "800", color: theme.ink }}>
        나의 여행자 유형은
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 26,
          lineHeight: 32,
          fontWeight: "900",
          letterSpacing: -0.5,
          color: theme.ink,
        }}
      >
        {copy.headline}
      </Text>

      <View style={{ marginTop: 14 }}>
        <TypeIdCard {...card} />
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 10,
          fontWeight: "800",
          color: theme.ink,
          textAlign: "right",
        }}
      >
        이 유형이 나온 이유 보기 ›
      </Text>
    </Pressable>
  );
}
