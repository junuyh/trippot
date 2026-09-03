import { Ionicons } from '@expo/vector-icons';
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
 */
const TRIP_SLOT_HEIGHT = TRIP_LINE_HEIGHT * MAX_VISIBLE_TRIPS;

/**
 * 편집 모드에서 본문이 좌우로 비켜 앉는 폭(px).
 *
 * ⚠️ 가로 여백만 준다. 세로에는 손대지 않는다.
 *    체크와 Chevron 은 absolute 라 레이아웃에서 빠지므로 카드 높이가 그대로다.
 */
const EDIT_INSET_LEFT = 32;
const EDIT_INSET_RIGHT = 36;

type Props = {
  group: GroupTravelCardData;
  /** 일반 모드에서 카드를 눌렀을 때. 편집 모드에서는 불리지 않는다. */
  onPress: (groupId: string) => void;

  // ── 편집 모드 ────────────────────────────────────────────────────────
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (groupId: string) => void;
  /** 저장 중. Chevron 을 잠근다. (NFR-005 중복 실행 방지) */
  actionsDisabled?: boolean;
};

/** 한 줄짜리 여행 표시. 여행지는 말줄임되고 날짜는 끝까지 남는다. */
function TripLine({ trip, suffix }: { trip: GroupTripItem; suffix?: string }) {
  return (
    <View style={{ height: TRIP_LINE_HEIGHT }} className="flex-row items-center">
      <Text numberOfLines={1} className="shrink text-pot-ink" style={{ fontSize: 13.5, lineHeight: 20 }}>
        {trip.destination ?? '여행지 미정'}
      </Text>
      <Text numberOfLines={1} className="shrink-0 text-pot-mute" style={{ fontSize: 12, lineHeight: 20 }}>
        {` · ${formatDateRange(trip.startDate, trip.endDate)}${suffix ?? ''}`}
      </Text>
    </View>
  );
}

/**
 * 모임 카드. (docs/09_IA_v1.md §3-1)
 *
 * 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수 를 담는다.
 *
 * 일반 모드 — 카드를 누르면 모임 상세로 간다. (docs/03 POL-NAV-001)
 * 편집 모드 — 상세 이동을 막고 선택 토글로 바꾼다.
 *
 * ── 높이 정책 ─────────────────────────────────────────────────────────────
 * 폭은 부모가 정하고, 높이는 콘텐츠와 무관하게 정해진다.
 *   - 모든 텍스트가 1줄 고정 + 명시적 leading
 *   - 진행 중 여행 영역은 건수와 무관하게 TRIP_SLOT_HEIGHT 고정
 *   - 편집 UI 는 absolute + 가로 여백이라 세로에 영향이 없다
 * 따라서 편집 모드로 들어가도 카드 크기가 그대로다.
 */
export function GroupTravelCard({
  group,
  onPress,
  editMode = false,
  selected = false,
  onToggleSelect,
  actionsDisabled = false,
}: Props) {
  const { ongoingTrips, pastTripCount } = group;

  const visibleTrips = ongoingTrips.slice(0, MAX_VISIBLE_TRIPS);
  const hiddenCount = ongoingTrips.length - visibleTrips.length;

  function handlePress() {
    if (editMode) {
      onToggleSelect?.(group.groupId);
      return;
    }
    onPress(group.groupId);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        editMode
          ? `${group.name} ${selected ? '선택 해제' : '선택'}`
          : `${group.name} 모임 상세로 이동`
      }
      accessibilityState={{ selected: editMode ? selected : undefined }}
      onPress={handlePress}
      className="rounded-2xl bg-white px-4 py-4 active:opacity-90"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* 편집 UI — absolute 라 카드 높이에 관여하지 않는다 */}
      {editMode ? (
        <>
          <View className="absolute bottom-0 left-3 top-0 justify-center">
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selected ? '#2563eb' : '#d1d5db'}
            />
          </View>

        </>
      ) : null}

      <View
        style={{
          paddingLeft: editMode ? EDIT_INSET_LEFT : 0,
          paddingRight: editMode ? EDIT_INSET_RIGHT : 0,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text
            numberOfLines={1}
            className="flex-1 pr-3 font-black text-pot-ink"
            style={{ fontSize: 17, lineHeight: 23, letterSpacing: -0.5 }}
          >
            {group.name}
          </Text>
          <Text className="shrink-0 text-pot-mute" style={{ fontSize: 12.5, lineHeight: 23 }}>
            {formatMemberCount(group.memberCount)}
          </Text>
        </View>

        <View className="mt-3.5 border-t border-pot-line pt-3">
          <Text className="font-semibold text-pot-faint" style={{ fontSize: 11, lineHeight: 15 }}>
            준비 중인 여행
          </Text>

          <View style={{ height: TRIP_SLOT_HEIGHT }} className="mt-1.5">
            {visibleTrips.length === 0 ? (
              <View style={{ height: TRIP_LINE_HEIGHT }} className="justify-center">
                <Text className="text-pot-faint" style={{ fontSize: 13, lineHeight: 20 }}>
                  준비 중인 여행이 없어요.
                </Text>
              </View>
            ) : (
              visibleTrips.map((trip, index) => {
                const isLastVisible = index === visibleTrips.length - 1;
                const suffix =
                  isLastVisible && hiddenCount > 0 ? ` · 외 ${hiddenCount}건` : undefined;
                return <TripLine key={trip.tripId} trip={trip} suffix={suffix} />;
              })
            )}
          </View>

          <Text className="mt-3 text-pot-faint" style={{ fontSize: 11.5, lineHeight: 16 }}>
            {`지난 여행 ${pastTripCount}회`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
