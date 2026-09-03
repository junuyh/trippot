// ============================================================================
// 1-2. 지난 여행 — 홈 가로 자동 슬라이드 (2026-09-03)
//
// 왜 홈에 있는가
//   docs/03_요구사항정의서_v1.md REQ-HOME-001 은 **Must** 다.
//   "홈에서 진행 중 여행과 종료 여행을 구분해 보여준다."
//   개편 전 홈에는 종료 여행이 없어서 지난 여행을 보려면
//   마이 탭 → MY-01 → MY-02 → 여행 선택, 네 번을 눌러야 했다.
//   docs/09_IA_v2.md §1-2 도 홈에 종료된 여행 카드를 둔다.
//
// 카드 모양은 **탑승권 반쪽**이다. 위에 사진, 절취선, 아래에 국가 색 옅은 톤과 글.
// 여행 준비 홈(TravelTicketCard)이 여정과 자금을 절취선으로 가르는 것과 같은
// 짜임이라, 준비 중인 여행과 다녀온 여행이 같은 물건으로 읽힌다.
// 앞서 우표 스티커·젤리 버튼으로 꾸몄더니 유치하다는 평을 받아 되돌렸다.
//
// 위 '진행 중인 여행' 은 한 장이 화면을 꽉 채우고, 여기는 두 장씩 보인다.
// 크기를 다르게 해서 지금 일과 지난 일을 구분한다.
//
// ⚠️ 카드 바탕색은 그 여행의 국가 색 옅은 톤(countryTheme.primarySoft)이다.
//    카드마다 파스텔을 돌려쓰지 않는다. 그러면 색에 뜻이 없어 알록달록해지기만 한다.
//
// ⚠️ 절취선 노치는 바탕색 원을 얹어 만든다. 홈 바탕이 pot-visual 한 색으로
//    고정이라 가능한 방법이다. **이 카드 뒤 배경색이 바뀌면 노치가 드러난다.**
//    (TravelTicketCard 는 SVG 로 모양을 실제로 잘라낸다. 그쪽이 정석이지만
//     이 작은 카드에 같은 구조를 넣으면 파일이 몇 배로 커진다)
//
// ⚠️ 홈에는 최근 4개만 둔다. 전체 목록은 MY-02(/me/trips)다.
//    홈이 여행 목록 페이지가 되면 안 된다. (CLAUDE.md 2장)
//
// ⚠️ 결산 전(ENDED) 여행은 최종 여행비가 없다. 그 자리에 '결산하기 →' 를 둬서
//    결산을 유도한다. 여행 기간이 끝나면 결산을 유도하는 것은 정책이다.
//    (CLAUDE.md 3장) 개편으로 '지금 챙겨야 할 것' 줄이 사라지면서
//    홈에서 결산을 권할 자리가 여기 하나만 남았다.
// ============================================================================
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { TRIP_OWNER_TYPE, TRIP_OWNER_TYPE_LABEL, TRIP_STATUS } from '@/lib/constants/status';

import { DestinationBanner } from './DestinationBanner';
import { formatNights, formatTripDates } from './format';
import { HOME_CAPTION, HOME_CARD_LINE, HOME_RADIUS } from './palette';
import { SectionHeader } from './SectionHeader';
import type { EndedTripCardData } from './types';
import { useAutoCarousel } from './useAutoCarousel';

