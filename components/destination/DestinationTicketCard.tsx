// ============================================================================
// 여행지 티켓 카드 — DEST-01 머리 (2026-09-11)
//
//   ┌──┬──────────────────────────────┐
//   │  │ TRIPPOT            ┌────────┐│
//   │  │ OSAKA              │  사진   ││  ← 도시 대표 사진
//   │  │ JAPAN 🇯🇵           │  ((스탬프))│
//   │██│ ─────────────────  └────────┘│  ← ██ 국가색 세로 라인
//   │  │ SEOUL / ICN   ✈   KIX        │
//   │  │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │  ← 절취선
//   │  │ 여행 기간 │ 추천 시기 │ 여행 스타일│
//   │  │ 3박 4일   │ 봄, 가을  │ 도시·미식 │
//   │  │ ||||||||           GOOD TRIP  │  ← 바코드
//   └──┴──────────────────────────────┘
//
// ⚠️ **국가가 바뀌어도 이 구조는 그대로다.** 바뀌는 것은 사진·도시명·국가명·
//    국기·공항 코드·세로 라인과 스탬프 색뿐이다. 일본 화면에서 프랑스 화면으로
//    넘어가도 같은 TripPot 으로 보여야 한다.
//
// ⚠️ **국가색은 좁게 쓴다.** 이 카드에서 국가색이 칠해지는 곳은 왼쪽 세로 라인과
//    스탬프 두 곳이다. 카드 바탕은 흰색, 글자는 딥네이비다. 큰 면을 국기색으로
//    채우면 나라가 바뀔 때마다 앱이 다른 서비스처럼 보인다.
//
// ⚠️ 바코드는 아무 값도 담지 않는 무늬다. 숫자를 붙이지 않는다.
//    (components/home/LuggageTagCard 와 같은 규칙)
//
// ⚠️ 사진이 없는 목적지는 사진 칸을 국가색 옅은 톤으로 비운다. 원격 URL 이
//    아니라 앱에 넣은 파일이라 로드 실패는 없지만, 사진을 확보하지 못한
//    목적지가 있을 수 있다. (lib/constants/destinationHeroPhoto)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import type { DestinationDetailData } from './types';
import { INK, LINE, MUTED, RADIUS, SUBTLE } from './tokens';

type Props = {
  destination: DestinationDetailData;
};

/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. (홈 카드와 같다) */
const ORIGIN_CITY = 'SEOUL';
const ORIGIN_CODE = 'ICN';

const PHOTO_WIDTH = 132;
const PHOTO_HEIGHT = 118;
/** 왼쪽 국가색 세로 라인 폭. 카드에서 국가색이 칠해지는 두 곳 중 하나다. */
const STRIPE_WIDTH = 7;

/** 바코드 무늬. 목적지 코드로 만들어 다시 그려도 같은 무늬가 나온다. */
function barcodeBars(seed: string, targetWidth: number, count = 26) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const bars: { x: number; w: number }[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    hash = (Math.imul(hash, 1103515245) + 12345) >>> 0;
    const w = 1 + (hash % 3);
    bars.push({ x: cursor, w });
    cursor += w + 1.4;
  }
  const scale = cursor > 0 ? targetWidth / cursor : 1;
  return bars.map((bar) => ({ x: bar.x * scale, w: bar.w * scale }));
}

/** 세 칸짜리 값 줄 한 칸. */
function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10.5, color: SUBTLE, letterSpacing: -0.2 }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{ marginTop: 3, fontSize: 13, fontWeight: '600', color: INK, letterSpacing: -0.3 }}
      >
        {value}
      </Text>
    </View>
  );
}

