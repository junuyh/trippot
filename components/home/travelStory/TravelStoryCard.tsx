// ============================================================================
// TravelStoryCard — '여행자들은 이렇게 다녀왔어요' 한 장 (2026-09-17 레퍼런스 반영)
//
//   ┌───────────────────────────────────────────────────┐
//   │ TRIPPOT · TRAVEL STORY      ((✈ NICE FR))╭──────╮ │
//   │                        ≋≋≋              │ ART  │ │ ← 기울어진 엽서 · 태그
//   │ 니스                                    │      │ │    + 스탬프 · 소인
//   │ NICE                                    ╰──────╯ │
//   │ 4박 5일 추천                                      │
//   │ ┄┄┄┄┄┄┄┄┄┄┄                                      │
//   │ ▤ 여행기 1개                          [ 보기 → ] │
//   └───────────────────────────────────────────────────┘
//
// 시각 우선순위: 도시명 → 일러스트 → 추천 기간 → 스탬프 → 여행기 수 → 보기 버튼
//
// ⚠️ **TripPot 여행 문서 체계의 일부다.** 보딩패스 · 여권 · 러기지 태그 · 영수증과 같은
//    말(스탬프 · 소인 · 엽서 · 수하물 태그 · 점선)을 쓴다. 새 디자인 시스템이 아니다.
//    한 카드에 여행 소품은 2~3개만 — 엽서/태그 · 스탬프 · 소인선.
//
// ⚠️ **사진 · 이모지 · 그라디언트 · 강한 그림자를 쓰지 않는다.** 그림은
//    travelStoryArt 의 플랫 일러스트다.
//
// ⚠️ 색은 카드마다 **그 나라 색 한 벌**이다. 바탕은 아주 옅게, 글자는 짙은 네이비.
//
// ⚠️ 누르면 커뮤니티의 그 여행지 글로 간다(화면 파일이 정한다). 카드 전체가 누름 영역이고
//    '보기' 알약은 표시다. 안에 또 누르는 곳을 두면 거기만 눌러야 하는 줄 안다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { CountryTheme } from '@/lib/constants/countryTheme';

import type { TravelStoryIllustration } from './travelStoryArt';

export type TravelStoryCardProps = {
  /** '니스' */
  cityName: string;
  /** 'NICE' */
  cityNameEn: string;
  /** '4박 5일 추천' */
  duration: string;
  /** 커뮤니티 여행기 수. 실제 글 수다. */
  storyCount: number;
  /** 'FR' — 스탬프 아래 국가 코드 */
  countryCode: string;
  /** 한글 국가명. 공통 일러스트가 랜드마크를 고를 때 쓴다. */
  countryKo: string | null;
  theme: CountryTheme;
  illustration: TravelStoryIllustration;
  width: number;
  height: number;
  onPress: () => void;
};

const NAVY = '#0E1726';
const TEXT = '#1B2433';
const SUBTLE = '#8C95A3';
const MUTED = '#5B6472';

