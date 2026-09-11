// ============================================================================
// 여행지 티켓 카드 — DEST-01 머리 (2026-09-11 시안 반영)
//
//   ┃┌──────────────────────────────────────────┐┃
//   ┃│ TRIPPOT              ┌─────────────────┐ │┃
//   ┃│ TOKYO                │  사진   Good Trip!│ │┃
//   ┃│ JAPAN 🇯🇵              │            [JP] │ │┃
//   ┃│ ──────────────────   └─────────────────┘ │┃
//   ●│ SEOUL / ICN ✈┄┄┄ NRT        ((스탬프))≋≋ │●   ← ● 티켓 노치
//   ┃│ ─────────────────────────────────────────│┃
//   ┃│ 여행 기간  │ 추천 시기 │ 여행 스타일        │┃
//   ┃│ 3박 4일    │ 봄, 가을  │ 도시·쇼핑·미식     │┃
//   ┃│ ▌▌▌▌▌▌▌▌▌▌▌▌        ✈┄ GOOD TRIP ALWAYS │┃
//   ┃│ TRIPPOT TRAVEL TICKET                    │┃
//   ┗└──────────────────────────────────────────┘┛
//    ↑ 국기 첫 번째 색                국기 두 번째 색 ↑
//
// ⚠️ **국가가 바뀌어도 이 구조는 그대로다.** 바뀌는 것은 사진·도시명·국가명·
//    국기·공항 코드, 그리고 좌우 띠와 스탬프 색뿐이다.
//
// ⚠️ **좌우 띠는 여행 준비 홈의 방식을 그대로 따른다.** (2026-09-11)
//    components/trip-home/BaggageTagCard 가 좌우 컬러 라인에 국기 두 색
//    (theme.stripe[0] / theme.stripe[1])을 쓴다. 여기도 같게 맞췄다.
//      일본   레드 · 딥네이비      프랑스  블루 · 레드
//      이탈리아 그린 · 레드        대만    딥블루 · 레드
//    두 화면의 티켓이 같은 체계로 보여야 하고, 색을 이 화면에서 새로 정하면
//    나중에 국기 색이 바뀔 때 한 곳만 남는다. (countryTheme 한 곳에서 온다)
//
// ⚠️ **국가색은 좁게 쓴다.** 좌우 띠와 스탬프뿐이다. 카드 바탕은 흰색,
//    글자는 딥네이비다. 큰 면을 국기색으로 채우면 나라가 바뀔 때마다 앱이
//    다른 서비스처럼 보인다. (tokens.ts 머리말)
//
// ⚠️ 노치(양옆 반원)는 **페이지 바탕색으로 뚫는다.** 카드가 흰색이고 페이지도
//    흰색이라 색으로는 구분되지 않지만, 띠를 파고들어 가면서 티켓 모양이 된다.
//
// ⚠️ 바코드는 아무 값도 담지 않는 무늬다. 숫자를 붙이지 않는다.
//    (components/home/LuggageTagCard 와 같은 규칙)
//
// ⚠️ 'Good Trip!' 손글씨는 Caveat 다. 글꼴이 아직 안 실렸으면 그리지 않는다.
//    글꼴 없이 그리면 시스템 고딕으로 나와서 손글씨가 아니라 오타처럼 보인다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useStoryFonts } from '@/lib/hooks/useStoryFonts';

import { INK, SUBTLE } from './tokens';
import type { DestinationDetailData } from './types';

/** 카드 테두리·구분선. 여행 준비 홈 티켓(TravelTicketCard)과 같은 값이다. */
const LINE = '#e5e8ec';

type Props = {
  destination: DestinationDetailData;
};

/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. (홈 카드와 같다) */
const ORIGIN_CITY = 'SEOUL';
const ORIGIN_CODE = 'ICN';

/**
 * 아래 세 값은 **여행 준비 홈의 티켓·태그(components/trip-home)** 에서 가져왔다.
 * 두 화면의 티켓이 같은 종이로 보여야 한다.
 *   RADIUS  TravelTicketCard 와 같은 18
 *   SIDE    BaggageTagCard 의 좌우 컬러 라인과 같은 11
 *   NOTCH   TravelTicketCard 의 NOTCH_R 과 같은 9
 */
const RADIUS = 18;
/** 좌우 컬러 라인 폭. 양쪽이 같다. */
const SIDE = 11;
const PAD = 15;
/** 노치 반지름. 양옆에서 카드를 파고든다. */
const NOTCH = 9;
/** 페이지 바탕. 노치를 이 색으로 뚫는다. ⚠️ 화면 바탕과 같아야 한다. */
const PAGE_BG = '#FFFFFF';

