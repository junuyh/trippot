import { Pressable, ScrollView, Text, View } from 'react-native';

import { calcReadyRatePercent, formatDDay, formatTripDates } from './format';
import { SectionHeader } from './SectionHeader';
import type { OngoingTripCardData } from './types';

type Props = {
  trips: OngoingTripCardData[];
  /** 진행 중 여행이 없을 때 문구를 고르는 값. (docs/03 REQ-HOME-002) */
  emptyVariant: 'first' | 'return';
  onPressTrip: (tripId: string) => void;
  onPressSeeAll: () => void;
  onPressCreateTrip: () => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 카드 한 장 폭. 다음 카드가 살짝 보여서 옆으로 넘길 수 있다는 걸 알린다. */
const CARD_WIDTH = 190;

/**
 * 진행 중인 여행 — 가로 스크롤.
 *
 * 세로로 길게 쌓으면 홈이 여행 목록 페이지가 된다.
 * 카드에는 최소 정보만 둔다. 자세한 건 여행 상세 홈에서 본다.
 */
export function OngoingTripCarousel({
  trips,
  emptyVariant,
  onPressTrip,
  onPressSeeAll,
  onPressCreateTrip,
}: Props) {
  return (
    <View>
      <SectionHeader
        title="진행 중인 여행"
        actionLabel={trips.length > 0 ? '전체 보기' : undefined}
        onPressAction={trips.length > 0 ? onPressSeeAll : undefined}
      />

      {trips.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 여행 만들기"
          onPress={onPressCreateTrip}
          className="items-center rounded-2xl border border-dashed border-pot-dash bg-white px-4 py-6 active:opacity-70"
        >
          <Text className="text-pot-mute" style={{ fontSize: 13, lineHeight: 19 }}>
            {emptyVariant === 'first'
              ? '아직 만든 여행이 없어요. 첫 여행을 만들어보세요.'
              : '진행 중인 여행이 없어요. 다음 여행을 계획해보세요.'}
          </Text>
          <Text className="mt-2 font-bold text-pot-ink" style={{ fontSize: 13 }}>
            + 여행 만들기
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // 카드 그림자가 잘리지 않게 위아래로 여유를 준다.
          contentContainerStyle={{ gap: 10, paddingRight: 20, paddingVertical: 2 }}
        >
          {trips.map((trip) => (
            <MiniTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** 가로 스크롤 한 장. 여행지 · D-Day · 기간 · 준비금액 · 준비율만 보여준다. */
function MiniTripCard({
  trip,
  onPress,
}: {
  trip: OngoingTripCardData;
  onPress: (tripId: string) => void;
}) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);
  const current = trip.currentAmount === null ? '—' : trip.currentAmount.toLocaleString('ko-KR');
  const target = trip.targetAmount === null ? '—' : trip.targetAmount.toLocaleString('ko-KR');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="rounded-2xl border border-pot-line bg-white px-3.5 py-3 active:opacity-80"
      style={{ width: CARD_WIDTH }}
    >
      <View className="flex-row items-center">
        <Text style={{ fontSize: 14 }}>{trip.flag}</Text>
        <Text
          className="ml-1.5 flex-1 font-bold text-pot-ink"
          style={{ fontSize: 14, letterSpacing: -0.3 }}
          numberOfLines={1}
        >
          {destination}
        </Text>
      </View>

      <View className="mt-1.5 flex-row items-center">
        {dday ? (
          <View className="rounded-md px-1.5 py-0.5" style={{ backgroundColor: trip.theme.primarySoft }}>
            <Text className="font-black" style={{ fontSize: 10, color: trip.theme.primary, ...NUM }}>
              {dday}
            </Text>
          </View>
        ) : null}
        <Text className="ml-1.5 text-pot-faint" style={{ fontSize: 11, ...NUM }}>
          {dates.start} – {dates.end}
        </Text>
      </View>

      <Text className="mt-2.5 text-pot-faint" style={{ fontSize: 10 }}>
        준비금액
      </Text>
      <Text className="mt-0.5 text-pot-ink" style={{ fontSize: 12.5, ...NUM }}>
        <Text className="font-black">{current}원</Text>
        <Text className="text-pot-faint"> / {target}원</Text>
      </Text>

      <View className="mt-2 h-1 overflow-hidden rounded-full bg-pot-visual">
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, rate ?? 0))}%`,
            backgroundColor: trip.theme.primary,
          }}
        />
      </View>
      <Text
        className="mt-1 font-bold"
        style={{ fontSize: 10.5, color: rate === null ? '#8B94A2' : trip.theme.primary, ...NUM }}
      >
        {rate === null ? '목표 미설정' : `${rate}%`}
      </Text>
    </Pressable>
  );
}
