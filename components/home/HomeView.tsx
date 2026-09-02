import { ScrollView, View } from 'react-native';

import { ActionRequiredSection } from './ActionRequiredSection';
import { GroupShortcutList } from './GroupShortcutList';
import { HomeHeader } from './HomeHeader';
import { NextTripCard } from './NextTripCard';
import { OngoingTripCarousel } from './OngoingTripCarousel';
import { PastTripInsight } from './PastTripInsight';
import { SectionHeader } from './SectionHeader';
import { TravelFundSummary } from './TravelFundSummary';
import type {
  HomeActionItem,
  HomeEmptyVariant,
  HomeFundSummaryData,
  HomeGroupItem,
  HomePastInsightData,
  NextTripCardData,
  OngoingTripCardData,
} from './types';

type Props = {
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 인사 문구에 쓴다. */
  daysToNextTrip: number | null;

  /** 출발이 가장 가까운 여행. 없으면 메인 카드를 그리지 않는다. */
  nextTrip: NextTripCardData | null;
  /** 메인 카드에 올린 여행을 뺀 나머지 진행 중 여행. */
  otherTrips: OngoingTripCardData[];
  /** 진행 중 여행이 하나도 없을 때 문구를 고르는 값. (docs/03 REQ-HOME-002) */
  emptyVariant: HomeEmptyVariant;

  actions: HomeActionItem[];
  fund: HomeFundSummaryData;
  insight: HomePastInsightData | null;
  groups: HomeGroupItem[];

  onPressTrip: (tripId: string) => void;
  onPressGroup: (groupId: string) => void;
  onPressCreateTrip: () => void;
  onPressProfile: () => void;
  onPressAction: (actionId: string) => void;
  onPressAllTrips: () => void;
  onPressInsight: (tripId: string) => void;
};

/**
 * HOME-01 본문 — 대표 홈 대시보드. (2026-09-02 개편)
 *
 * 사용자가 홈에서 세 가지를 바로 알 수 있어야 한다.
 *   ① 가장 가까운 여행이 무엇인가   → NextTripCard
 *   ② 준비 상태가 어떤가            → NextTripCard 진행률 · TravelFundSummary
 *   ③ 지금 해야 할 일이 무엇인가    → ActionRequiredSection
 *
 * ⚠️ 항공·숙소·식비 같은 카테고리 관리 UI 를 여기서 반복하지 않는다.
 *    그건 여행 상세 홈(TRIP-HOME-01)의 일이다. 두 화면의 역할을 나눈다.
 *
 * ⚠️ 바탕은 pot-visual 이다. 여행 카드(TripCardShell)의 절취선 구멍이
 *    이 색으로 뚫려 있어서, 바탕색이 다르면 구멍이 아니라 점으로 보인다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function HomeView({
  userName,
  daysToNextTrip,
  nextTrip,
  otherTrips,
  emptyVariant,
  actions,
  fund,
  insight,
  groups,
  onPressTrip,
  onPressGroup,
  onPressCreateTrip,
  onPressProfile,
  onPressAction,
  onPressAllTrips,
  onPressInsight,
}: Props) {
  // 메인 카드에 이미 올라간 여행을 가로 스크롤에서 또 보여주지 않는다.
  // 진행 중 여행이 그 하나뿐이면 섹션 자체를 그리지 않는다.
  const showCarousel = nextTrip === null || otherTrips.length > 0;

  return (
    <View className="flex-1 bg-pot-visual">
      <HomeHeader
        userName={userName}
        daysToNextTrip={daysToNextTrip}
        onPressProfile={onPressProfile}
        onPressCreateTrip={onPressCreateTrip}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-28 pt-1">
        {nextTrip ? <NextTripCard trip={nextTrip} onPress={onPressTrip} /> : null}

        <View className="mt-7">
          <ActionRequiredSection actions={actions} onPressAction={onPressAction} />
        </View>

        {showCarousel ? (
          <View className="mt-7">
            <OngoingTripCarousel
              trips={otherTrips}
              emptyVariant={emptyVariant}
              onPressTrip={onPressTrip}
              onPressSeeAll={onPressAllTrips}
              onPressCreateTrip={onPressCreateTrip}
            />
          </View>
        ) : null}

        <View className="mt-7">
          <TravelFundSummary fund={fund} />
        </View>

        <View className="mt-7">
          <PastTripInsight insight={insight} onPress={onPressInsight} />
        </View>

        {/* 모임 바로가기 — docs/09_IA §1-3. 어디서 눌러도 같은 모임 상세로 간다. */}
        {groups.length > 0 ? (
          <View className="mt-7">
            <SectionHeader title="모임 바로가기" />
            <GroupShortcutList groups={groups} onPress={onPressGroup} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
