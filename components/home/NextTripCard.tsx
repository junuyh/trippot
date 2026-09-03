import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { DestinationBanner } from './DestinationBanner';
import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from './format';
import { HOME_ACCENT, HOME_ACCENT_SOFT, HOME_DANGER, HOME_TRACK } from './palette';
import type { NextTripCardData } from './types';

type Props = {
  trip: NextTripCardData;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 사진 배너 높이. 여행지 이름과 날짜 두 줄이 아래쪽 그라디언트 안에 들어가는 최소값이다. */
const BANNER_HEIGHT = 156;

/**
 * 대표 홈 메인 카드 — 출발이 가장 가까운 여행 하나.
 *
 * 2026-09-03 사진 배너로 바꿨다.
 *   위  랜드마크 사진 + 여행지 · D-Day · 일정        어디로 언제 가는가
 *   아래 흰 바탕 + 금액 · 준비율 · 부족 금액 · CTA    얼마나 준비됐는가
 *
 * ⚠️ 금액을 사진 위에 얹지 않는다. 사진은 밝기가 제각각이라 같은 글자색이
 *    어떤 사진에서는 읽히고 어떤 사진에서는 안 읽힌다. 이 서비스에서 가장
 *    정확히 읽혀야 하는 값이 금액이므로 흰 바탕에 둔다. (CLAUDE.md 9장)
 *    사진 위에는 틀려도 덜 위험한 값 — 여행지 이름과 날짜 — 만 올린다.
 *
 * ⚠️ 사진은 없을 수 있는 값이다. 없으면 DestinationBanner 가 국가 테마
 *    그라디언트와 랜드마크 실루엣으로 대신 채운다. 카드 구조는 그대로다.
 *
 * ⚠️ 항공·숙소 같은 카테고리는 여기서 보여주지 않는다. 여행 상세 홈의 일이다.
 */
export function NextTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);

  const shortage =
    trip.targetAmount === null || trip.currentAmount === null
      ? null
      : Math.max(0, trip.targetAmount - trip.currentAmount);

  const meta = [
    `${dates.start} – ${dates.end}`,
    nights,
    trip.memberCount === null ? null : `${trip.memberCount}명`,
  ].filter(Boolean) as string[];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 보기`}
      onPress={() => onPress(trip.tripId)}
      className="overflow-hidden rounded-3xl bg-white active:opacity-90"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <DestinationBanner
        photoUrl={trip.photoUrl}
        countryKo={trip.countryKo}
        theme={trip.theme}
        height={BANNER_HEIGHT}
      >
        <View className="flex-1 justify-between px-4 py-3.5">
          <View className="flex-row items-start justify-between">
            {/* 반투명 흰 알약. 어떤 사진 위에서도 글자가 뜬다. */}
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#FFFFFF2E' }}>
              <Text
                style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3, color: '#FFFFFF' }}
              >
                NEXT TRIP
              </Text>
            </View>

            {dday ? (
              <View className="rounded-full bg-white px-2.5 py-1">
                <Text className="font-black" style={{ fontSize: 10.5, color: HOME_DANGER, ...NUM }}>
                  {dday}
                </Text>
              </View>
            ) : null}
          </View>

          <View>
            <View className="flex-row items-center">
              <Text
                className="font-black text-white"
                style={{ fontSize: 22, letterSpacing: -0.6 }}
                numberOfLines={1}
              >
                {destination}
              </Text>
              <Text className="ml-2" style={{ fontSize: 16 }}>
                {trip.flag}
              </Text>
            </View>

            <View className="mt-1 flex-row items-center">
              <Ionicons name="calendar-outline" size={12} color="#FFFFFFCC" />
              <Text
                className="ml-1.5"
                style={{ fontSize: 11.5, color: '#FFFFFFE6', ...NUM }}
                numberOfLines={1}
              >
                {meta.join('  ·  ')}
              </Text>
            </View>
          </View>
        </View>
      </DestinationBanner>

      <View className="px-4 pb-3.5 pt-3.5">
        {/* 금액 두 칸 */}
        <View className="flex-row">
          <View className="flex-1">
            <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
              준비된 금액
            </Text>
            <Text
              className="mt-1 font-black text-pot-ink"
              style={{ fontSize: 17, letterSpacing: -0.5, ...NUM }}
            >
              {trip.currentAmount === null
                ? '—'
                : `${trip.currentAmount.toLocaleString('ko-KR')}원`}
            </Text>
          </View>

          <View className="mx-3 w-px self-stretch bg-pot-line" />

          <View className="flex-1">
            <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
              목표 금액
            </Text>
            <Text
              className="mt-1 font-black text-pot-ink"
              style={{ fontSize: 17, letterSpacing: -0.5, ...NUM }}
            >
              {trip.targetAmount === null ? '—' : `${trip.targetAmount.toLocaleString('ko-KR')}원`}
            </Text>
          </View>
        </View>

        {/* 진행률 */}
        <View className="mt-3.5 flex-row items-center">
          <View
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: HOME_TRACK }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, rate ?? 0))}%`,
                backgroundColor: HOME_ACCENT,
              }}
            />
          </View>
          <Text
            className="ml-3 font-black"
            style={{ fontSize: 12, color: rate === null ? '#8B94A2' : HOME_ACCENT, ...NUM }}
          >
            {rate === null ? '목표 미설정' : `${rate}%`}
          </Text>
        </View>

        {/* 부족 금액 + CTA */}
        <View
          className="mt-3 flex-row items-center justify-between rounded-2xl py-1.5 pl-3.5 pr-1.5"
          style={{ backgroundColor: HOME_ACCENT_SOFT }}
        >
          <Text
            className="flex-1 pr-2 font-bold"
            style={{ fontSize: 11.5, color: HOME_ACCENT, ...NUM }}
            numberOfLines={1}
          >
            {shortage === null
              ? '목표 여행자금을 정해보세요'
              : shortage === 0
                ? '목표를 다 채웠어요!'
                : `${shortage.toLocaleString('ko-KR')}원 더 준비하면 돼요!`}
          </Text>

          <View className="flex-row items-center rounded-full bg-pot-ink px-3 py-2">
            <Text className="font-bold text-white" style={{ fontSize: 11.5 }} numberOfLines={1}>
              {`${destination} 보기`}
            </Text>
            <Ionicons name="chevron-forward" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
