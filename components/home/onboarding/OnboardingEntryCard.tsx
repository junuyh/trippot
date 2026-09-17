// ============================================================================
// 신규 사용자 홈 — 온보딩 들어가기 카드 (2026-09-17)
//
//   ┌──────────────────────────────────────────┐
//   │ TRIPPOT · FIRST TRIP GUIDE     ╭────╮     │
//   │                           ╭───╮│ 엽서│     │ ← 기울어진 엽서 두 장
//   │ 떠나기 전에,               │엽서│╰────╯     │   + 스탬프 · 소인선
//   │ TripPot 먼저               ╰(TRIPPOT)      │
//   │ 여행해 볼래요?                              │
//   │ 계획부터 다음 여행까지, 1분이면 알 수 있어요 │
//   ◖┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄◗ ← 티켓 절취선
//   │ ✈ PLAN ─ FUND ─ RECORD ─ NEXT  [둘러보기 →] │ ← 온보딩 네 장의 항로
//   └──────────────────────────────────────────┘
//
// 왜 이렇게 하나 — 온보딩 캐러셀을 홈에 바로 펼치면 첫 화면이 설명서가 된다.
// 설명은 궁금한 사람만 들어가서 보게 하고(/onboarding), 홈에는 **들어가 보고 싶게 만드는
// 카드 한 장**만 둔다. 들어가지 않은 사람도 문구와 항로만 보고 앱이 뭔지 알 수 있어야 한다.
//
// ⚠️ **TripPot 여행 문서 체계 안에서 그린다.** 엽서 · 스탬프 · 소인 · 절취선은
//    트래블 스토리 카드(travelStory)와 같은 소품이다. 사진 · 이모지를 쓰지 않는다.
// ⚠️ 특정 여행이 아니라 서비스 소개라 국가색이 아닌 **브랜드 보라**를 쓴다.
// ⚠️ 카드 전체가 누름 영역이다. '둘러보기' 알약은 표시다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { BRAND } from '@/lib/constants/brandColor';

import { PostalLines, tint, TravelStamp } from '../travelStory/TravelStoryCard';
import type { TravelStoryArtProps } from '../travelStory/travelStoryArt';
import { ParisArt, TokyoArt } from '../travelStory/travelStoryArtCities';

type Props = {
  onPress: () => void;
};

const NAVY = '#0E1726';
const MUTED = '#5B6472';
/** 홈 바탕. 절취선 양 끝의 반원 홈을 이 색으로 파낸다. */
const PAGE_BG = '#FFFFFF';

/** 홈 좌우 여백(px-4) 합. */
const SCREEN_PADDING = 32;
/** 절취선 위 칸 높이. */
const TOP_HEIGHT = 184;
/** 절취선 아래 칸 높이. */
const BOTTOM_HEIGHT = 76;
const PAD = 20;
const NOTCH = 20;

/** 온보딩 네 장과 같은 순서다. OnboardingView 의 SLIDES 를 바꾸면 같이 본다. */
const STOPS = ['PLAN', 'FUND', 'RECORD', 'NEXT'] as const;

