// ============================================================================
// 신규 사용자 홈 — 여행지 추천 카드 가로 자동 슬라이드 (2026-09-07)
//
// 여행이 하나도 없는 사람의 홈에는 보여줄 여행이 없다. 그 자리에 "어디 가지?"
// 의 후보를 놓는다. 홈은 내 여행이 놓인 선반인데, 선반이 비어 있으면 무엇을
// 올릴 수 있는지부터 보여야 한다.
//
// ⚠️ **기존 홈의 부품과 값을 그대로 쓴다. 새로 만든 규칙이 없다.**
//    · 사진과 대체 화면   → DestinationBanner (진행 중인 여행 카드와 같은 것)
//    · 자동 슬라이드 규칙 → useAutoCarousel (준비 중인 여행 배너와 같은 것)
//    · 카드 폭·간격·점    → OngoingTripCarousel 과 같은 값
//    · 모서리·그림자      → NextTripBanner 와 같은 값 (18 / 0.1 / 22 / (0,8))
//    두 홈이 다른 물건처럼 보이면, 첫 여행을 만든 순간 화면이 낯설어진다.
//
// ⚠️ **카드다. 화면을 꽉 채우지 않는다.** (2026-09-07)
//
//      ┌──────────────────────┐  ← 좌우 여백 안, 모서리 18
//      │        사진           │
//      │ ┈┈ 아래로 갈수록 어둡게 │
//      │ 타이베이              │  ← 흰 글씨
//      │ 대만 ▭                │
//      └──────────────────────┘
//              ▬ · · · · ·
//
//    지나온 모양들
//    ① 사진 위 검은 글씨 + 밝은 안개 → 밝은 사진에서 대비가 모자랐다
//    ② 사진 아래 흰 정보 영역 → 읽기는 확실했지만 매물 목록처럼 보였다
//    ③ 화면을 꽉 채운 통짜 사진 → 사진은 시원했지만 **이 화면만 다른 앱 같았다.**
//       홈의 다른 카드도, 다른 화면도 전부 여백 안에 놓인 카드다.
//    ④ 지금 — 카드로 되돌리고 옆 카드의 치수를 그대로 가져왔다.
//
// ⚠️ **이 배너는 광고다. 그래서 사진 말고는 최소한만 얹는다.** (2026-09-07)
//    거쳐 간 것: '추천 여행지' 배지, 한 줄 소개, 특징 태그 셋, 국가 알약.
//    전부 뺐다. 글이 늘수록 사진이 가려지고, 가려진 사진은 "가고 싶다" 는
//    마음을 만들지 못한다. 남은 것은 **도시 이름과 나라** 뿐이다.
//    맥락은 섹션 제목과 아래 '새 여행 만들기' 카드가 준다.
//
// ⚠️ **DestinationBanner 의 막은 끄고(scrim={false}) 아래쪽에만 옅게 깐다.**
//    공용 막은 0.52 지점부터 0.6 까지 짙어져 사진 절반이 눌린다. 여기는 사진이
//    주인공이라 그만큼 어두워지면 안 된다. 공용 컴포넌트를 고치면 준비 중인
//    여행 카드까지 밝아지므로 여기서 따로 깐다.
//
//    글자 그림자도 함께 남겼다. 그늘이 옅어서 밝은 사진에서는 그림자가 마지막
//    보루가 된다. 지금 여덟 곳 중 세부(카와산 폭포)만 주간 사진이라 그 자리를
//    가장 먼저 본다. 읽기 힘들면 그 목적지의 사진을 바꾼다.
//    (lib/constants/destinationHeroPhoto.ts)
//
// ⚠️ 검색창·찜하기를 넣지 않았다. 시안에는 있지만 우리에게는 그 기능도 저장할
//    곳도 없다. 화면에만 두면 눌러도 아무 일이 없는 칸이 된다. [검토 필요]
//
// ⚠️ 금액을 쓰지 않는다. 목적지 상수에 항공료 기준값이 있지만 꺼내지 않는다.
//    이유는 types.ts 의 DestinationSuggestion 주석에 있다.
//
// ⚠️ 누르면 여행 만들기로 간다. **목적지는 따라가지 않는다.**
//    TRIP-01(/trips/new/owner)이 지금 destination param 을 받지 않는다.
//    받게 하려면 그 화면을 고쳐야 하는데 담당이 달라 손대지 않았다.
//    (CLAUDE.md 13장) TODO: TRIP-01 이 목적지를 받으면 code 를 함께 넘긴다.
// ============================================================================
import { useId } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CountryFlag } from './CountryFlag';
import { DestinationBanner } from './DestinationBanner';
import { SectionHeader } from './SectionHeader';
import type { DestinationSuggestion } from './types';
import { useAutoCarousel } from './useAutoCarousel';

