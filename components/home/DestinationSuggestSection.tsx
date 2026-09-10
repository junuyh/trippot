// ============================================================================
// 신규 사용자 홈 — 추천 여행지 (2026-09-09 개편)
//
// 여행이 하나도 없는 사람의 홈에는 보여줄 여행이 없다. 그 자리에 "어디 가지?"
// 의 후보를 놓는다. 홈은 내 여행이 놓인 선반인데, 선반이 비어 있으면 무엇을
// 올릴 수 있는지부터 보여야 한다.
//
// ⚠️ **기존 홈의 부품과 값을 그대로 쓴다. 새로 만든 규칙이 없다.**
//    · 섹션 제목 줄    → SectionHeader (준비 중인 여행·지난 여행과 같은 것)
//    · 자동 슬라이드   → useAutoCarousel (준비 중인 여행 배너와 같은 것)
//    · 카드 폭·간격·점 → OngoingTripCarousel 과 같은 값
//    · 카드 한 장       → DestinationSuggestCard (NextTripBanner 와 같은 치수)
//    두 홈이 다른 물건처럼 보이면, 첫 여행을 만든 순간 화면이 낯설어진다.
//
// ⚠️ **사진 슬라이드에서 보딩패스 카드로 바꿨다.** (2026-09-07 → 2026-09-09)
//    사진 배너는 그 자체로는 좋았지만 홈의 다른 카드와 다른 물건이었다.
//    바뀐 이유는 DestinationSuggestCard 주석에 있다.
//    ⚠️ 사진 상수(lib/constants/destinationHeroPhoto)는 지우지 않았다.
//       지금은 쓰는 곳이 없다. (CLAUDE.md 1장)
//
// ⚠️ 점(Dots)은 OngoingTripCarousel 과 같은 모양이다. 두 홈의 같은 자리에
//    같은 표시가 선다. 그 파일의 Dots 는 파일 안에만 있어서 여기에 같은 것을
//    뒀다. 공용으로 올리려면 두 파일을 모두 고쳐야 해서 지금은 두지 않는다.
// ============================================================================
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { DestinationSuggestCard } from './DestinationSuggestCard';
import { SectionHeader } from './SectionHeader';
import type { DestinationSuggestion } from './types';
import { useAutoCarousel } from './useAutoCarousel';

type Props = {
  suggestions: DestinationSuggestion[];
  /** 목적지 코드를 받는다. 지금은 쓰지 않지만 TRIP-01 이 받게 되면 넘긴다. */
  onPressSuggestion: (code: string) => void;
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

export function DestinationSuggestSection({ suggestions, onPressSuggestion }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(0, width - SCREEN_PADDING);

  const { ref, page, handleScroll, handleTouch } = useAutoCarousel({
    count: suggestions.length,
    step: cardWidth + CARD_GAP,
  });

  // 목적지 상수가 비는 일은 없지만, 비어도 화면이 깨지지 않아야 한다.
  if (suggestions.length === 0) return null;

  return (
    <View>
      <SectionHeader title="추천 여행지" />

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
        {suggestions.map((suggestion) => (
          <DestinationSuggestCard
            key={suggestion.code}
            suggestion={suggestion}
            width={cardWidth}
            onPress={onPressSuggestion}
          />
        ))}
      </ScrollView>

      {suggestions.length > 1 ? <Dots count={suggestions.length} page={page} /> : null}
    </View>
  );
}

/**
 * 몇 장이 더 있는지 알리는 점.
 * OngoingTripCarousel 의 것과 같은 값이다. 두 홈에서 같은 표시로 보여야 한다.
 */
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
