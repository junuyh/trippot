// ============================================================================
// TRIP-HOME-01 수하물 태그 — 여행 요약 + 여행자금 (시안 v4)
//
// ⚠️ 보딩패스(TravelTicketCard)를 대체한다. 가로로 눕힌 항공권 대신
//    세로로 긴 수하물 태그다. 도시명이 카드의 주인공이고, 비행 경로가
//    세로로 서서 여행자금 달성률을 나타낸다.
//
// ⚠️ 실제 항공권이 아니다. **여행자금 준비 과정을 여행 경험처럼 보여주는 UI** 다.
//    시안 아래쪽의 `FLIGHT TP0912 · GATE 09` 는 넣지 않았다.
//    항공편 예약이 연동되기 전에는 실제 예약 정보처럼 보이는 값을
//    만들지 않는다. (CLAUDE.md 3장 · 이전 보딩패스와 같은 판단)
//
// ⚠️ 비행기 위치 = 누적 모금액 ÷ 목표 여행비.
//    현재 계좌 잔액이 아니다. 항공권을 사면 잔액은 줄지만 준비 진행률은
//    줄면 안 된다.
//
// ⚠️ 화면 안의 네 숫자(현재 여행자금 · 목표 · 앞으로 필요한 금액 · 달성률)는
//    전부 raisedAmount 와 targetAmount 하나에서 나온다. 서로 어긋날 수 없다.
//
// ⚠️ 금액 영역 전체가 하나의 버튼이다. 시안이 `여행자금 현황 보기` 버튼을
//    따로 두지 말라고 했으므로, 같은 곳으로 가는 진입점을 두 개 만들지 않는다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect } from "react-native-svg";

import { cityLandmark } from "@/lib/constants/cityLandmark";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import { countryLandmark } from "@/lib/constants/countryLandmark";
import type { DestinationCode } from "@/lib/constants/destinations";
import { CONDENSED_FONT, useDisplayFont } from "@/lib/hooks/useDisplayFont";

// ── 태그 치수 ───────────────────────────────────────────────────────────────
/** 좌우 여백. 시안의 29px */
const PAD = 29;
/** 위·아래 바코드 띠 높이 */
const STRIP = 8;
/** 좌우 컬러 라인 폭 */
const SIDE = 11;
/** 도시명 영역. **도시명 길이와 무관하게 고정**이라 아래 정보가 밀리지 않는다 */
const CITY_H = 192;

// ── 세로 비행 경로 ──────────────────────────────────────────────────────────
const FLIGHT_W = 49;
const FLIGHT_H = 190;
/** 도착 공항 코드 배지 높이. 위 여백 8 + 글자 상자 26 */
const BADGE_H = 34;
const PLANE = 36;
/** 비행기가 0% → 100% 사이에 실제로 움직이는 거리 */
const TRAVEL = FLIGHT_H - BADGE_H - PLANE;

const INK = "#101828";
const LABEL = "#8a94a2";
const HAIR = "#dfe3e8";

/** 도시명 최대 크기. 글자가 길면 이보다 작아진다 */
const CITY_MAX = 72;
const CITY_MIN = 34;
/** Bebas Neue 의 대략적인 글자폭 비율. 폰트 크기를 정하는 데만 쓴다 */
const GLYPH_RATIO = 0.42;
/** 랜드마크 스카이라인 높이. 도시명 영역(192)의 아래쪽만 쓴다 */
const SKYLINE_H = 132;

