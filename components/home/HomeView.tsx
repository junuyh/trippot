import { ScrollView, Text, View } from 'react-native';

import { EndedTripCard } from './EndedTripCard';
import { GroupShortcutList } from './GroupShortcutList';
import { HomeButton } from './HomeButton';
import { OngoingTripCard } from './OngoingTripCard';
import type { EndedTripCardData, HomeGroupItem, OngoingTripCardData } from './types';

type Props = {
  ongoingTrips: OngoingTripCardData[];
  endedTrips: EndedTripCardData[];
  groups: HomeGroupItem[];
  onPressTrip: (tripId: string) => void;
  onPressGroup: (groupId: string) => void;
  onPressCreateTrip: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text className="mb-3 text-base font-bold text-gray-900">{title}</Text>
      {children}
    </View>
  );
}

/**
 * HOME-01 본문. (docs/09_IA_v1.md §1)
 *
 * 1-1 진행 중인 여행 / 1-2 종료된 여행 / 1-3 모임 바로가기 / 1-4 새 여행 만들기
 *
 * 진행 중 여행과 종료 여행을 구분해 보여준다. (docs/03 REQ-HOME-001)
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function HomeView({
  ongoingTrips,
  endedTrips,
  groups,
  onPressTrip,
  onPressGroup,
  onPressCreateTrip,
}: Props) {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-2">
      <Section title="진행 중인 여행">
        {ongoingTrips.length === 0 ? (
          <Text className="text-sm text-gray-400">진행 중인 여행이 없어요.</Text>
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

      <View className="mt-8">
        <HomeButton label="새 여행 만들기" onPress={onPressCreateTrip} />
      </View>
    </ScrollView>
  );
}
