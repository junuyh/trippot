// ============================================================================
// 이런 여행지는 어때요? 태그 — 신규 사용자 홈 (2026-09-10 개편)
//
//    ┌─────────────╮
//   ┃│ ICN    ⊚   ┌───────┐│      ← 출발 공항 · 구멍 · 도착/기간 칸
//   ┃│ DEPARTURE  │ARRIVAL││
//   ┃│            │ NRT ✈ ││
//   ┃│ ≋≋≋  ●     │STAY   ││      ← 소인 물결 · 국가색 해
//   ┃│            │3박 4일││
//   ┃│ TOKYO       ((JP)) │       ← 도착 도시 · 소인
//   ┃│ 도쿄                │
//   ┃│      ⛩ 🗻          │       ← 나라 그림 (tagArt)
//   ┃└──────╮/////////////│       ← 항공우편 사선 또는 물결
//   │ POSTS │             │
//   │ 12개                │
//   │ 여행기 보기 →  ||||||| │      ← 커뮤니티로 · 바코드
//   ╰─────────────────────╯
//
// ⚠️ **지난 여행 카드(LuggageTagCard)를 그대로 가져왔다.** 종이·국가 띠·구멍·
//    소인 물결·해·소인·도착 칸·나라 그림·항공우편 가장자리·바코드까지 자리와
//    치수가 같은 값이다. 처음에는 이 중 절반을 뺀 단순한 태그였는데, 옆에 둔
//    지난 여행 태그와 나란히 놓으면 **덜 그려진 카드처럼** 보였다.
//
// ⚠️ 뺀 것은 **여행에만 있는 값**뿐이다. 그 자리는 비우지 않고 이 카드가 아는
//    값으로 채웠다. 칸을 비워 두면 종이의 균형이 무너진다.
//
//      지난 여행 카드          이 카드              왜
//      ─────────────────      ─────────────────    ────────────────────────
//      STAY  3박 4일          STAY  3박 4일        추천 기간 (사람이 정한 값)
//      소인  JP · 2026        소인  JP             연도는 여행에만 있다
//      DATE  09.02 – 09.06    POSTS 12개           날짜가 없다. 글 수를 쓴다
//      결산하기 →             여행기 보기 →         눌렀을 때 가는 곳
//
// ⚠️ 참고 디자인의 'FLIGHT NO.' 와 'GATE' 자리에 **실제로 아는 값**을 넣는
//    규칙은 그대로다. 모르는 값을 그럴듯하게 지어내지 않는다.
//    (components/trip-home/TravelTicketCard · LuggageTagCard 와 같은 규칙)
//
// ⚠️ 왜 러기지 태그인가.
//    이 칸은 "다른 사람이 다녀온 곳" 이다. 떼어 낸 수하물 태그는 다녀온 흔적을
//    가리키는 물건이라 뜻이 맞는다. 위 '추천 여행지'(보딩패스)는 앞으로 갈 곳,
//    여기(러기지 태그)는 이미 다녀온 곳 — 생김새가 그 차이를 말한다.
//
// ⚠️ **누르면 커뮤니티의 그 여행지 글로 간다.** 여행 만들기가 아니다.
//
// ⚠️ 바코드는 아무 값도 담지 않는 무늬다. 숫자를 붙이지 않는다.
//    붙이는 순간 지어낸 값이 된다. (LuggageTagCard 와 같은 규칙)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { TagScene, tagArt } from './tagArt';
import type { DiscoverDestination } from './types';

