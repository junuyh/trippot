// ============================================================================
// 여행지 카드 — 여행지 추천 격자 · 홈 '지금 떠나기 좋은 해외여행지' (2026-09-16)
//
//   ┌──────────────────────┐
//   │ ╭──────────────╮ JP │  ← 포스터 액자 · 국가 코드
//   │ │   🏯 선그림    │    │
//   │ ╰──────────────╯    │
//   ├──────────────────────┤  ← 캡션 띠 (흰 종이)
//   │ 오사카 🇯🇵            │
//   │ 도시 · 미식 · 쇼핑     │
//   └──────────────────────┘
//
// ⚠️ **사진을 쓰지 않는다.** 나라별 랜드마크 펜 드로잉(components/home/landmarkScene)과
//    국가색으로 그린다. 사진 카드는 이 서비스의 다른 화면과 다른 물건처럼 보인다.
//
// ⚠️ **작은 포스터다.** 신규 사용자 홈의 추천 여행지 카드(DestinationSuggestCard)와
//    같은 물건이고 크기만 작다 — 색 면 + 액자 테두리 + 아래 캡션 띠.
//
//    2026-09-16 티켓 모양(항로 점선 · 절취선 · 노치)에서 바꿨다. 그 요소들은
//    **내 여행 카드(보딩패스 · 러기지 태그)의 말**이라, 추천 카드가 그것을 쓰면
//    내 여행과 구별되지 않는다. 자세한 규칙은 DestinationSuggestCard 머리말 표에 있다.
//
// ⚠️ **색은 그 나라 색 하나다.** 카드마다 다른 파스텔을 돌려쓰지 않는다.
//    (components/home/palette.ts 머리말)
//
// ⚠️ 하트(찜)를 두지 않는다. 시안에는 있지만 찜을 저장할 곳이 없다.
//    누를 수 있는데 아무 일도 안 하는 버튼을 만들지 않는다. [검토 필요]
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Pressable, Text, View } from 'react-native';

import { LandmarkArt } from '@/components/home/landmarkScene';

import { pastel } from './pastel';
import type { ExploreCardData } from './types';

type Props = {
  item: ExploreCardData;
  width: number;
  /** 홈 가로 목록용. 소개 문장을 빼고 스타일 한 줄까지만 그린다. */
  compact?: boolean;
  onPress: (code: string) => void;
};

const INK = '#111827';
const BODY = '#596272';
const SUBTLE = '#858e9c';
const LINE = '#edf0f2';
const RADIUS = 14;
const PAD = 11;

export function ExploreDestinationCard({ item, width, compact = false, onPress }: Props) {
  const accent = item.theme.primary;
  const poster = pastel(accent, 0.09);
  const artHeight = Math.round(width * 0.56);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.nameKo}, ${item.countryKo}. 여행지 상세 보기`}
      onPress={() => onPress(item.code)}
      className="bg-white active:opacity-90"
      style={{
        width,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: LINE,
        overflow: 'hidden',
      }}
    >
      {/* ── 포스터 면 ─────────────────────────────────────────────────── */}
      <View style={{ height: artHeight, backgroundColor: poster, padding: 7 }}>
        {/* 액자 테두리. 이 한 줄이 '인쇄물' 이라는 신호다 */}
        <View
          style={{
            flex: 1,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: pastel(accent, 0.32),
            overflow: 'hidden',
          }}
        >
          <LandmarkArt
            countryKo={item.countryKo}
            fill={poster}
            line={pastel(accent, 0.6)}
            width={width - 22}
            height={artHeight - 26}
            style={{ position: 'absolute', left: 3, bottom: 2 }}
          />

          {item.theme.code === '--' ? null : (
            <Text
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 7,
                top: 6,
                fontSize: 9.5,
                fontWeight: '800',
                letterSpacing: 0.6,
                color: accent,
              }}
            >
              {item.theme.code}
            </Text>
          )}
        </View>
      </View>

      {/* ── 캡션 띠 ───────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: PAD,
          paddingTop: 9,
          paddingBottom: compact ? 10 : 12,
          borderTopWidth: 1,
          borderTopColor: LINE,
        }}
      >
        <View className="flex-row items-center">
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.4, color: INK }}
          >
            {item.nameKo}
          </Text>
          <Text style={{ marginLeft: 4, fontSize: 12 }}>{item.flag}</Text>
        </View>

        <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 11, color: SUBTLE }}>
          {item.styles.join(' · ')}
        </Text>

        {compact ? null : (
          <Text numberOfLines={2} style={{ marginTop: 6, fontSize: 12, lineHeight: 17, color: BODY }}>
            {/* 줄바꿈은 넓은 카드용이다. 좁은 격자에서는 이어서 흘린다. */}
            {item.blurb.replace(/\n/g, ' ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
