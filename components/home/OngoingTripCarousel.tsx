// ============================================================================
// 1-1. 진행 중인 여행 — 화면 폭을 꽉 채우는 사진 배너를 한 장씩 넘긴다.
//
// 2026-09-03 여행 준비 홈(TRIP-HOME-01)의 디자인 언어에 맞춰 다시 잡았다.
// 앞서 스티커·반짝이·젤리 버튼으로 꾸몄더니 유치하다는 평을 받았다.
// 같은 서비스 안에서 홈만 장난감처럼 보이면 안 된다.
//
// 가져온 것
//   · 보딩패스 모서리(18)
//   · 출발 → 도착 공항 코드 표기 (TravelTicketCard 의 FROM/TO)
//   · **비행기 위치 = 준비율** (RouteProgress). 막대 그래프를 쓰지 않는다
//   · 납작한 흰 칩. 기울기·테두리·그림자 없는 배지
//
// ⚠️ 글자를 전부 사진 위에 얹는다. 그래서 카드에 금액을 두지 않았다.
//    사진마다 밝기가 달라 흰 글자가 읽히는 정도가 제각각인데,
//    이 서비스에서 가장 정확히 읽혀야 하는 값이 금액이다.
//    준비 상태는 항로 위 비행기 위치와 퍼센트 한 값으로만 알린다.
//
// ⚠️ [문서와 어긋남] docs/09_IA_v2.md §1-1 은 여행 카드에
//    '현재 여행자금 / 목표 여행비' 를 두라고 적고 있다. 두 금액을 빼고
//    준비율만 남겼다. 홈을 금액 화면으로 만들지 않기 위한 판단이고,
//    두 금액은 여행 준비 홈에서 그대로 볼 수 있다.
//    문서를 임의로 고치지 않았다. (CLAUDE.md 1-1)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { DestinationBanner } from './DestinationBanner';
import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from './format';
import { HOME_CAPTION, HOME_CARD_LINE, HOME_RADIUS } from './palette';
import { RouteProgress } from './RouteProgress';
import { SectionHeader } from './SectionHeader';
import type { OngoingTripCardData } from './types';
import { useAutoCarousel } from './useAutoCarousel';

type Props = {
  trips: OngoingTripCardData[];
  /** 진행 중 여행이 없을 때 문구를 고르는 값. (docs/03 REQ-HOME-002) */
  emptyVariant: 'first' | 'return';
  onPressTrip: (tripId: string) => void;
  onPressCreateTrip: () => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 카드 사이 간격. */
const CARD_GAP = 12;
/** 홈 좌우 여백(px-4) 합. 카드 폭을 화면 폭에서 이만큼 뺀다. */
const SCREEN_PADDING = 32;
/** 카드 높이. */
const CARD_HEIGHT = 196;
/** 카드 안쪽 좌우 여백. 항로 선 폭을 여기서 계산한다. */
const CARD_INSET = 16;
/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. (destinations.ts 기준 전제) */
const ORIGIN_CODE = 'ICN';

export function OngoingTripCarousel({
  trips,
  emptyVariant,
  onPressTrip,
  onPressCreateTrip,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(0, width - SCREEN_PADDING);

  // 한 장씩 꽉 차므로 마지막 장이 그대로 끝이다.
  const { ref, page, handleScroll, handleTouch } = useAutoCarousel({
    count: trips.length,
    step: cardWidth + CARD_GAP,
  });

  return (
    <View>
      {/* 진행 중 여행은 여기서 전부 보여준다. 따로 '전체 보기' 를 둘 이유가 없다. */}
      <SectionHeader title="준비 중인 여행" />

      {trips.length === 0 ? (
        <EmptyCard variant={emptyVariant} onPress={onPressCreateTrip} />
      ) : (
        <>
          <ScrollView
            ref={ref}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onScrollBeginDrag={handleTouch}
            onScrollEndDrag={handleTouch}
            scrollEventThrottle={16}
            // 한 장씩 딱 멈추게 한다. 카드가 화면보다 좁아서 pagingEnabled 로는 안 맞는다.
            snapToInterval={cardWidth + CARD_GAP}
            decelerationRate="fast"
            // 카드 그림자가 잘리지 않게 위아래로 여유를 준다.
            contentContainerStyle={{ gap: CARD_GAP, paddingVertical: 4 }}
          >
            {trips.map((trip) => (
              <TripBanner key={trip.tripId} trip={trip} width={cardWidth} onPress={onPressTrip} />
            ))}
          </ScrollView>

          {trips.length > 1 ? <Dots count={trips.length} page={page} /> : null}
        </>
      )}
    </View>
  );
}

/**
 * 몇 장이 더 있는지 알리는 점.
 *
 * 지금 장만 잉크색 짧은 막대다. trip-home 여정 단계가 지나온 칸을 잉크로
 * 채우는 것과 같은 방식이라 두 화면의 표시가 따로 놀지 않는다.
 */
function Dots({ count, page }: { count: number; page: number }) {
  return (
    <View className="mt-3 flex-row items-center justify-center">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index === page ? 14 : 5,
            height: 5,
            marginHorizontal: 2.5,
            borderRadius: 999,
            backgroundColor: index === page ? '#111827' : '#d1d5db',
          }}
        />
      ))}
    </View>
  );
}

