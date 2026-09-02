// ============================================================================
// TRIP-HOME-01 보딩패스 — 여정 + 여행자금 (시안 v4)
//
// ⚠️ 2026-09-02 · **뒤집기를 걷어냈다.** (시안 v4)
//    앞면에는 여행 기본 정보, 절취선 아래에는 현재 여행자금·목표·필요 금액·
//    D-Day·달성률이 한 장에 다 있다. 뒷면에 같은 숫자를 한 번 더 두면
//    "어느 쪽이 진짜인가" 를 사용자가 판단해야 하고, 카드를 뒤집어야만
//    보이는 목표 금액은 사실상 없는 정보였다.
//
// ⚠️ 실제 항공권이 아니다. **여행자금 준비 과정을 여행 경험처럼 보여주는 UI** 다.
//    항공편 예약이 연동되기 전에는 실제 예약 정보처럼 보이는 값을 만들지 않는다.
//    지금 쓰는 값은 출발지 · 목적지 · 여행 기간 · 인원 · 준비 상태뿐이다.
//
// ⚠️ 비행기 위치 = 누적 모금액 ÷ 목표 여행비.
//    현재 계좌 잔액이 아니다. 항공권을 사면 잔액은 줄지만 준비 진행률은
//    줄면 안 된다. (스펙 12장)
//
// ⚠️ 절취선 노치는 SVG path 로 **카드를 실제로 잘라** 만든다.
//    흰 원을 위에 얹는 방식이 아니라 외곽선 자체에 4분원이 빠져 있어,
//    홈 안쪽에 세로 외곽선이 남거나 원 전체가 떠 보이지 않는다. (스펙 7장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Line, Path } from "react-native-svg";

import { countryLandmark } from "@/lib/constants/countryLandmark";
import type { CountryTheme } from "@/lib/constants/countryTheme";

/** 여정 영역 높이. 절취선이 여기서 갈린다 */
const VISUAL_HEIGHT = 215;
/**
 * 자금 영역 높이.
 * 시안 v4 에서 목표 여행비·앞으로 필요한 금액 두 칸이 들어와 137 → 168 이다.
 */
const STUB_HEIGHT = 168;
/** 카드 전체 높이. SVG 로 모양을 그리므로 미리 정해져 있어야 한다 */
const CARD_HEIGHT = VISUAL_HEIGHT + STUB_HEIGHT;

/** 절취선 노치 반지름. 카드 좌우 경계 중앙에 원의 절반이 물린다 */
const NOTCH_R = 9;
const RADIUS = 18;
const LINE = "#e5e8ec";
const VISUAL_BG = "#f4f6f8";
const MUTED = "#858e9c";

/**
 * 배경 실루엣 크기. 좌표계가 100 × 60 이라 높이는 폭의 0.6 배다.
 * 오른쪽 아래에만 깔고 공항 코드 영역은 비운다.
 */
const DECOR_W = 150;
const DECOR_H = DECOR_W * 0.6;

/**
 * 앞면 위쪽(여정) 외곽선.
 * 위 모서리는 둥글고, 아래쪽 좌우에 노치의 **위쪽 4분원**이 파여 있다.
 */
function topPath(w: number): string {
  return [
    `M ${RADIUS},0`,
    `H ${w - RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${w},${RADIUS}`,
    `V ${VISUAL_HEIGHT - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w - NOTCH_R},${VISUAL_HEIGHT}`,
    `H ${NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 0,${VISUAL_HEIGHT - NOTCH_R}`,
    `V ${RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${RADIUS},0`,
    "Z",
  ].join(" ");
}

/**
 * 위쪽 영역의 **외곽선만** 그리는 열린 path.
 *
 * ⚠️ 노치 사이의 직선 구간을 일부러 뺐다. 그 자리는 절취선이 지나가는 곳이라,
 *    채움 path 의 테두리까지 같이 그리면 실선 + 실선 + 점선이 겹쳐
 *    홈 주변에 이중 테두리가 생긴다. (스펙 7장)
 *    카드 안쪽을 향하는 반원 곡선은 그대로 남긴다.
 */
