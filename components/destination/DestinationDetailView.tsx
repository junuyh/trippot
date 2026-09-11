// ============================================================================
// 여행지 상세 — 화면 본문 (2026-09-11)
//
//   ┌──────────────────────────────────────┐
//   │  ICN ┄┄┄ ✈ ┄┄┄ TPE              TW  │  ← 추천 여행지 카드와 같은 항로 줄
//   │  TAIPEI                              │
//   │  타이베이            🏙 랜드마크 선그림  │
//   │                                      │
//   │  야시장부터 감성적인 골목 카페까지,       │
//   │  먹거리와 도심 여행을 함께 즐기기 좋은 곳  │
//   │  ──────────────────────────────────  │
//   │  🗓 추천 여행 기간 3~4일 │ 📍 대만       │
//   └──────────────────────────────────────┘
//
//   여행자들의 여행기 12개
//   [글 카드] [글 카드] …
//
//   ────────────────────────────────────────
//   [ 타이베이로 여행 만들기 ]                 ← 화면 아래 고정
//
// ⚠️ **홈의 추천 여행지 카드(DestinationSuggestCard)를 펼친 화면이다.**
//    그 카드에서만 들어온다. 머리 부분의 항로 줄·도시 이름·소개·값 줄은 카드와
//    같은 것을 그린다. 누른 카드가 그대로 커진 것처럼 보여야 "내가 누른 그
//    여행지가 맞다" 를 알 수 있다.
//
// ⚠️ **새로 만든 값이 없다.** 소개·추천 기간은 destinationEditorial, 도시·나라·
//    공항 코드는 destinations 상수, 여행기는 커뮤니티 글이다. 화면을 채우려고
//    없는 값을 지어내지 않는다. (components/home/NextTripBanner 와 같은 규칙)
//
// ⚠️ 여행기 카드는 커뮤니티의 PostCard 를 그대로 쓴다. 같은 글이 커뮤니티에서와
//    다르게 생기면 두 화면이 다른 글을 보여주는 것처럼 보인다.
//
// ⚠️ 맨 아래 '여행 만들기' 는 **화면에 고정한다.** 여행기가 많아 한참 내려간
//    사람이 마음먹었을 때 버튼이 화면 밖에 있으면 안 된다. 홈의 떠 있는
//    버튼(CreateTripFab)과 같은 이유다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard, type PostCardData } from '@/components/community';
import { LandmarkArt } from '@/components/home/landmarkScene';
import { HOME_CARD_LINE, HOME_RADIUS } from '@/components/home/palette';
import type { CountryTheme } from '@/lib/constants/countryTheme';

/** 화면이 그리는 여행지 한 곳. 상수 조회는 화면 파일이 하고 결과만 받는다. */
export type DestinationDetailData = {
  code: string;
  nameKo: string;
  nameEn: string;
  countryKo: string;
  /** 지역 이름. '동아시아' 처럼 쓴다. */
  regionKo: string;
  airportCode: string;
  /** 사람이 쓴 두 줄 소개. (lib/constants/destinationEditorial) */
  blurb: string;
  /** 사람이 정한 추천 기간. '3~4일'. */
  days: string;
  theme: CountryTheme;
};

type Props = {
  destination: DestinationDetailData;
  /** 이 여행지의 커뮤니티 글. 없으면 빈 배열이고 안내 문구가 나온다. */
  posts: PostCardData[];
  onPressPost: (postId: string) => void;
  onPressCreateTrip: () => void;
};

/** 아래 값은 DestinationSuggestCard 와 같다. 카드가 펼쳐진 것으로 보여야 한다. */
const INSET = 16;
const ART_HEIGHT = 92;
const ART_LINE_TINT = 0.32;
const ART_FILL = '#FFFFFF';

const INK = '#111827';
const LABEL = '#9aa3af';
const BODY = '#6b7280';
const HAIRLINE = '#eff1f4';

/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. (홈 카드와 같다) */
const ORIGIN_CODE = 'ICN';

/**
 * 국가색을 흰 바탕에 섞어 파스텔을 만든다.
 * DestinationSuggestCard 의 것과 같은 함수다. countryTheme 은 여러 화면이 함께
 * 쓰는 파일이라 그쪽에 올리지 않았다. (CLAUDE.md 5장)
 */
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

