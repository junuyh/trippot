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
 * 항공권 검색 결과 카드 구조다.
 *   윗줄   국기 뱃지 · 여행지 · 개인/모임명 | 기간
 *   가운데 출발일 → 도착일 (가장 큰 숫자) · 공항 코드
 *   점선 아래  D-Day | 준비율 배지 · 현재 여행자금
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

  return (
    <TripCardShell
      accentColor={trip.theme.primary}
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
    >
      {/* 윗줄 */}
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

      {/* 가운데 — 출발일 → 도착일 */}
      <View className="mt-4 flex-row items-center">
        <View className="flex-1">
          <Text
            className="font-bold text-pot-ink"
            style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.5, ...NUM }}
          >
            {dates.start}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Ionicons name="arrow-up-circle-outline" size={14} color="#2E3A47" />
            <Text className="ml-1 text-pot-ink" style={{ fontSize: 12.5 }} numberOfLines={1}>
              ICN (서울)
            </Text>
          </View>
        </View>

        <Ionicons name="airplane" size={17} color="#2E3A47" style={{ marginHorizontal: 6 }} />

        <View className="flex-1 items-end">
          <Text
            className="font-bold text-pot-ink"
            style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.5, ...NUM }}
          >
            {dates.end}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Ionicons name="arrow-down-circle-outline" size={14} color="#2E3A47" />
            <Text className="ml-1 text-pot-ink" style={{ fontSize: 12.5 }} numberOfLines={1}>
              {trip.airportCode} ({destination})
            </Text>
          </View>
        </View>
      </View>

      {/* 점선 */}
      <View className="my-3.5 border-t border-dashed border-pot-dash" />

      {/* 아랫줄 */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={15} color="#9AA3AE" />
          <Text className="ml-1.5 text-pot-faint" style={{ fontSize: 13 }}>
            {dday ?? '일정 미정'}
          </Text>
        </View>

        <View className="flex-row items-center">
          {rate !== null ? (
            <View
              className="mr-2 rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: trip.theme.primarySoft }}
            >
              <Text
                className="font-bold"
                style={{ fontSize: 12, color: trip.theme.primary, ...NUM }}
              >
                {rate}%
              </Text>
            </View>
          ) : null}
          <Text
            className="font-bold text-pot-ink"
            style={{ fontSize: 17, letterSpacing: -0.3, ...NUM }}
          >
            {trip.currentAmount === null
              ? '—'
              : `${trip.currentAmount.toLocaleString('ko-KR')}원`}
          </Text>
        </View>
      </View>

      {rate === null ? (
        <Text className="mt-2 text-pot-faint" style={{ fontSize: 11, lineHeight: 15 }}>
          목표 여행비와 여행자금을 등록하면 준비율을 볼 수 있어요.
        </Text>
      ) : null}
    </TripCardShell>
  );
}
