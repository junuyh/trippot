import { Text, View } from 'react-native';

import { TRIP_OWNER_TYPE, TRIP_OWNER_TYPE_LABEL, TRIP_STATUS_LABEL } from '@/lib/constants/status';

import { calcReadyRatePercent, formatAmount, formatDDay, formatTripDates } from './format';
import { TicketCard, TicketField } from './TicketCard';
import type { OngoingTripCardData } from './types';

type Props = {
  trip: OngoingTripCardData;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * 1-1. 진행 중인 여행 카드. (docs/09_IA_v1.md §1)
 * 여행지 · 일정/D-Day · 개인/모임명 · 현재 여행자금/목표 여행비 · 준비율
 *
 * 위 칸은 여행, 절취선 아래는 돈이다.
 * 빨강은 D-Day 한 곳에만 쓴다. 여러 군데 쓰면 강조가 사라진다.
 */
export function OngoingTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  return (
    <TicketCard
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      top={
        <>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text
                className="text-[32px] font-bold leading-[36px] tracking-tighter text-pot-ink"
                numberOfLines={1}
              >
                {destination}
              </Text>
              <Text className="mt-1.5 text-xs text-pot-mute" numberOfLines={1}>
                {ownerLabel} · {TRIP_STATUS_LABEL[trip.status]}
              </Text>
            </View>

            {dday ? (
              <View className="items-end">
                <Text className="text-[10px] font-semibold tracking-[1.4px] text-pot-mute">
                  D-DAY
                </Text>
                <Text className="mt-0.5 text-2xl font-bold text-pot-red" style={NUM}>
                  {dday}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-5 flex-row items-baseline">
            <Text className="text-xl font-bold tracking-tight text-pot-ink" style={NUM}>
              {dates.start}
            </Text>
            <View className="mx-3 h-[1.5px] w-6 bg-pot-ink" />
            <Text className="text-xl font-bold tracking-tight text-pot-ink" style={NUM}>
              {dates.end}
            </Text>
          </View>
        </>
      }
      bottom={
        <>
          <View className="flex-row items-end justify-between">
            <TicketField label="현재 여행자금">
              <Text className="text-[22px] font-bold tracking-tight text-pot-ink" style={NUM}>
                {formatAmount(trip.currentAmount)}
              </Text>
            </TicketField>
            <TicketField label="목표" align="right">
              <Text className="text-sm font-medium text-pot-mute" style={NUM}>
                {formatAmount(trip.targetAmount)}
              </Text>
            </TicketField>
          </View>

          {rate === null ? (
            <Text className="mt-4 text-[11px] leading-4 text-pot-mute">
              목표 여행비와 여행자금을 등록하면 준비율을 볼 수 있어요.
            </Text>
          ) : (
            <View className="mt-4">
              <View className="h-1 w-full overflow-hidden rounded-full bg-pot-line">
                <View
                  className="h-full rounded-full bg-pot-ink"
                  style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                />
              </View>
              <Text
                className="mt-2 text-right text-[11px] font-semibold text-pot-ink"
                style={NUM}
              >
                준비율 {rate}%
              </Text>
            </View>
          )}
        </>
      }
    />
  );
}
