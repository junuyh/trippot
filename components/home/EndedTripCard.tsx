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

/** 지난 여행 스텁은 국가 색을 쓰지 않는다. 이미 끝난 여행이다. */
const MUTED_STUB = '#B6BCC6';

/**
 * 1-2. 종료된 여행 카드. (docs/09_IA_v1.md §1)
 * 여행지 · 여행 기간 · 개인/모임명 · 최종 여행비
 *
 * 대표 여행 유형 이미지·라벨은 [고도화](9/07~)라 그리지 않는다.
 * 진행 중 카드와 같은 가로 티켓이되 스텁을 회색으로 둔다.
 */
export function EndedTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;
  // 금액이 없으면 빈칸으로 둔다. '—' 는 값이 있는데 비어 보이게 한다 (2026-09-21 2차)
  const amount =
    trip.finalAmount === null ? '' : `${trip.finalAmount.toLocaleString('ko-KR')}원`;

  // ENDED 는 아직 결산 전이라 최종 여행비가 확정되지 않았다.
  const beforeSettlement = trip.status === TRIP_STATUS.ENDED && trip.finalAmount === null;

  return (
    <TripCardShell
      muted
      stubColor={MUTED_STUB}
      stubTextColor="#FFFFFF"
      stubLabel={trip.airportCode}
      accessibilityLabel={`${destination} 지난 여행 보기`}
      onPress={() => onPress(trip.tripId)}
    >
      <View className="flex-row items-start justify-between">
        <Text
          className="flex-1 pr-2 font-bold text-pot-ink"
          style={{ fontSize: 16, letterSpacing: -0.3 }}
          numberOfLines={1}
        >
          {destination}
        </Text>
        <Text className="text-pot-faint" style={{ fontSize: 11 }}>
          {ownerLabel}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center">
        <Ionicons name="calendar-outline" size={13} color="#9AA3AE" />
        <Text className="ml-1.5 text-pot-mute" style={{ fontSize: 12, ...NUM }}>
          {dates.start} – {dates.end}
        </Text>
        {nights ? (
          <>
            <Text className="mx-1.5 text-pot-line" style={{ fontSize: 12 }}>
              ·
            </Text>
            <Text className="text-pot-faint" style={{ fontSize: 12 }}>
              {nights}
            </Text>
          </>
        ) : null}
      </View>

      <View className="my-2.5 border-t border-dashed border-pot-dash" />

      <View className="flex-row items-end justify-between">
        <Text className="text-pot-faint" style={{ fontSize: 10 }}>
          최종 여행비
        </Text>
        {beforeSettlement ? (
          <Text className="font-bold text-pot-mute" style={{ fontSize: 12 }}>
            결산 전
          </Text>
        ) : (
          <Text
            className="font-black text-pot-ink"
            style={{ fontSize: 16, letterSpacing: -0.4, ...NUM }}
          >
            {amount}
          </Text>
        )}
      </View>
    </TripCardShell>
  );
}
