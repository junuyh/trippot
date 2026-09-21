// ============================================================================
// 지난 여행 카드 — 빈티지 러기지 태그 (2026-09-04)
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
//   │ DATE  │             │
//   │ 08.28 – 08.31       │
//   │ 결산하기 →    ||||||| │      ← 결산 유도 · 바코드
//   ╰─────────────────────╯
//
// 다녀온 여행은 **끝난 기록**이다. 캐리어에 남은 수하물 태그처럼 붙어 있다.
// 준비 중인 여행(흰 배너)이 아직 손에 든 물건이라면, 이건 떼어 낸 물건이다.
//
// ⚠️ 이전 시안(빈티지 우표)에서 넘어왔다. 우표는 톱니 말고는 나라를 알 수 없어
//    카드 넉 장이 색만 다른 같은 그림이었다. 태그는 왼쪽 띠(국가명)·소인·풍경까지
//    나라마다 달라서 도시 이름을 읽기 전에 어느 여행인지 알아본다.
//
// ⚠️ 태그 종이는 **크림색**이다. 페이지가 흰색이라 종이도 흰색이면 태그가
//    페이지에서 떨어지지 않는다. 구멍(⊚)도 종이색이 달라야 뚫린 것으로 읽힌다.
//
// ⚠️ 참고 디자인의 'FLIGHT NO. NH696' 과 'GATE 23A' 자리에는 **실제로 아는 값**을
//    넣었다. 우리는 항공편도 게이트도 모른다.
//      FLIGHT NO. → 도착 공항 (NRT)
//      GATE       → 여행 기간 (3박 4일)
//      소인        → 국가 코드와 연도
//    모르는 값을 그럴듯하게 지어내지 않는다.
//    (components/trip-home/TravelTicketCard 와 같은 규칙)
//
// ⚠️ 바코드는 아무 값도 담지 않는 무늬다. 숫자를 붙이지 않는다.
//    붙이는 순간 지어낸 값이 된다.
//
// ⚠️ 카드를 기울이지 않는다. 기울이면 장식으로 읽혀서 누르지 않는다는 평을
//    이미 받았다. 오른쪽 아래 바코드 옆이 아니라 카드 전체가 누름 영역이다.
//
// ⚠️ 결산 전(ENDED) 여행은 최종 여행비가 없다. 그 자리에 '결산하기 →' 를 둬서
//    결산을 유도한다. 여행 기간이 끝나면 결산을 유도하는 것은 정책이다.
//    (CLAUDE.md 3장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { TRIP_STATUS } from '@/lib/constants/status';

import { formatNights, formatTripDates } from './format';
import { TagScene, tagArt } from './tagArt';
import type { EndedTripCardData } from './types';

