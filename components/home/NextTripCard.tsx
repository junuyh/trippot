import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from './format';
import {
  HOME_ACCENT,
  HOME_ACCENT_SOFT,
  HOME_DANGER,
  HOME_DANGER_SOFT,
  HOME_TRACK,
} from './palette';
import type { NextTripCardData } from './types';

type Props = {
  trip: NextTripCardData;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 왼쪽 가장자리에 파인 반원. 티켓처럼 보이게 하는 장치다. */
const NOTCH = 10;
const NOTCH_COUNT = 4;
/** 오른쪽 일러스트 크기. 이 값만큼 위쪽 글자에 오른쪽 여백을 준다. */
const ART = 112;

/**
 * 대표 홈 메인 카드 — 출발이 가장 가까운 여행 하나.
 *
 * 카드는 흰 바탕이고 색은 세 곳에만 쓴다.
 *   NEXT TRIP·D-Day  빨강   지금 챙길 일이라는 신호
 *   진행률·부족 금액  보라   서비스 대표 색
 *   그 외            무채색
 *
 * ⚠️ 항공·숙소 같은 카테고리는 여기서 보여주지 않는다. 여행 상세 홈의 일이다.
 * ⚠️ 왼쪽 반원은 바탕색(pot-visual) 동그라미를 얹어 만든다.
 *    이 카드 뒤 배경이 흰색으로 바뀌면 반원이 사라지니 함께 확인해야 한다.
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
      className="rounded-3xl bg-white px-4 pb-3.5 pt-4 active:opacity-90"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {/* 왼쪽 절취 반원 */}
      <View
        pointerEvents="none"
        className="absolute bottom-8 top-8 justify-between"
        style={{ left: -NOTCH / 2, width: NOTCH }}
      >
        {Array.from({ length: NOTCH_COUNT }).map((_, index) => (
          <View
            key={index}
            className="rounded-full bg-pot-visual"
            style={{ width: NOTCH, height: NOTCH }}
          />
        ))}
      </View>

      {/* 오른쪽 일러스트. 글자를 가리지 않게 위쪽 줄에 오른쪽 여백을 준다. */}
      <Image
        source={require('@/assets/home/next-trip.png')}
        style={{ position: 'absolute', right: 0, top: 24, width: ART, height: ART }}
        resizeMode="contain"
        // 장식이다. 화면 낭독기가 읽을 내용이 없다.
        accessible={false}
      />

      <View className="flex-row items-start justify-between">
        <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.3, color: HOME_DANGER }}>
          NEXT TRIP
        </Text>
        {dday ? (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: HOME_DANGER_SOFT }}>
            <Text className="font-black" style={{ fontSize: 10, color: HOME_DANGER, ...NUM }}>
              {dday}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-1.5 flex-row items-center" style={{ paddingRight: ART - 22 }}>
        <Text
          className="font-black text-pot-ink"
          style={{ fontSize: 18.5, letterSpacing: -0.6 }}
          numberOfLines={1}
        >
          {destination}
        </Text>
        <Text className="ml-1.5" style={{ fontSize: 15 }}>
          {trip.flag}
        </Text>
      </View>

      <Text
        className="mt-1 text-pot-mute"
        style={{ fontSize: 11.5, paddingRight: ART - 22, ...NUM }}
        numberOfLines={1}
      >
        {meta.join('  ·  ')}
      </Text>

      {/* 금액 두 칸 */}
      <View className="mt-3.5 flex-row" style={{ paddingRight: ART - 40 }}>
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
    </Pressable>
  );
}