function topOutline(w: number): string {
  return [
    `M ${NOTCH_R},${VISUAL_HEIGHT}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 0,${VISUAL_HEIGHT - NOTCH_R}`,
    `V ${RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${RADIUS},0`,
    `H ${w - RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${w},${RADIUS}`,
    `V ${VISUAL_HEIGHT - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w - NOTCH_R},${VISUAL_HEIGHT}`,
  ].join(" ");
}

/** 아래쪽 영역의 외곽선만. 위와 같은 이유로 노치 사이 직선을 뺐다. */
function bottomOutline(w: number, h: number): string {
  return [
    `M ${w - NOTCH_R},0`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w},${NOTCH_R}`,
    `V ${h - RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${w - RADIUS},${h}`,
    `H ${RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 0,${h - RADIUS}`,
    `V ${NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${NOTCH_R},0`,
  ].join(" ");
}

/** 아래쪽(자금) 외곽선. 위쪽 좌우에 노치의 **아래쪽 4분원**이 파여 있다. */
function bottomPath(w: number, h: number): string {
  return [
    `M 0,${NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${NOTCH_R},0`,
    `H ${w - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w},${NOTCH_R}`,
    `V ${h - RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${w - RADIUS},${h}`,
    `H ${RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 0,${h - RADIUS}`,
    "Z",
  ].join(" ");
}

type Props = {
  theme: CountryTheme;
  flag: string;
  /** 티켓 표기·워터마크용 영문 도시명 */
  destinationEn: string;
  /** 한글 국가명. 앞면 배경 실루엣을 고르는 데 쓴다 */
  countryKo: string | null;
  airportCode: string;
  /** 'MM.dd'. 여행 시작일·종료일이며 **항공편 시각이 아니다** */
  departLabel: string | null;
  arriveLabel: string | null;
  /** 'DD MMM' */
  ticketDate: string | null;
  headcount: number;
  dDayLabel: string | null;

  /**
   * 누적 모금액. 지금까지 확보한 총 여행자금이다.
   * 결제로 잔액이 줄어도 이 값은 줄지 않는다. (스펙 12장)
   */
  raisedAmount: number;
  targetAmount: number;
  /** 0~100. 100 을 넘겨받지 않는다 — 비행기가 도착지를 지나치면 안 된다 */
  progress: number;

  /** 현재 여행자금 금액을 누르면 FUND-01 여행자금 관리로 간다 (v4) */
  onPressFund: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function TravelTicketCard({
  theme,
  flag,
  destinationEn,
  countryKo,
  airportCode,
  departLabel,
  arriveLabel,
  ticketDate,
  headcount,
  dDayLabel,
  raisedAmount,
  targetAmount,
  progress,
  onPressFund,
}: Props) {
  // ── 접근성: 모션 최소화 ────────────────────────────────────────────────
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // 비행기는 준비율만큼 도착지 쪽으로 미끄러진다.
  // ⚠️ 퍼센트 폭 애니메이션이라 네이티브 드라이버를 쓸 수 없다.
  const flight = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(flight, {
      toValue: progress,
      duration: reduceMotion ? 0 : 550,
      useNativeDriver: false,
    }).start();
  }, [flight, progress, reduceMotion]);
  const widthPercent = flight.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  const shortage = Math.max(0, targetAmount - raisedAmount);
  const percent = Math.round(progress);
  const landmark = countryLandmark(countryKo);

  // SVG 로 카드 모양을 그리려면 실제 폭이 필요하다.
  const [width, setWidth] = useState(0);
  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((prev) => (prev === next ? prev : next));
  };

  return (
    <View
      onLayout={handleLayout}
      style={{
        height: CARD_HEIGHT,
        shadowColor: "#111827",
        shadowOpacity: 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      }}
    >
      {/*
        카드 모양을 SVG 로 그린다. 절취선 노치가 **실제로 파인** 구조다.
        흰 원을 위에 덮는 방식이 아니라 path 에서 4분원이 빠져 있다.
      */}
      {width > 0 ? (
        <Svg
          width={width}
          height={CARD_HEIGHT}
          style={{ position: "absolute", left: 0, top: 0 }}
          pointerEvents="none"
        >
          {/* 채움과 외곽선을 나눠 그린다. 이유는 topOutline() 주석 참고 */}
          <Path d={topPath(width)} fill={VISUAL_BG} />

          {/*
            국가별 랜드마크 실루엣. (스펙 8장)
            오른쪽 아래에만 깔고, 위쪽 영역 밖으로 넘치지 않게 잘라낸다.
            공항 코드가 있는 위쪽은 비워 두어 글자 뒤에서 겹치지 않게 한다.
          */}
          <Defs>
            <ClipPath id="ticket-visual">
              <Path d={topPath(width)} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#ticket-visual)" opacity={0.05}>
            <G
              translateX={width - DECOR_W - 6}
              translateY={VISUAL_HEIGHT - DECOR_H - 4}
              scale={DECOR_W / 100}
            >
              {landmark.paths.map((shape, index) => (
                <Path
                  key={`lm-p-${index}`}
                  d={shape.d}
                  fill="#111827"
                  fillRule={shape.fillRule}
                />
              ))}
              {(landmark.circles ?? []).map((circle, index) => (
                <Circle
                  key={`lm-c-${index}`}
                  cx={circle.cx}
                  cy={circle.cy}
                  r={circle.r}
                  fill="#111827"
                />
              ))}
            </G>
          </G>

          <Path
            d={bottomPath(width, STUB_HEIGHT)}
            fill="#ffffff"
            translateY={VISUAL_HEIGHT}
          />

          <Path
            d={topOutline(width)}
            fill="none"
            stroke={LINE}
            strokeWidth={1}
          />
          <Path
            d={bottomOutline(width, STUB_HEIGHT)}
            fill="none"
            stroke={LINE}
            strokeWidth={1}
            translateY={VISUAL_HEIGHT}
          />

          {/* 절취선. 좌우 반원 홈이 열리는 지점을 정확히 잇는다 (스펙 7장) */}
          <Line
            x1={NOTCH_R}
            y1={VISUAL_HEIGHT}
            x2={width - NOTCH_R}
            y2={VISUAL_HEIGHT}
            stroke="#cdd2d8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </Svg>
      ) : null}

      {/* ══════════════ 여정 ══════════════ */}
      <View style={{ height: VISUAL_HEIGHT }}>
        <View
          style={{ position: "absolute", left: 18, right: 18, top: 18 }}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-[7px]">
            <Text style={{ fontSize: 16 }}>{flag}</Text>
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.3,
                fontWeight: "900",
                color: "#111827",
              }}
            >
              NEXT TRIP · {destinationEn}
            </Text>
          </View>
          <Text style={{ fontSize: 10, letterSpacing: 1.3, color: "#7c8492" }}>
            TRIPPOT · {theme.code}
          </Text>
        </View>

        <View
          style={{ position: "absolute", left: 20, right: 20, top: 64 }}
          className="flex-row items-center"
        >
          <View>
            <Text style={{ fontSize: 9, letterSpacing: 0.8, color: MUTED }}>
              FROM · SEOUL
            </Text>
            <Text
              style={{
                fontSize: 33,
                lineHeight: 33,
                fontWeight: "900",
                letterSpacing: -1,
                color: "#111827",
                marginTop: 4,
                marginBottom: 3,
              }}
            >
              ICN
            </Text>
            {/* 여행 시작일이다. 항공편 출발 시각이 아니다 (스펙 4장) */}
            {departLabel ? (
              <Text style={{ fontSize: 10, color: "#7b8491" }}>
                {departLabel}
              </Text>
            ) : null}
          </View>

          {/*
            경로 = 진행도. 여기서 진행 상태를 다 보여주므로
            아래에 같은 뜻의 막대그래프를 또 두지 않는다. (스펙 3장)
          */}
          <View
            style={{
              flex: 1,
              height: 44,
              justifyContent: "center",
              marginHorizontal: 10,
            }}
          >
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 17,
                borderTopWidth: 1,
                borderStyle: "dashed",
                borderColor: "#b8c0ca",
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                left: 0,
                top: 16,
                height: 2,
                width: widthPercent,
                borderRadius: 2,
                backgroundColor: theme.primary,
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                top: 5,
                left: widthPercent,
                marginLeft: -12.5,
                width: 25,
                height: 25,
                borderRadius: 12.5,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
                shadowOpacity: 0.22,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Ionicons name="airplane" size={13} color={theme.onPrimary} />
            </Animated.View>
            <Text
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 30,
                textAlign: "center",
                fontSize: 9,
                fontWeight: "900",
                letterSpacing: 0.3,
                color: theme.primary,
              }}
            >
              {percent}% FUNDED
            </Text>
          </View>

          <View className="items-end">
            <Text style={{ fontSize: 9, letterSpacing: 0.8, color: MUTED }}>
              TO · {destinationEn}
            </Text>
            <Text
              style={{
                fontSize: 33,
                lineHeight: 33,
                fontWeight: "900",
                letterSpacing: -1,
                color: "#111827",
                marginTop: 4,
                marginBottom: 3,
              }}
            >
              {airportCode}
            </Text>
            {arriveLabel ? (
              <Text style={{ fontSize: 10, color: "#7b8491" }}>
                {arriveLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 17,
            paddingTop: 12,
            borderTopWidth: 1,
            borderStyle: "dashed",
            borderColor: "#c8ced5",
          }}
          className="flex-row justify-between"
        >
          <Text style={{ fontSize: 9, letterSpacing: 0.5, color: "#8c94a0" }}>
            STATUS
            <Text style={{ fontSize: 10, color: "#111827", fontWeight: "700" }}>
              {"  "}
              {progress >= 100 ? "READY" : "PREPARING"}
            </Text>
          </Text>
          <Text style={{ fontSize: 9, letterSpacing: 0.5, color: "#8c94a0" }}>
            PASSENGERS
            <Text style={{ fontSize: 10, color: "#111827", fontWeight: "700" }}>
              {"  "}
              {String(headcount).padStart(2, "0")}
            </Text>
          </Text>
          <Text style={{ fontSize: 9, letterSpacing: 0.5, color: "#8c94a0" }}>
            DATE
            <Text style={{ fontSize: 10, color: "#111827", fontWeight: "700" }}>
              {"  "}
              {ticketDate ?? "—"}
            </Text>
          </Text>
        </View>
      </View>

      {/* ══════════════ 여행자금 ══════════════ */}
      <View
        style={{ height: STUB_HEIGHT, paddingHorizontal: 20, paddingTop: 15 }}
      >
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 10, color: MUTED }}>현재 여행자금</Text>
          {dDayLabel ? (
            <Text
              style={{
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: theme.primarySoft,
                fontSize: 10,
                fontWeight: "900",
                color: theme.primary,
              }}
            >
              {dDayLabel}
            </Text>
          ) : null}
        </View>

        {/*
          ⚠️ 금액이 곧 링크다. (v4) 카드 전체를 누르는 구조를 없앴으므로
             여기만 눌린다. 아래 '여행자금 관리' 카드와 같은 곳으로 가지만
             둘 다 시안이 요구한 진입점이다.
        */}
        <View
          className="flex-row items-end justify-between"
          style={{ marginTop: 6 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="현재 여행자금 관리하기"
            onPress={onPressFund}
            className="active:opacity-60"
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 30,
                lineHeight: 36,
                fontWeight: "900",
                letterSpacing: -1.4,
                color: "#111827",
                paddingBottom: 3,
                borderBottomWidth: 2,
                borderBottomColor: "#dbe0e6",
              }}
            >
              {raisedAmount.toLocaleString("ko-KR")}
              <Text style={{ fontSize: 13, letterSpacing: 0 }}>원</Text>
            </Text>
          </Pressable>
          <Text
            style={{ fontSize: 22, fontWeight: "900", color: theme.primary }}
          >
            {percent}%
          </Text>
        </View>

        {/*
          ⚠️ 목표·필요 금액은 위 금액과 **같은 데이터**로 계산한다.
             필요 금액 = 목표 − 누적 모금액. 화면 안에서 숫자가 어긋나면 안 된다.
        */}
        <View className="flex-row" style={{ marginTop: 12, gap: 10 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 10,
              backgroundColor: "#f5f7f9",
              padding: 11,
            }}
          >
            <Text style={{ fontSize: 9, color: MUTED }}>목표 여행비</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: "#111827",
                marginTop: 4,
              }}
            >
              {won(targetAmount)}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: 10,
              backgroundColor: "#f5f7f9",
              padding: 11,
            }}
          >
            <Text style={{ fontSize: 9, color: MUTED }}>
              앞으로 필요한 금액
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: theme.primary,
                marginTop: 4,
              }}
            >
              {shortage > 0 ? won(shortage) : "다 모았어요"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
