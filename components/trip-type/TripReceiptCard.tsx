// ============================================================================
// TRIP-HOME-02 여행 영수증 (시안 v3)
//
// **진짜 영수증처럼 보이게** 만든다. 카드가 아니라 종이다.
//   · 위아래 톱니로 찢은 자국
//   · 본문보다 좁은 폭 (종이는 화면 끝까지 닿지 않는다)
//   · 가운데 정렬한 머리글 · 자간 넓은 대문자
//   · 등폭 숫자 — 금액 자릿수가 줄마다 흔들리면 영수증으로 안 읽힌다
//   · 합계 앞 점선 구분선
//
// ⚠️ 톱니는 SVG path 로 그린다. RN 에는 CSS linear-gradient 반복 배경이 없다.
//
// ⚠️ 금액을 축약하지 않는다. 영수증은 정확한 숫자가 있는 자리다.
// ============================================================================
import {
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useState } from "react";
import Svg, { Path } from "react-native-svg";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import { CATEGORY_CODE_LABEL, type CategoryCode } from "@/lib/constants/status";

const GREEN = "#19865f";
/**
 * 영수증 종이색. 진짜 영수증처럼 흰색이다.
 *
 * ⚠️ 화면 배경도 흰색이라 색만으로는 종이가 안 보인다. 그래서 톱니와
 *    좌우 변에 **테두리 선을 그리고 그림자를 준다.** 선이 없으면 찢어낸
 *    윗변·아랫변이 배경에 묻혀 그냥 흰 사각형이 된다.
 */
const PAPER = "#ffffff";
const LINE = "#dfe3e8";
/** 톱니 한 칸의 폭·높이 */
const TOOTH = 12;
const TOOTH_H = 7;
/** 등폭 숫자. 자릿수가 줄마다 흔들리지 않게 한다 */
const NUM = { fontVariant: ["tabular-nums" as const] };

type Diff = { categoryCode: CategoryCode; diff: number } | null;