type Props = {
  destination: DiscoverDestination;
  width: number;
  onPress: (nameKo: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 아래 값은 전부 LuggageTagCard 와 같다. 두 태그가 같은 종이로 보여야 한다. */
const RATIO = 0.72;
const PAPER = '#f7f3e8';
const PAPER_EDGE = '#e6dfcc';
const INK = '#2f3b33';
const LABEL = '#8f8b7c';
/**
 * 홈 바탕색. 태그 구멍을 이 색으로 뚫는다.
 * ⚠️ HomeEmpty 의 바탕과 **반드시 같아야 한다.** 다르면 구멍이 다른 색 점이 된다.
 */
const PAGE_BG = '#FFFFFF';
/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. */
const ORIGIN_CODE = 'ICN';

/** HONG KONG 처럼 긴 이름이 한 줄을 넘지 않게 길이로 줄인다. (LuggageTagCard 와 같다) */
function cityRatio(name: string): number {
  if (name.length <= 5) return 0.155;
  if (name.length <= 7) return 0.118;
  if (name.length <= 9) return 0.095;
  return 0.078;
}

/**
 * 바코드 막대.
 *
 * ⚠️ LuggageTagCard 에 같은 함수가 있다. 그쪽에서 꺼내 오려면 그 파일을 고쳐야
 *    해서 여기에 뒀다. 지난 여행 카드는 tripId 로, 여기는 목적지 코드로 씨앗을
 *    삼는다. 여행지마다 무늬가 달라야 같은 카드가 복사된 것처럼 보이지 않는다.
 */
function barcodeBars(seed: string, targetWidth: number, count = 20) {
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

/** 항공우편 사선 무늬. 띠 밖으로 나간 부분은 clipPath 로 잘린다. */
function stripePaths(x0: number, x1: number, y0: number, y1: number): string[] {
  const bandHeight = y1 - y0;
  const barWidth = bandHeight * 0.75;
  const step = bandHeight * 1.6;
  const paths: string[] = [];

  for (let x = x0 - bandHeight; x < x1 + bandHeight; x += step) {
    paths.push(
      `M ${x} ${y1} L ${x + barWidth} ${y1} L ${x + barWidth + bandHeight} ${y0} L ${x + bandHeight} ${y0} Z`,
    );
  }
  return paths;
}

/** 물결 무늬. 바다를 낀 나라의 아래 가장자리다. */
function wavePath(x0: number, x1: number, y0: number, y1: number): string {
  const amplitude = (y1 - y0) * 0.55;
  const step = (x1 - x0) / 6;
  let d = `M ${x0} ${y1} L ${x0} ${y0 + amplitude}`;
  for (let index = 0; index < 6; index += 1) {
    const sign = index % 2 === 0 ? -1 : 1;
    d += ` q ${step / 2} ${sign * amplitude} ${step} 0`;
  }
  return `${d} L ${x1} ${y1} Z`;
}

export function DiscoverDestinationCard({ destination, width, onPress }: Props) {
  const height = Math.round(width / RATIO);
  const art = tagArt(destination.countryKo);
  const accent = destination.theme.primary;

  // ── 태그 위의 자리들 ─────────────────────────────────────────────────────
  // 글자와 그림이 같은 좌표를 보고 그려야 어긋나지 않는다.
  // ⚠️ 아래 좌표는 LuggageTagCard 와 같은 값이다. 두 태그가 나란히 섰을 때
  //    공항 코드·도시 이름·바코드의 높이가 서로 맞아야 한 벌로 보인다.
  const radius = width * 0.05;
  const stripWidth = Math.round(width * 0.115);
  const pad = Math.round(width * 0.05);
  const contentLeft = stripWidth + pad;
  const contentRight = width - pad;
  const stripBottom = height * 0.775;

  const holeX = contentLeft + (width - contentLeft) * 0.38;
  const holeY = height * 0.072;
  const holeOuter = width * 0.062;

  const boxWidth = width * 0.36;
  const boxLeft = contentRight - boxWidth;
  const boxTop = height * 0.042;
  const boxRow = height * 0.068;

  const sunX = contentLeft + (width - contentLeft) * 0.55;
  const sunY = height * 0.25;

  const stampX = contentRight - width * 0.1;
  const stampY = height * 0.29;
  const stampR = width * 0.095;

  const sceneTop = height * 0.46;
  const sceneHeight = height * 0.305;

  const postsTop = height * 0.78;
  const postsBottom = height * 0.885;
  const postsRight = width * 0.44;

  const edgeTop = height * 0.79;
  const edgeBottom = height * 0.845;
  const edgeLeft = width * 0.47;

  const footTop = height * 0.9;
  const barcodeWidth = width * 0.26;
  const barcodeHeight = height * 0.055;

  const cityFont = width * cityRatio(destination.nameEn);
  const labelFont = width * 0.032;
  const valueFont = width * 0.048;

  const bars = barcodeBars(destination.code, barcodeWidth);

  // ⚠️ clipPath id 는 카드마다 달라야 한다. 한 화면에 태그가 여러 장 있는데
  //    id 가 같으면 웹(react-native-web)에서 모두 첫 카드의 자르기 영역을 쓴다.
  const edgeClipId = `discover-edge-${destination.code}`;

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
        <Defs>
          {/* 가장자리 무늬가 태그 밖으로 나가지 않게 종이 모양으로 자른다 */}
          <ClipPath id={edgeClipId}>
            <Rect x={edgeLeft} y={edgeTop} width={width - edgeLeft} height={edgeBottom - edgeTop} />
          </ClipPath>
        </Defs>

        {/* 종이. 네 모서리를 같은 값으로 둥글려 종이가 끊기지 않게 한다. */}
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

        {/* 왼쪽 국가색 띠. 종이의 왼쪽 위 둥근 모서리를 그대로 따라간다. */}
        <Path
          d={[
            `M ${radius} 0`,
            `H ${stripWidth}`,
            `V ${stripBottom}`,
            `H 0`,
            `V ${radius}`,
            `A ${radius} ${radius} 0 0 1 ${radius} 0`,
            'Z',
          ].join(' ')}
          fill={accent}
        />

        {/* 태그를 매다는 구멍 */}
        <Circle cx={holeX} cy={holeY} r={holeOuter} fill={accent} />
        <Circle cx={holeX} cy={holeY} r={holeOuter * 0.42} fill={PAGE_BG} />

        {/* 소인 물결. 우체국 도장 옆에 긋는 선이다 */}
        {[0, 1, 2].map((line) => {
          const y = height * 0.215 + line * height * 0.017;
          const span = (width - contentLeft) * 0.42;
          const step = span / 3;
          return (
            <Path
              key={`cancel-${line}`}
              d={`M ${contentLeft} ${y} q ${step / 2} -2.5 ${step} 0 t ${step} 0 t ${step} 0`}
              stroke={accent}
              strokeWidth={1.1}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />
          );
        })}

        {/* 해 */}
        <Circle cx={sunX} cy={sunY} r={width * 0.058} fill={accent} opacity={0.9} />

        {/* 도착·기간 칸 */}
        <Path
          d={`M ${boxLeft} ${boxTop} V ${boxTop + boxRow * 2}`}
          stroke={INK}
          strokeWidth={0.9}
          strokeDasharray="2.5 2"
          opacity={0.45}
        />
        <Path
          d={`M ${boxLeft} ${boxTop + boxRow} H ${contentRight}`}
          stroke={INK}
          strokeWidth={0.9}
          strokeDasharray="2.5 2"
          opacity={0.45}
        />

        {/* 소인 */}
        <Circle
          cx={stampX}
          cy={stampY}
          r={stampR}
          stroke={accent}
          strokeWidth={1.4}
          fill="none"
          opacity={0.75}
        />
        <Circle
          cx={stampX}
          cy={stampY}
          r={stampR * 0.78}
          stroke={accent}
          strokeWidth={0.8}
          strokeDasharray="2 2"
          fill="none"
          opacity={0.6}
        />

        {/* 글 수 칸. 지난 여행 태그의 기간 칸과 같은 자리다. */}
        <Path
          d={`M 0 ${postsTop} H ${postsRight} V ${postsBottom} H 0`}
          stroke={INK}
          strokeWidth={0.9}
          fill="none"
          opacity={0.35}
        />

        {/* 아래 가장자리 무늬 */}
        <G clipPath={`url(#${edgeClipId})`}>
          {art.edge === 'stripe' ? (
            stripePaths(edgeLeft, width, edgeTop, edgeBottom).map((d, index) => (
              <Path key={`stripe-${index}`} d={d} fill={accent} opacity={0.85} />
            ))
          ) : (
            <>
              <Path d={wavePath(edgeLeft, width, edgeTop, edgeBottom)} fill={accent} opacity={0.85} />
              <Path
                d={wavePath(edgeLeft, width, edgeTop - (edgeBottom - edgeTop) * 0.5, edgeBottom)}
                fill={accent}
                opacity={0.3}
              />
            </>
          )}
        </G>

        {/* 바코드. 값을 담지 않는 무늬다 */}
        {bars.map((bar, index) => (
          <Rect
            key={`bar-${index}`}
            x={contentRight - barcodeWidth + bar.x}
            y={footTop}
            width={bar.w}
            height={barcodeHeight}
            fill={INK}
            opacity={0.8}
          />
        ))}
      </Svg>

      {/* ── 나라 그림 ────────────────────────────────────────────────────── */}
      <TagScene
        countryKo={destination.countryKo}
        art={art}
        accent={accent}
        style={{
          position: 'absolute',
          left: stripWidth,
          top: sceneTop,
          width: width - stripWidth,
          height: sceneHeight,
        }}
      />

      {/* ── 왼쪽 띠의 국가명 ─────────────────────────────────────────────── */}
      <Ionicons
        name={art.icon}
        size={width * 0.058}
        color={destination.theme.onPrimary}
        style={{
          position: 'absolute',
          left: stripWidth / 2 - width * 0.029,
          top: height * 0.045,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: stripBottom - height * 0.12,
          height: stripWidth,
          left: stripWidth / 2 - (stripBottom - height * 0.12) / 2,
          top: (height * 0.12 + stripBottom) / 2 - stripWidth / 2,
          transform: [{ rotate: '-90deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: width * 0.044,
            fontWeight: '700',
            letterSpacing: 1.2,
            color: destination.theme.onPrimary,
          }}
        >
          {`${art.native}   ${art.latin}`}
        </Text>
      </View>

      {/* ── 출발 공항 ────────────────────────────────────────────────────── */}
      <View style={{ position: 'absolute', left: contentLeft, top: height * 0.045 }}>
        <Text
          style={{
            fontSize: width * 0.082,
            lineHeight: width * 0.094,
            fontWeight: '800',
            letterSpacing: 0.5,
            color: INK,
          }}
        >
          {ORIGIN_CODE}
        </Text>
        <Text style={{ fontSize: width * 0.038, fontWeight: '700', letterSpacing: 1, color: accent }}>
          DEPARTURE
        </Text>
      </View>

      {/* ── 도착 공항 · 추천 기간 ────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: boxLeft + pad * 0.5,
          top: boxTop + boxRow * 0.06,
          width: boxWidth - pad * 0.5,
        }}
      >
        <Text style={{ fontSize: labelFont, fontWeight: '700', letterSpacing: 0.6, color: LABEL }}>
          ARRIVAL
        </Text>
        <View className="flex-row items-center">
          <Text
            style={{ fontSize: valueFont, fontWeight: '700', color: INK, ...NUM }}
            numberOfLines={1}
          >
            {destination.airportCode}
          </Text>
          <Ionicons
            name="airplane"
            size={valueFont * 0.9}
            color={INK}
            style={{ marginLeft: 3, opacity: 0.7 }}
          />
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          left: boxLeft + pad * 0.5,
          top: boxTop + boxRow * 1.06,
          width: boxWidth - pad * 0.5,
        }}
      >
        {/* 여행에는 실제 기간이 들어가지만 여기는 사람이 정한 추천 기간이다.
            (lib/constants/destinationEditorial) */}
        <Text style={{ fontSize: labelFont, fontWeight: '700', letterSpacing: 0.6, color: LABEL }}>
          STAY
        </Text>
        <Text style={{ fontSize: valueFont, fontWeight: '700', color: INK }} numberOfLines={1}>
          {destination.nights}
        </Text>
      </View>

      {/* ── 소인 안쪽 ────────────────────────────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: stampX - stampR,
          top: stampY - stampR,
          width: stampR * 2,
          height: stampR * 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* ⚠️ 지난 여행 태그는 국가 코드 아래에 여행 연도를 찍는다. 여기는 연도가
            없다. 오늘 연도를 찍으면 이 여행지를 올해 다녀왔다는 뜻이 되어 버린다. */}
        {destination.theme.code === '--' ? null : (
          <Text style={{ fontSize: width * 0.07, fontWeight: '800', color: accent, opacity: 0.85 }}>
            {destination.theme.code}
          </Text>
        )}
      </View>

      {/* ── 도착 도시 ────────────────────────────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: contentLeft,
          top: height * 0.36,
          width: (width - contentLeft - pad) * 0.78,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: cityFont,
            lineHeight: cityFont * 1.04,
            fontWeight: '700',
            letterSpacing: -0.6,
            color: INK,
          }}
        >
          {destination.nameEn}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: width * 0.062, fontWeight: '700', color: accent, marginTop: 2 }}
        >
          {destination.nameKo}
        </Text>
      </View>

      {/* ── 커뮤니티 글 수 ──────────────────────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: pad * 0.9,
          top: postsTop + height * 0.012,
          width: postsRight - pad * 1.6,
        }}
      >
        <Text style={{ fontSize: labelFont, fontWeight: '700', letterSpacing: 0.6, color: LABEL }}>
          POSTS
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: width * 0.048, fontWeight: '700', color: INK, ...NUM }}
        >
          {`${destination.postCount}개`}
        </Text>
      </View>

      {/* ── 눌렀을 때 가는 곳 ───────────────────────────────────────────── */}
      {/* 지난 여행 태그의 '결산하기 →' 자리다. 카드 전체가 누름 영역이라
          이 글자는 따로 누를 수 없다. 어디로 가는지 알리는 표시다. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: pad * 0.9,
          top: footTop,
          width: contentRight - barcodeWidth - pad * 1.4,
          height: barcodeHeight,
          justifyContent: 'center',
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: width * 0.058, fontWeight: '800', color: accent }}>
          여행기 보기 →
        </Text>
      </View>
    </Pressable>
  );
}
