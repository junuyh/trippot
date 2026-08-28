import { Pressable, Text, View } from 'react-native';

import { TRIP_OWNER_TYPE, TRIP_OWNER_TYPE_LABEL, TRIP_STATUS_LABEL } from '@/lib/constants/status';

import { calcReadyRatePercent, formatAmount, formatDateRange, formatDDay } from './format';
import type { OngoingTripCardData } from './types';

type Props = {
  trip: OngoingTripCardData;
  onPress: (tripId: string) => void;
};

/**
 * 1-1. 진행 중인 여행 카드. (docs/09_IA_v1.md §1)
 * 여행지 · 일정/D-Day · 개인/모임명 · 현재 여행자금/목표 여행비 · 준비율
 *
 * 탭하면 2-2 여행 준비 홈으로 간다. 이동만 하고 도착 화면은 관여하지 않는다.
 */
export function OngoingTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="rounded-2xl border border-gray-200 bg-white px-4 py-4 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {destination}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>

        <View className="items-end">
          {dday ? (
            <View className="rounded-full bg-pot-sun px-2.5 py-1">
              <Text className="text-xs font-bold text-pot-ink">{dday}</Text>
            </View>
          ) : null}
          <Text className="mt-1.5 text-[11px] text-gray-400">{TRIP_STATUS_LABEL[trip.status]}</Text>
        </View>
      </View>

      <Text className="mt-2 text-xs text-gray-500" numberOfLines={1}>
        {ownerLabel}
      </Text>

      <View className="mt-4 border-t border-gray-100 pt-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-xs text-gray-500">현재 여행자금</Text>
          <Text className="text-base font-bold text-gray-900">
            {formatAmount(trip.currentAmount)}
          </Text>
        </View>
        <View className="mt-1 flex-row items-baseline justify-between">
          <Text className="text-xs text-gray-500">목표 여행비</Text>
          <Text className="text-xs text-gray-500">{formatAmount(trip.targetAmount)}</Text>
        </View>

        {rate === null ? (
          <Text className="mt-3 text-[11px] text-gray-400">
            목표 여행비와 여행자금을 등록하면 준비율을 볼 수 있어요.
          </Text>
        ) : (
          <View className="mt-3">
            <View className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <View
                className="h-full rounded-full bg-pot-mint"
                style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
              />
            </View>
            <Text className="mt-1.5 text-right text-xs font-semibold text-gray-900">
              준비율 {rate}%
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
