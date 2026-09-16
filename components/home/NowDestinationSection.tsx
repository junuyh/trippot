// ============================================================================
// 1-3. 지금 떠나기 좋은 해외여행지 — 기존 사용자 홈, 지난 여행 아래 (2026-09-16)
//
// 여행지 추천 화면(/destinations)의 '지금 가기 좋아요' 를 몇 장만 먼저 보여준다.
// 카드는 그 화면 격자와 **같은 컴포넌트**(components/explore/ExploreDestinationCard)다.
// 홈에서 본 카드를 전체 보기에서 다시 알아볼 수 있어야 한다.
//
// ⚠️ 지난 여행 **아래**다. 홈은 내 여행이 놓인 선반이라 내 여행이 먼저다.
//    추천은 그 다음이다. (시안 01 '새로운 여행 추천은 그 아래에')
//
// ⚠️ 가로 슬라이드이고 저절로 넘어가지 않는다. (PastTripSection 과 같은 이유)
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { ExploreDestinationCard, type ExploreCardData } from '@/components/explore';

import { SectionHeader } from './SectionHeader';

type Props = {
  /** '9월' */
  monthLabel: string;
  items: ExploreCardData[];
  onPressDestination: (code: string) => void;
  onPressSeeAll: () => void;
};

const SCREEN_PADDING = 32;
const CARD_GAP = 10;
/** 한 화면에 두 장 반. 옆에 카드가 더 있다는 걸 잘린 반 장이 말한다. */
const CARD_RATIO = 0.4;

export function NowDestinationSection({
  monthLabel,
  items,
  onPressDestination,
  onPressSeeAll,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.max(0, width - SCREEN_PADDING) * CARD_RATIO);

  // 추천할 곳이 없으면 칸째 그리지 않는다. 빈 추천 칸은 할 말이 없다.
  if (items.length === 0) return null;

  return (
    <View>
      <SectionHeader
        title={`${monthLabel}에 떠나기 좋은 해외여행지`}
        actionLabel="전체 보기"
        onPressAction={onPressSeeAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: CARD_GAP }}
      >
        {items.map((item) => (
          <ExploreDestinationCard
            key={item.code}
            item={item}
            width={cardWidth}
            compact
            onPress={onPressDestination}
          />
        ))}
      </ScrollView>
    </View>
  );
}