/** 국가색을 흰색에 섞어 불투명한 톤을 만든다. (NextTripBanner 의 pastel 과 같은 식) */
export function tint(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const channel = (start: number) =>
    Math.round(255 + (parseInt(value.slice(start, start + 2), 16) - 255) * ratio);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(channel(0))}${to2(channel(2))}${to2(channel(4))}`;
}

/** 도시명 크기. 글자 수가 늘면 줄인다. 웹은 자동 축소를 지원하지 않아 길이로 정한다. */
function cityFontSize(name: string): number {
  if (name.length <= 2) return 38;
  if (name.length <= 3) return 34;
  return 28;
}

/** 우편 소인선 세 줄. */
export function PostalLines({ width, height, color }: { width: number; height: number; color: string }) {
  const step = width / 3;
  const amp = height * 0.14;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      {[0.22, 0.52, 0.82].map((t) => {
        let d = `M 0 ${height * t}`;
        for (let i = 0; i < 3; i += 1) d += ` q ${step / 2} ${i % 2 === 0 ? -amp : amp} ${step} 0`;
        return <Path key={t} d={d} stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />;
      })}
    </Svg>
  );
}

/** 원형 여행 스탬프. 비행기 · 도시 · 국가 코드. 살짝 기울여 찍힌 도장처럼 둔다. */
export function TravelStamp({
  size,
  color,
  city,
  code,
}: {
  size: number;
  color: string;
  city: string;
  code: string;
}) {
  const cityFont = Math.min(size * 0.17, (size * 0.62) / Math.max(city.length * 0.62, 1));
  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, transform: [{ rotate: '-10deg' }] }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1.2} stroke={color} strokeWidth={1.6} fill="rgba(255,255,255,0.72)" />
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 5.5} stroke={color} strokeWidth={0.7} strokeDasharray="2.2 1.8" fill="none" />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="airplane" size={size * 0.17} color={color} style={{ transform: [{ rotate: '-45deg' }] }} />
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: cityFont, fontWeight: '900', letterSpacing: 0.4, color }}>
          {city}
        </Text>
        {code === '--' ? null : (
          <Text style={{ marginTop: 1, fontSize: size * 0.11, fontWeight: '800', letterSpacing: 1, color }}>{code}</Text>
        )}
      </View>
    </View>
  );
}

export function TravelStoryCard({
  cityName,
  cityNameEn,
  duration,
  storyCount,
  countryCode,
  countryKo,
  theme,
  illustration,
  width,
  height,
  onPress,
}: TravelStoryCardProps) {
  const accent = theme.primary;
  const stampColor = illustration.stampColor ?? accent;
  const cardBg = tint(accent, 0.035);
  /**
   * 글자 · 여백 배율. 시안 기준 높이(280)에서 1 이다. (2026-09-17)
   * ⚠️ 카드를 줄였는데 글자 크기가 고정이면 아래 '여행기 · 보기' 줄이 위 절취선을 덮는다.
   *    그림 자리는 원래 카드 크기 비율이라 글자도 같은 비율로 줄인다.
   */
  const s = Math.min(1, height / 280);
  const pad = Math.round(20 * s);

  // 오른쪽 여행 문서 자리. 모든 치수는 카드 크기에서 나온다.
  const frameWidth = Math.round(width * 0.44);
  const frameHeight = Math.round(height * 0.68);
  const frameRight = Math.round(18 * s);
  const frameTop = Math.round(18 * s);
  const stampSize = Math.round(width * 0.24);
  const Art = illustration.Art;
  const cityFont = Math.round(cityFontSize(cityName) * s);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cityName} 여행기 ${storyCount}개 보기`}
      onPress={onPress}
      className="active:opacity-90"
      style={{
        width,
        height,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: tint(accent, 0.12),
        backgroundColor: cardBg,
        overflow: 'hidden',
        shadowColor: '#1b2540',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      {/* ── 오른쪽: 여행 문서(엽서 · 태그) ─────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: frameRight, top: frameTop, width: frameWidth, height: frameHeight }}
      >
        {illustration.frame === 'postcard' ? (
          <Postcard
            width={frameWidth}
            height={frameHeight}
            accent={accent}
            countryKo={countryKo}
            illustration={illustration}
            Art={Art}
          />
        ) : (
          <LuggageTag
            width={frameWidth}
            height={frameHeight}
            accent={accent}
            cardBg={cardBg}
            countryKo={countryKo}
            illustration={illustration}
            stampColor={stampColor}
            stampSize={Math.round(stampSize * 0.62)}
            countryCode={countryCode}
            Art={Art}
          />
        )}
      </View>

      {/* ── 엽서는 스탬프가 왼쪽 위로 걸치고, 소인선이 그 아래로 흐른다 ──────── */}
      {illustration.frame === 'postcard' ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: width - frameRight - frameWidth - stampSize * 0.38,
              top: frameTop + frameHeight * 0.1,
            }}
          >
            <TravelStamp size={stampSize} color={stampColor} city={cityNameEn} code={countryCode} />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: width - frameRight - frameWidth - stampSize * 0.38 - width * 0.1,
              top: frameTop + frameHeight * 0.1 + stampSize * 0.62,
            }}
          >
            <PostalLines width={Math.round(width * 0.14)} height={Math.round(stampSize * 0.36)} color={tint(stampColor, 0.65)} />
          </View>
        </>
      ) : null}

      {/* ── 왼쪽: 여행지 정보 ────────────────────────────────────────── */}
      <View style={{ position: 'absolute', left: pad, top: pad + 2, width: Math.round(width * 0.48) }}>
        <Text style={{ fontSize: 10 * Math.max(s, 0.9), fontWeight: '800', letterSpacing: 1.4, color: accent }}>
          TRIPPOT · TRAVEL STORY
        </Text>

        <Text
          numberOfLines={1}
          style={{
            marginTop: Math.round(22 * s),
            fontSize: cityFont,
            lineHeight: Math.round(cityFont * 1.18),
            fontWeight: '800',
            letterSpacing: -0.8,
            color: NAVY,
          }}
        >
          {cityName}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 15 * s, fontWeight: '700', letterSpacing: 2.6 * s, color: SUBTLE }}>
          {cityNameEn}
        </Text>

        <Text numberOfLines={1} style={{ marginTop: Math.round(14 * s), fontSize: 17 * s, fontWeight: '600', color: TEXT }}>
          {duration}
        </Text>

        {/* 티켓 절취선 */}
        <View
          style={{
            marginTop: Math.round(14 * s),
            width: Math.round(width * 0.4),
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: tint(accent, 0.3),
          }}
        />
      </View>

      {/* ── 아래: 여행기 수 · 보기 ───────────────────────────────────── */}
      <View
        pointerEvents="none"
        className="flex-row items-center"
        style={{ position: 'absolute', left: pad, bottom: pad + 2 }}
      >
        <Ionicons name="document-text-outline" size={Math.round(17 * s)} color={MUTED} />
        <Text style={{ marginLeft: 6, fontSize: 14.5 * s, fontWeight: '600', color: MUTED }}>
          여행기 {storyCount}개
        </Text>
      </View>

      <View
        pointerEvents="none"
        className="flex-row items-center justify-center"
        style={{
          position: 'absolute',
          right: frameRight,
          bottom: frameTop,
          width: Math.round(100 * s),
          height: Math.round(44 * s),
          borderRadius: 999,
          backgroundColor: tint(accent, 0.14),
        }}
      >
        <Text style={{ fontSize: 15 * s, fontWeight: '800', color: accent }}>보기</Text>
        <Ionicons name="arrow-forward" size={Math.round(15 * s)} color={accent} style={{ marginLeft: 4 }} />
      </View>
    </Pressable>
  );
}

