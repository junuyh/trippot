import { Ionicons } from '@expo/vector-icons';
import { useId, useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { pickGroupCardTheme, pickGroupCardVariant, type GroupCardTheme } from './cardTheme';
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

/**
 * 기간 칸의 고정 폭. '12.28 – 27.01.03'(가장 긴 꼴)은 100 이면 들어가지만 128 로 둔다 —
 * 기간이 카드 오른쪽 끝이 아니라 **가운데 조금 지나서** 시작해 여행지와 한 줄로 붙어 읽힌다.
 *
 * ⚠️ 폭을 고정하는 이유 — 여행지가 길든 짧든 기간은 **늘 같은 자리**에서 시작해야
 *    두 줄을 위아래로 훑을 때 눈이 흔들리지 않는다. flex 로 양끝에 밀면 기간이
 *    카드 끝에 붙어 여행지와 남남처럼 보였다. (2026-09-13)
 */
const DATE_COL_WIDTH = 128;

/** 여행지와 기간 사이. 한 줄 정보로 읽힐 만큼만 띄운다. */
const DATE_COL_GAP = 12;

/** 실물 카드 모서리. */
const CARD_RADIUS = 18;

/** 장식 변형 수. 항로 곡선의 시작점이 조금씩 다르다. */
const PATTERN_VARIANTS = 3;

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
 * 카드 바탕 + 여행 장식. Svg 한 장이다.
 *
 *   바탕   왼쪽 위 → 오른쪽 아래로 옅어지는 두 톤 그라데이션 (플라스틱 카드의 결)
 *   항로   왼쪽 아래에서 오른쪽 위로 올라가는 점선 곡선 + 출발·경유 점 + 끝의 비행기
 *   도장   오른쪽 위 구석의 이중 원 (여권 도장 · 카드 홀로그램 자리)
 *
 * ⚠️ 장식은 보조다. 모두 opacity 0.1 안팎이라 글자 뒤에서 결만 만든다.
 * ⚠️ variant 로 항로 시작점을 세 가지로 바꿔 같은 테마끼리도 똑같이 보이지 않게 한다.
 */
function CardBackdrop({
  width,
  height,
  theme,
  variant,
}: {
  width: number;
  height: number;
  theme: GroupCardTheme;
  variant: number;
}) {
  const gradientId = useId();
  // 항로 시작 x 를 변형별로 조금씩 옮긴다. 끝점(오른쪽 위)은 같다.
  const startX = width * (0.3 + variant * 0.12);
  const routeStart = { x: startX, y: height * 0.96 };
  const routeMid = { x: width * 0.72, y: height * 0.58 };
  const routeEnd = { x: width * 0.92, y: height * 0.2 };
  const route = `M ${routeStart.x} ${routeStart.y} C ${width * 0.5} ${height * 0.7}, ${width * 0.62} ${height * 0.62}, ${routeMid.x} ${routeMid.y} S ${width * 0.86} ${height * 0.34}, ${routeEnd.x} ${routeEnd.y}`;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={theme.paperStart} />
          <Stop offset="1" stopColor={theme.paperEnd} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />

      {/* 도장 — 오른쪽 위 구석. 반은 카드 밖이다. */}
      <Circle
        cx={width * 0.9}
        cy={height * 0.16}
        r={height * 0.3}
        stroke={theme.pattern}
        strokeWidth={1}
        fill="none"
        opacity={0.1}
      />
      <Circle
        cx={width * 0.9}
        cy={height * 0.16}
        r={height * 0.24}
        stroke={theme.pattern}
        strokeWidth={1}
        strokeDasharray="2 3"
        fill="none"
        opacity={0.1}
      />

      {/* 항로 */}
      <Path
        d={route}
        stroke={theme.pattern}
        strokeWidth={1.2}
        strokeDasharray="4 5"
        fill="none"
        opacity={0.16}
      />
      <Circle cx={routeStart.x} cy={routeStart.y} r={3} fill={theme.pattern} opacity={0.16} />
      <Circle cx={routeMid.x} cy={routeMid.y} r={2.5} fill={theme.pattern} opacity={0.14} />
      <Circle cx={routeEnd.x} cy={routeEnd.y} r={3} fill={theme.pattern} opacity={0.16} />
    </Svg>
  );
}

