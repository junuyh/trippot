import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { GROUP_CARD } from './cardTheme';
import { formatCardDate, formatMemberCount, formatShortDateRange } from './format';
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

/** 실물 카드 모서리. rounded-2xl(16)보다 조금 더 카드답게. */
const CARD_RADIUS = 18;

/** 없는 값. */
const NUM = { fontVariant: ['tabular-nums' as const] };

type Props = {
  group: GroupTravelCardData;
  /** 일반 모드에서 카드를 눌렀을 때. 편집 모드에서는 불리지 않는다. 어디로 갈지는 화면이 종류를 보고 정한다. */
  onPress: (card: GroupTravelCardData) => void;

  // ── 편집 모드 ────────────────────────────────────────────────────────
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (groupId: string) => void;
  /** 저장 중. Chevron 을 잠근다. (NFR-005 중복 실행 방지) */
  actionsDisabled?: boolean;
};

/**
 * 카드 배경 장식 — 오른쪽 위에서 번지는 큰 호 두 개와 얇은 항로 곡선.
 * 금융 카드의 은은한 무늬 정도다. 정보보다 앞으로 나오면 실패라 opacity 를 낮게 둔다.
 * ⚠️ 카드 폭에 맞춰 그린다. 절대 좌표를 박지 않는다.
 */
function CardPattern({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Circle
        cx={width * 0.98}
        cy={height * 0.02}
        r={height * 0.62}
        stroke={GROUP_CARD.pattern}
        strokeWidth={1}
        fill="none"
        opacity={0.1}
      />
      <Circle
        cx={width * 0.98}
        cy={height * 0.02}
        r={height * 0.92}
        stroke={GROUP_CARD.pattern}
        strokeWidth={1}
        fill="none"
        opacity={0.07}
      />
      {/* 항로 한 줄. 왼쪽 아래에서 오른쪽 위로 완만하게. */}
      <Path
        d={`M ${width * 0.42} ${height} C ${width * 0.6} ${height * 0.55}, ${width * 0.8} ${height * 0.5}, ${width} ${height * 0.18}`}
        stroke={GROUP_CARD.pattern}
        strokeWidth={1}
        strokeDasharray="3 4"
        fill="none"
        opacity={0.12}
      />
    </Svg>
  );
}

/** 한 줄짜리 여행 표시. 여행지는 왼쪽에서 말줄임되고 기간은 오른쪽 끝에 남는다. */
function TripLine({ trip, suffix }: { trip: GroupTripItem; suffix?: string }) {
  return (
    <View style={{ height: TRIP_LINE_HEIGHT }} className="flex-row items-center">
      <Text
        numberOfLines={1}
        className="flex-1 font-semibold"
        style={{ fontSize: 13.5, lineHeight: 20, color: GROUP_CARD.ink }}
      >
        {trip.destination ?? '여행지 미정'}
      </Text>
      <Text
        numberOfLines={1}
        className="ml-3 shrink-0"
        style={{ fontSize: 12, lineHeight: 20, color: GROUP_CARD.secondary, ...NUM }}
      >
        {`${formatShortDateRange(trip.startDate, trip.endDate)}${suffix ?? ''}`}
      </Text>
    </View>
  );
}