/** 바코드 무늬. 목적지 코드로 만들어 다시 그려도 같은 무늬가 나온다. */
function barcodeBars(seed: string, targetWidth: number, count = 46) {
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
    cursor += w + 1.3;
  }
  const scale = cursor > 0 ? targetWidth / cursor : 1;
  return bars.map((bar) => ({ x: bar.x * scale, w: bar.w * scale }));
}

/**
 * 값 세 칸 중 한 칸.
 *
 * ⚠️ **글자를 자르지 않는다.** '도시 · 쇼핑 · 미식' 처럼 긴 값이 들어오면
 *    두 줄로 흘린다. numberOfLines={1} + adjustsFontSizeToFit 을 쓰면 이 칸만
 *    글자가 작아져서 세 칸의 크기가 서로 달라 보인다.
 * @param grow 칸 폭 비율. 값이 긴 칸(여행 스타일)에 더 준다.
 */
function TicketField({ label, value, grow = 1 }: { label: string; value: string; grow?: number }) {
  return (
    <View style={{ flex: grow }}>
      <Text style={{ fontSize: 10.5, color: SUBTLE, letterSpacing: -0.2 }}>{label}</Text>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 4,
          fontSize: 13.5,
          lineHeight: 18,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: INK,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function DestinationTicketCard({ destination }: Props) {
  const accent = destination.theme.primary;
  const fontsReady = useStoryFonts();

  const bars = barcodeBars(destination.code, 178);

  return (
    <View
      className="flex-row bg-white"
      style={{
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: LINE,
        overflow: 'hidden',
      }}
    >
      {/* 왼쪽 컬러 라인 — 국기 첫 번째 색 */}
      <View style={{ width: SIDE, backgroundColor: destination.theme.stripe[0] }} />

      <View style={{ flex: 1, paddingHorizontal: PAD, paddingTop: PAD, paddingBottom: 12 }}>
        {/* ── 위: 도시 정보 + 사진 ────────────────────────────────────────── */}
        <View className="flex-row">
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: INK }}>
              TRIPPOT
            </Text>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                marginTop: 4,
                fontSize: 40,
                lineHeight: 44,
                // 카드에서 가장 큰 글자. 여기와 값 세 칸만 굵게 간다.
                fontWeight: '900',
                letterSpacing: -1.6,
                color: INK,
              }}
            >
              {destination.nameEn}
            </Text>

            <View className="mt-0.5 flex-row items-center">
              <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.2, color: '#9AA7BD' }}>
                {destination.theme.nameEn}
              </Text>
              {/* 국기를 흰 칸에 넣어 배지로 만든다.
                  ⚠️ 윈도우에는 국기 글꼴이 없어 'JP' 처럼 글자로 보인다. */}
              <View
                style={{
                  marginLeft: 7,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderRadius: 5,
                  borderWidth: 1,
                  borderColor: LINE,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontSize: 12 }}>{destination.flag}</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: LINE, marginTop: 10 }} />

            {/* 항로 — 비행기가 왼쪽에 서고 점선이 도착지로 이어진다 */}
            <View className="mt-2.5 flex-row items-center">
              <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2, color: INK }}>
                {ORIGIN_CITY} / {ORIGIN_CODE}
              </Text>
              <Ionicons name="airplane" size={14} color={INK} style={{ marginLeft: 8 }} />
              <View
                className="flex-1"
                style={{
                  marginHorizontal: 6,
                  borderTopWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#C8D0DD',
                }}
              />
              <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2, color: INK }}>
                {destination.airportCode}
              </Text>
            </View>
          </View>

          {/* 사진 */}
          <View
            style={{
              width: '43%',
              aspectRatio: 1.12,
              borderRadius: 10,
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

            {/* 손글씨. 글꼴이 실리지 않았으면 그리지 않는다. (위 주석) */}
            {fontsReady ? (
              <Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 12,
                  fontFamily: 'Caveat_700Bold',
                  fontSize: 20,
                  color: '#FFFFFF',
                  // 밝은 사진 위에서도 읽히게 그늘을 준다.
                  textShadowColor: 'rgba(0,0,0,0.45)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                Good Trip!
              </Text>
            ) : null}

            {/* 국가 코드 배지. 딥네이비 — 나라가 바뀌어도 같은 색이다. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 7,
                top: 7,
                backgroundColor: INK,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: '#FFFFFF' }}>
                {destination.theme.code}
              </Text>
            </View>
          </View>
        </View>

        {/* 카드를 가로로 가르는 선. 아래가 '값' 영역이다. */}
        <View style={{ height: 1, backgroundColor: LINE, marginTop: 14 }} />

        {/* ── 값 세 칸 ───────────────────────────────────────────────────── */}
        <View className="mt-3 flex-row items-stretch">
          <TicketField label="여행 기간" value={destination.nights} />
          <View style={{ width: 1, height: 34, backgroundColor: LINE, marginHorizontal: 9 }} />
          <TicketField label="추천 시기" value={destination.season} />
          <View style={{ width: 1, height: 34, backgroundColor: LINE, marginHorizontal: 9 }} />
          <TicketField label="여행 스타일" value={destination.styles} grow={1.35} />
        </View>

        {/* ── 바코드 줄 ──────────────────────────────────────────────────── */}
        <View className="mt-3.5 flex-row items-end justify-between">
          <View>
            <Svg width={178} height={30}>
              {bars.map((bar, index) => (
                <Rect key={index} x={bar.x} y={0} width={bar.w} height={30} fill={INK} />
              ))}
            </Svg>
            <Text style={{ marginTop: 5, fontSize: 9.5, letterSpacing: 1.4, color: '#9AA7BD' }}>
              TRIPPOT TRAVEL TICKET
            </Text>
          </View>

          <View className="flex-row items-center" style={{ marginBottom: 2 }}>
            <Ionicons name="airplane" size={12} color="#B6C0CF" />
            <View
              style={{
                width: 26,
                marginHorizontal: 5,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#C8D0DD',
              }}
            />
            <Text style={{ fontSize: 9.5, letterSpacing: 1.1, color: '#9AA7BD' }}>
              GOOD TRIP ALWAYS
            </Text>
          </View>
        </View>
      </View>

      {/* 오른쪽 컬러 라인 — 국기 두 번째 색 */}
      <View style={{ width: SIDE, backgroundColor: destination.theme.stripe[1] }} />

      {/*
        국가 스탬프 — 카드에서 국가색이 칠해지는 두 번째 자리.
        사진 아래 오른쪽에 걸치게 두고, 오른쪽으로 소인 물결을 흘린다.
      */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: SIDE + 4, top: '46%' }}
      >
        <View style={{ width: 78, height: 66 }}>
          <Svg width={78} height={66} style={{ position: 'absolute' }}>
            {/* 소인 물결. 도장 오른쪽으로 흘러 나간다. */}
            {[0, 1, 2, 3].map((line) => {
              const y = 24 + line * 6;
              return (
                <Path
                  key={line}
                  d={`M 58 ${y} q 5 -3 10 0 t 10 0`}
                  stroke={accent}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  fill="none"
                />
              );
            })}
            {/* 이중 원 */}
            <Circle cx={33} cy={33} r={30} stroke={accent} strokeWidth={1.8} fill={PAGE_BG} opacity={0.96} />
            <Circle cx={33} cy={33} r={25.5} stroke={accent} strokeWidth={0.9} fill="none" opacity={0.85} />
          </Svg>

          <View
            style={{
              position: 'absolute',
              left: 3,
              top: 3,
              width: 60,
              height: 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 7, fontWeight: '800', letterSpacing: 0.9, color: accent }}>
              TRIPPOT
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                maxWidth: 52,
                fontSize: 13,
                fontWeight: '900',
                letterSpacing: -0.3,
                color: accent,
              }}
            >
              {destination.nameEn}
            </Text>
            <Text style={{ fontSize: 6.5, fontWeight: '800', letterSpacing: 0.8, color: accent }}>
              {destination.theme.nameEn}
            </Text>
            <Ionicons name="airplane" size={9} color={accent} style={{ marginTop: 1 }} />
          </View>
        </View>
      </View>

      {/*
        티켓 노치. 양옆에서 카드를 파고든다.
        ⚠️ overflow: hidden 안쪽이라 반원만 보인다.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -NOTCH,
          top: '46%',
          width: NOTCH * 2,
          height: NOTCH * 2,
          borderRadius: NOTCH,
          backgroundColor: PAGE_BG,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -NOTCH,
          top: '46%',
          width: NOTCH * 2,
          height: NOTCH * 2,
          borderRadius: NOTCH,
          backgroundColor: PAGE_BG,
        }}
      />
    </View>
  );
}
