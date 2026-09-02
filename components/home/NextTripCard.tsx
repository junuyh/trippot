import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { calcReadyRatePercent, formatAmount, formatDDay, formatNights, formatTripDates } from './format';
import type { NextTripCardData } from './types';

type Props = {
  trip: NextTripCardData;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 절취선 구멍 개수. 티켓처럼 보이게 하는 장치다. */
const PERFORATIONS = 16;

/**
 * 대표 홈 메인 카드 — 출발이 가장 가까운 여행 하나.
 *
 * 여행 상세(TRIP-HOME-01)의 티켓 디자인 언어를 축약해서 가져왔다.
 * 위 칸은 국가 색, 아래 칸은 흰 바탕이고 그 사이를 절취선이 가른다.
 *
 * 주의: 항공·숙소 같은 카테고리는 여기서 보여주지 않는다.
 *       그건 여행 상세 홈의 일이다. 대표 홈에서 반복하면 두 화면의 역할이 겹친다.
 */
export function NextTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);

  // 부족 금액. 목표를 정하지 않았거나 이미 다 모았으면 안내 문구를 바꾼다.
  const shortage =
    trip.targetAmount === null || trip.currentAmount === null
      ? null
      : Math.max(0, trip.targetAmount - trip.currentAmount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 보기`}
      onPress={() => onPress(trip.tripId)}
      className="overflow-hidden rounded-3xl active:opacity-90"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {/* 윗칸 — 국가 색 */}
      <View className="px-5 pb-5 pt-4" style={{ backgroundColor: trip.theme.primary }}>
        <View className="flex-row items-center justify-between">
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.8,
              color: trip.theme.onPrimary,
              opacity: 0.75,
            }}
          >
            NEXT TRIP
          </Text>
          {dday ? (
            <View className="rounded-full bg-white/25 px-2.5 py-1">
              <Text
                className="font-black"
                style={{ fontSize: 11, color: trip.theme.onPrimary, ...NUM }}
              >
                {dday}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-2.5 flex-row items-center">
          <Text style={{ fontSize: 22 }}>{trip.flag}</Text>
          <Text
            className="ml-2 flex-1 font-black"
            style={{ fontSize: 22, letterSpacing: -0.6, color: trip.theme.onPrimary }}
            numberOfLines={1}
          >
            {destination}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '900',
              letterSpacing: 1.2,
              color: trip.theme.onPrimary,
              opacity: 0.8,
            }}
          >
            {trip.airportCode}
          </Text>
        </View>

        <View className="mt-1.5 flex-row items-center">
          <Text style={{ fontSize: 12.5, color: trip.theme.onPrimary, opacity: 0.85, ...NUM }}>
            {dates.start} – {dates.end}
          </Text>
          {nights ? (
            <Text style={{ fontSize: 12.5, color: trip.theme.onPrimary, opacity: 0.6 }}>
              {`  ·  ${nights}`}
            </Text>
          ) : null}
          {trip.memberCount !== null ? (
            <Text style={{ fontSize: 12.5, color: trip.theme.onPrimary, opacity: 0.6, ...NUM }}>
              {`  ·  ${trip.memberCount}명`}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 절취선 */}
      <View className="flex-row items-center justify-between bg-white px-3" style={{ height: 12 }}>
        {Array.from({ length: PERFORATIONS }).map((_, index) => (
          <View key={index} className="h-[2px] w-2 rounded-full bg-pot-line" />
        ))}
      </View>

      {/* 아랫칸 — 여행자금 */}
      <View className="bg-white px-5 pb-5">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-pot-faint" style={{ fontSize: 11 }}>
              준비된 여행자금
            </Text>
            <Text
              className="mt-1 font-black text-pot-ink"
              style={{ fontSize: 24, letterSpacing: -0.8, ...NUM }}
            >
              {formatAmount(trip.currentAmount)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-pot-faint" style={{ fontSize: 11 }}>
              목표 여행자금
            </Text>
            <Text className="mt-1 font-bold text-pot-mute" style={{ fontSize: 14, ...NUM }}>
              {formatAmount(trip.targetAmount)}
            </Text>
          </View>
        </View>

        {rate === null ? (
          <Text className="mt-3 text-pot-mute" style={{ fontSize: 13 }}>
            목표 여행자금을 정하면 준비율을 볼 수 있어요.
          </Text>
        ) : (
          <>
            <View className="mt-3 h-2 overflow-hidden rounded-full bg-pot-visual">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, rate))}%`,
                  backgroundColor: trip.theme.primary,
                }}
              />
            </View>

            <View className="mt-2 flex-row items-center justify-between">
              <Text
                className="font-black"
                style={{ fontSize: 13, color: trip.theme.primary, ...NUM }}
              >
                {rate}%
              </Text>
              <Text className="text-pot-mute" style={{ fontSize: 12.5, ...NUM }}>
                {shortage === null || shortage === 0
                  ? '목표를 다 채웠어요'
                  : `${shortage.toLocaleString('ko-KR')}원 더 준비하면 돼요`}
              </Text>
            </View>
          </>
        )}

        {/* CTA */}
        <View className="mt-4 flex-row items-center justify-center rounded-xl bg-pot-ink py-3.5">
          <Text className="font-bold text-white" style={{ fontSize: 14 }}>
            {`${destination} 보기`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
      </View>
    </Pressable>
  );
}
