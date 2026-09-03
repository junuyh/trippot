// ============================================================================
// 1-1. 준비 중인 여행 — 화면 폭을 꽉 채우는 보딩패스를 한 장씩 넘긴다.
//
// 2026-09-03 사진 배너 → 보딩패스 → 여권 지갑을 거쳐, 값만 남긴 지금 모양이 됐다.
// 여행 준비 홈(TRIP-HOME-01)의 새 시안과 같은 물건으로 보여야 한다.
// 홈에서 카드를 누르면 그 화면으로 가는데, 둘이 다르게 생기면 이어지지 않는다.
// 카드 한 장의 생김새는 NextTripBanner 에 있다.
//
// ⚠️ [문서와 어긋남] docs/09_IA_v2.md §1-1 은 여행 카드에
//    '현재 여행자금 / 목표 여행비' 를 두라고 적고 있다. 두 금액을 빼고
//    준비율(READY)만 남겼다. 홈을 금액 화면으로 만들지 않기 위한 판단이고,
//    두 금액은 여행 준비 홈에서 그대로 볼 수 있다.
//    문서를 임의로 고치지 않았다. (CLAUDE.md 1-1)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { NextTripBanner } from './NextTripBanner';
import { HOME_CAPTION, HOME_CARD_LINE, HOME_RADIUS } from './palette';
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

/** 카드 사이 간격. */
const CARD_GAP = 12;
/** 홈 좌우 여백(px-4) 합. 카드 폭을 화면 폭에서 이만큼 뺀다. */
const SCREEN_PADDING = 32;
/**
 * 그림자가 잘리지 않게 스크롤 영역을 좌우로 넓히는 폭.
 *
 * ⚠️ 가로 ScrollView 는 좌우 경계에서 내용을 잘라낸다. 카드 폭이 여백 안쪽을
 *    꽉 채우고 있어서 첫 장의 왼쪽·마지막 장의 오른쪽 그림자가 잘렸다.
 *    바깥으로 이만큼 넓히고(marginHorizontal 음수) 안쪽에서 같은 만큼 밀어 넣으면
 *    카드 위치는 그대로면서 그림자 자리만 생긴다.
 *    두 값이 같아야 snapToInterval 이 어긋나지 않는다.
 */
const SHADOW_PAD = 12;

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
            style={{ marginHorizontal: -SHADOW_PAD }}
            // 그림자가 잘리지 않게 사방으로 여유를 준다.
            // 테두리를 빼고 그림자로만 카드를 띄우면서 넉넉하게 잡았다.
            contentContainerStyle={{
              gap: CARD_GAP,
              paddingTop: 6,
              paddingBottom: 14,
              paddingHorizontal: SHADOW_PAD,
            }}
          >
            {trips.map((trip) => (
              <NextTripBanner
                key={trip.tripId}
                trip={trip}
                width={cardWidth}
                onPress={onPressTrip}
              />
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
      <Text className="mt-2.5" style={{ fontSize: 10, fontWeight: '700', color: '#2a5caa' }}>
        새 여행 만들기 →
      </Text>
    </Pressable>
  );
}
