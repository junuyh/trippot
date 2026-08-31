import { Pressable, Text, View } from 'react-native';

import { formatDateRange } from './format';
import type { GroupTripItem } from './types';

type Props = {
  trip: GroupTripItem;
  onPress: (tripId: string) => void;
};

/**
 * 3-2. 모임 상세의 여행 카드. 진행 중 / 지난 여행이 같은 모양을 쓴다.
 *
 * 누르면 해당 여행의 준비 홈(2-2)으로 간다. 진행/지난을 여기서 분기하지 않는다.
 * 도착 화면이 trip.status 로 TRIP-HOME-01 / TRIP-HOME-02 를 가른다. (docs/04_v3 §5)
 *
 * ⚠️ 이동 기준은 반드시 tripId 다. 같은 모임에 같은 여행지 여행이 여러 개 있어도
 *    여행지·일정으로는 구분되지 않는다. trips.id 는 uuid PK 라 절대 겹치지 않는다.
 */
export function GroupTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="rounded-2xl border border-gray-200 bg-white px-4 py-4 active:bg-gray-50"
    >
      <Text numberOfLines={1} className="text-base font-bold leading-6 text-gray-900">
        {destination}
      </Text>
      <Text className="mt-1 text-xs leading-4 text-gray-500">
        {formatDateRange(trip.startDate, trip.endDate)}
      </Text>
    </Pressable>
  );
}
