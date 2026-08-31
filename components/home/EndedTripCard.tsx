import { Pressable, Text, View } from 'react-native';

import {
  TRIP_OWNER_TYPE,
  TRIP_OWNER_TYPE_LABEL,
  TRIP_STATUS,
  TRIP_STATUS_LABEL,
} from '@/lib/constants/status';

import { formatAmount, formatDateRange } from './format';
import type { EndedTripCardData } from './types';

type Props = {
  trip: EndedTripCardData;
  onPress: (tripId: string) => void;
};

/**
 * 1-2. 종료된 여행 카드. (docs/09_IA_v1.md §1)
 * 여행지 · 여행 기간 · 개인/모임명 · 최종 여행비
 *
 * 대표 여행 유형 이미지·라벨은 [고도화](9/07~)라 여기서 그리지 않는다.
 *
 * 탭하면 2-2 종료 상태 여행 홈으로 간다.
 */
export function EndedTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  // ENDED 는 아직 결산 전이라 최종 여행비가 확정되지 않았다.
  const beforeSettlement = trip.status === TRIP_STATUS.ENDED;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 지난 여행 보기`}
      onPress={() => onPress(trip.tripId)}
      className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 active:bg-gray-100"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold text-gray-700" numberOfLines={1}>
            {destination}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
          <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
            {ownerLabel}
          </Text>
        </View>

        <View className="rounded-full bg-gray-200 px-2.5 py-1">
          <Text className="text-[11px] font-semibold text-gray-600">
            {TRIP_STATUS_LABEL[trip.status]}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-baseline justify-between border-t border-gray-200 pt-3">
        <Text className="text-xs text-gray-500">최종 여행비</Text>
        {beforeSettlement && trip.finalAmount === null ? (
          <Text className="text-xs text-gray-400">결산 전</Text>
        ) : (
          <Text className="text-base font-bold text-gray-700">
            {formatAmount(trip.finalAmount)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
