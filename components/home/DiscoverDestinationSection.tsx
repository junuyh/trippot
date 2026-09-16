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
//    지금은 엽서다. 이유는 DiscoverDestinationCard 머리말에 있다.
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

import { DiscoverDestinationCard } from './DiscoverDestinationCard';
import { SectionHeader } from './SectionHeader';
import type { DiscoverDestination } from './types';

type Props = {
  destinations: DiscoverDestination[];
  /** 한글 도시명을 받는다. 커뮤니티 여행지 필터가 이 값을 쓴다. */
  onPressDestination: (nameKo: string) => void;
};

/** 좌우 여백과 그림자 여유는 PastTripSection 과 같다. 카드 폭만 다르다. */
const SCREEN_PADDING = 32;
const SHADOW_PAD = 12;
const CARD_GAP = 14;
/**
 * 화면 안쪽 폭 대비 카드 폭.
 *
 * ⚠️ 2026-09-16 엽서로 바꾸면서 0.48 → 0.56 으로 넓혔다. 엽서는 가로로 눕는
 *    종이라 좁으면 도시 이름과 우표가 서로 밀린다. 지난 여행 태그(0.48)와
 *    **일부러 다른 값**이다 — 두 칸이 같은 물건으로 보이지 않아야 한다.
 */
const CARD_RATIO = 0.56;

export function DiscoverDestinationSection({ destinations, onPressDestination }: Props) {
  const { width } = useWindowDimensions();
  const innerWidth = Math.max(0, width - SCREEN_PADDING);
  const cardWidth = Math.round(innerWidth * CARD_RATIO);
  const step = cardWidth + CARD_GAP;

  // 글이 하나도 없으면 칸을 통째로 그리지 않는다. 위 주석 참조.
  if (destinations.length === 0) return null;

  return (
    <View>
      <SectionHeader title="여행자들은 이렇게 다녀왔어요" />

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
          <DiscoverDestinationCard
            key={destination.code}
            destination={destination}
            width={cardWidth}
            onPress={onPressDestination}
          />
        ))}
      </ScrollView>
    </View>
  );
}
