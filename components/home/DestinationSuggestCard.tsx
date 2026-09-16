// ============================================================================
// 추천 여행지 카드 — 신규 사용자 홈 (2026-09-16 개편: 보딩패스 → 여행 포스터)
//
//   ┌────────────────────────────────┐
//   │ ╭────────────────────────────╮ │  ← 포스터 이중 테두리
//   │ │ VISIT              [인기]  │ │
//   │ │ OSAKA                      │ │  ← 큰 영문. 포스터의 주인공
//   │ │ 오사카 · 일본               │ │
//   │ │        🏯 랜드마크 선그림    │ │
//   │ ╰────────────────────────────╯ │
//   ├────────────────────────────────┤  ← 인쇄물의 캡션 띠 (흰 종이)
//   │ 맛있는 음식과 활기찬 거리가       │
//   │ 추천 3~4일   오사카 둘러보기 →   │
//   └────────────────────────────────┘
//
// ⚠️ **왜 바꿨나 (2026-09-16 사용자 평)**
//    이 카드가 준비 중인 여행 배너(NextTripBanner)와 **같은 보딩패스**였다.
//    항로 점선 · 공항 코드 · 흰 바탕 · 도시 영문까지 같아서, 내 여행과 추천을
//    구별하기 어렵다는 평을 받았다. 같은 자리에서 뜻이 다른 두 카드가 같은
//    물건이면 안 된다.
//
// ⚠️ **디자인 언어를 이렇게 나눈다. 새 카드를 만들 때 이 규칙을 따른다.**
//
//      내 여행 (여행 서류)              추천 · 남의 이야기 (인쇄물)
//      ──────────────────────────      ────────────────────────────
//      보딩패스  준비 중인 여행          포스터    추천 여행지 (이 파일)
//      러기지 태그 지난 여행             엽서      여행자들은 이렇게 다녀왔어요
//      항로 점선 · 공항 코드 · 바코드     테두리 프레임 · 우표 · 소인
//      흰 종이                         국가색 면 · 크림 종이
//
//    항로 점선 · 공항 코드 · 비행기 · 바코드는 **내 여행 카드에만** 쓴다.
//    그것들이 "내가 타는 비행기" 라는 뜻을 갖고 있기 때문이다.
//
// ⚠️ 포스터라서 **색 면을 넓게 쓴다.** 국가색을 흰색에 섞은 옅은 톤이고
//    글자는 딥네이비 그대로다. 국기색 원색으로 면을 채우지 않는다.
//    (components/home/palette.ts · countryTheme 머리말)
//
// ⚠️ 그림은 나라별 랜드마크 펜 드로잉 한 벌을 그대로 쓴다. (landmarkScene)
//    사진을 쓰지 않는다. 이유는 2026-09-09 개편 기록과 같다 — 사진은
//    "가고 싶다" 를 만들지만 "여기가 어떤 곳인가" 는 글이 답한다.
//
// ⚠️ **금액을 쓰지 않는다.** 추천 기간과 나라를 쓴다. (types.ts DestinationSuggestion)
// ⚠️ 배지는 근거가 있을 때만 나온다. 화면 파일이 커뮤니티 글 수로 정한다.
// ⚠️ 누르면 여행지 상세(DEST-01)로 간다. 여행 만들기가 아니다.
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

const RADIUS = 18;
/** 포스터 바깥 여백. 이 여백이 있어야 안쪽 테두리가 액자처럼 보인다. */
const FRAME_PAD = 10;
const INK = '#111827';
const BODY = '#5b6472';
const LABEL = '#8b95a4';
const HAIRLINE = '#eff1f4';

/** 도시 이름 크기. 카드 폭에 대한 비율이다. 포스터라 전보다 크게 쓴다. */
function cityFontRatio(name: string): number {
  if (name.length <= 5) return 0.115;
  if (name.length <= 8) return 0.092;
  if (name.length <= 10) return 0.075;
  return 0.062;
}

/** 국가색을 흰색에 섞어 불투명한 파스텔을 만든다. (NextTripBanner 의 pastel 과 같다) */
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

export function DestinationSuggestCard({ suggestion, width, onPress }: Props) {
  const accent = suggestion.theme.primary;
  const poster = pastel(accent, 0.1);
  const frameLine = pastel(accent, 0.34);
  const cityFont = width * cityFontRatio(suggestion.nameEn);
  /** 포스터 면 높이. 그림이 들어갈 만큼만 잡는다. */
  const posterHeight = Math.round(width * 0.46);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.nameKo}, ${suggestion.countryKo}. 여행지 둘러보기`}
      onPress={() => onPress(suggestion.code)}
      className="overflow-hidden bg-white active:opacity-90"
      style={{
        width,
        borderRadius: RADIUS,
        // 그림자는 홈의 다른 카드와 같은 값이다. 물건이 달라도 같은 책상 위에 있다.
        shadowColor: '#1b2540',
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {/* ── 포스터 면 ─────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: poster, padding: FRAME_PAD }}>
        <View
          style={{
            height: posterHeight,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: frameLine,
            paddingHorizontal: 14,
            paddingTop: 12,
            overflow: 'hidden',
          }}
        >
          {/* 랜드마크는 액자 안쪽 아래에 깔린다. 글자 뒤로 지나가지 않게 오른쪽에 둔다 */}
          <LandmarkArt
            countryKo={suggestion.countryKo}
            fill={poster}
            line={pastel(accent, 0.5)}
            width={width * 0.52}
            height={posterHeight * 0.62}
            style={{ position: 'absolute', right: 8, bottom: 6 }}
          />

          <View className="flex-row items-start">
            <Text
              style={{ flex: 1, fontSize: 10.5, fontWeight: '800', letterSpacing: 3, color: LABEL }}
            >
              VISIT
            </Text>

            {/* 배지. 근거가 있을 때만 화면 파일이 넣는다 */}
            {suggestion.badge ? (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: frameLine,
                  paddingHorizontal: 8,
                  paddingVertical: 2.5,
                }}
              >
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: accent }}>
                  {suggestion.badge}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={1}
            style={{
              marginTop: 6,
              fontSize: cityFont,
              lineHeight: cityFont * 1.05,
              fontWeight: '900',
              letterSpacing: -1.2,
              color: INK,
            }}
          >
            {suggestion.nameEn}
          </Text>

          <Text style={{ marginTop: 3, fontSize: 12.5, fontWeight: '700', color: BODY }}>
            {suggestion.nameKo} · {suggestion.countryKo}
          </Text>
        </View>
      </View>

      {/* ── 캡션 띠 ───────────────────────────────────────────────────── */}
      {/* 포스터 아래 인쇄된 설명 줄이다. 흰 종이라 위 색 면과 층이 나뉜다 */}
      <View style={{ borderTopWidth: 1, borderTopColor: HAIRLINE, padding: 14, paddingTop: 11 }}>
        <Text style={{ fontSize: 12, lineHeight: 18, color: BODY }}>{suggestion.blurb}</Text>

        <View className="mt-2.5 flex-row items-center justify-between">
          <Text style={{ fontSize: 11, color: LABEL }} numberOfLines={1}>
            추천 여행 기간 {suggestion.days}
          </Text>

          {/* ⚠️ 따로 누를 수 없다. 카드 전체가 누름 영역이고 이건 표시다. */}
          <View pointerEvents="none" className="flex-row items-center">
            <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '800', color: accent }}>
              {suggestion.nameKo} 둘러보기
            </Text>
            <Ionicons name="arrow-forward" size={11} color={accent} style={{ marginLeft: 3 }} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
