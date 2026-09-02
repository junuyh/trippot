import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from '@/components/home/format';
import { HOME_TRACK } from '@/components/home/palette';
import { TRIP_STATUS } from '@/lib/constants/status';

import type { MyTripItem } from './types';

type Props = {
  trip: MyTripItem;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 왼쪽 색 띠. 홈의 가로 카드와 같은 규칙이라 두 화면이 한 벌로 보인다. */
const STRIPE = 4;
/** 지난 여행은 색을 죽인다. */
const MUTED = '#B6BCC6';

/**
 * MY-02 목록의 여행 한 장.
 *
 * 진행 중이면 준비율까지, 지난 여행이면 최종 여행비까지 보여준다.
 * 카드 모양·색 규칙은 홈의 가로 카드를 그대로 따른다.
 */
export function MyTripCard({ trip, onPress }: Props) {
  const past = trip.status === TRIP_STATUS.ENDED || trip.status === TRIP_STATUS.SETTLED;
  const accent = past ? MUTED : trip.color;

  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="flex-row overflow-hidden rounded-2xl bg-white active:opacity-80"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View style={{ width: STRIPE, backgroundColor: accent }} />

      <View className="flex-1 px-4 py-3.5">
        <View className="flex-row items-center">
          <Text
            className="flex-1 font-black text-pot-ink"
            style={{ fontSize: 14.5, letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {destination} {trip.flag}
          </Text>

          {past ? (
            <View className="rounded-full bg-pot-visual px-2 py-0.5">
              <Text className="font-bold text-pot-mute" style={{ fontSize: 10 }}>
                {trip.status === TRIP_STATUS.SETTLED ? '결산 완료' : '결산 전'}
              </Text>
            </View>
          ) : dday ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: trip.colorSoft }}>
              <Text className="font-black" style={{ fontSize: 10, color: trip.color, ...NUM }}>
                {dday}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-center">
          <Ionicons name="calendar-outline" size={11} color="#9AA3AE" />
          <Text className="ml-1 text-pot-faint" style={{ fontSize: 11, ...NUM }} numberOfLines={1}>
            {`${dates.start} – ${dates.end}${nights ? `  ·  ${nights}` : ''}`}
          </Text>
          <Text className="mx-1.5 text-pot-line" style={{ fontSize: 11 }}>
            ·
          </Text>
          <Text className="flex-1 text-pot-faint" style={{ fontSize: 11 }} numberOfLines={1}>
            {trip.ownerLabel}
          </Text>
        </View>

        {past ? (
          <View className="mt-2.5 flex-row items-end justify-between">
            <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
              최종 여행비
            </Text>
            <Text className="font-black text-pot-ink" style={{ fontSize: 13, ...NUM }}>
              {trip.finalAmount === null
                ? '결산 전'
                : `${trip.finalAmount.toLocaleString('ko-KR')}원`}
            </Text>
          </View>
        ) : (
          <>
            <Text className="mt-2.5 text-pot-ink" style={{ fontSize: 12, ...NUM }} numberOfLines={1}>
              <Text className="font-black">
                {trip.currentAmount === null ? '—' : trip.currentAmount.toLocaleString('ko-KR')}원
              </Text>
              <Text className="text-pot-faint">
                {' / '}
                {trip.targetAmount === null ? '—' : trip.targetAmount.toLocaleString('ko-KR')}원
              </Text>
            </Text>

            <View className="mt-2 flex-row items-center">
              <View
                className="h-1 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: HOME_TRACK }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, rate ?? 0))}%`,
                    backgroundColor: accent,
                  }}
                />
              </View>
              <Text
                className="ml-2 font-black"
                style={{ fontSize: 10.5, color: rate === null ? '#8B94A2' : accent, ...NUM }}
              >
                {rate === null ? '목표 미설정' : `${rate}%`}
              </Text>
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}
