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
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Text as SvgText,
  TextPath,
} from "react-native-svg";

import type { CountryTheme } from "@/lib/constants/countryTheme";

/** 도장 한 변 */
const STAMP = 84;
/** 바깥을 둘러싼 눌린 자국. 12도마다 하나 */
const TEETH = Array.from({ length: 30 }, (_, index) => index * 12);

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
      {/*
        ── 여권 도장 ──
        ⚠️ 동그라미 하나에 글자를 넣은 '일반 도장' 이 아니다. 실제 입국
           도장처럼 **이중 테두리 · 위아래 호를 따라 도는 글자 · 가운데 가로
           띠 · 톱니 자국** 을 둔다. 이 카드가 여행의 기념품 역할을 하는
           자리라, 도장이 밋밋하면 카드 전체가 밋밋해진다.
        ⚠️ 잉크가 번진 느낌을 내려고 색을 옅게 깔고 각도를 살짝 틀었다.
      */}
      <View
        style={{
          position: "absolute",
          right: 18,
          top: 12,
          width: STAMP,
          height: STAMP,
          transform: [{ rotate: "-9deg" }],
          opacity: 0.55,
        }}
        pointerEvents="none"
      >
        <Svg width={STAMP} height={STAMP} viewBox="0 0 100 100">
          <Defs>
            <Path
              id="stamp-top"
              d="M 50 50 m -34 0 a 34 34 0 1 1 68 0"
              fill="none"
            />
            <Path
              id="stamp-bottom"
              d="M 50 50 m -27 0 a 27 27 0 1 0 54 0"
              fill="none"
            />
          </Defs>

          {/* 바깥 톱니. 실제 도장의 눌린 자국처럼 점을 둘러 찍는다 */}
          {TEETH.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <Circle
                key={`tooth-${angle}`}
                cx={50 + Math.cos(rad) * 46}
                cy={50 + Math.sin(rad) * 46}
                r={1.3}
                fill={theme.primary}
              />
            );
          })}

          <Circle
            cx={50}
            cy={50}
            r={41}
            fill="none"
            stroke={theme.primary}
            strokeWidth={3}
          />
          <Circle
            cx={50}
            cy={50}
            r={35}
            fill="none"
            stroke={theme.primary}
            strokeWidth={1.2}
          />

          {/* 가운데 가로 띠. 입국 도장의 날짜 칸 자리다 */}
          <Rect x={14} y={44} width={72} height={13} fill={theme.primary} />

          <SvgText
            fill={theme.primary}
            fontSize={9}
            fontWeight="bold"
            letterSpacing={1.4}
          >
            <TextPath href="#stamp-top" startOffset="50%" textAnchor="middle">
              {destinationEn}
            </TextPath>
          </SvgText>
          <SvgText
            fill={theme.primary}
            fontSize={7}
            fontWeight="bold"
            letterSpacing={1.2}
          >
            <TextPath
              href="#stamp-bottom"
              startOffset="50%"
              textAnchor="middle"
            >
              COMPLETED
            </TextPath>
          </SvgText>

          <SvgText
            x={50}
            y={53.5}
            fill="#fff"
            fontSize={8}
            fontWeight="bold"
            letterSpacing={1}
            textAnchor="middle"
          >
            TRIPPOT
          </SvgText>
        </Svg>
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
              backgroundColor: theme.primarySoft,
              paddingHorizontal: 11,
              paddingVertical: 7,
              fontSize: 11,
              fontWeight: "700",
              color: theme.primary,
            }}
          >
            {tag}
          </Text>
        ))}
      </View>
    </View>
  );
}
