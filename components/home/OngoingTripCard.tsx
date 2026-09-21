import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { TRIP_OWNER_TYPE, TRIP_OWNER_TYPE_LABEL } from '@/lib/constants/status';

import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from './format';
import { TripCardShell } from './TripCardShell';
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
 * 가로 티켓이다. 왼쪽 스텁 색과 강조 색은 목적지 국가 테마에서 온다.
 */
export function OngoingTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);
  const ownerLabel =
    trip.ownerType === TRIP_OWNER_TYPE.GROUP
      ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
      : TRIP_OWNER_TYPE_LABEL.PERSONAL;
  const amount =
    trip.currentAmount === null ? '—' : `${trip.currentAmount.toLocaleString('ko-KR')}원`;

  return (
    <TripCardShell
      stubColor={trip.theme.primary}
      stubTextColor={trip.theme.onPrimary}
      stubLabel={trip.airportCode}
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
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
        {dday ? (
          <View
            className="rounded-md px-2 py-1"
            style={{ backgroundColor: trip.theme.primarySoft }}
          >
            <Text
              className="font-black"
              style={{ fontSize: 11, color: trip.theme.primary, ...NUM }}
            >
              {dday}
            </Text>
          </View>
        ) : null}
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

      {/* 스텁이 도착 공항 코드를 이미 보여준다. 여기서는 경로를 반복하지 않는다. */}
      <View className="mt-1 flex-row items-center">
        <Ionicons name="people-outline" size={13} color="#9AA3AE" />
        <Text className="ml-1.5 flex-1 text-pot-mute" style={{ fontSize: 12 }} numberOfLines={1}>
          {ownerLabel}
        </Text>
      </View>

      <View className="my-2.5 border-t border-dashed border-pot-dash" />

      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-pot-faint" style={{ fontSize: 10 }}>
            {/* 결제로 줄지 않는 누적 모금액이다. 여행 홈 카드와 같은 말을 쓴다 */}
            모은 여행자금
          </Text>
          <Text
            className="mt-0.5 font-black text-pot-ink"
            style={{ fontSize: 17, letterSpacing: -0.4, ...NUM }}
          >
            {amount}
          </Text>
        </View>

        {rate === null ? (
          <Text className="text-right text-pot-faint" style={{ fontSize: 10, lineHeight: 14 }}>
            목표를 정하면{'\n'}준비율이 보여요
          </Text>
        ) : (
          <View className="items-end">
            <View className="h-1 w-24 overflow-hidden rounded-full bg-pot-line">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, rate))}%`,
                  backgroundColor: trip.theme.primary,
                }}
              />
            </View>
            <Text
              className="mt-1 font-bold"
              style={{ fontSize: 11, color: trip.theme.primary, ...NUM }}
            >
              {rate}% 준비됨
            </Text>
          </View>
        )}
      </View>
    </TripCardShell>
  );
}
