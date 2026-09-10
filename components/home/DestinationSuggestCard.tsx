// ============================================================================
// 추천 여행지 카드 — 신규 사용자 홈 (2026-09-09)
//
//   ICN ┄┄┄┄ ✈ ┄┄┄┄ KIX                              JP
//                                            ╭──────╮
//   OSAKA                                    │ 인기 │  ← 국가색 옅은 배지
//   오사카                    🏯 랜드마크 선그림 ╰──────╯
//
//   맛있는 음식과 활기찬 거리가
//   함께하는, 언제나 설레는 여행지
//   ──────────────────────────────────────────────
//   🗓 3박 4일 │ 💬 여행기 12개        [ 여행 만들기 → ]
//
// ⚠️ **준비 중인 여행 카드(NextTripBanner)와 같은 물건이다.**
//    치수·색·그림자·항로 줄·랜드마크 선그림을 값 하나까지 그대로 가져왔다.
//    첫 여행을 만든 순간 이 카드 자리에 그 카드가 온다. 둘이 다르게 생기면
//    사용자에게는 화면이 통째로 바뀐 것으로 보인다.
//
// ⚠️ 사진 배너에서 이 모양으로 바꿨다. (2026-09-07 → 2026-09-09)
//    사진 배너는 그 자체로는 좋았지만 **홈의 다른 카드와 다른 물건**이었다.
//    사진은 "가고 싶다" 를 만들지만, 첫 화면에서 사용자가 답해야 하는 질문은
//    "여기가 어떤 곳이고 내가 무엇을 할 수 있나" 다. 그건 글이 답한다.
//
// ⚠️ **금액을 쓰지 않는다.** 시안의 '추천 예산 ₩850,000~' 자리에 추천 기간과
//    여행기 수를 뒀다. 이유는 types.ts 의 DestinationSuggestion 주석에 있다.
//
// ⚠️ 배지는 근거가 있을 때만 나온다. 화면 파일이 커뮤니티 글 수로 정한다.
//    아무 여행지에나 '인기' 를 붙이지 않는다.
//
// ⚠️ 버튼 문구가 '둘러보기' 가 아니라 '여행 만들기' 다. 시안과 다르다.
//    이 버튼은 여행 만들기(TRIP-01)로 간다. 하는 일과 다른 말을 쓰면
//    누른 사람이 다른 화면에 도착한다. 둘러보는 자리는 아래 '발견한 여행지' 다.
//
// ⚠️ 누르면 여행 만들기로 간다. **목적지는 따라가지 않는다.**
//    TRIP-01(/trips/new/owner)이 지금 destination param 을 받지 않는다.
//    받게 하려면 그 화면을 고쳐야 하는데 담당이 달라 손대지 않았다.
//    (CLAUDE.md 13장) TODO: TRIP-01 이 목적지를 받으면 code 를 함께 넘긴다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { LandmarkArt } from './landmarkScene';
import type { DestinationSuggestion } from './types';

type Props = {
  suggestion: DestinationSuggestion;
  width: number;
  onPress: (code: string) => void;
};

/** 아래 값은 전부 NextTripBanner 와 같다. 두 카드가 같은 물건으로 보여야 한다. */
const INSET = 12;
const RADIUS = 18;
const ART_RATIO = 0.45;
const ART_HEIGHT = 80;
const ART_TOP = 2;
const ART_FILL = '#FFFFFF';
const ART_LINE_TINT = 0.32;

const INK = '#111827';
const LABEL = '#9aa3af';
const BODY = '#6b7280';
const HAIRLINE = '#eff1f4';
const BADGE_TINT = 0.14;

/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. (NextTripBanner 와 같다) */
const ORIGIN_CODE = 'ICN';

/**
 * 국가색을 흰색에 섞어 파스텔을 만든다.
 *
 * ⚠️ 반투명(알파)이 아니라 아예 섞어서 불투명한 색을 만든다.
 *    알파를 쓰면 겹친 자리마다 색이 달라져서 같은 톤으로 맞출 수 없다.
 *    (NextTripBanner 의 pastel 과 같은 함수다. countryTheme 은 여러 화면이
 *     함께 쓰는 파일이라 그쪽에 올리지 않았다. CLAUDE.md 5장)
 */