// ── 엽서 ────────────────────────────────────────────────────────────────────
function Postcard({
  width,
  height,
  accent,
  countryKo,
  illustration,
  Art,
}: {
  width: number;
  height: number;
  accent: string;
  countryKo: string | null;
  illustration: TravelStoryIllustration;
  Art: TravelStoryIllustration['Art'];
}) {
  const inner = 9;
  const topBand = 18;
  const bottomBand = 30;
  const artWidth = width - inner * 2;
  const artHeight = height - inner * 2 - topBand - bottomBand;
  return (
    <View
      style={{
        width,
        height,
        padding: inner,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EEF1F5',
        transform: [{ rotate: '4deg' }],
        shadowColor: '#1b2540',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <View style={{ height: topBand, alignItems: 'flex-end', justifyContent: 'center' }}>
        {illustration.topLabel ? (
          <Text numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '700', letterSpacing: 1.3, color: tint(accent, 0.7) }}>
            {illustration.topLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ width: artWidth, height: artHeight, borderRadius: 3, overflow: 'hidden' }}>
        <Art width={artWidth} height={artHeight} accent={accent} countryKo={countryKo} />
      </View>

      <View style={{ height: bottomBand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          {(illustration.bottomLabel ?? []).map((line) => (
            <Text key={line} numberOfLines={1} style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1.3, color: '#9AA3AF' }}>
              {line}
            </Text>
          ))}
        </View>
        <PostalLines width={30} height={14} color="#DDE3EA" />
      </View>
    </View>
  );
}

// ── 수하물 태그 ─────────────────────────────────────────────────────────────
function LuggageTag({
  width,
  height,
  accent,
  cardBg,
  countryKo,
  illustration,
  stampColor,
  stampSize,
  countryCode,
  Art,
}: {
  width: number;
  height: number;
  accent: string;
  cardBg: string;
  countryKo: string | null;
  illustration: TravelStoryIllustration;
  stampColor: string;
  stampSize: number;
  countryCode: string;
  Art: TravelStoryIllustration['Art'];
}) {
  const tagWidth = Math.round(width * 0.88);
  const inner = 10;
  const artHeight = Math.round(height * 0.52);
  return (
    <View style={{ width, height }}>
      {/* 뒤쪽 카드 — 세로 글씨 */}
      <View
        style={{
          position: 'absolute',
          left: -6,
          top: height * 0.2,
          width: width * 0.36,
          height: height * 0.72,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: '#ECE6DA',
          backgroundColor: '#FBF8F2',
          transform: [{ rotate: '-5deg' }],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {illustration.sideLabel ? (
          <Text
            numberOfLines={1}
            style={{
              width: height * 0.6,
              textAlign: 'center',
              fontSize: 8,
              fontWeight: '700',
              letterSpacing: 2,
              color: '#A7A08F',
              transform: [{ rotate: '90deg' }],
            }}
          >
            {illustration.sideLabel}
          </Text>
        ) : null}
      </View>

      {/* 앞 태그 */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: tagWidth,
          height,
          padding: inner,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#EEF1F5',
          backgroundColor: '#FFFFFF',
          transform: [{ rotate: '4deg' }],
          shadowColor: '#1b2540',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        {/* 태그 구멍 */}
        <View
          style={{
            position: 'absolute',
            left: tagWidth * 0.18,
            top: -6,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: tint(accent, 0.3),
          }}
        />

        <View style={{ marginTop: 10 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '900', letterSpacing: 0.4, color: accent }}>
            {illustration.title}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 8, fontWeight: '700', letterSpacing: 2, color: '#9AA3AF' }}>
            {illustration.subtitle}
          </Text>
        </View>

        {/* 그림을 먼저 깔고, 키워드 · 스탬프를 그 위에 얹는다 */}
        <View
          style={{
            position: 'absolute',
            left: inner,
            right: inner,
            bottom: inner,
            height: artHeight,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <Art width={tagWidth - inner * 2} height={artHeight} accent={accent} countryKo={countryKo} />
        </View>

        {/* 키워드 — 여행 포스터의 작은 글씨 */}
        <View style={{ position: 'absolute', right: inner, top: inner + stampSize + 4, alignItems: 'flex-end' }}>
          {(illustration.keywords ?? []).map((word) => (
            <Text key={word} style={{ fontSize: 7, fontWeight: '800', letterSpacing: 1, color: '#7A8391', lineHeight: 10 }}>
              {word}
            </Text>
          ))}
        </View>

        {/* 스탬프 — 태그 안쪽 오른쪽 위 */}
        <View style={{ position: 'absolute', right: inner - 2, top: inner - 2 }}>
          <TravelStamp size={stampSize} color={stampColor} city={illustration.title ?? ''} code={countryCode} />
        </View>
      </View>
    </View>
  );
}
