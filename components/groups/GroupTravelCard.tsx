import { Pressable, Text, View } from 'react-native';

import { formatDateRange, formatMemberCount } from './format';
import type { GroupTravelCardData, GroupTripItem } from './types';

/** 카드에 그리는 진행 중 여행 최대 건수. 초과분은 둘째 줄 끝에 '외 N건' 으로 접는다. */
const MAX_VISIBLE_TRIPS = 2;

/**
 * 진행 중 여행 한 줄의 높이(px).
 * 줄마다 높이를 고정해야 글꼴 기본 행간에 흔들리지 않는다.
 */
const TRIP_LINE_HEIGHT = 20;

/**
 * 진행 중 여행 영역의 고정 높이. 항상 2줄분이다.
 *
 * 여행이 0건이든 6건이든 이 높이는 변하지 않는다.
 * 이 고정이 "같은 화면의 모든 카드는 같은 높이" 정책의 핵심이다.
 * 여행 건수에 따라 영역이 늘면 모임마다 카드 높이가 달라지고,
 * 이후 순서 변경 기능의 좌표 계산도 깨진다.
 */
const TRIP_SLOT_HEIGHT = TRIP_LINE_HEIGHT * MAX_VISIBLE_TRIPS;

type Props = {
  group: GroupTravelCardData;
  onPress: (groupId: string) => void;
};

/** 한 줄짜리 여행 표시. 여행지는 말줄임되고 날짜는 끝까지 남는다. */
function TripLine({ trip, suffix }: { trip: GroupTripItem; suffix?: string }) {
  return (
    <View style={{ height: TRIP_LINE_HEIGHT }} className="flex-row items-center">
      <Text numberOfLines={1} className="shrink text-sm leading-5 text-gray-800">
        {trip.destination ?? '여행지 미정'}
      </Text>
      <Text numberOfLines={1} className="shrink-0 text-xs leading-5 text-gray-500">
        {` · ${formatDateRange(trip.startDate, trip.endDate)}${suffix ?? ''}`}
      </Text>
    </View>
  );
}

/**
 * 모임 카드. (docs/09_IA_v1.md §3-1)
 *
 * 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수 를 담는다.
 * '대표 모임 여행 유형' 은 [고도화] 라 넣지 않는다.
 * 생성일 · 대표 이미지 · More 는 IA §3-1 에 없어서 넣지 않는다.
 *
 * 카드 전체를 누르면 모임 상세로 간다. (docs/03 POL-NAV-001)
 *
 * ── 높이 정책 ─────────────────────────────────────────────────────────────
 * 폭은 부모가 정하고(화면 폭 - 좌우 여백), 높이는 콘텐츠와 무관하게 정해진다.
 *   - 모든 텍스트가 1줄 고정 + 명시적 leading
 *   - 진행 중 여행 영역은 건수와 무관하게 TRIP_SLOT_HEIGHT 고정
 * 따라서 같은 화면의 카드는 항상 같은 크기다.
 *
 * 선택 체크 같은 오버레이를 얹어도 높이가 바뀌지 않는다. 이 Pressable 이
 * 기준 컨테이너라서 position:absolute 자식은 레이아웃에 영향을 주지 않는다.
 */
export function GroupTravelCard({ group, onPress }: Props) {
  const { ongoingTrips, pastTripCount } = group;

  const visibleTrips = ongoingTrips.slice(0, MAX_VISIBLE_TRIPS);
  const hiddenCount = ongoingTrips.length - visibleTrips.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.name} 모임 상세로 이동`}
      onPress={() => onPress(group.groupId)}
      className="rounded-2xl border border-gray-200 bg-white px-4 py-4 active:bg-gray-50"
    >
      {/* 모임명 + 인원 */}
      <View className="flex-row items-center justify-between">
        <Text
          numberOfLines={1}
          className="flex-1 pr-3 text-lg font-bold leading-6 text-gray-900"
        >
          {group.name}
        </Text>
        <Text className="shrink-0 text-sm leading-6 text-gray-500">
          {formatMemberCount(group.memberCount)}
        </Text>
      </View>

      {/* 진행 중인 여행 — 건수와 무관하게 높이 고정 */}
      <View className="mt-4 border-t border-gray-100 pt-3">
        <Text className="text-xs font-medium leading-4 text-gray-500">진행 중인 여행</Text>

        <View style={{ height: TRIP_SLOT_HEIGHT }} className="mt-1.5">
          {visibleTrips.length === 0 ? (
            // 0건. 둘째 줄은 비지만 영역 높이는 그대로다.
            <View style={{ height: TRIP_LINE_HEIGHT }} className="justify-center">
              <Text className="text-sm leading-5 text-gray-400">진행 중인 여행이 없어요.</Text>
            </View>
          ) : (
            visibleTrips.map((trip, index) => {
              // '외 N건' 은 별도 줄을 만들지 않고 마지막 줄 끝에 붙인다.
              const isLastVisible = index === visibleTrips.length - 1;
              const suffix = isLastVisible && hiddenCount > 0 ? ` · 외 ${hiddenCount}건` : undefined;
              return <TripLine key={trip.tripId} trip={trip} suffix={suffix} />;
            })
          )}
        </View>

        <Text className="mt-3 text-xs leading-4 text-gray-400">
          {`지난 여행 ${pastTripCount}회`}
        </Text>
      </View>
    </Pressable>
  );
}
