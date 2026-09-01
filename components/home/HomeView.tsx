import { ScrollView, Text, View } from 'react-native';

import { EndedTripCard } from './EndedTripCard';
import { GroupShortcutList } from './GroupShortcutList';
import { HomeHeader } from './HomeHeader';
import { HomeButton } from './HomeButton';
import { OngoingTripCard } from './OngoingTripCard';
import type {
  EndedTripCardData,
  HomeEmptyVariant,
  HomeGroupItem,
  OngoingTripCardData,
} from './types';

type Props = {
  ongoingTrips: OngoingTripCardData[];
  endedTrips: EndedTripCardData[];
  groups: HomeGroupItem[];
  onPressTrip: (tripId: string) => void;
  onPressGroup: (groupId: string) => void;
  /** 진행 중 여행이 없을 때 어떤 문구를 쓸지. (docs/03 REQ-HOME-002) */
  emptyVariant: HomeEmptyVariant;
  onPressCreateTrip: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-8">
      <Text
        className="mb-3 font-black text-pot-ink"
        style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.6 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * HOME-01 본문. (docs/09_IA_v1.md §1)
 *
 * 1-1 진행 중인 여행 / 1-2 종료된 여행 / 1-3 모임 바로가기 / 1-4 새 여행 만들기
 *
 * ⚠️ 바탕은 pot-stone 이다. 티켓 카드의 절취선 구멍과 옆 홈이 이 색으로 뚫려 있어서,
 *    바탕색이 다르면 구멍이 아니라 떠 있는 점으로 보인다.
 *
 * 진행 중 여행과 종료 여행을 구분해 보여준다. (docs/03 REQ-HOME-001)
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function HomeView({
  ongoingTrips,
  endedTrips,
  groups,
  emptyVariant,
  onPressTrip,
  onPressGroup,
  onPressCreateTrip,
}: Props) {
  return (
    <View className="flex-1 bg-pot-visual">
      <HomeHeader />
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-28 pt-1">
      <Section title="진행 중인 여행">
        {ongoingTrips.length === 0 ? (
          <Text className="text-sm leading-5 text-pot-mute">
            {emptyVariant === 'first'
              ? '아직 만든 여행이 없어요. 첫 여행을 만들어보세요.'
              : '진행 중인 여행이 없어요. 다음 여행을 계획해보세요.'}
          </Text>
        ) : (
          <View className="gap-3">
            {ongoingTrips.map((trip) => (
              <OngoingTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
            ))}
          </View>
        )}
      </Section>

      {endedTrips.length > 0 ? (
        <Section title="종료된 여행">
          <View className="gap-3">
            {endedTrips.map((trip) => (
              <EndedTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="모임 바로가기">
        <GroupShortcutList groups={groups} onPress={onPressGroup} />
      </Section>

      <View className="mt-9">
        <HomeButton label="새 여행 만들기" onPress={onPressCreateTrip} />
      </View>
      </ScrollView>
    </View>
  );
}