type Props = {
  /** 좌우 컬러 라인과 강조 색을 국기 색에서 가져온다 */
  theme: CountryTheme;
  flag: string;
  /** 국가 코드. 국기와 함께 배지에 표시한다 */
  countryCode: string;
  /** 영문 도시명. 태그의 주인공이다 */
  destinationEn: string;
  /** 도시 랜드마크 스카이라인을 고르는 키 */
  destinationCode: DestinationCode | null;
  /** 도시 스카이라인이 없을 때 쓰는 국가 실루엣의 키 */
  countryKo: string | null;
  /** 도착 공항 IATA 코드 */
  airportCode: string;
  /** 'MM.dd–MM.dd'. 여행 기간이며 **항공편 시각이 아니다** */
  dateLabel: string | null;
  headcount: number;
  /** 여행계 이름. 없으면 개인 여행 */
  groupLabel: string;
  /** 'D–9'. 출발일까지 남은 날짜 */
  dDayLabel: string | null;

  /** 누적 모금액. 결제로 잔액이 줄어도 이 값은 줄지 않는다 */
  raisedAmount: number;
  targetAmount: number;
  /** 0~100. 비행기가 도착지를 지나치지 않게 넘겨받기 전에 잘라둔다 */
  progress: number;

  /** 금액 영역을 누르면 FUND-01 로 간다 */
  onPressFund: () => void;
  /** 일정·인원·여행계 수정. 끝난 여행이면 null */
  onPressEdit: (() => void) | null;
};

function amount(value: number): { body: string; unit: string } {
  return { body: value.toLocaleString("ko-KR"), unit: "원" };
}

/**
 * 도시명 폰트 크기.
 *
 * 가장 긴 **단어**가 한 줄에 들어가는 크기를 고른다. 단어 기준이라
 * `HONG KONG` 은 두 줄로 나뉘되 글자는 크게 남고, `SHANGHAI` 처럼 띄어쓰기가
 * 없는 긴 이름만 글자가 작아진다.
 */
function citySize(name: string, available: number): number {
  const longest = name
    .split(" ")
    .reduce((max, word) => Math.max(max, word.length), 1);
  if (available <= 0) return CITY_MAX;
  const fit = Math.floor(available / (longest * GLYPH_RATIO));
  return Math.max(CITY_MIN, Math.min(CITY_MAX, fit));
}

