import { ScrollView, View } from 'react-native';

import { CreateTripCard } from './CreateTripCard';
import { HomeHeader } from './HomeHeader';
import { OngoingTripCarousel } from './OngoingTripCarousel';
import { PastTripSection } from './PastTripSection';
import type { EndedTripCardData, HomeEmptyVariant, OngoingTripCardData } from './types';

type Props = {
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 인사 문구에 쓴다. */
  daysToNextTrip: number | null;

  /** 준비 중인 여행 전부. 티켓 카드 가로 슬라이드가 된다. */
  ongoingTrips: OngoingTripCardData[];
  /** 진행 중 여행이 하나도 없을 때 문구를 고르는 값. (docs/03 REQ-HOME-002) */
  emptyVariant: HomeEmptyVariant;

  /** 홈에 보여줄 지난 여행. 최근 몇 개만이다. 전체는 MY-02. */
  pastTrips: EndedTripCardData[];
  /** 홈에 다 담지 못한 지난 여행이 더 있는가. */
  hasMorePastTrips: boolean;

  onPressTrip: (tripId: string) => void;
  /** 지난 여행 카드의 '결산하기' 를 눌렀을 때. 결산 화면으로 바로 보낸다. */
  onPressSettle: (tripId: string) => void;
  onPressCreateTrip: () => void;
  onPressAllPastTrips: () => void;
};

/**
 * HOME-01 본문. (2026-09-03 개편)
 *
 * 홈은 **내 여행이 놓인 선반**이다. 지금 가는 여행과 다녀온 여행을 보여주고,
 * 새 여행을 시작하게 한다. docs/09_IA_v2.md §1 구조 그대로다.
 *
 *   1-1. 준비 중인 여행   여행지·일정·여행자금 배너, 가로 슬라이드
 *   1-4. 새 여행 만들기
 *   1-2. 지난 여행        빈티지 우표, 가로 슬라이드 (결산 전이면 '결산하기')
 *
 * ⚠️ **[문서와 어긋남] 새 여행 만들기를 지난 여행 위로 올렸다.** (2026-09-07)
 *    docs/09_IA_v2.md §1-4 는 이 카드를 맨 아래에 두라고 적고 있다.
 *    지난 여행은 되돌아보는 자리고 새 여행 만들기는 지금 할 일이라, 할 일이
 *    기록보다 아래에 있으면 스크롤을 끝까지 내려야 닿는다.
 *    문서를 임의로 고치지 않았다. (CLAUDE.md 1-1)
 *
 * ⚠️ 2026-09-02 대시보드 개편(메인 카드·지금 챙겨야 할 것·여행자금 현황·
 *    모임 바로가기·지난 여행 인사이트)을 되돌렸다.
 *    금액·준비율·부족 금액이 홈 대부분을 차지하면서 홈이 "어디 가지?" 가 아니라
 *    "얼마 있지?" 에 답하고 있었다. 계좌관리 앱·가계부처럼 만들지 않는다는
 *    CLAUDE.md 2장에 어긋난다. 금액은 여행 준비 홈(TRIP-HOME-01)에서 본다.
 *
 * ⚠️ 지난 여행을 홈에 둔 것은 취향이 아니라 요구사항이다.
 *    docs/03_요구사항정의서_v1.md REQ-HOME-001 은 Must 이고,
 *    개편 전 홈은 종료 여행을 아예 그리지 않아 이 항목을 채우지 못했다.
 *
 * ⚠️ 2026-09-03 바탕을 흰색으로 바꿨다.
 *    카드도 흰색이라 경계가 약해지는데, 카드마다 1px 테두리(#edf0f2)와 그림자가
 *    있어서 구분된다. trip-home 카드들이 쓰는 방식과 같다.

 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function HomeView({
  userName,
  daysToNextTrip,
  ongoingTrips,
  emptyVariant,
  pastTrips,
  hasMorePastTrips,
  onPressTrip,
  onPressSettle,
  onPressCreateTrip,
  onPressAllPastTrips,
}: Props) {
  return (
    <View className="flex-1 bg-white">
      {/* 상단바에는 만들기 버튼이 없다. 이유는 HomeHeader 주석 참조. */}
      <HomeHeader userName={userName} daysToNextTrip={daysToNextTrip} />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-28 pt-2">
        <OngoingTripCarousel
          trips={ongoingTrips}
          emptyVariant={emptyVariant}
          onPressTrip={onPressTrip}
          onPressCreateTrip={onPressCreateTrip}
        />

        <View className="mt-7">
          <CreateTripCard onPress={onPressCreateTrip} />
        </View>

        <View className="mt-7">
          <PastTripSection
            trips={pastTrips}
            hasMore={hasMorePastTrips}
            onPressTrip={onPressTrip}
            onPressSettle={onPressSettle}
            onPressSeeAll={onPressAllPastTrips}
          />
        </View>
      </ScrollView>
    </View>
  );
}