export function DestinationDetailView({
  destination,
  posts,
  onPressPost,
  onPressCreateTrip,
}: Props) {
  const insets = useSafeAreaInsets();
  const accent = destination.theme.primary;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        // 아래 고정 버튼에 마지막 글이 가리지 않게 버튼 높이만큼 비운다.
        contentContainerStyle={{ paddingHorizontal: INSET, paddingBottom: 120, paddingTop: 8 }}
      >
        {/* ── 머리: 홈 카드와 같은 보딩패스 ──────────────────────────────── */}
        <View
          className="overflow-hidden bg-white"
          style={{
            borderRadius: HOME_RADIUS.ticket,
            borderWidth: 1,
            borderColor: HOME_CARD_LINE,
            padding: INSET,
          }}
        >
          {/* 랜드마크 선그림. 홈 카드와 같은 그림이다. */}
          <LandmarkArt
            countryKo={destination.countryKo}
            fill={ART_FILL}
            line={pastel(accent, ART_LINE_TINT)}
            width={160}
            height={ART_HEIGHT}
            style={{ position: 'absolute', right: 8, top: 6 }}
          />

          {/* 국가 코드. 모르는 나라의 코드는 '--' 라 그리지 않는다. */}
          {destination.theme.code === '--' ? null : (
            <Text
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: INSET,
                top: INSET,
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 0.6,
                color: INK,
              }}
            >
              {destination.theme.code}
            </Text>
          )}

          {/* 항로 */}
          <View className="flex-row items-center" style={{ width: '62%' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1, color: BODY }}>
              {ORIGIN_CODE}
            </Text>
            <View
              className="flex-1"
              style={{
                marginHorizontal: 6,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#d7dce3',
              }}
            />
            {/* 돌리지 않은 Ionicons 비행기는 오른쪽 위를 향한다. (홈 카드 주석) */}
            <Ionicons name="airplane" size={13} color={INK} />
            <View
              className="flex-1"
              style={{
                marginHorizontal: 6,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#d7dce3',
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1, color: BODY }}>
              {destination.airportCode}
            </Text>
          </View>

          {/* 도시 */}
          <Text
            numberOfLines={1}
            style={{
              marginTop: 6,
              fontSize: 30,
              lineHeight: 34,
              fontWeight: '700',
              letterSpacing: -0.8,
              color: INK,
            }}
          >
            {destination.nameEn}
          </Text>
          <Text style={{ marginTop: 1, fontSize: 14, fontWeight: '600', color: BODY }}>
            {destination.nameKo}
          </Text>

          {/* 소개. 줄바꿈은 문구 안에 들어 있다. (destinationEditorial) */}
          <Text style={{ marginTop: 14, fontSize: 13.5, lineHeight: 21, color: BODY }}>
            {destination.blurb}
          </Text>

          <View style={{ height: 1, backgroundColor: HAIRLINE, marginTop: 14, marginBottom: 11 }} />

          {/* 값 줄. 홈 카드와 같은 두 값이다. */}
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={13} color={LABEL} />
            <Text style={{ marginLeft: 5, fontSize: 12, color: BODY }}>
              추천 여행 기간 {destination.days}
            </Text>

            <View style={{ width: 1, height: 10, marginHorizontal: 10, backgroundColor: '#e5e7eb' }} />

            <Ionicons name="location-outline" size={12} color={LABEL} />
            <Text style={{ marginLeft: 5, fontSize: 12, color: BODY }}>
              {destination.countryKo} · {destination.regionKo}
            </Text>
          </View>
        </View>

        {/* ── 여행기 ─────────────────────────────────────────────────────── */}
        <View className="mb-2.5 mt-7 flex-row items-center justify-between">
          <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.4, color: INK }}>
            여행자들의 여행기
          </Text>
          {posts.length > 0 ? (
            <Text style={{ fontSize: 12, color: LABEL }}>{posts.length}개</Text>
          ) : null}
        </View>

        {posts.length === 0 ? (
          /* ⚠️ 글이 없다고 화면을 비우지 않는다. 이 여행지의 첫 글을 권한다. */
          <View
            className="border border-dashed bg-white px-4 py-5"
            style={{ borderColor: '#cdd2d8', borderRadius: HOME_RADIUS.card }}
          >
            <Text style={{ fontSize: 12.5, lineHeight: 19, color: BODY }}>
              아직 {destination.nameKo} 여행기가 없어요.{'\n'}
              다녀오시면 첫 여행기의 주인공이 될 수 있어요.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {posts.map((post) => (
              <PostCard key={post.postId} post={post} onPress={onPressPost} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── 아래 고정 버튼 ─────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: INSET,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12) + 4,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: HOME_CARD_LINE,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${destination.nameKo}로 여행 만들기`}
          onPress={onPressCreateTrip}
          className="items-center justify-center active:opacity-90"
          style={{ height: 52, borderRadius: 14, backgroundColor: accent }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '800',
              letterSpacing: -0.3,
              color: destination.theme.onPrimary,
            }}
          >
            {destination.nameKo}로 여행 만들기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