export function BaggageTagCard({
  theme,
  flag,
  countryCode,
  destinationEn,
  destinationCode,
  countryKo,
  airportCode,
  dateLabel,
  headcount,
  groupLabel,
  dDayLabel,
  raisedAmount,
  targetAmount,
  progress,
  onPressFund,
  onPressEdit,
}: Props) {
  const { fontFamily } = useDisplayFont();

  // ── 접근성: 모션 최소화 ──────────────────────────────────────────────
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

  /**
   * 비행기는 **진입할 때 0% 에서 현재 달성률까지 한 번만** 올라간다.
   * ⚠️ 계속 오르내리는 반복 애니메이션을 쓰지 않는다. 시선을 계속 끌면
   *    정작 읽어야 할 금액을 못 읽는다. (시안 v4 조건)
   */
  const target = (Math.max(0, Math.min(100, progress)) / 100) * TRAVEL;
  const fly = useRef(new Animated.Value(0)).current;
  const runFlight = useCallback(() => {
    fly.setValue(0);
    Animated.timing(fly, {
      toValue: target,
      duration: reduceMotion ? 0 : 1800,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      // bottom 값이라 네이티브 드라이버를 쓸 수 없다
      useNativeDriver: false,
    }).start();
  }, [fly, target, reduceMotion]);
  useEffect(runFlight, [runFlight]);

  const percent = Math.round(Math.max(0, Math.min(100, progress)));
  const shortage = Math.max(0, targetAmount - raisedAmount);
  const raised = amount(raisedAmount);
  const goal = amount(targetAmount);
  const need = amount(shortage);

  // 바코드 띠와 스카이라인을 그리려면 실제 폭이 필요하다
  const [width, setWidth] = useState(0);
  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  };

  /** 도시명이 쓸 수 있는 폭. 오른쪽 비행 경로 아래로 들어가지 않게 뺀다 */
  const cityWidth = Math.max(0, width - PAD * 2 - FLIGHT_W - 12);
  const cityFont = citySize(destinationEn, cityWidth);

  return (
    <View
      onLayout={handleLayout}
      style={{
        borderWidth: 1,
        borderColor: "#d9dee5",
        borderRadius: 22,
        backgroundColor: "#fff",
        overflow: "hidden",
        shadowColor: INK,
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 3,
      }}
    >
      {/* ── 상·하단 바코드 띠 ── 시안의 12px 주기 패턴을 그대로 옮겼다 */}
      {width > 0 ? (
        <>
          <Barcode id="tag-barcode-top" width={width} edge="top" />
          <Barcode id="tag-barcode-bottom" width={width} edge="bottom" />
        </>
      ) : null}

      {/* ── 좌우 컬러 라인 ── 바코드 띠 사이에만 선다 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: STRIP,
          bottom: STRIP,
          width: SIDE,
          backgroundColor: theme.stripe[0],
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: 0,
          top: STRIP,
          bottom: STRIP,
          width: SIDE,
          backgroundColor: theme.stripe[1],
        }}
      />

      {/* ══════════════ 출발지 · 국가 ══════════════ */}
      <View
        style={{ marginTop: 30, marginHorizontal: PAD }}
        className="flex-row items-start justify-between"
      >
        <View>
          <Text
            style={{
              fontSize: 9,
              fontWeight: "900",
              letterSpacing: 1.5,
              color: INK,
            }}
          >
            TRIPPOT
          </Text>
          {/*
            ⚠️ 출발지는 아직 데이터가 없다. MVP 는 해외여행만 다루고
               기준 금액도 인천 출발로 잡혀 있어 고정값을 쓴다.
               (lib/constants/destinations.ts 의 baseline 주석과 같은 전제)
          */}
          <Text
            style={{ marginTop: 7, fontSize: 16, fontWeight: "500", letterSpacing: 0.2, color: INK }}
          >
            SEOUL / ICN
          </Text>
        </View>
        <Text
          style={{
            borderRadius: 5,
            backgroundColor: INK,
            color: "#fff",
            paddingHorizontal: 10,
            paddingVertical: 9,
            fontSize: 14,
            fontWeight: "900",
          }}
        >
          {flag} {countryCode}
        </Text>
      </View>

      {/* ══════════════ 도시명 + 스카이라인 + 세로 비행 경로 ══════════════ */}
      <View
        style={{
          height: CITY_H,
          marginTop: 24,
          marginHorizontal: PAD,
          borderBottomWidth: 1,
          borderBottomColor: HAIR,
          overflow: "hidden",
        }}
      >
        {/*
          랜드마크 배경. 도시 스카이라인이 있으면 그것을, 없으면 국가 실루엣을
          쓰고, 둘 다 없으면 아무것도 그리지 않는다. 어느 경우에도 깨진 이미지나
          빈 사각형이 남지 않는다.
        */}
        {width > 0 ? (
          <LandmarkBackdrop
            width={width - PAD * 2}
            destinationCode={destinationCode}
            countryKo={countryKo}
          />
        ) : null}

        <Text
          numberOfLines={2}
          style={{
            marginTop: 12,
            width: cityWidth || undefined,
            fontFamily,
            fontSize: cityFont,
            lineHeight: cityFont,
            letterSpacing: 0,
            color: INK,
          }}
        >
          {destinationEn}
        </Text>

        {/* ── 세로 비행 경로 ── 아래가 0%, 위 공항 배지가 100% 다 */}
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: FLIGHT_W,
            height: FLIGHT_H,
          }}
        >
          {/*
            ⚠️ 위아래 여백을 같게 주지 않는다. Bebas Neue 는 밑으로 내려가는
               획이 없어서 글자 상자 아래쪽이 통째로 비어 있다. 여백을 같게
               주면 글자가 위로 쏠려 검은 배지 아래가 남아 보인다.
               위 여백을 크게 주고 아래를 0 으로 둬야 글자가 가운데에 온다.
            ⚠️ lineHeight 를 글자 크기보다 작게 줄이지 않는다. 글자가 검은
               배경 밖으로 밀려나 흰 바탕에서 아래쪽이 지워진 것처럼 보인다.
          */}
          <Text
            style={{
              width: FLIGHT_W,
              backgroundColor: INK,
              color: "#fff",
              textAlign: "center",
              paddingTop: 8,
              fontFamily,
              fontSize: 26,
              lineHeight: 26,
              letterSpacing: 1,
              includeFontPadding: false,
            }}
          >
            {airportCode}
          </Text>
          {/*
            ⚠️ borderStyle:"dashed" 를 쓰지 않는다. iOS 에서 2px 짜리 세로
               테두리는 점선으로 그려지지 않고 실선이 된다. SVG 로 그린다.
          */}
          <Svg
            pointerEvents="none"
            width={2}
            height={FLIGHT_H - BADGE_H}
            style={{ position: "absolute", left: 23, top: BADGE_H }}
          >
            <Line
              x1={1}
              y1={0}
              x2={1}
              y2={FLIGHT_H - BADGE_H}
              stroke="#c1c8d1"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          </Svg>
          <Animated.View style={{ position: "absolute", left: 6, bottom: fly }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`여행자금 ${percent}% 모았어요. 다시 보기`}
              onPress={runFlight}
              style={{
                width: PLANE,
                height: PLANE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="airplane"
                size={27}
                color={INK}
                style={{ transform: [{ rotate: "-90deg" }] }}
              />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* ══════════════ 기간 · 인원 · 여행계 ══════════════ */}
      <View
        style={{
          marginTop: 18,
          marginHorizontal: PAD,
          paddingBottom: 17,
          borderBottomWidth: 1,
          borderBottomColor: HAIR,
        }}
        className="flex-row items-center"
        /* ⚠️ 칸 사이 간격이 없으면 구분선이 다음 칸 글자에 붙는다 (시안의 gap:8) */
      >
        <Field label="DATE" value={dateLabel ?? "—"} divider />
        <Field label="TRAVELERS" value={`${String(headcount).padStart(2, "0")}명`} divider />
        <Field label="GROUP" value={groupLabel} />
        {/*
          일정·인원·여행계를 고친다. 바로 위 세 칸이 정확히 그 세 값이라
          여기 두는 것이 가장 가깝다.
          ⚠️ 끝난 여행은 못 고친다. 화면 파일에서 null 을 넘겨 감춘다.
        */}
        {onPressEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="여행 기본 정보 수정"
            onPress={onPressEdit}
            className="items-center justify-center active:bg-gray-100"
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: "#e6e9ed",
            }}
          >
            <Ionicons name="pencil" size={12} color="#657181" />
          </Pressable>
        ) : null}
      </View>

      {/* ══════════════ 여행자금 ══════════════ */}
      <View style={{ marginHorizontal: PAD, paddingTop: 14 }}>
        <View
          style={{ paddingBottom: 11 }}
          className="flex-row items-center justify-between"
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: "900",
              letterSpacing: 1.2,
              color: INK,
            }}
          >
            TRAVEL FUND / BALANCE
          </Text>
          {dDayLabel ? (
            <Text
              style={{
                borderRadius: 4,
                backgroundColor: INK,
                color: "#fff",
                paddingHorizontal: 9,
                paddingVertical: 7,
                fontSize: 9,
                fontWeight: "900",
              }}
            >
              {dDayLabel}
            </Text>
          ) : null}
        </View>

        {/*
          ⚠️ borderStyle:"dashed" 를 쓰지 않는다. iOS 에서 1px 가로 테두리는
             점선으로 그려지지 않고 실선이 된다. (세로 비행 경로와 같은 이유)
        */}
        {width > 0 ? (
          <Svg width={width - PAD * 2} height={1}>
            <Line
              x1={0}
              y1={0.5}
              x2={width - PAD * 2}
              y2={0.5}
              stroke="#d7dce2"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </Svg>
        ) : null}

        {/*
          ⚠️ 현재 여행자금부터 앞으로 필요한 금액까지가 **하나의 버튼**이다.
             시안이 `여행자금 현황 보기` 버튼을 따로 두지 말라고 했다.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`여행자금 현황 보기. 현재 ${raised.body}원, 목표 ${goal.body}원, ${percent}퍼센트 달성`}
          onPress={onPressFund}
          style={{ borderRadius: 8, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 13 }}
          className="active:bg-gray-50"
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: "700",
              letterSpacing: 0.5,
              color: LABEL,
            }}
          >
            현재 여행자금
          </Text>
          <View
            className="flex-row items-baseline justify-between"
            style={{ marginTop: 7 }}
          >
            {/*
              ⚠️ 도시명(Bebas Neue)과 같은 폰트를 쓰지 않는다. Bebas 는 굵기가
                 하나뿐이라 큰 금액이 얇아 보인다. 시스템 폰트 900 은 반대로
                 옆으로 두꺼워 태그 폭을 잡아먹는다. 굵기를 줄 수 있는
                 콘덴스드 폰트로 그 사이를 잡는다.
              ⚠️ `원` 은 한글이라 이 폰트에 없으므로 기본 폰트로 되돌린다.
            */}
            <Text
              accessibilityLiveRegion="polite"
              style={{
                flexShrink: 1,
                fontFamily: CONDENSED_FONT,
                fontSize: 42,
                lineHeight: 46,
                fontWeight: "700",
                letterSpacing: -0.2,
                color: INK,
              }}
            >
              {raised.body}
              <Text
                style={{
                  fontFamily: undefined,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0,
                }}
              >
                {raised.unit}
              </Text>
            </Text>
            {/* 달성률. 비행기 위치와 같은 값이다. 금액보다는 작게 둔다 */}
            <Text
              style={{
                marginLeft: 8,
                fontSize: 20,
                fontWeight: "900",
                letterSpacing: -0.5,
                color: theme.primary,
              }}
            >
              {percent}%
            </Text>
          </View>

          <View className="flex-row" style={{ marginTop: 17 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 8, fontWeight: "700", letterSpacing: 0.7, color: "#89929e" }}>
                목표 여행비
              </Text>
              <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: INK }}>
                {goal.body}
                <Text style={{ fontSize: 10, fontWeight: "700" }}>{goal.unit}</Text>
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                paddingLeft: 12,
                borderLeftWidth: 1,
                borderLeftColor: "#edf0f3",
              }}
            >
              <Text style={{ fontSize: 8, fontWeight: "700", letterSpacing: 0.7, color: "#89929e" }}>
                앞으로 필요한 금액
              </Text>
              {/*
                ⚠️ 목표 − 누적 모금액이다. 잔액으로 계산하지 않는다.
                   쓰면 쓸수록 필요 금액이 늘어나 목표가 멀어져 보인다.
              */}
              <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: theme.primary }}>
                {shortage > 0 ? (
                  <>
                    {need.body}
                    <Text style={{ fontSize: 10, fontWeight: "700" }}>{need.unit}</Text>
                  </>
                ) : (
                  "다 모았어요"
                )}
              </Text>
            </View>
          </View>
        </Pressable>

        <View
          style={{ marginTop: 12, marginBottom: 22 }}
          className="flex-row items-center justify-between"
        >
          <Text style={{ fontSize: 7, fontWeight: "700", letterSpacing: 0.8, color: "#7f8997" }}>
            TRIPPOT TRAVEL TAG
          </Text>
          <Text style={{ fontSize: 7, fontWeight: "900", letterSpacing: 0.8, color: INK }}>
            ICN → {airportCode}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * 도시명 뒤에 깔리는 랜드마크.
 *
 * ⚠️ 도시 스카이라인은 **선**, 국가 실루엣은 **면**이다. 원래 쓰임이 달라
 *    같은 방식으로 그리면 한쪽이 뭉치거나 사라진다. 그래서 나눠 그린다.
 *
 * ⚠️ 오른쪽 비행 경로 아래로 들어가지 않게 폭을 줄여 둔다.
 */
