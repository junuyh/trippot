// ============================================================================
// 여행자들은 이렇게 다녀왔어요 카드 — 신규 사용자 홈
// (2026-09-16 개편: 러기지 태그 → 엽서)
//
//   ┌──────────────────────────────┐
//   │ POST CARD        ╭╌╌╌╌╌╮     │  ← 우표 (톱니 테두리 · 나라 그림)
//   │ ─────────        ╎ 🗼  ╎     │
//   │        ((TOKYO)) ╰╌╌╌╌╌╯     │  ← 둥근 소인
//   │ 도쿄                          │
//   │ TOKYO                 ─────   │  ← 주소 줄 (아무 값도 없는 무늬)
//   │ 3박 4일 추천           ─────   │
//   │ 여행기 12개          보기 →    │
//   └──────────────────────────────┘
//
// ⚠️ **왜 바꿨나 (2026-09-16 사용자 평)**
//    이 카드가 지난 여행 카드(LuggageTagCard)와 **같은 러기지 태그**였다.
//    크림색 종이 · 국가 띠 · 구멍 · 소인 물결 · 항공우편 사선 · 바코드까지
//    같은 값을 썼기 때문에, 내 여행 기록과 남의 이야기가 구별되지 않았다.
//
// ⚠️ **디자인 언어를 이렇게 나눈다.** (DestinationSuggestCard 머리말과 같은 표)
//
//      내 여행 (여행 서류)              추천 · 남의 이야기 (인쇄물)
//      ──────────────────────────      ────────────────────────────
//      보딩패스   준비 중인 여행         포스터   추천 여행지
//      러기지 태그 지난 여행             엽서     이 파일
//      크림 종이 · 구멍 · 바코드         흰 종이 · 우표 · 소인 · 주소 줄
//
//    구멍 · 항공우편 사선 · 바코드 · 공항 코드는 **내 여행 카드에만** 쓴다.
//
// ⚠️ 왜 엽서인가.
//    이 칸은 "다른 사람이 다녀와서 남긴 이야기" 다. 엽서는 다녀온 사람이 보내는
//    소식이라 뜻이 맞는다. 위 '추천 여행지'(포스터)는 가보라고 권하는 인쇄물,
//    여기(엽서)는 다녀온 사람이 보낸 소식 — 생김새가 그 차이를 말한다.
//
// ⚠️ 나라 그림은 **우표 안에** 들어간다. 랜드마크 펜 드로잉 한 벌을 그대로 쓴다.
//    (components/home/landmarkScene — 추천 여행지 포스터와 같은 그림)
//    ⚠️ 지난 여행 태그가 쓰는 실루엣(tagArt)과는 다른 그림이다. 일부러 다르게 뒀다.
//
// ⚠️ 주소 줄 세 개는 **아무 값도 담지 않는 무늬**다. 가짜 주소나 가짜 문장을 적지
//    않는다. (바코드에 숫자를 붙이지 않는 것과 같은 규칙)
//
// ⚠️ **누르면 커뮤니티의 그 여행지 글로 간다.** 여행 만들기가 아니다.
// ⚠️ '여행기 N개' 는 실제 글 수다. 화면 파일이 커뮤니티 조회 결과로 넘긴다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { LandmarkArt } from './landmarkScene';
import type { DiscoverDestination } from './types';

type Props = {
  destination: DiscoverDestination;
  width: number;
  onPress: (nameKo: string) => void;
};

/** 엽서 가로세로비. 러기지 태그(세로로 긴 0.72)와 달리 가로로 눕는다. */
const RATIO = 1.2;
const PAPER = '#FFFFFF';
const PAPER_EDGE = '#e4e7ec';
const INK = '#1f2937';
const LABEL = '#9aa3af';
const BODY = '#5b6472';
/** 주소 줄. 종이에 인쇄된 아주 옅은 선이다. */
const RULE = '#e9ecf1';

/** 국가색을 흰색에 섞어 불투명한 파스텔을 만든다. (추천 여행지 포스터와 같은 함수) */
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

