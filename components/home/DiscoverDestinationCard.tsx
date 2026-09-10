// ============================================================================
// 이런 여행지는 어때요? 태그 — 신규 사용자 홈 (2026-09-09)
//
//   ┃│ ICN    ⊚ ┄✈┄  NRT │
//   ┃│ DEPARTURE  ARRIVAL │
//   ┃│                    │
//   ┃│ TOKYO              │      ← 도착 도시
//   ┃│ 도쿄                │
//   ┃│ 여행기 12개          │      ← 실제 커뮤니티 글 수
//   ┃│      ⛩ 🗻          │      ← 나라 그림 (tagArt)
//   ┃│ TRAVEL CITY ||||||| │      ← 바코드
//   ╰────────────────────╯
//    ↑ 세로 국가 띠 (일본 JAPAN)
//
// ⚠️ **지난 여행 카드(LuggageTagCard)와 같은 러기지 태그다.** 종이색·잉크색·
//    국가 띠·구멍·나라 그림·바코드를 그대로 가져왔다. 다만 **더 단순하다** —
//    소인 물결·해·날짜 칸·결산 유도가 없다. 그건 다녀온 여행에만 있는 값이다.
//
// ⚠️ 왜 여기에 러기지 태그를 쓰는가.
//    이 칸은 "다른 사람이 다녀온 곳" 이다. 떼어 낸 수하물 태그는 다녀온 흔적을
//    가리키는 물건이라 뜻이 맞는다. 위 '추천 여행지'(보딩패스)는 앞으로 갈 곳,
//    여기(러기지 태그)는 이미 다녀온 곳 — 두 카드의 생김새가 그 차이를 말한다.
//
// ⚠️ **누르면 커뮤니티의 그 여행지 글로 간다.** 여행 만들기가 아니다.
//    태그에 적힌 '여행기 N개' 가 곧 눌렀을 때 보게 될 것이다.
//
// ⚠️ 바코드는 아무 값도 담지 않는 무늬다. 숫자를 붙이지 않는다.
//    붙이는 순간 지어낸 값이 된다. (LuggageTagCard 와 같은 규칙)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { TagScene, tagArt } from './tagArt';
import type { DiscoverDestination } from './types';

type Props = {
  destination: DiscoverDestination;
  width: number;
  onPress: (nameKo: string) => void;
};

/** 아래 값은 LuggageTagCard 와 같다. 두 태그가 같은 종이로 보여야 한다. */
const RATIO = 0.72;
const PAPER = '#f7f3e8';
const PAPER_EDGE = '#e6dfcc';
const INK = '#2f3b33';
const LABEL = '#8f8b7c';
/** 홈 바탕색. 태그 구멍을 이 색으로 뚫는다. ⚠️ HomeEmpty 의 바탕과 같아야 한다. */
const PAGE_BG = '#FFFFFF';
/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. */
const ORIGIN_CODE = 'ICN';

/** HONG KONG 처럼 긴 이름이 한 줄을 넘지 않게 길이로 줄인다. (LuggageTagCard 와 같다) */
function cityRatio(name: string): number {
  if (name.length <= 5) return 0.15;
  if (name.length <= 7) return 0.115;
  if (name.length <= 9) return 0.092;
  return 0.076;
}

/**
 * 바코드 막대.
 *
 * ⚠️ LuggageTagCard 에 같은 함수가 있다. 그쪽에서 꺼내 오려면 그 파일을 고쳐야
 *    해서 여기에 뒀다. 지난 여행 카드는 tripId 로, 여기는 목적지 코드로 씨앗을
 *    삼는다. 여행지마다 무늬가 달라야 같은 카드가 복사된 것처럼 보이지 않는다.
 */
function barcodeBars(seed: string, targetWidth: number, count = 16) {
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
    cursor += w + 1.5;
  }

  const scale = cursor > 0 ? targetWidth / cursor : 1;
  return bars.map((bar) => ({ x: bar.x * scale, w: bar.w * scale }));
}