type Props = {
  trips: EndedTripCardData[];
  /** 홈에 다 담지 못한 지난 여행이 더 있는가. 있을 때만 '전체 보기' 를 그린다. */
  hasMore: boolean;
  onPressTrip: (tripId: string) => void;
  onPressSettle: (tripId: string) => void;
  onPressSeeAll: () => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const CARD_GAP = 10;
/** 홈 좌우 여백(px-4) 합. */
const SCREEN_PADDING = 32;
/**
 * 화면 안쪽 폭 대비 카드 폭.
 * 두 장이 다 들어오고 세 번째가 살짝 걸쳐서 더 있다는 걸 알린다.
 */
const CARD_RATIO = 0.455;
/** 카드 위 사진 높이. */
const PHOTO_HEIGHT = 104;
/** 절취선 노치 반지름. TravelTicketCard 는 9, 이 카드는 작아서 6이다. */
const NOTCH_R = 6;
/** 홈 바탕(pot-visual). 노치를 이 색으로 뚫는다. */
const PAGE_BG = '#F5F7FA';

export function PastTripCarousel({
  trips,
  hasMore,
  onPressTrip,
  onPressSettle,
  onPressSeeAll,
}: Props) {
  const { width } = useWindowDimensions();
  const innerWidth = Math.max(0, width - SCREEN_PADDING);
  const cardWidth = Math.round(innerWidth * CARD_RATIO);
  const step = cardWidth + CARD_GAP;

  // 카드가 두 장씩 보이므로 마지막 카드까지 스크롤할 수 없다.
  // 더 갈 곳이 없는 자리에서 처음으로 돌아가야 자동 슬라이드가 멈춘 것처럼 보이지 않는다.
  const visibleCount = step > 0 ? Math.max(1, Math.floor((innerWidth + CARD_GAP) / step)) : 1;
  const lastIndex = Math.max(0, trips.length - visibleCount);

  const { ref, handleScroll, handleTouch } = useAutoCarousel({
    count: trips.length,
    step,
    lastIndex,
  });

  return (
    <View>
      <SectionHeader
        title="지난 여행"
        actionLabel={hasMore ? '전체 보기' : undefined}
        onPressAction={hasMore ? onPressSeeAll : undefined}
      />

      {trips.length === 0 ? (
        <View
          className="border border-dashed bg-white px-4 py-5"
          style={{ borderColor: '#cdd2d8', borderRadius: HOME_RADIUS.card }}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: HOME_CAPTION }}>
            아직 다녀온 여행이 없어요.{'\n'}여행이 끝나면 여기에 쌓여요.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollBeginDrag={handleTouch}
          onScrollEndDrag={handleTouch}
          scrollEventThrottle={16}
          snapToInterval={step}
          decelerationRate="fast"
          contentContainerStyle={{ gap: CARD_GAP, paddingVertical: 4 }}
        >
          {trips.map((trip) => (
            <StubTripCard
              key={trip.tripId}
              trip={trip}
              width={cardWidth}
              onPress={onPressTrip}
              onPressSettle={onPressSettle}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function StubTripCard({
  trip,
  width,
  onPress,
  onPressSettle,
}: {
  trip: EndedTripCardData;
  width: number;
  onPress: (tripId: string) => void;
  onPressSettle: (tripId: string) => void;
}) {
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 지난 여행 보기`}
      onPress={() => onPress(trip.tripId)}
      className="bg-white active:opacity-80"
      style={{
        width,
        borderRadius: HOME_RADIUS.guide,
        borderWidth: 1,
        borderColor: HOME_CARD_LINE,
        // 노치가 카드 밖으로 반쯤 나가야 파인 것처럼 보인다.
        overflow: 'visible',
      }}
    >
      {/* 사진. 카드 위 모서리만 둥글다. */}
      <View
        style={{
          borderTopLeftRadius: HOME_RADIUS.guide - 1,
          borderTopRightRadius: HOME_RADIUS.guide - 1,
          overflow: 'hidden',
        }}
      >
        {/* 글자를 얹지 않는 사진이라 어두운 그라디언트를 끈다. */}
        <DestinationBanner
          photoUrl={trip.photoUrl}
          countryKo={trip.countryKo}
          theme={trip.theme}
          height={PHOTO_HEIGHT}
          scrim={false}
        />
      </View>

      {/* 절취선. 사진과 글 사이를 탑승권처럼 가른다. */}
      <View className="flex-row items-center" style={{ height: NOTCH_R * 2 }}>
        <View
          style={{
            position: 'absolute',
            left: -NOTCH_R,
            width: NOTCH_R * 2,
            height: NOTCH_R * 2,
            borderRadius: NOTCH_R,
            backgroundColor: PAGE_BG,
          }}
        />
        <View
          className="flex-1 border-t border-dashed"
          style={{ marginHorizontal: NOTCH_R + 3, borderColor: '#dfe3e8' }}
        />
        <View
          style={{
            position: 'absolute',
            right: -NOTCH_R,
            width: NOTCH_R * 2,
            height: NOTCH_R * 2,
            borderRadius: NOTCH_R,
            backgroundColor: PAGE_BG,
          }}
        />
      </View>

      <View
        className="px-3 pb-3 pt-0.5"
        style={{
          backgroundColor: trip.theme.primarySoft,
          borderBottomLeftRadius: HOME_RADIUS.guide - 1,
          borderBottomRightRadius: HOME_RADIUS.guide - 1,
        }}
      >
        <View className="flex-row items-center">
          <Text
            className="flex-1 text-pot-ink"
            style={{ fontSize: 14, fontWeight: '800', letterSpacing: -0.4 }}
            numberOfLines={1}
          >
            {destination}
          </Text>
          <Text
            className="ml-1 font-black"
            style={{ fontSize: 9, color: trip.theme.primary, letterSpacing: 0.8 }}
          >
            {trip.airportCode}
          </Text>
        </View>

        <Text
          className="mt-1"
          style={{ fontSize: 10, lineHeight: 14, color: HOME_CAPTION, ...NUM }}
          numberOfLines={1}
        >
          {`${dates.start} – ${dates.end}${nights ? `  ·  ${nights}` : ''}`}
        </Text>
        <Text
          style={{ fontSize: 10, lineHeight: 14, color: '#858e9c' }}
          numberOfLines={1}
        >
          {ownerLabel}
        </Text>

        <View className="mt-2">
          {beforeSettlement ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${destination} 결산하기`}
              onPress={() => onPressSettle(trip.tripId)}
              hitSlop={6}
              className="active:opacity-60"
            >
              <Text style={{ fontSize: 10, fontWeight: '900', color: trip.theme.primary }}>
                결산하기 →
              </Text>
            </Pressable>
          ) : (
            <Text
              className="text-pot-ink"
              style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: -0.3, ...NUM }}
              numberOfLines={1}
            >
              {trip.finalAmount === null ? '—' : `${trip.finalAmount.toLocaleString('ko-KR')}원`}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