/**
 * 한 줄짜리 여행 표시 — 여행지(가변) + 기간(고정 폭).
 *
 *   [오사카 · 외 1건        ][10.31 – 11.01]
 *    ↑ 남는 폭 · 말줄임        ↑ DATE_COL_WIDTH 고정 · 왼쪽 정렬
 *
 * '외 N건' 은 여행지 뒤에 shrink-0 으로 붙여 여행지가 잘려도 남는다.
 */
function TripLine({
  trip,
  suffix,
  theme,
}: {
  trip: GroupTripItem;
  suffix?: string;
  theme: GroupCardTheme;
}) {
  return (
    <View style={{ height: TRIP_LINE_HEIGHT }} className="flex-row items-center">
      <View className="flex-1 flex-row items-center" style={{ marginRight: DATE_COL_GAP }}>
        <Text
          numberOfLines={1}
          className="shrink font-semibold"
          style={{ fontSize: 13.5, lineHeight: 20, color: theme.ink }}
        >
          {trip.destination ?? '여행지 미정'}
        </Text>
        {suffix ? (
          <Text
            numberOfLines={1}
            className="shrink-0"
            style={{ fontSize: 12, lineHeight: 20, color: theme.secondary }}
          >
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          width: DATE_COL_WIDTH,
          fontSize: 12,
          lineHeight: 20,
          color: theme.secondary,
          ...NUM,
        }}
      >
        {formatShortDateRange(trip.startDate, trip.endDate)}
      </Text>
    </View>
  );
}