type Props = {
  trip: EndedTripCardData;
  width: number;
  onPress: (tripId: string) => void;
  onPressSettle: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 태그 가로세로비(가로 ÷ 세로). 실제 수하물 태그와 비슷한 세로 비율이다. */
const RATIO = 0.72;

/** 태그 종이. 페이지(흰색)와 달라야 종이로 읽힌다. */
const PAPER = '#f7f3e8';
/** 종이 가장자리 선. 종이보다 한 톤 진한 정도로만 둔다. */
const PAPER_EDGE = '#e6dfcc';
/** 인쇄 잉크. 참고 디자인의 짙은 차콜 자리다. */
const INK = '#2f3b33';
/** 라벨·보조 글자. */
const LABEL = '#8f8b7c';
/**
 * 홈 바탕색. 태그 구멍을 이 색으로 뚫는다.
 *
 * ⚠️ HomeView 의 바탕과 **반드시 같아야 한다.** 다르면 구멍이 다른 색 점이 된다.
 */
const PAGE_BG = '#FFFFFF';
/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. */
const ORIGIN_CODE = 'ICN';

/** HONG KONG 처럼 긴 이름이 한 줄을 넘지 않게 길이로 줄인다. */
function cityRatio(name: string): number {
  if (name.length <= 5) return 0.155;
  if (name.length <= 7) return 0.118;
  if (name.length <= 9) return 0.095;
  return 0.078;
}

/**
 * 바코드 막대.
 *
 * ⚠️ 여행마다 무늬가 달라야 같은 카드가 복사된 것처럼 보이지 않는다.
 *    tripId 로 만들어서 다시 그려도 같은 무늬가 나온다. 값을 담지는 않는다.
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

export function LuggageTagCard({ trip, width, onPress, onPressSettle }: Props) {
  const height = Math.round(width / RATIO);
  const art = tagArt(trip.countryKo);
  const accent = trip.theme.primary;

  const destination = trip.destination ?? '여행지 미정';
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const year = (trip.endDate ?? trip.startDate)?.slice(0, 4) ?? null;

  // ENDED 는 아직 결산 전이라 최종 여행비가 확정되지 않았다.
  const beforeSettlement = trip.status === TRIP_STATUS.ENDED && trip.finalAmount === null;

  // ── 태그 위의 자리들 ─────────────────────────────────────────────────────
  // 글자와 그림이 같은 좌표를 보고 그려야 어긋나지 않는다.
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

  const dateTop = height * 0.78;
  const dateBottom = height * 0.885;
  const dateRight = width * 0.44;

  const edgeTop = height * 0.79;
  const edgeBottom = height * 0.845;
  const edgeLeft = width * 0.47;

  const footTop = height * 0.9;
  const barcodeWidth = width * 0.26;
  const barcodeHeight = height * 0.055;

  const cityFont = width * cityRatio(trip.destinationEn);
  const labelFont = width * 0.032;
  const valueFont = width * 0.048;

  const bars = barcodeBars(trip.tripId, barcodeWidth);

  // ⚠️ clipPath id 는 카드마다 달라야 한다. 한 화면에 태그가 여러 장 있는데
  //    id 가 같으면 웹(react-native-web)에서 모두 첫 카드의 자르기 영역을 쓴다.
  const edgeClipId = `tag-edge-${trip.tripId}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 지난 여행 보기`}
      onPress={() => onPress(trip.tripId)}
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

        {/*
          종이.

          ⚠️ 처음에는 위 두 모서리를 비스듬히 잘라 수하물 태그 모양을 냈다.
             잘라 낸 자리로 페이지의 흰색이 드러나 카드 위쪽에 흰 삼각형 두 개가
             남았고, 종이가 접힌 게 아니라 카드가 덜 그려진 것처럼 보였다.
             네 모서리를 같은 값으로 둥글려 종이가 끊기지 않게 했다.
        */}
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

        {/* 왼쪽 국가색 띠 */}
        <Path
          // 띠도 종이의 왼쪽 위 둥근 모서리를 그대로 따라간다.
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

        {/* 기간 칸 */}
        <Path
          d={`M 0 ${dateTop} H ${dateRight} V ${dateBottom} H 0`}
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
        countryKo={trip.countryKo}
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
        color={trip.theme.onPrimary}
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
            color: trip.theme.onPrimary,
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
        <Text
          style={{
            fontSize: width * 0.038,
            fontWeight: '700',
            letterSpacing: 1,
            color: accent,
          }}
        >
          DEPARTURE
        </Text>
      </View>

      {/* ── 도착 공항 · 여행 기간 ────────────────────────────────────────── */}
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
            {trip.airportCode}
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
        <Text style={{ fontSize: labelFont, fontWeight: '700', letterSpacing: 0.6, color: LABEL }}>
          STAY
        </Text>
        <Text style={{ fontSize: valueFont, fontWeight: '700', color: INK }} numberOfLines={1}>
          {nights ?? '—'}
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
        {trip.theme.code === '--' ? null : (
          <Text
            style={{ fontSize: width * 0.07, fontWeight: '800', color: accent, opacity: 0.85 }}
          >
            {trip.theme.code}
          </Text>
        )}
        {year ? (
          <Text
            style={{ fontSize: width * 0.034, fontWeight: '700', color: accent, opacity: 0.75, ...NUM }}
          >
            {year}
          </Text>
        ) : null}
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
            // ⚠️ 800 이면 글자가 카드에서 혼자 튀어나와 보였다. 크기는 그대로 두고
            //    굵기만 한 단계 낮춘다. 더 내리면 도시 이름이 제목으로 안 읽힌다.
            fontWeight: '700',
            letterSpacing: -0.6,
            color: INK,
          }}
        >
          {trip.destinationEn}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: width * 0.062, fontWeight: '700', color: accent, marginTop: 2 }}
        >
          {destination}
        </Text>
      </View>

      {/* ── 여행 기간 ────────────────────────────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: pad * 0.9,
          top: dateTop + height * 0.012,
          // 날짜 두 개가 칸 선을 넘지 않게 폭을 칸 안쪽으로 묶는다.
          width: dateRight - pad * 1.6,
        }}
      >
        <Text style={{ fontSize: labelFont, fontWeight: '700', letterSpacing: 0.6, color: LABEL }}>
          DATE
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: width * 0.048, fontWeight: '700', color: INK, ...NUM }}
        >
          {`${dates.start} – ${dates.end}`}
        </Text>
      </View>

      {/* ── 결산 유도 또는 최종 여행비 ───────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: pad * 0.9,
          top: footTop,
          width: contentRight - barcodeWidth - pad * 1.4,
          height: barcodeHeight,
          justifyContent: 'center',
        }}
      >
        {beforeSettlement ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${destination} 결산하기`}
            onPress={() => onPressSettle(trip.tripId)}
            hitSlop={8}
            className="active:opacity-60"
          >
            <Text style={{ fontSize: width * 0.058, fontWeight: '800', color: accent }}>
              결산하기 →
            </Text>
          </Pressable>
        ) : (
          <Text
            numberOfLines={1}
            style={{ fontSize: width * 0.058, fontWeight: '800', color: INK, ...NUM }}
          >
            {/* 금액이 없으면 빈칸. '—' 안 쓴다 (2026-09-21 2차) */}
            {trip.finalAmount === null ? '' : `${trip.finalAmount.toLocaleString('ko-KR')}원`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
