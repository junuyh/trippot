// ============================================================================
// TRIP-HOME-02 여행 유형 매거진 카드 (시안 v3)
//
// 결산이 확정된 여행이 어떤 여행이었는지를 **잡지 표지처럼** 보여준다.
// 누르면 TYPE-01 이 오버레이로 올라온다.
//
// ⚠️ 이 카드만 국가 포인트 컬러를 쓰지 않는다. 노란 바탕은 '여행 유형' 자체의
//    표식이라 나라가 바뀌어도 같아야 한다. 나라별로 색이 바뀌면 유형 카드인지
//    아닌지를 색으로 못 알아본다.
//
// ⚠️ 정확도 배지의 숫자는 **결산 확정 시점의 기록**이다. (queries/travelTypes.ts)
//    나중에 예산을 고쳐도 바뀌지 않는다.
//
// ⚠️ 도트 배경은 SVG Pattern 으로 그린다. RN 에는 radial-gradient 가 없다.
// ============================================================================
import { Image, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { TRAVEL_TYPE_COPY } from "@/lib/constants/travelTypeCopy";
import type { SpendingProfileType } from "@/lib/constants/status";

/** 시안의 --yellow. 유형 카드 고유색이다 */
const YELLOW = "#ffd92f";
const INK = "#111827";
/** 정확도 배지 바탕 */
const CORAL = "#ff6a78";

const CARD_HEIGHT = 370;

type Props = {
  code: SpendingProfileType;
  /** 예산 정확도. basis point. 9960 = 99.6% */
  accuracyBp: number;
  /** 배지에 함께 적는 영문 도시명 */
  destinationEn: string;
  onPress: () => void;
};

export function TravelTypeCard({
  code,
  accuracyBp,
  destinationEn,
  onPress,
}: Props) {
  const copy = TRAVEL_TYPE_COPY[code];
  const accuracy = (accuracyBp / 100).toFixed(1).replace(/\.0$/, "");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`여행 유형 ${copy.headline.replace("\n", " ")} 자세히 보기`}
      onPress={onPress}
      className="active:opacity-90"
      style={{
        height: CARD_HEIGHT,
        borderRadius: 19,
        backgroundColor: YELLOW,
        padding: 19,
        overflow: "hidden",
      }}
    >
      {/* 도트 바탕 */}
      <Svg
        width="100%"
        height={CARD_HEIGHT}
        style={{ position: "absolute", left: 0, top: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id="type-dots"
            width={15}
            height={15}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={1.3} cy={1.3} r={1.3} fill={INK} opacity={0.12} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={CARD_HEIGHT} fill="url(#type-dots)" />
      </Svg>

      {/*
        캐릭터. 오른쪽에 크게 깔고 글자 아래로 보낸다.
        ⚠️ 캐릭터가 없는 유형은 이모지로 대신한다. 지금 이미지는 균형형 하나뿐이다.
      */}
      {copy.image ? (
        <Image
          source={copy.image}
          style={{
            position: "absolute",
            right: -31,
            top: 63,
            width: "86%",
            height: 296,
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          style={{ position: "absolute", right: 18, top: 120, fontSize: 96 }}
        >
          {copy.emoji}
        </Text>
      )}

      <View className="flex-row items-start justify-between">
        <Text
          style={{
            fontSize: 9,
            fontWeight: "900",
            letterSpacing: 1,
            color: INK,
          }}
        >
          TRIPPOT TRAVEL TYPE
        </Text>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "900",
            letterSpacing: 1,
            color: INK,
          }}
        >
          TYPE {copy.no}
        </Text>
      </View>

      {/* 기울인 호수 태그. 시안의 :after 를 옮겼다 */}
      <View
        style={{
          position: "absolute",
          right: 17,
          top: 42,
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: INK,
          paddingHorizontal: 9,
          paddingVertical: 6,
          transform: [{ rotate: "5deg" }],
        }}
      >
        <Text style={{ fontSize: 8, fontWeight: "900", color: INK }}>
          NO.{copy.no} · {destinationEn}
        </Text>
      </View>

      <Text
        style={{
          marginTop: 40,
          fontSize: 36,
          lineHeight: 34,
          fontWeight: "900",
          letterSpacing: -2,
          color: INK,
        }}
      >
        {copy.headline}
      </Text>

      <View
        style={{
          alignSelf: "flex-start",
          maxWidth: "56%",
          marginTop: 10,
          backgroundColor: "rgba(255,255,255,0.64)",
          paddingHorizontal: 8,
          paddingVertical: 7,
          transform: [{ rotate: "-2deg" }],
        }}
      >
        <Text style={{ fontSize: 9, lineHeight: 14, color: INK }}>
          {copy.description}
        </Text>
      </View>

      {/* 예산 정확도 배지 */}
      <View
        style={{
          position: "absolute",
          left: 18,
          bottom: 14,
          width: 75,
          height: 75,
          borderRadius: 37.5,
          borderWidth: 1,
          borderColor: INK,
          backgroundColor: CORAL,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "-8deg" }],
        }}
      >
        <Text
          style={{
            fontSize: 8,
            fontWeight: "900",
            lineHeight: 11,
            textAlign: "center",
            color: INK,
          }}
        >
          BUDGET{"\n"}
          {accuracy}%{"\n"}ACCURACY
        </Text>
      </View>
    </Pressable>
  );
}