export function DiscoverDestinationCard({ destination, width, onPress }: Props) {
  const height = Math.round(width / RATIO);
  const accent = destination.theme.primary;

  // 카드 폭에서 모든 치수가 나온다. 폭만 바꾸면 그림과 글자가 같은 비율로 움직인다.
  const pad = Math.round(width * 0.062);
  const stampWidth = Math.round(width * 0.26);
  const stampHeight = Math.round(stampWidth * 1.1);
  const postmark = Math.round(width * 0.19);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination.nameKo} 여행기 ${destination.postCount}개 보기`}
      onPress={() => onPress(destination.nameKo)}
      className="active:opacity-90"
      style={{
        width,
        height,
        backgroundColor: PAPER,
        // 엽서는 모서리가 거의 각졌다. 태그(둥근 모서리)와 여기서 갈린다.
        borderRadius: 6,
        borderWidth: 1,
        borderColor: PAPER_EDGE,
        padding: pad,
        shadowColor: '#1b2540',
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      {/* ── 우표 ─────────────────────────────────────────────────────── */}
      {/* 톱니 테두리는 점선으로 흉내 낸다. 톱니를 그리면 작은 카드에서 뭉갠다 */}
      <View
        style={{
          position: 'absolute',
          right: pad,
          top: pad,
          width: stampWidth,
          height: stampHeight,
          borderRadius: 3,
          borderWidth: 1.2,
          borderStyle: 'dashed',
          borderColor: pastel(accent, 0.45),
          backgroundColor: pastel(accent, 0.08),
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 2,
        }}
      >
        <LandmarkArt
          countryKo={destination.countryKo}
          fill={pastel(accent, 0.08)}
          line={pastel(accent, 0.62)}
          width={stampWidth - 8}
          height={stampHeight - 14}
          style={{ position: 'absolute', top: 2 }}
        />
        {destination.theme.code === '--' ? null : (
          <Text style={{ fontSize: 7.5, fontWeight: '800', letterSpacing: 0.8, color: accent }}>
            {destination.theme.code}
          </Text>
        )}
      </View>

      {/* ── 소인 ─────────────────────────────────────────────────────── */}
      {/* 우표 왼쪽에 비스듬히 찍힌다. 도시 영문만 들어간다 — 날짜는 모르는 값이다 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: pad + stampWidth - Math.round(postmark * 0.4),
          top: pad + Math.round(stampHeight * 0.36),
          width: postmark,
          height: postmark,
          borderRadius: postmark / 2,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: pastel(accent, 0.55),
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-12deg' }],
          backgroundColor: 'rgba(255,255,255,0.86)',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            paddingHorizontal: 2,
            fontSize: Math.max(5.5, postmark * 0.17),
            fontWeight: '800',
            color: pastel(accent, 0.85),
          }}
        >
          {destination.nameEn}
        </Text>
      </View>

      {/* ── 왼쪽 위: 엽서 표기 ───────────────────────────────────────── */}
      <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 2, color: LABEL }}>
        POST CARD
      </Text>
      <View style={{ marginTop: 4, width: width * 0.22, height: 1, backgroundColor: RULE }} />

      {/* ── 가운데: 도시 ─────────────────────────────────────────────── */}
      <View style={{ marginTop: 'auto' }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: width * 0.115, fontWeight: '900', letterSpacing: -0.6, color: INK }}
        >
          {destination.nameKo}
        </Text>
        <Text
          numberOfLines={1}
          style={{ marginTop: 1, fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: LABEL }}
        >
          {destination.nameEn}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 10, color: BODY }}>
          {destination.nights} 추천
        </Text>
      </View>

      {/* ── 아래: 글 수와 링크 ───────────────────────────────────────── */}
      <View className="flex-row items-end justify-between" style={{ marginTop: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '700', color: BODY }}>
          여행기 {destination.postCount}개
        </Text>

        {/* ⚠️ 따로 누를 수 없다. 카드 전체가 누름 영역이고 이건 표시다. */}
        <View pointerEvents="none" className="flex-row items-center">
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: accent }}>보기</Text>
          <Ionicons name="arrow-forward" size={10} color={accent} style={{ marginLeft: 2 }} />
        </View>
      </View>

      {/* ── 주소 줄 ──────────────────────────────────────────────────── */}
      {/* 엽서 오른쪽 아래의 주소 칸. 아무 값도 담지 않는 무늬다 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: pad,
          bottom: pad + Math.round(height * 0.16),
          width: width * 0.3,
        }}
      >
        {[1, 0.82, 0.64].map((scale) => (
          <View
            key={scale}
            style={{ height: 1, marginBottom: 4, width: `${scale * 100}%`, backgroundColor: RULE }}
          />
        ))}
      </View>
    </Pressable>
  );
}