function LandmarkBackdrop({
  width,
  destinationCode,
  countryKo,
}: {
  width: number;
  destinationCode: DestinationCode | null;
  countryKo: string | null;
}) {
  const city = cityLandmark(destinationCode);
  if (city) {
    /*
      ⚠️ 지면선이 도시명 영역의 아래 경계에 정확히 앉게 bottom 을 0 으로 둔다.
         음수로 내리면 건물 밑동이 잘려 공중에 뜬 것처럼 보인다.
      ⚠️ 높이를 먼저 정하고 폭을 비율로 맞춘다. 폭을 꽉 채우면 스카이라인이
         도시명까지 올라와 글자를 덮는다.
    */
    const h = Math.min(SKYLINE_H, width * (150 / 260));
    return (
      <Svg
        pointerEvents="none"
        width={h * (260 / 150)}
        height={h}
        viewBox={city.viewBox}
        style={{ position: "absolute", left: 2, bottom: 0, opacity: 0.075 }}
      >
        <G
          fill="none"
          stroke={INK}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {city.paths.map((d, index) => (
            <Path key={`skyline-${index}`} d={d} />
          ))}
        </G>
      </Svg>
    );
  }

  if (!countryKo) return null;
  const country = countryLandmark(countryKo);
  const w = Math.max(0, width - FLIGHT_W - 8);
  return (
    <Svg
      pointerEvents="none"
      width={w}
      height={w * 0.6}
      viewBox={country.viewBox}
      style={{ position: "absolute", left: 0, bottom: -4, opacity: 0.06 }}
    >
      {country.paths.map((shape, index) => (
        <Path
          key={`silhouette-p-${index}`}
          d={shape.d}
          fill={INK}
          fillRule={shape.fillRule}
        />
      ))}
      {(country.circles ?? []).map((circle, index) => (
        <Circle
          key={`silhouette-c-${index}`}
          cx={circle.cx}
          cy={circle.cy}
          r={circle.r}
          fill={INK}
        />
      ))}
    </Svg>
  );
}