/** 여권 · 카드가 같이 쓰는 작은 대문자 라벨. */
function MetaLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 9,
        lineHeight: 12,
        letterSpacing: 1,
        fontWeight: '700',
        color: GROUP_CARD.secondary,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * 모임 카드 — "TripPot 모임통장 카드". (docs/09_IA_v1.md §3-1 · 2026-09-13 실물 카드로)
 *
 * 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수 · (GROUP 만) 만든 날 을 담는다.
 *
 *   ┌ TripPot                       👥 4명 ┐   ← 브랜드 · 인원(PERSONAL 은 종류 라벨)
 *   │ 여행계                               │   ← 모임명 = 카드 이름
 *   │ 준비 중인 여행                        │
 *   │ 오사카                 10.31 – 11.01 │   ← 최대 2줄 · 고정 높이
 *   │ 후쿠오카               12.04 – 12.07 │
 *   │ ─────────────────────────────────── │
 *   │ 지난 여행 2회                CREATED │   ← PERSONAL 은 오른쪽이 빈다
 *   │                             26.09.04 │
 *   └──────────────────────────────────────┘
 *
 * ⚠️ 실물 카드의 **모양**만 빌린다. 가짜 카드번호 · VALID THRU · 칩 · NFC 는 없다.
 *    CREATED 는 유효기간 자리에 놓인 실제 groups.created_at 이다.
 *
 * 일반 모드 — 카드를 누르면 모임 상세로 간다. (docs/03 POL-NAV-001)
 * 편집 모드 — 상세 이동을 막고 선택 토글로 바꾼다. 선택 원은 오른쪽 위 인원 자리에 들어간다.
 *
 * ── 높이 정책 ─────────────────────────────────────────────────────────────
 * 폭은 부모가 정하고, 높이는 콘텐츠와 무관하게 정해진다.
 *   - 모든 텍스트가 1줄 고정 + 명시적 leading
 *   - 진행 중 여행 영역은 건수와 무관하게 TRIP_SLOT_HEIGHT 고정
 *   - 아랫줄 오른쪽(CREATED)은 PERSONAL 에서 비어도 같은 높이를 차지한다
 *   - 편집 UI(선택 원)는 윗줄 오른쪽 자리에 들어가 세로에 영향이 없다
 * 따라서 GROUP · PERSONAL · 편집 모드 모두 카드 크기가 같다.
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

  // 개인 여행은 숨길 수 없다. 숨김 설정이 group_id 기준이라 대상이 없다.
  const selectable = group.kind === 'GROUP';

  // 배경 무늬는 카드 크기에 맞춘다.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  function handlePress() {
    if (editMode) {
      if (selectable) onToggleSelect?.(group.groupId);
      return;
    }
    onPress(group);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        editMode
          ? selectable
            ? `${group.name} ${selected ? '선택 해제' : '선택'}`
            : `${group.name} (숨길 수 없음)`
          : group.kind === 'GROUP'
            ? `${group.name} 모임 상세로 이동`
            : `${group.name} 상세로 이동`
      }
      accessibilityState={{ selected: editMode && selectable ? selected : undefined }}
      onPress={handlePress}
      onLayout={onLayout}
      className="overflow-hidden px-4 pb-3.5 pt-4 active:opacity-80"
      style={{
        backgroundColor: GROUP_CARD.background,
        borderRadius: CARD_RADIUS,
        borderWidth: 1,
        // 선택되면 테두리만 강조색으로. 두께는 그대로라 카드가 커지지 않는다.
        borderColor: editMode && selectable && selected ? GROUP_CARD.accent : GROUP_CARD.edge,
        shadowColor: '#2B2757',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {size.width > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <CardPattern width={size.width} height={size.height} />
        </View>
      ) : null}

      {/*
        윗줄 — 왼쪽 브랜드, 오른쪽 인원(GROUP) 또는 종류(PERSONAL).
        편집 모드면 오른쪽 자리에 선택 원이 대신 들어간다. 왼쪽·높이는 그대로다.
      */}
      <View className="flex-row items-center justify-between" style={{ height: 22 }}>
        <View className="flex-row items-center">
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 22, height: 18 }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="TripPot"
          />
          <Text
            className="ml-1.5"
            style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: -0.2, color: GROUP_CARD.accent }}
          >
            TripPot
          </Text>
        </View>

        {editMode && selectable ? (
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={selected ? GROUP_CARD.accent : GROUP_CARD.unselected}
          />
        ) : group.kind === 'GROUP' ? (
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={13} color={GROUP_CARD.secondary} />
            <Text
              className="ml-1"
              style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', color: GROUP_CARD.secondary, ...NUM }}
            >
              {formatMemberCount(group.memberCount)}
            </Text>
          </View>
        ) : (
          // 개인 여행은 모임원이 없다. 인원 대신 카드 종류를 적는다. '1명' 을 만들지 않는다.
          <MetaLabel>PERSONAL</MetaLabel>
        )}
      </View>

      {/* 모임명 — 카드의 이름. 실물 카드의 상품명 자리다. */}
      <Text
        numberOfLines={1}
        className="mt-2.5"
        style={{ fontSize: 19, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5, color: GROUP_CARD.ink }}
      >
        {group.name}
      </Text>

      {/* 준비 중인 여행. 라벨 + 고정 2줄. */}
      <View className="mt-3">
        <Text
          style={{ fontSize: 10.5, lineHeight: 14, fontWeight: '600', letterSpacing: 0.3, color: GROUP_CARD.secondary }}
        >
          준비 중인 여행
        </Text>

        <View style={{ height: TRIP_SLOT_HEIGHT }} className="mt-1">
          {visibleTrips.length === 0 ? (
            <View style={{ height: TRIP_LINE_HEIGHT }} className="justify-center">
              <Text style={{ fontSize: 12.5, lineHeight: 20, color: GROUP_CARD.secondary }}>
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
      </View>

      {/* 아랫줄 — 왼쪽 지난 여행, 오른쪽 CREATED(GROUP 만). 실물 카드의 유효기간 자리다. */}
      <View
        className="mt-3 flex-row items-end justify-between pt-2.5"
        style={{ borderTopWidth: 1, borderTopColor: GROUP_CARD.rule, height: 40 }}
      >
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: GROUP_CARD.secondary, ...NUM }}>
          {`지난 여행 ${pastTripCount}회`}
        </Text>

        {group.kind === 'GROUP' ? (
          <View className="items-end">
            <MetaLabel>CREATED</MetaLabel>
            <Text
              style={{ fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: GROUP_CARD.ink, ...NUM }}
            >
              {formatCardDate(group.createdAt)}
            </Text>
          </View>
        ) : (
          // ⚠️ PERSONAL 은 모임이 없어 만든 날이 없다. 빈 자리를 가짜 값으로 채우지 않는다.
          //    같은 높이의 빈 View 로 카드 높이만 지킨다.
          <View style={{ height: 28 }} />
        )}
      </View>
    </Pressable>
  );
}
