// ============================================================================
// 신규 사용자 홈 — 이런 여행지는 어때요? (2026-09-09)
//
// 위 '추천 여행지' 가 "여기로 가보세요" 라면, 이 칸은 "다른 사람은 여기
// 다녀왔대요" 다. 그래서 누르면 여행 만들기가 아니라 **커뮤니티의 그 여행지
// 글 목록**으로 간다.
//
// ⚠️ **지난 여행 칸(PastTripSection)과 같은 물건이다.** 카드 폭 비율·간격·
//    그림자 여유를 값 하나까지 그대로 가져왔다. 첫 여행을 다녀오면 이 자리에
//    지난 여행이 오는데, 둘이 다르게 생기면 화면이 통째로 바뀐 것으로 보인다.
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

/** 아래 값은 PastTripSection 과 같다. 두 칸의 카드가 같은 크기로 선다. */
const SCREEN_PADDING = 32;
const SHADOW_PAD = 12;
const CARD_GAP = 14;
/**
 * 화면 안쪽 폭 대비 카드 폭.
 * ⚠️ 0.44 아래로 내리지 않는다. 그 아래에서는 나라 그림이 뭉개진다.
 *    (PastTripSection 주석)
 */
const CARD_RATIO = 0.48;

export function DiscoverDestinationSection({ destinations, onPressDestination }: Props) {
  const { width } = useWindowDimensions();
  const innerWidth = Math.max(0, width - SCREEN_PADDING);
  const cardWidth = Math.round(innerWidth * CARD_RATIO);
  const step = cardWidth + CARD_GAP;

  // 글이 하나도 없으면 칸을 통째로 그리지 않는다. 위 주석 참조.
  if (destinations.length === 0) return null;

  return (
    <View>
      <SectionHeader title="이런 여행지는 어때요?" />

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
