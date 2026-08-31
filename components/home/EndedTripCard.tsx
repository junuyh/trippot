import { Text, View } from 'react-native';

import {
  TRIP_OWNER_TYPE,
  TRIP_OWNER_TYPE_LABEL,
  TRIP_STATUS,
  TRIP_STATUS_LABEL,
} from '@/lib/constants/status';

import { formatAmount, formatTripDates } from './format';
import { TicketCard, TicketField } from './TicketCard';
import type { EndedTripCardData } from './types';

type Props = {
  trip: EndedTripCardData;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * 1-2. 종료된 여행 카드. (docs/09_IA_v1.md §1)
 * 여행지 · 여행 기간 · 개인/모임명 · 최종 여행비
 *
 * 대표 여행 유형 이미지·라벨은 [고도화](9/07~)라 그리지 않는다.
 * 진행 중 카드와 같은 티켓이되 빨강을 쓰지 않는다 — 이미 끝난 여행이다.
 */
export function EndedTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  // ENDED 는 아직 결산 전이라 최종 여행비가 확정되지 않았다.
  const beforeSettlement = trip.status === TRIP_STATUS.ENDED && trip.finalAmount === null;

  return (
    <TicketCard
      muted
      accessibilityLabel={`${destination} 지난 여행 보기`}
      onPress={() => onPress(trip.tripId)}
      top={
        <>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text
                className="text-2xl font-bold leading-7 tracking-tighter text-pot-ink"
                numberOfLines={1}
              >
                {destination}
              </Text>
              <Text className="mt-1.5 text-xs text-pot-mute" numberOfLines={1}>
                {ownerLabel} · {TRIP_STATUS_LABEL[trip.status]}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row items-baseline">
            <Text className="text-base font-bold tracking-tight text-pot-mute" style={NUM}>
              {dates.start}
            </Text>
            <View className="mx-3 h-[1.5px] w-5 bg-pot-line" />
            <Text className="text-base font-bold tracking-tight text-pot-mute" style={NUM}>
              {dates.end}
            </Text>
          </View>
        </>
      }
      bottom={
        <TicketField label="최종 여행비">
          {beforeSettlement ? (
            <Text className="text-sm font-medium text-pot-mute">결산 전</Text>
          ) : (
            <Text className="text-[22px] font-bold tracking-tight text-pot-ink" style={NUM}>
              {formatAmount(trip.finalAmount)}
            </Text>
          )}
        </TicketField>
      }
    />
  );
}