/** 진행 중 여행이 없을 때. trip-home 금고의 '미설정' 칸과 같은 점선 테두리다. */
function EmptyCard({ variant, onPress }: { variant: 'first' | 'return'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="새 여행 만들기"
      onPress={onPress}
      className="items-center border border-dashed bg-white px-4 py-6 active:opacity-80"
      style={{ borderColor: '#cdd2d8', borderRadius: HOME_RADIUS.card }}
    >
      <Ionicons name="airplane-outline" size={22} color="#98a1ad" />
      <Text
        className="mt-2.5 text-center"
        style={{ fontSize: 12, lineHeight: 18, color: HOME_CAPTION }}
      >
        {variant === 'first'
          ? '아직 만든 여행이 없어요.\n첫 여행을 만들어보세요.'
          : '준비 중인 여행이 없어요.\n다음 여행을 계획해보세요.'}
      </Text>
      <Text className="mt-2.5" style={{ fontSize: 10, fontWeight: '900', color: '#2a5caa' }}>
        새 여행 만들기 →
      </Text>
    </Pressable>
  );
}

/**
 * 사진 배너 한 장. 보딩패스의 표기를 사진 위로 옮긴 것이다.
 *
 *   왼쪽 위    ICN ✈ NRT
 *   오른쪽 위  D-Day
 *   왼쪽 아래  여행지 / 일정
 *   맨 아래    항로선 위 비행기(= 준비율) + 퍼센트
 */
function TripBanner({
  trip,
  width,
  onPress,
}: {
  trip: OngoingTripCardData;
  width: number;
  onPress: (tripId: string) => void;
}) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);

  // 퍼센트 글자가 오른쪽에 붙으므로 그만큼 항로선을 줄인다.
  const routeWidth = Math.max(0, width - CARD_INSET * 2 - 52);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="overflow-hidden active:opacity-90"
      style={{
        width,
        borderRadius: HOME_RADIUS.ticket,
        shadowColor: '#111827',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
        elevation: 3,
      }}
    >
      <DestinationBanner
        photoUrl={trip.photoUrl}
        countryKo={trip.countryKo}
        theme={trip.theme}
        height={CARD_HEIGHT}
      >
        <View className="flex-1 justify-between" style={{ padding: CARD_INSET }}>
          <View className="flex-row items-center justify-between">
            {/* 보딩패스의 FROM · TO. 반투명 검정이라 어떤 사진 위에서도 글자가 뜬다. */}
            <View
              className="flex-row items-center rounded-md px-2 py-1"
              style={{ backgroundColor: '#00000047' }}
            >
              <Text
                className="font-black text-white"
                style={{ fontSize: 10.5, letterSpacing: 1 }}
              >
                {ORIGIN_CODE}
              </Text>
              <Ionicons
                name="airplane"
                size={10}
                color="#FFFFFF"
                style={{ marginHorizontal: 5 }}
              />
              <Text
                className="font-black text-white"
                style={{ fontSize: 10.5, letterSpacing: 1 }}
              >
                {trip.airportCode}
              </Text>
            </View>

            {dday ? (
              <View className="rounded-md bg-white px-2 py-1">
                <Text
                  className="font-black"
                  style={{ fontSize: 10.5, color: trip.theme.primary, ...NUM }}
                >
                  {dday}
                </Text>
              </View>
            ) : null}
          </View>

          <View>
            <View className="flex-row items-center">
              <Text
                className="text-white"
                style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}
                numberOfLines={1}
              >
                {destination}
              </Text>
              <Text className="ml-1.5" style={{ fontSize: 14 }}>
                {trip.flag}
              </Text>
            </View>

            <Text
              className="mt-1"
              style={{ fontSize: 11, color: '#FFFFFFCC', ...NUM }}
              numberOfLines={1}
            >
              {`${dates.start} – ${dates.end}${nights ? `  ·  ${nights}` : ''}`}
            </Text>

            {/* 준비율. 비행기가 항로 위 어디쯤 왔는지로 보여준다. */}
            <View className="mt-2.5 flex-row items-center">
              <RouteProgress rate={rate} width={routeWidth} />
              <Text
                className="ml-2 font-black text-white"
                style={{ fontSize: 10.5, ...NUM }}
                numberOfLines={1}
              >
                {rate === null ? '목표 미설정' : `${rate}%`}
              </Text>
            </View>
          </View>
        </View>
      </DestinationBanner>

      {/* 사진 아래 얇은 테두리. 카드가 배경에서 뜨지 않고 얹힌 느낌을 준다. */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-0 right-0 top-0"
        style={{
          borderRadius: HOME_RADIUS.ticket,
          borderWidth: 1,
          borderColor: HOME_CARD_LINE,
          opacity: 0.35,
        }}
      />
    </Pressable>
  );
}