type Props = {
  suggestions: DestinationSuggestion[];
  onPressSuggestion: () => void;
};

/** 아래 세 값은 OngoingTripCarousel 과 같다. 두 홈의 카드가 같은 자리에 선다. */
const CARD_GAP = 12;
const SCREEN_PADDING = 32;
/**
 * 그림자가 잘리지 않게 스크롤 영역을 좌우로 넓히는 폭.
 *
 * 가로 ScrollView 는 좌우 경계에서 내용을 잘라낸다. 바깥으로 이만큼 넓히고
 * 안쪽에서 같은 만큼 밀어 넣으면 카드 위치는 그대로면서 그림자 자리만 생긴다.
 * 두 값이 같아야 snapToInterval 이 어긋나지 않는다. (OngoingTripCarousel 주석)
 */
const SHADOW_PAD = 12;

/** 모서리·그림자는 준비 중인 여행 카드(NextTripBanner)와 같은 값이다. */
const CARD_RADIUS = 18;

/**
 * 카드 높이.
 *
 * ⚠️ 준비 중인 여행 카드보다 높다. 얹는 것이 다르기 때문이다.
 *    그 카드는 값 몇 개를 한 줄로 보여주지만, 여기는 사진 자체가 내용이다.
 *    낮게 잡으면 광고로서 눈에 걸리지 않는다.
 */
const CARD_HEIGHT = 300;

/** 글 덩어리와 카드 아래 끝 사이. 그늘 계산(SHADE_FULL)에 쓰인다. */
const CONTENT_PADDING_BOTTOM = 18;

/**
 * 아래쪽 그늘.
 *
 * 세 지점으로 정한다.
 *   SHADE_START  여기부터 어두워지기 시작한다. 위쪽은 사진 그대로다.
 *   SHADE_FULL   **글씨가 시작되는 높이.** 여기서 그늘이 다 찬다.
 *   그 아래       끝까지 같은 진하기로 간다.
 *
 * ⚠️ SHADE_FULL 은 글 덩어리의 윗면과 맞춘 값이다.
 *    CARD_HEIGHT(300) 에서 아래 여백 18 과 글 높이(제목 34 + 국가 줄 21 ≈ 55)를
 *    빼면 글이 시작되는 곳이 위에서 약 227px, 즉 0.76 다.
 *    조금 위인 0.72 에서 다 차게 해 제목 윗줄까지 덮는다.
 *    ⚠️ 글 크기나 CARD_HEIGHT 를 바꾸면 이 값도 같이 봐야 한다.
 *       어긋나면 제목 윗부분만 그늘 밖으로 나가 흐려진다.
 *
 * ⚠️ 소개·태그를 걷어내면서 덮는 자리가 줄었다. 시작도 늦추고 진하기도 낮췄다.
 *    광고 배너라 사진이 조금이라도 더 보이는 쪽이 낫다.
 */
const SHADE_START = 0.5;
const SHADE_FULL = 0.72;
const SHADE_OPACITY = 0.36;

/** 사진 위 글씨. 제목은 순백, 보조는 살짝 눌러 위계를 만든다. */
const ON_PHOTO = '#ffffff';
const ON_PHOTO_SUB = '#ffffffe6';

/**
 * 글자에만 붙는 옅은 그림자.
 *
 * ⚠️ 막(scrim)이 아니다. 사진 전체를 덮지 않고 글자 뒤에만 번진다.
 *    그늘이 옅어서 밝은 사진에서는 이것이 마지막 보루가 된다.
 */
const TEXT_SHADOW = {
  textShadowColor: '#00000066',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

export function DestinationSuggestSection({ suggestions, onPressSuggestion }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(0, width - SCREEN_PADDING);

  // 한 장씩 꽉 차므로 마지막 장이 그대로 끝이다. (준비 중인 여행과 같다)
  const { ref, page, handleScroll, handleTouch } = useAutoCarousel({
    count: suggestions.length,
    step: cardWidth + CARD_GAP,
  });

  // 추천할 목적지가 없으면 섹션 자체를 그리지 않는다.
  // 제목만 덩그러니 남으면 무언가 실패한 화면으로 보인다.
  if (suggestions.length === 0) return null;

  return (
    <View>
      <SectionHeader title="이런 여행지는 어때요?" />

      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleTouch}
        onScrollEndDrag={handleTouch}
        scrollEventThrottle={16}
        // 한 장씩 딱 멈추게 한다. 카드가 화면보다 좁아서 pagingEnabled 로는 안 맞는다.
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        style={{ marginHorizontal: -SHADOW_PAD }}
        contentContainerStyle={{
          gap: CARD_GAP,
          paddingTop: 6,
          paddingBottom: 14,
          paddingHorizontal: SHADOW_PAD,
        }}
      >
        {suggestions.map((item) => (
          <SuggestionCard
            key={item.code}
            item={item}
            width={cardWidth}
            onPress={onPressSuggestion}
          />
        ))}
      </ScrollView>

      {suggestions.length > 1 ? <Dots count={suggestions.length} page={page} /> : null}
    </View>
  );
}

