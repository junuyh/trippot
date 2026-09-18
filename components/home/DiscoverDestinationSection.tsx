// ============================================================================
// 신규 사용자 홈 — 여행자들은 이렇게 다녀왔어요 (2026-09-09)
//
// 위 '추천 여행지' 가 "여기로 가보세요" 라면, 이 칸은 "다른 사람은 여기
// 다녀왔대요" 다. 그래서 누르면 여행 만들기가 아니라 **커뮤니티의 그 여행지
// 글 목록**으로 간다.
//
// ⚠️ **2026-09-16 지난 여행 칸(PastTripSection)과 일부러 다른 물건이 됐다.**
//    전에는 카드 폭 비율·간격까지 지난 여행 태그와 같은 값이었는데, 그래서
//    "내 여행 기록인지 남의 이야기인지 구별이 안 된다" 는 평을 받았다.
//    지금은 트래블 스토리 카드다. (travelStory/TravelStoryCard 머리말)
//    (간격·그림자 여유는 그대로 둔다 — 같은 화면의 리듬은 맞아야 한다)
//
// ⚠️ **'전체 보기' 를 두지 않았다.** (2026-09-09 사용자 확인)
//    여행지 목록 화면이 아직 없다. 눌러도 아무 일이 없는 칸을 만들지 않는다.
//    (같은 이유로 검색창·찜하기도 두지 않았다 — 이전 시안 검토 기록)
//
// ⚠️ **글이 있는 여행지만 들어온다.** 화면 파일이 커뮤니티 글 수로 목록을
//    만든다. 글이 없는 여행지를 넣으면 눌렀을 때 빈 목록이 나온다.
//    그래서 이 칸은 **통째로 사라질 수 있다.** 커뮤니티에 글이 하나도 없으면
//    아무것도 그리지 않는다. 빈 칸으로 자리만 차지하는 것보다 낫다.
// ============================================================================
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { SectionHeader } from './SectionHeader';
import { TravelStoryCard } from './travelStory/TravelStoryCard';
import { travelStoryIllustration } from './travelStory/travelStoryArt';
import { travelStoryPhoto } from './travelStory/travelStoryPhoto';
import type { DiscoverDestination } from './types';

type Props = {
  destinations: DiscoverDestination[];
  /** 한글 도시명을 받는다. 커뮤니티 여행지 필터가 이 값을 쓴다. */
  onPressDestination: (nameKo: string) => void;
  /** '전체 보기'. 커뮤니티 탭으로 보낸다. (2026-09-17 시안) */
  onPressSeeAll: () => void;
};

/** 좌우 여백과 그림자 여유는 PastTripSection 과 같다. 카드 폭만 다르다. */
const SCREEN_PADDING = 32;
const SHADOW_PAD = 12;
const CARD_GAP = 14;
/**
 * 화면 폭 대비 카드 폭.
 *
 * ⚠️ 2026-09-17 트래블 스토리 카드 시안: 화면 폭의 88%. 첫 카드는 온전히, 다음 카드는
 *    오른쪽에 살짝 보여 옆으로 넘길 수 있다는 걸 알린다.
 *    지난 여행 태그(0.48)와 **일부러 다른 값**이다 — 두 칸이 같은 물건으로 보이지 않아야 한다.
 */
const CARD_RATIO = 0.78;
/**
 * 카드 높이는 196~228 사이. 폭의 0.7 배를 이 범위로 자른다.
 *
 * ⚠️ 2026-09-17 카드가 너무 크다는 평을 받아 줄였다. (폭 88% → 78%, 높이 260~300 → 196~228)
 *    한 장이 화면을 다 차지하면 옆으로 넘길 수 있다는 게 안 보이고 홈이 이 칸에 먹힌다.
 *    글자 · 여백은 TravelStoryCard 가 카드 높이에 맞춰 같이 줄인다.
 */
const CARD_MIN_HEIGHT = 196;
const CARD_MAX_HEIGHT = 228;

export function DiscoverDestinationSection({
  destinations,
  onPressDestination,
  onPressSeeAll,
}: Props) {
  const { width } = useWindowDimensions();
  // 카드가 화면 안쪽 폭을 넘지 않게 한다. (좁은 기기에서 88% 가 여백을 파고들지 않게)
  const innerWidth = Math.max(0, width - SCREEN_PADDING);
  const cardWidth = Math.min(innerWidth, Math.round(width * CARD_RATIO));
  const cardHeight = Math.min(CARD_MAX_HEIGHT, Math.max(CARD_MIN_HEIGHT, Math.round(cardWidth * 0.7)));
  const step = cardWidth + CARD_GAP;

  // 글이 하나도 없으면 칸을 통째로 그리지 않는다. 위 주석 참조.
  if (destinations.length === 0) return null;

  return (
    <View>
      {/*
        ⚠️ 2026-09-17 '전체 보기' 를 달았다. (시안) 여행지 목록 화면이 없어 전에는 뺐는데,
           이 칸의 전체는 결국 커뮤니티 글 목록이라 커뮤니티 탭으로 보낸다.
      */}
      <SectionHeader
        title="여행자들은 이렇게 다녀왔어요"
        actionLabel="전체 보기"
        onPressAction={onPressSeeAll}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        style={{ marginHorizontal: -SHADOW_PAD }}
        contentContainerStyle={{
          gap: CARD_GAP,
          paddingVertical: 8,
          paddingHorizontal: SHADOW_PAD,
        }}
      >
        {destinations.map((destination) => (
          <TravelStoryCard
            key={destination.code}
            cityName={destination.nameKo}
            cityNameEn={destination.nameEn}
            duration={`${destination.nights} 추천`}
            storyCount={destination.postCount}
            countryCode={destination.theme.code}
            countryKo={destination.countryKo}
            theme={destination.theme}
            // 등록된 도시는 엽서 그림 한 장을 쓰고, 없으면 아래 illustration 으로 직접 그린다
            photo={travelStoryPhoto(destination.code)}
            illustration={travelStoryIllustration(
              destination.code,
              destination.theme.nameEn,
              destination.nameEn,
            )}
            width={cardWidth}
            height={cardHeight}
            onPress={() => onPressDestination(destination.nameKo)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