export function DiscoverDestinationCard({ destination, width, onPress }: Props) {
  const height = Math.round(width / RATIO);
  const radius = width * 0.055;
  const accent = destination.theme.primary;
  const art = tagArt(destination.countryKo);

  // 왼쪽 국가 띠. 종이 전체 높이를 지난다.
  const stripWidth = width * 0.125;
  const contentLeft = stripWidth + width * 0.055;
  const contentRight = width - width * 0.055;

  const holeX = stripWidth + width * 0.085;
  const holeY = height * 0.075;
  const holeOuter = width * 0.038;

  const sceneTop = height * 0.5;
  const sceneHeight = height * 0.28;

  const cityFont = width * cityRatio(destination.nameEn);
  const labelFont = width * 0.033;
  const valueFont = width * 0.052;

  const barcodeWidth = width * 0.24;
  const barcodeHeight = height * 0.05;
  const barcodeY = height * 0.905;
  const bars = barcodeBars(destination.code, barcodeWidth);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination.nameKo} 여행기 ${destination.postCount}개 보기`}
      onPress={() => onPress(destination.nameKo)}
      className="active:opacity-80"
      style={{
        width,
        height,
        shadowColor: '#1b2540',
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
      }}
    >
      {/* ── 태그 종이와 인쇄물 ───────────────────────────────────────────── */}
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        {/* 종이. 네 모서리를 같은 값으로 둥글린다. */}
        <Path
          d={[
            `M ${radius} 0`,
            `H ${width - radius}`,
            `A ${radius} ${radius} 0 0 1 ${width} ${radius}`,
            `V ${height - radius}`,
            `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
            `H ${radius}`,
            `A ${radius} ${radius} 0 0 1 0 ${height - radius}`,
            `V ${radius}`,
            `A ${radius} ${radius} 0 0 1 ${radius} 0`,
            'Z',
          ].join(' ')}
          fill={PAPER}
          stroke={PAPER_EDGE}
          strokeWidth={1}
        />

        {/* 왼쪽 국가색 띠. 위아래 둥근 모서리를 종이와 함께 돈다. */}
        <Path
          d={[
            `M ${radius} 0`,
            `H ${stripWidth}`,
            `V ${height}`,
            `H ${radius}`,
            `A ${radius} ${radius} 0 0 1 0 ${height - radius}`,
            `V ${radius}`,
            `A ${radius} ${radius} 0 0 1 ${radius} 0`,
            'Z',
          ].join(' ')}
          fill={accent}
        />

        {/* 태그를 매다는 구멍 */}
        <Circle cx={holeX} cy={holeY} r={holeOuter} fill={accent} opacity={0.18} />
        <Circle cx={holeX} cy={holeY} r={holeOuter * 0.42} fill={PAGE_BG} />

        {/* 아래 절취선. 태그 아랫단(바코드 칸)을 가른다. */}
        <Path
          d={`M ${stripWidth} ${height * 0.855} H ${width}`}
          stroke={PAPER_EDGE}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* 바코드 */}
        {bars.map((bar, index) => (
          <Rect
            key={`bar-${index}`}
            x={contentRight - barcodeWidth + bar.x}
            y={barcodeY}
            width={bar.w}
            height={barcodeHeight}
            fill={INK}
            opacity={0.75}
          />
        ))}
      </Svg>

      {/* 나라 그림. 종이 위, 글자 아래 */}
      <TagScene
        countryKo={destination.countryKo}
        art={art}
        accent={accent}
        style={{
          position: 'absolute',
          left: contentLeft,
          right: width * 0.055,
          top: sceneTop,
          height: sceneHeight,
        }}
      />

      {/*
        세로 국가명.

        ⚠️ SVG 로 돌리지 않고 View 를 돌린다. 글꼴 크기가 기기마다 조금씩 달라
           SVG 좌표로 놓으면 긴 국가명(PHILIPPINES)이 띠 밖으로 나간다.
           View 를 돌리면 글자가 알아서 줄어든다.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: stripWidth,
          height,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            transform: [{ rotate: '-90deg' }],
            width: height * 0.8,
            textAlign: 'center',
            fontSize: labelFont,
            fontWeight: '700',
            letterSpacing: 1.4,
            color: destination.theme.onPrimary,
          }}
        >
          {destination.countryKo} {destination.theme.nameEn}
        </Text>
      </View>

      {/* ── 인쇄 글자 ───────────────────────────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: contentLeft, right: width * 0.055, top: height * 0.05 }}
      >
        {/* 출발 → 도착 */}
        <View className="flex-row items-start justify-between">
          <View>
            <Text style={{ fontSize: valueFont, fontWeight: '800', color: INK }}>
              {ORIGIN_CODE}
            </Text>
            <Text style={{ fontSize: labelFont, letterSpacing: 0.5, color: accent }}>
              DEPARTURE
            </Text>
          </View>

          <Ionicons name="airplane" size={valueFont} color={INK} style={{ marginTop: 2 }} />

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: valueFont, fontWeight: '800', color: INK }}>
              {destination.airportCode}
            </Text>
            <Text style={{ fontSize: labelFont, letterSpacing: 0.5, color: LABEL }}>ARRIVAL</Text>
          </View>
        </View>

        {/* 도착 도시 */}
        <Text
          numberOfLines={1}
          style={{
            marginTop: height * 0.055,
            fontSize: cityFont,
            lineHeight: cityFont * 1.05,
            fontWeight: '800',
            letterSpacing: -0.6,
            color: INK,
          }}
        >
          {destination.nameEn}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: valueFont, fontWeight: '700', color: accent }}
        >
          {destination.nameKo}
        </Text>

        {/* 눌렀을 때 보게 될 것. 지어낸 홍보 문구를 쓰지 않는다. */}
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: labelFont * 1.15, color: LABEL }}>
          여행기 {destination.postCount}개
        </Text>
      </View>

      {/* 아랫단 라벨. 바코드와 같은 줄이다. */}
      <Text
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: contentLeft,
          top: barcodeY,
          fontSize: labelFont,
          letterSpacing: 0.8,
          color: LABEL,
        }}
      >
        TRAVEL{'\n'}CITY
      </Text>
    </Pressable>
  );
}