function SuggestionCard({
  item,
  width,
  onPress,
}: {
  item: DestinationSuggestion;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      // 국기는 읽지 않는다. 바로 옆에 국가명이 글자로 있어 같은 말을 두 번 읽게 된다.
      accessibilityLabel={`${item.nameKo}, ${item.countryKo}. 새 여행 만들기`}
      onPress={onPress}
      style={{
        width,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        // 사진이 카드를 다 덮지만, 사진이 늦게 뜰 때 잠깐 보이는 바탕이다.
        backgroundColor: '#ffffff',
        // 준비 중인 여행 카드(NextTripBanner)와 같은 그림자다.
        shadowColor: '#1b2540',
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
      className="active:opacity-95"
    >
      <DestinationBanner
        photoUrl={item.photoUrl}
        countryKo={item.countryKo}
        theme={item.theme}
        height={CARD_HEIGHT}
        // 공용 막은 끄고 아래쪽에만 옅게 깐다. (파일 머리말 참조)
        scrim={false}
      >
        <View style={{ flex: 1 }}>
          <BottomShade />

          {/* 글은 아래에만 붙인다. 위쪽은 사진이 온전히 보이도록 비운다. */}
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              paddingHorizontal: 18,
              paddingBottom: CONTENT_PADDING_BOTTOM,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 28,
                fontWeight: '700',
                letterSpacing: -0.9,
                color: ON_PHOTO,
                ...TEXT_SHADOW,
              }}
            >
              {item.nameKo}
            </Text>

            <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{ fontSize: 13, fontWeight: '600', color: ON_PHOTO_SUB, ...TEXT_SHADOW }}
              >
                {item.countryKo}
              </Text>
              {/* 국기는 그림이다. 이모지를 쓰면 윈도우에서 'TW' 같은 글자로 보인다.
                  (components/home/CountryFlag.tsx) */}
              <CountryFlag code={item.theme.code} emoji={item.flag} height={12} />
            </View>
          </View>
        </View>
      </DestinationBanner>
    </Pressable>
  );
}

/**
 * 아래쪽에만 까는 옅은 그늘.
 *
 * 글이 놓인 높이에서 그늘이 다 차고, 그 위로는 서서히 옅어져 사진으로 이어진다.
 *
 * ⚠️ SVG 그라디언트 id 는 카드마다 달라야 한다.
 *    웹(react-native-web)에서는 SVG 가 진짜 DOM 이라 id 가 문서 전체에서
 *    공유된다. 여섯 장이 같은 id 를 쓰면 url(#...) 이 전부 첫 번째를 가리킨다.
 *    네이티브에서는 안 보이고 웹에서만 드러나는 종류의 버그다.
 *    (DestinationBanner 가 같은 이유로 useId 를 쓴다)
 */
function BottomShade() {
  // useId 는 ':r1:' 처럼 콜론이 들어간 값을 준다. url(#...) 에 그대로 못 쓴다.
  const id = `shade-${useId().replace(/:/g, '')}`;

  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', left: 0, top: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0} />
          <Stop offset={SHADE_START} stopColor="#000000" stopOpacity={0} />
          <Stop offset={SHADE_FULL} stopColor="#000000" stopOpacity={SHADE_OPACITY} />
          <Stop offset="1" stopColor="#000000" stopOpacity={SHADE_OPACITY} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** 준비 중인 여행 배너의 점과 같은 모양이다. (OngoingTripCarousel) */
function Dots({ count, page }: { count: number; page: number }) {
  return (
    <View className="mt-3 flex-row items-center justify-center">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index === page ? 14 : 5,
            height: 5,
            marginHorizontal: 2.5,
            borderRadius: 999,
            backgroundColor: index === page ? '#111827' : '#d1d5db',
          }}
        />
      ))}
    </View>
  );
}