export function DestinationTicketCard({ destination }: Props) {
  const accent = destination.theme.primary;
  const bars = barcodeBars(destination.code, 74);

  return (
    <View
      className="flex-row overflow-hidden bg-white"
      style={{ borderRadius: RADIUS.card, borderWidth: 1, borderColor: LINE }}
    >
      {/* 국가색 세로 라인 — 이 카드에서 국가색이 칠해지는 첫 번째 자리 */}
      <View style={{ width: STRIPE_WIDTH, backgroundColor: accent }} />

      <View style={{ flex: 1, padding: 14 }}>
        <View className="flex-row">
          {/* ── 왼쪽: 도시 정보 ─────────────────────────────────────────── */}
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: SUBTLE }}>
              TRIPPOT
            </Text>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                marginTop: 6,
                fontSize: 38,
                lineHeight: 42,
                // ⚠️ 카드에서 가장 큰 글자다. 여기와 예산 숫자만 굵게 두고
                //    나머지 제목은 Medium 으로 눌러 둔다. 다 굵으면 위계가 사라진다.
                fontWeight: '800',
                letterSpacing: -1.2,
                color: INK,
              }}
            >
              {destination.nameEn}
            </Text>

            <View className="mt-1 flex-row items-center">
              <Text
                style={{ fontSize: 14, fontWeight: '600', letterSpacing: 0.4, color: MUTED }}
              >
                {destination.theme.nameEn}
              </Text>
              {/* ⚠️ 윈도우에는 국기 글꼴이 없어 'JP' 처럼 글자로 보인다. */}
              <Text style={{ marginLeft: 6, fontSize: 13 }}>{destination.flag}</Text>
            </View>
          </View>

          {/* ── 오른쪽: 대표 사진 + 스탬프 ──────────────────────────────── */}
          <View
            style={{
              width: PHOTO_WIDTH,
              height: PHOTO_HEIGHT,
              borderRadius: RADIUS.inner,
              overflow: 'hidden',
              backgroundColor: destination.theme.primarySoft,
            }}
          >
            {destination.photo ? (
              <Image
                source={{ uri: destination.photo }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityRole="image"
                accessibilityLabel={`${destination.nameKo} 대표 사진`}
              />
            ) : null}

            {/* 국가 코드 배지. 사진 위에 얹는다. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 6,
                top: 6,
                backgroundColor: INK,
                borderRadius: 5,
                paddingHorizontal: 5,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: '#FFFFFF' }}>
                {destination.theme.code}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 항로 ───────────────────────────────────────────────────────── */}
        <View className="mt-3 flex-row items-center">
          <Text style={{ fontSize: 11.5, fontWeight: '600', letterSpacing: 0.6, color: MUTED }}>
            {ORIGIN_CITY} / {ORIGIN_CODE}
          </Text>
          <View
            className="flex-1"
            style={{ marginHorizontal: 8, borderTopWidth: 1, borderStyle: 'dashed', borderColor: LINE }}
          />
          {/* 돌리지 않은 Ionicons 비행기는 오른쪽 위를 향한다. 45도 돌리면
              하강하는 비행기로 보인다. (components/home/NextTripBanner 주석) */}
          <Ionicons name="airplane" size={14} color={INK} />
          <View
            className="flex-1"
            style={{ marginHorizontal: 8, borderTopWidth: 1, borderStyle: 'dashed', borderColor: LINE }}
          />
          <Text style={{ fontSize: 11.5, fontWeight: '600', letterSpacing: 0.6, color: MUTED }}>
            {destination.airportCode}
          </Text>
        </View>

        {/* 절취선 */}
        <View
          style={{ marginTop: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: LINE }}
        />

        {/* ── 값 세 칸 ───────────────────────────────────────────────────── */}
        <View className="mt-3 flex-row items-start">
          <TicketField label="여행 기간" value={destination.nights} />
          <View style={{ width: 1, height: 26, backgroundColor: LINE, marginHorizontal: 10 }} />
          <TicketField label="추천 시기" value={destination.season} />
          <View style={{ width: 1, height: 26, backgroundColor: LINE, marginHorizontal: 10 }} />
          <TicketField label="여행 스타일" value={destination.styles} />
        </View>

        {/* ── 바코드 줄 ──────────────────────────────────────────────────── */}
        <View className="mt-3.5 flex-row items-end justify-between">
          <Svg width={74} height={20}>
            {bars.map((bar, index) => (
              <Rect key={index} x={bar.x} y={0} width={bar.w} height={20} fill={INK} opacity={0.75} />
            ))}
          </Svg>

          <Text style={{ fontSize: 9, letterSpacing: 0.8, color: SUBTLE }}>
            GOOD TRIP ALWAYS
          </Text>
        </View>
      </View>

      {/*
        국가 스탬프 — 이 카드에서 국가색이 칠해지는 두 번째 자리.
        사진 위에 비스듬히 찍는다. 우체국 소인처럼 이중 원이다.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 18,
          top: 84,
          width: 62,
          height: 62,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-12deg' }],
        }}
      >
        <Svg width={62} height={62} style={{ position: 'absolute' }}>
          <Circle cx={31} cy={31} r={29} stroke={accent} strokeWidth={1.6} fill="#FFFFFF" opacity={0.92} />
          <Circle
            cx={31}
            cy={31}
            r={24}
            stroke={accent}
            strokeWidth={0.9}
            strokeDasharray="2 2"
            fill="none"
            opacity={0.75}
          />
        </Svg>
        <Text style={{ fontSize: 7, fontWeight: '800', letterSpacing: 0.8, color: accent }}>
          TRIPPOT
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 11, fontWeight: '800', letterSpacing: -0.2, color: accent }}
        >
          {destination.nameEn}
        </Text>
        <Text style={{ fontSize: 7, fontWeight: '700', letterSpacing: 0.8, color: accent }}>
          {destination.theme.nameEn}
        </Text>
      </View>
    </View>
  );
}