function pastel(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mix = (start: number) => {
    const channel = parseInt(value.slice(start, start + 2), 16);
    return Math.round(255 + (channel - 255) * ratio);
  };
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(0))}${to2(mix(2))}${to2(mix(4))}`;
}

/** 도시 이름 크기. 카드 폭에 대한 비율이다. (NextTripBanner 와 같다) */
function cityFontRatio(name: string): number {
  if (name.length <= 5) return 0.082;
  if (name.length <= 8) return 0.068;
  if (name.length <= 10) return 0.055;
  return 0.048;
}

export function DestinationSuggestCard({ suggestion, width, onPress }: Props) {
  const artWidth = width * ART_RATIO;
  // 글자 단은 그림과 겹치지 않는 만큼만 쓴다. 겹치면 도시 이름 위로 건물이 지나간다.
  const columnWidth = Math.max(0, width - INSET - 12 - artWidth - 10);
  const cityFont = width * cityFontRatio(suggestion.nameEn);
  const accent = suggestion.theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.nameKo}, ${suggestion.countryKo}. 새 여행 만들기`}
      onPress={() => onPress(suggestion.code)}
      className="overflow-hidden bg-white active:opacity-90"
      style={{
        width,
        borderRadius: RADIUS,
        // 테두리를 쓰지 않는다. 카드가 바탕에서 뜨는 일은 그림자 하나로 한다.
        shadowColor: '#1b2540',
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {/* 랜드마크 선그림. 그림 자체는 components/home/landmarkScene 에 있다 */}
      <LandmarkArt
        countryKo={suggestion.countryKo}
        fill={ART_FILL}
        line={pastel(accent, ART_LINE_TINT)}
        width={artWidth}
        height={ART_HEIGHT}
        style={{ position: 'absolute', right: 12, top: ART_TOP }}
      />

      {/* 국가 코드. 모르는 나라의 코드는 '--' 라 그리지 않는다. */}
      {suggestion.theme.code === '--' ? null : (
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: INSET,
            top: INSET,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.6,
            color: INK,
          }}
        >
          {suggestion.theme.code}
        </Text>
      )}

      {/* 배지. 준비 중인 여행 카드의 D-Day 와 같은 자리·같은 모양이다. */}
      {suggestion.badge ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: INSET - 2,
            top: INSET + 16,
            alignItems: 'center',
            backgroundColor: pastel(accent, BADGE_TINT),
            borderRadius: 9,
            paddingHorizontal: 7,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: -0.3, color: accent }}>
            {suggestion.badge}
          </Text>
        </View>
      ) : null}

      <View style={{ padding: INSET }}>
        {/* 왼쪽 글자 단. 오른쪽은 그림과 배지 자리다 */}
        <View style={{ width: columnWidth }}>
          {/* 항로 */}
          <View className="flex-row items-center">
            <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: BODY }}>
              {ORIGIN_CODE}
            </Text>
            <View
              className="flex-1"
              style={{
                marginHorizontal: 6,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#d7dce3',
              }}
            />
            {/* 돌리지 않은 Ionicons 비행기는 오른쪽 위를 향한다. 45도 돌리면
                하강하는 비행기로 보인다. (NextTripBanner 주석) */}
            <Ionicons name="airplane" size={12} color={INK} />
            <View
              className="flex-1"
              style={{
                marginHorizontal: 6,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#d7dce3',
              }}
            />
            <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: BODY }}>
              {suggestion.airportCode}
            </Text>
          </View>

          {/* 도시 — 영문 큰 글자 + 한글 */}
          <Text
            numberOfLines={1}
            style={{
              marginTop: 3,
              fontSize: cityFont,
              lineHeight: cityFont * 1.08,
              fontWeight: '700',
              letterSpacing: -0.8,
              color: INK,
            }}
          >
            {suggestion.nameEn}
          </Text>
          <Text
            numberOfLines={1}
            style={{ marginTop: 1, fontSize: 12.5, fontWeight: '600', color: BODY }}
          >
            {suggestion.nameKo}
          </Text>
        </View>

        {/*
          소개.

          ⚠️ 카드 폭을 다 쓴다. 위 도시 단과 달리 이 줄은 그림 아래로 지나간다.
             랜드마크는 카드 위쪽 80px 안에서 끝나므로 글과 겹치지 않는다.
          ⚠️ 줄바꿈은 문구 안에 들어 있다. 어디서 끊을지 사람이 정했다.
             (lib/constants/destinationEditorial)
        */}
        <Text style={{ marginTop: 10, fontSize: 12, lineHeight: 18, color: BODY }}>
          {suggestion.blurb}
        </Text>

        <View style={{ height: 1, backgroundColor: HAIRLINE, marginTop: 11, marginBottom: 9 }} />

        {/* 값 두 개 + 버튼 한 줄 */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            <Ionicons name="calendar-outline" size={12} color={LABEL} />
            <Text style={{ marginLeft: 4, fontSize: 11, color: BODY }} numberOfLines={1}>
              {suggestion.nights}
            </Text>

            <View
              style={{ width: 1, height: 9, marginHorizontal: 8, backgroundColor: '#e5e7eb' }}
            />

            <Ionicons name="chatbubble-outline" size={11} color={LABEL} />
            <Text style={{ marginLeft: 4, fontSize: 11, color: BODY }} numberOfLines={1}>
              {suggestion.postCount > 0 ? `여행기 ${suggestion.postCount}개` : '첫 여행기 주인공'}
            </Text>
          </View>

          {/*
            ⚠️ 이 알약은 따로 누를 수 없다. 카드 전체가 누름 영역이고 이건 표시다.
               안에 또 누를 수 있는 것을 두면 거기만 눌러야 하는 줄 안다.
               (NextTripBanner 가 동그란 화살표를 뺀 것과 같은 이유)
          */}
          <View
            pointerEvents="none"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pastel(accent, 0.1),
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: accent }}>여행 만들기</Text>
            <Ionicons name="arrow-forward" size={11} color={accent} style={{ marginLeft: 3 }} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