/** 기간·인원·여행계 한 칸 */
function Field({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingRight: 8,
        marginRight: divider ? 8 : 0,
        borderRightWidth: divider ? 1 : 0,
        borderRightColor: "#edf0f3",
      }}
    >
      <Text style={{ fontSize: 8, fontWeight: "700", letterSpacing: 0.8, color: LABEL }}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 5, fontSize: 12, fontWeight: "700", color: INK }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * 수하물 태그 위·아래의 바코드 띠.
 *
 * 12px 을 한 주기로 굵기가 다른 막대 두 개가 반복된다. (시안과 같은 값)
 * 폭이 얼마든 같은 간격이 유지되게 SVG 패턴으로 그린다.
 */
function Barcode({
  id,
  width,
  edge,
}: {
  /** ⚠️ 위·아래 띠가 같은 id 를 쓰면 Android 에서 패턴이 서로 덮인다 */
  id: string;
  width: number;
  edge: "top" | "bottom";
}) {
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={STRIP}
      style={{
        position: "absolute",
        left: 0,
        top: edge === "top" ? 0 : undefined,
        bottom: edge === "bottom" ? 0 : undefined,
      }}
    >
      <Defs>
        <Pattern
          id={id}
          x="0"
          y="0"
          width={12}
          height={STRIP}
          patternUnits="userSpaceOnUse"
        >
          <Rect x={0} y={0} width={2} height={STRIP} fill={INK} />
          <Rect x={5} y={0} width={3} height={STRIP} fill={INK} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={STRIP} fill={`url(#${id})`} />
    </Svg>
  );
}
