import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { TRIP_OWNER_TYPE, TRIP_OWNER_TYPE_LABEL, TRIP_STATUS } from '@/lib/constants/status';

import { formatNights, formatTripDates } from './format';
import { TripCardShell } from './TripCardShell';
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
 * 진행 중 카드와 같은 구조지만 날짜를 키우지 않고 국가 색도 쓰지 않는다.
 * 이미 끝난 여행이라 눈이 먼저 갈 이유가 없다.
 */
export function EndedTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  // ENDED 는 아직 결산 전이라 최종 여행비가 확정되지 않았다.
  const beforeSettlement = trip.status === TRIP_STATUS.ENDED && trip.finalAmount === null;

  return (
    <TripCardShell
      muted
      accentColor="#C3C9D2"
      accessibilityLabel={`${destination} 지난 여행 보기`}
      onPress={() => onPress(trip.tripId)}
    >
      <View className="flex-row items-center">

        <View className="flex-1">
          <Text
            className="font-bold text-pot-ink"
            style={{ fontSize: 17, letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {destination}
          </Text>
          <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 13 }} numberOfLines={1}>
            {ownerLabel}
          </Text>
        </View>

        {nights ? (
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={15} color="#9AA3AE" />
            <Text className="ml-1 text-pot-faint" style={{ fontSize: 13 }}>
              {nights}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="my-3.5 border-t border-dashed border-pot-dash" />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={15} color="#9AA3AE" />
          <Text className="ml-1.5 text-pot-faint" style={{ fontSize: 13, ...NUM }}>
            {dates.start} – {dates.end}
          </Text>
        </View>

        {beforeSettlement ? (
          <Text className="font-bold text-pot-mute" style={{ fontSize: 13 }}>
            결산 전
          </Text>
        ) : (
          <Text
            className="font-bold text-pot-ink"
            style={{ fontSize: 17, letterSpacing: -0.3, ...NUM }}
          >
            {trip.finalAmount === null
              ? '—'
              : `${trip.finalAmount.toLocaleString('ko-KR')}원`}
          </Text>
        )}
      </View>
    </TripCardShell>
  );
}