type Props = {
  theme: CountryTheme;
  destinationEn: string;
  /** '28 AUG — 31 AUG' */
  periodLabel: string;
  headcount: number;
  targetAmount: number;
  actualAmount: number;
  topOver: Diff;
  topSaved: Diff;
  /** 영수증 맨 아래 링크. 누르면 SETTLE-01 로 간다 */
  onPressDetail?: () => void;
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

/**
 * 톱니 한 줄.
 * @param up true 면 위로 솟은 톱니(영수증 윗변), false 면 아래로 처진 톱니(아랫변)
 */
function toothPath(width: number, up: boolean): string {
  const count = Math.ceil(width / TOOTH);
  const parts: string[] = [];
  if (up) {
    // 위쪽: 종이 안쪽(아래)을 채우고 윗변만 톱니로 판다
    parts.push(`M 0,${TOOTH_H}`);
    for (let i = 0; i < count; i += 1) {
      parts.push(`L ${i * TOOTH + TOOTH / 2},0`);
      parts.push(`L ${(i + 1) * TOOTH},${TOOTH_H}`);
    }
    parts.push(`L ${count * TOOTH},${TOOTH_H} L 0,${TOOTH_H} Z`);
  } else {
    parts.push(`M 0,0`);
    for (let i = 0; i < count; i += 1) {
      parts.push(`L ${i * TOOTH + TOOTH / 2},${TOOTH_H}`);
      parts.push(`L ${(i + 1) * TOOTH},0`);
    }
    parts.push(`L ${count * TOOTH},0 L 0,0 Z`);
  }
  return parts.join(" ");
}

/** 영수증 한 줄. 이름은 왼쪽, 금액은 오른쪽 */
function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View
      className="flex-row items-baseline justify-between"
      style={{ marginTop: 11 }}
    >
      <Text style={{ fontSize: 10, color: "#858e9c" }}>{label}</Text>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: tone ?? "#141b28",
          ...NUM,
        }}
      >
        {value}
      </Text>
    </View>
  );
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
  onPressDetail,
}: Props) {
  const [width, setWidth] = useState(0);
  const remaining = targetAmount - actualAmount;
  const withinBudget = remaining >= 0;

  const handleLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  return (
    // 본문보다 좁게 둔다. 종이는 화면 끝까지 닿지 않는다.
    <View style={{ width: "94%", alignSelf: "center" }} onLayout={handleLayout}>
      {/* 찢어낸 윗변 */}
      {width > 0 ? (
        <Svg width={width} height={TOOTH_H}>
          <Path
            d={toothPath(width, true)}
            fill={PAPER}
            stroke={LINE}
            strokeWidth={1}
          />
        </Svg>
      ) : null}

      <View
        style={{
          backgroundColor: PAPER,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: LINE,
          paddingHorizontal: 17,
          paddingTop: 16,
          paddingBottom: 16,
          // 종이가 살짝 떠 보이게
          shadowColor: "#111827",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontSize: 10,
            fontWeight: "900",
            letterSpacing: 1.6,
            color: "#141b28",
          }}
        >
          {destinationEn} TRIP RECEIPT
        </Text>
        <Text
          style={{
            textAlign: "center",
            marginTop: 4,
            fontSize: 8,
            letterSpacing: 0.6,
            color: "#a8afb9",
            ...NUM,
          }}
        >
          {periodLabel} · {headcount} TRAVELERS
        </Text>

        {/* 머리글과 본문을 가르는 점선 */}
        <View
          style={{
            marginTop: 13,
            borderTopWidth: 1,
            borderStyle: "dashed",
            borderColor: "#d6dbe1",
          }}
        />

        <Line label="목표 여행비" value={won(targetAmount)} />
        <Line label="실제 여행비" value={won(actualAmount)} />
        {topOver ? (
          <Line
            label={`가장 큰 초과 · ${CATEGORY_CODE_LABEL[topOver.categoryCode]}`}
            value={`+${won(topOver.diff)}`}
            tone={theme.primary}
          />
        ) : null}
        {topSaved ? (
          <Line
            label={`가장 큰 절약 · ${CATEGORY_CODE_LABEL[topSaved.categoryCode]}`}
            value={`−${won(topSaved.diff)}`}
            tone={GREEN}
          />
        ) : null}

        {/* 합계 */}
        <View
          className="flex-row items-baseline justify-between"
          style={{
            marginTop: 15,
            paddingTop: 13,
            borderTopWidth: 1,
            borderStyle: "dashed",
            borderColor: "#bcc3cc",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "900", color: "#141b28" }}>
            {withinBudget ? "남은 금액" : "초과 금액"}
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "900",
              color: withinBudget ? "#141b28" : theme.primary,
              ...NUM,
            }}
          >
            {won(remaining)}
          </Text>
        </View>

        <Text
          style={{
            textAlign: "right",
            marginTop: 8,
            fontSize: 9,
            fontWeight: "900",
            color:
              actualAmount === 0
                ? "#98a1ad"
                : withinBudget
                  ? GREEN
                  : theme.primary,
          }}
        >
          {actualAmount === 0
            ? "지출을 기록하면 결과가 채워져요"
            : withinBudget
              ? "예산 안에서 여행 완료 ✓"
              : "예산을 넘겼어요"}
        </Text>

        {/*
          ⚠️ 9px 오른쪽 정렬 글자로 두지 않는다. 이 영수증에서 사용자가
             다음으로 갈 곳은 여기 하나뿐인데, 가장 작은 글씨라 아무도
             누르지 않았다. 영수증 폭을 다 쓰는 버튼으로 만든다.
        */}
        {onPressDetail ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="여행비 정산 자세히 보기"
            onPress={onPressDetail}
            className="flex-row items-center justify-center active:opacity-70"
            style={{
              gap: 5,
              marginTop: 16,
              height: 44,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.primary,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "900", color: theme.primary }}
            >
              여행비 정산 자세히 보기
            </Text>
            <Text style={{ fontSize: 13, color: theme.primary }}>›</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 찢어낸 아랫변 */}
      {width > 0 ? (
        <Svg width={width} height={TOOTH_H}>
          <Path
            d={toothPath(width, false)}
            fill={PAPER}
            stroke={LINE}
            strokeWidth={1}
          />
        </Svg>
      ) : null}
    </View>
  );
}