/** 카드의 작은 대문자 메타 라벨. */
function MetaLabel({ children, theme }: { children: string; theme: GroupCardTheme }) {
  return (
    <Text
      style={{
        fontSize: 9,
        lineHeight: 12,
        letterSpacing: 1,
        fontWeight: '700',
        color: theme.secondary,
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
 *   ┌ [logo] TripPot 모임              👥 4명 ┐   ← 브랜드 라벨 · 인원(PERSONAL 은 종류)
 *   │ 여행계                                  │   ← 모임명 = 카드의 주인공
 *   │ 준비 중인 여행                           │
 *   │ 오사카                 10.31 – 11.01    │   ← 여행지(가변) + 기간(고정 폭)
 *   │ 후쿠오카 · 외 1건       12.04 – 12.07    │
 *   │ ──────────────────────────────────────  │
 *   │ 지난 여행 2회                   CREATED │   ← PERSONAL 은 오른쪽이 빈다
 *   │                                26.09.04 │
 *   └─────────────────────────────────────────┘
 *
 * 색은 카드마다 다르다 — cardTheme.pickGroupCardTheme 이 모임별로 고정 배정한다.
 *
 * ⚠️ 실물 카드의 **모양**만 빌린다. 가짜 카드번호 · VALID THRU · 칩 · NFC 는 없다.
 *    CREATED 는 유효기간 자리에 놓인 실제 groups.created_at 이다.
 *
 * 일반 모드 — 카드를 누르면 모임 상세로 간다. (docs/03 POL-NAV-001)
 * 편집 모드 — 상세 이동을 막고 선택 토글로 바꾼다. 선택 원은 오른쪽 위 인원 자리에 들어가고,
 *            선택되면 카드 가장자리에 2px 테두리가 **덧그려진다**(absolute · 크기 불변).
 *
 * ── 높이 정책 ─────────────────────────────────────────────────────────────
 * 폭은 부모가 정하고, 높이는 콘텐츠와 무관하게 정해진다.
 *   - 모든 텍스트가 1줄 고정 + 명시적 leading
 *   - 진행 중 여행 영역은 건수와 무관하게 TRIP_SLOT_HEIGHT 고정
 *   - 아랫줄 오른쪽(CREATED)은 PERSONAL 에서 비어도 같은 높이를 차지한다
 *   - 편집 UI 는 윗줄 오른쪽 자리와 absolute 테두리라 세로에 영향이 없다
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
  const theme = pickGroupCardTheme(group);
  const variant = pickGroupCardVariant(group, PATTERN_VARIANTS);

  const visibleTrips = ongoingTrips.slice(0, MAX_VISIBLE_TRIPS);
  const hiddenCount = ongoingTrips.length - visibleTrips.length;

  // 개인 여행은 숨길 수 없다. 숨김 설정이 group_id 기준이라 대상이 없다.
  const selectable = group.kind === 'GROUP';
  const showSelectedRing = editMode && selectable && selected;

  // 바탕 Svg 는 카드 크기에 맞춘다.
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
      className="overflow-hidden px-4 pb-3.5 pt-4 active:opacity-85"
      style={{
        // Svg 가 그려지기 전 첫 프레임의 바탕색. 그라데이션 시작색과 같다.
        backgroundColor: theme.paperStart,
        borderRadius: CARD_RADIUS,
        // 한 장씩 떠 보일 만큼만. 테두리는 없다 — 그림자가 분리를 맡는다.
        shadowColor: theme.ink,
        shadowOpacity: 0.09,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {size.width > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <CardBackdrop width={size.width} height={size.height} theme={theme} variant={variant} />
        </View>
      ) : null}

      {/*
        윗줄 — 왼쪽 브랜드 라벨, 오른쪽 인원(GROUP) 또는 종류(PERSONAL).
        편집 모드면 오른쪽 자리에 선택 원이 대신 들어간다. 왼쪽·높이는 그대로다.
        ⚠️ 브랜드는 작다. 카드의 주인공은 아래 모임명이다.
      */}
      <View className="flex-row items-center justify-between" style={{ height: 20 }}>
        <View className="flex-row items-center">
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 19, height: 16 }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="TripPot"
          />
          <Text
            className="ml-1.5"
            style={{ fontSize: 11.5, lineHeight: 16, fontWeight: '700', letterSpacing: -0.1, color: theme.accent }}
          >
            {/* 개인 여행 카드는 모임이 아니라 '모임' 을 붙이지 않는다. */}
            {group.kind === 'GROUP' ? 'TripPot 모임' : 'TripPot'}
          </Text>
        </View>

        {editMode && selectable ? (
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={selected ? theme.accent : theme.unselected}
          />
        ) : group.kind === 'GROUP' ? (
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={13} color={theme.secondary} />
            <Text
              className="ml-1"
              style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', color: theme.secondary, ...NUM }}
            >
              {formatMemberCount(group.memberCount)}
            </Text>
          </View>
        ) : (
          // 개인 여행은 모임원이 없다. 인원 대신 카드 종류를 적는다. '1명' 을 만들지 않는다.
          <MetaLabel theme={theme}>PERSONAL</MetaLabel>
        )}
      </View>

      {/* 모임명 — 카드의 이름. 실물 카드의 상품명 자리다. 가장 강하다. */}
      <Text
        numberOfLines={1}
        className="mt-3"
        style={{ fontSize: 20, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5, color: theme.ink }}
      >
        {group.name}
      </Text>

      {/* 준비 중인 여행. 라벨 + 고정 2줄. */}
      <View className="mt-3">
        <Text
          style={{ fontSize: 10.5, lineHeight: 14, fontWeight: '600', letterSpacing: 0.3, color: theme.secondary }}
        >
          준비 중인 여행
        </Text>

        <View style={{ height: TRIP_SLOT_HEIGHT }} className="mt-1">
          {visibleTrips.length === 0 ? (
            <View style={{ height: TRIP_LINE_HEIGHT }} className="justify-center">
              <Text style={{ fontSize: 12.5, lineHeight: 20, color: theme.secondary }}>
                준비 중인 여행이 없어요.
              </Text>
            </View>
          ) : (
            visibleTrips.map((trip, index) => {
              const isLastVisible = index === visibleTrips.length - 1;
              const suffix =
                isLastVisible && hiddenCount > 0 ? ` · 외 ${hiddenCount}건` : undefined;
              return <TripLine key={trip.tripId} trip={trip} suffix={suffix} theme={theme} />;
            })
          )}
        </View>
      </View>

      {/* 아랫줄 — 왼쪽 지난 여행, 오른쪽 CREATED(GROUP 만). 실물 카드의 유효기간 자리다. */}
      <View
        className="mt-3 flex-row items-end justify-between pt-2.5"
        style={{ borderTopWidth: 1, borderTopColor: theme.rule, height: 40 }}
      >
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: theme.secondary, ...NUM }}>
          {`지난 여행 ${pastTripCount}회`}
        </Text>

        {group.kind === 'GROUP' ? (
          <View className="items-end">
            <MetaLabel theme={theme}>CREATED</MetaLabel>
            <Text
              style={{ fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: theme.ink, ...NUM }}
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

      {/* 선택 테두리 — 덧그리기라 카드 크기가 변하지 않는다. */}
      {showSelectedRing ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            borderRadius: CARD_RADIUS,
            borderWidth: 2,
            borderColor: theme.accent,
          }}
        />
      ) : null}
    </Pressable>
  );
}