export function OnboardingEntryCard({ onPress }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(0, windowWidth - SCREEN_PADDING);
  const accent = BRAND.primary;
  const line = tint(accent, 0.14);

  // 엽서 자리. 모든 치수는 카드 폭에서 나온다.
  const backWidth = Math.round(width * 0.25);
  const frontWidth = Math.round(width * 0.27);
  const frontRight = 18;
  const frontTop = 36;
  const frontHeight = Math.round(frontWidth * 1.3);
  const stampSize = Math.round(width * 0.18);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="떠나기 전에, TripPot 먼저 여행해 볼래요? 둘러보기"
      onPress={onPress}
      className="active:opacity-90"
      style={{
        width,
        height: TOP_HEIGHT + BOTTOM_HEIGHT,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: line,
        backgroundColor: BRAND.primarySoft,
        overflow: 'hidden',
      }}
    >
      {/* ── 오른쪽: 엽서 두 장 · 스탬프 · 소인선 ─────────────────────────── */}
      <MiniPostcard
        label="TOKYO"
        Art={TokyoArt}
        width={backWidth}
        height={Math.round(backWidth * 1.3)}
        rotate="-9deg"
        style={{ right: frontRight + frontWidth * 0.62, top: 24 }}
      />
      <MiniPostcard
        label="PARIS"
        Art={ParisArt}
        width={frontWidth}
        height={frontHeight}
        rotate="7deg"
        style={{ right: frontRight, top: frontTop }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: frontRight + frontWidth - stampSize * 0.4,
          top: frontTop + frontHeight - stampSize * 0.72,
        }}
      >
        <TravelStamp size={stampSize} color={accent} city="TRIPPOT" code="--" />
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: 8, top: frontTop + frontHeight - 6 }}
      >
        <PostalLines width={Math.round(width * 0.12)} height={16} color={tint(accent, 0.35)} />
      </View>

      {/* ── 왼쪽: 제안 문구 ─────────────────────────────────────────────── */}
      <View style={{ position: 'absolute', left: PAD, top: PAD, width: Math.round(width * 0.5) }}>
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: accent }}>
          TRIPPOT · FIRST TRIP GUIDE
        </Text>
        <Text
          style={{
            marginTop: 14,
            fontSize: 21,
            lineHeight: 28,
            fontWeight: '800',
            letterSpacing: -0.7,
            color: NAVY,
          }}
        >
          {'떠나기 전에,\nTripPot 먼저\n여행해 볼래요?'}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 17, color: MUTED }}>
          {'계획부터 다음 여행까지,\n1분이면 알 수 있어요'}
        </Text>
      </View>

      {/* ── 티켓 절취선 · 양 끝 반원 홈 ─────────────────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: NOTCH / 2 + 6,
          right: NOTCH / 2 + 6,
          top: TOP_HEIGHT,
          borderTopWidth: 1.2,
          borderStyle: 'dashed',
          borderColor: tint(accent, 0.3),
        }}
      />
      <Notch side="left" color={line} />
      <Notch side="right" color={line} />

      {/* ── 아래: 온보딩 네 장의 항로 · 둘러보기 ─────────────────────────── */}
      <View
        pointerEvents="none"
        className="flex-row items-center"
        style={{ position: 'absolute', left: PAD, right: PAD, top: TOP_HEIGHT, height: BOTTOM_HEIGHT }}
      >
        <Ionicons
          name="airplane"
          size={15}
          color={accent}
          style={{ marginRight: 6, transform: [{ rotate: '-45deg' }] }}
        />
        <View style={{ flex: 1, marginRight: 14 }}>
          {/* 정류장을 잇는 점선. 첫 점과 마지막 점 사이에만 긋는다 */}
          <View
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: 3.5,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: tint(accent, 0.45),
            }}
          />
          <View className="flex-row justify-between">
            {STOPS.map((stop, index) => (
              <View key={stop} style={{ alignItems: index === 0 ? 'flex-start' : index === STOPS.length - 1 ? 'flex-end' : 'center' }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: accent,
                    backgroundColor: index === 0 ? accent : BRAND.primarySoft,
                  }}
                />
                <Text style={{ marginTop: 5, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8, color: MUTED }}>
                  {stop}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          className="flex-row items-center justify-center"
          style={{ height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: accent }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>둘러보기</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </View>
      </View>
    </Pressable>
  );
}

/** 절취선 양 끝을 파낸 반원 홈. 홈 바탕색 동그라미를 카드 가장자리에 걸친다. */
function Notch({ side, color }: { side: 'left' | 'right'; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        [side]: -NOTCH / 2,
        top: TOP_HEIGHT - NOTCH / 2,
        width: NOTCH,
        height: NOTCH,
        borderRadius: NOTCH / 2,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: PAGE_BG,
      }}
    />
  );
}

/** 작은 세로 엽서. 위 라벨 한 줄 + 도시 일러스트. */
function MiniPostcard({
  label,
  Art,
  width,
  height,
  rotate,
  style,
}: {
  label: string;
  Art: (props: TravelStoryArtProps) => ReactElement;
  width: number;
  height: number;
  rotate: string;
  style: { right: number; top: number };
}) {
  const inner = 6;
  const band = 14;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...style,
        width,
        height,
        padding: inner,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#EEF1F5',
        backgroundColor: '#FFFFFF',
        transform: [{ rotate }],
        shadowColor: '#1b2540',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <View style={{ height: band, alignItems: 'flex-end', justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ fontSize: 7, fontWeight: '700', letterSpacing: 1.2, color: '#9AA3AF' }}>
          {label}
        </Text>
      </View>
      <View style={{ flex: 1, borderRadius: 3, overflow: 'hidden' }}>
        <Art width={width - inner * 2} height={height - inner * 2 - band} accent={BRAND.primary} countryKo={null} />
      </View>
    </View>
  );
}
