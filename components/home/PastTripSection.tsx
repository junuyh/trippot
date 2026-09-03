// ============================================================================
// 1-2. 지난 여행 — 빈티지 우표 가로 슬라이드 (2026-09-03)
//
// 왜 홈에 있는가
//   docs/03_요구사항정의서_v1.md REQ-HOME-001 은 **Must** 다.
//   "홈에서 진행 중 여행과 종료 여행을 구분해 보여준다."
//   개편 전 홈에는 종료 여행이 없어서 지난 여행을 보려면
//   마이 탭 → MY-01 → MY-02 → 여행 선택, 네 번을 눌러야 했다.
//   docs/09_IA_v2.md §1-2 도 홈에 종료된 여행 카드를 둔다.
//
// 카드 모양은 **빈티지 러기지 태그**다. 자세한 건 LuggageTagCard 에 있다.
// 나라마다 띠 색·국가명·풍경이 달라서 도시 이름을 읽기 전에 어느 여행인지 안다.
//
// ⚠️ 배치는 슬라이드 → 두 줄 나열 → 콜라주 → 격자 → **다시 가로 슬라이드** 로 왔다.
//    콜라주(기울이고 겹쳐 놓기)는 "버튼인지 몰라 안 누를 것 같다" 는 평을 받고 버렸다.
//    기울임·겹침은 장식의 신호이고, 겹친 자리를 누르면 위 카드가 반응해서
//    한 번 헛누르면 다음부터 안 누른다.
//
//    지금은 **똑바로 세워 한 줄로 늘어놓고 옆으로 넘긴다.**
//    줄이 맞고 겹치지 않으니 각 장이 버튼으로 읽히고, 스크롤 자체가
//    '만질 수 있다' 는 신호가 된다. 재미는 배치가 아니라 카드 그림
//    (우표 톱니·크림색 종이·큰 비행기 실루엣·국가색 해와 물결)이 낸다.
//
// ⚠️ 홈에는 최근 4개만 둔다. 전체 목록은 MY-02(/me/trips)다.
//    홈이 여행 목록 페이지가 되면 안 된다. (CLAUDE.md 2장)
//
// ⚠️ 결산 전(ENDED) 여행은 최종 여행비가 없다. 그 자리에 '결산하기 →' 를 둬서
//    결산을 유도한다. 여행 기간이 끝나면 결산을 유도하는 것은 정책이다.
//    (CLAUDE.md 3장) 개편으로 '지금 챙겨야 할 것' 줄이 사라지면서
//    홈에서 결산을 권할 자리가 여기 하나만 남았다.
// ============================================================================
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { HOME_CAPTION, HOME_RADIUS } from './palette';
import { SectionHeader } from './SectionHeader';
import { LuggageTagCard } from './LuggageTagCard';
import type { EndedTripCardData } from './types';
import { useAutoCarousel } from './useAutoCarousel';

type Props = {
  trips: EndedTripCardData[];
  /** 홈에 다 담지 못한 지난 여행이 더 있는가. 있을 때만 '전체 보기' 를 그린다. */
  hasMore: boolean;
  onPressTrip: (tripId: string) => void;
  onPressSettle: (tripId: string) => void;
  onPressSeeAll: () => void;
};

/** 홈 좌우 여백(px-4) 합. */
const SCREEN_PADDING = 32;
/**
 * 그림자가 잘리지 않게 스크롤 영역을 좌우로 넓히는 폭.
 * 바깥으로 넓힌 만큼 안쪽에서 밀어 넣어야 snapToInterval 이 어긋나지 않는다.
 */
const SHADOW_PAD = 12;
const CARD_GAP = 14;
/**
 * 화면 안쪽 폭 대비 카드 폭.
 *
 * ⚠️ 태그 한 장에 들어가는 것이 많다 — 공항 코드·도착 칸·도시 이름·나라 그림·
 *    소인·기간·결산 유도. 카드 안의 모든 치수가 이 폭에서 나오므로 이 값만
 *    바꾸면 글자와 그림이 같은 비율로 함께 줄고 는다.
 *
 * ⚠️ 0.44 아래로 내리지 않는다. 그 아래에서는 나라 그림이 뭉개져서
 *    도시 이름을 읽기 전에 어느 여행인지 알아보는 이점이 사라진다.
 */
const CARD_RATIO = 0.48;

export function PastTripSection({
  trips,
  hasMore,
  onPressTrip,
  onPressSettle,
  onPressSeeAll,
}: Props) {
  const { width } = useWindowDimensions();
  const innerWidth = Math.max(0, width - SCREEN_PADDING);
  const cardWidth = Math.round(innerWidth * CARD_RATIO);
  const step = cardWidth + CARD_GAP;

  // 카드가 두 장씩 보이므로 마지막 카드까지 스크롤할 수 없다.
  // 더 갈 곳이 없는 자리에서 처음으로 돌아가야 자동 슬라이드가 멈춘 것처럼 보이지 않는다.
  const visibleCount = step > 0 ? Math.max(1, Math.floor((innerWidth + CARD_GAP) / step)) : 1;
  const lastIndex = Math.max(0, trips.length - visibleCount);

  const { ref, handleScroll, handleTouch } = useAutoCarousel({
    count: trips.length,
    step,
    lastIndex,
  });

  return (
    <View>
      <SectionHeader
        title="지난 여행"
        actionLabel={hasMore ? '전체 보기' : undefined}
        onPressAction={hasMore ? onPressSeeAll : undefined}
      />

      {trips.length === 0 ? (
        <View
          className="border border-dashed bg-white px-4 py-5"
          style={{ borderColor: '#cdd2d8', borderRadius: HOME_RADIUS.card }}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: HOME_CAPTION }}>
            아직 다녀온 여행이 없어요.{'\n'}여행이 끝나면 여기에 쌓여요.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollBeginDrag={handleTouch}
          onScrollEndDrag={handleTouch}
          scrollEventThrottle={16}
          snapToInterval={step}
          decelerationRate="fast"
          style={{ marginHorizontal: -SHADOW_PAD }}
          // 카드 그림자가 잘리지 않게 사방으로 여유를 준다.
          contentContainerStyle={{
            gap: CARD_GAP,
            paddingVertical: 8,
            paddingHorizontal: SHADOW_PAD,
          }}
        >
          {trips.map((trip) => (
            <LuggageTagCard
              key={trip.tripId}
              trip={trip}
              width={cardWidth}
              onPress={onPressTrip}
              onPressSettle={onPressSettle}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
