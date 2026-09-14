import { Ionicons } from '@expo/vector-icons';
import { useId, useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { pickGroupCardVariant, type GroupCardTheme } from './cardTheme';
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
 * 준비 중 여행 한 줄 = **왼쪽에 붙은 작은 묶음** [여행지 칸][사이][기간 칸].
 * 카드 폭을 다 쓰지 않는다. (2026-09-14)
 *
 *   오사카        09.18 – 09.21
 *   퇴사기념 …    12.04 – 12.07
 *   └─ 96 ─┘ 8 └─── 112 ───┘      → 묶음 216 · 카드 안쪽(iPhone 17 기준 338)의 왼쪽
 *
 * ⚠️ 두 칸 다 고정 폭이다. 여행지가 길든 짧든 기간은 **늘 같은 x** 에서 시작하고,
 *    여행지 옆 8 만 띄워 한 정보로 읽힌다. flex 로 양끝에 밀면 기간이 카드 끝에
 *    붙어 여행지와 남남처럼 보였고(1차), 기간 칸만 넓혀도 멀었고(2차), 120/14 도
 *    아직 벌어져 보여 96/8 로 줄였고(3차), 흰 패널 구조로 바꾸며 88/6 으로 한 번 더(4차 · 2026-09-14).
 * ⚠️ 여행지 칸 88 은 한글 5~6자. 넘치면 말줄임. '외 N건' 은 이 칸 안에서 여행지 뒤에
 *    shrink-0 으로 남는다(여행지가 먼저 잘린다). 기간 칸 112 는 '12.28 – 27.01.03'
 *    (가장 긴 꼴)이 들어간다.
 */
const DESTINATION_COL_WIDTH = 88;
const DATE_COL_GAP = 6;
const DATE_COL_WIDTH = 112;

/** 실물 카드 모서리. 바깥 컬러 프레임. */
const CARD_RADIUS = 18;
/** 바깥 프레임 두께. 테마 색은 여기서만 보인다. (2026-09-15 · 9 → 15: 실물 카드 프레임처럼) */
const FRAME = 15;
/** 안쪽 흰 패널(인쇄면) 모서리. 프레임 radius − 프레임 두께에 가깝게 해 동심으로 보이게 한다. */
const PANEL_RADIUS = 10;
/**
 * 흰 패널 왼쪽 변 가운데의 돌출부(탭). 시안의 카드 인쇄면 실루엣이다. (2026-09-14)
 *   NOTCH_DEPTH  프레임 쪽으로 튀어나오는 깊이. FRAME(15)보다 작아 프레임 띠가 남는다
 *   NOTCH_HALF   돌출부 세로 반높이. 패널 중앙 ± 이만큼
 */
const NOTCH_DEPTH = 12;
const NOTCH_HALF = 26;

/** 장식용 칩. 실물 카드의 IC 칩 자리. 누르지 못하고 읽히지도 않는다. */
const CHIP_WIDTH = 28;
const CHIP_HEIGHT = 20;

/** 장식 변형 수. 항로 곡선의 시작점이 조금씩 다르다. */
const PATTERN_VARIANTS = 3;

const NUM = { fontVariant: ['tabular-nums' as const] };

type Props = {
  group: GroupTravelCardData;
  /**
   * 이 카드의 색. 목록(GroupTravelCardList)이 assignGroupCardThemes 로 겹치지 않게
   * 정해서 내려준다. 카드 혼자서는 다른 카드와 겹치는지 알 수 없다.
   */
  theme: GroupCardTheme;
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
 * 바깥 프레임의 바탕. Svg 한 장 — 두 톤 그라데이션 + 점선 항로 하나.
 *
 * 흰 패널이 가운데를 덮으므로 실제로 보이는 건 프레임 폭(FRAME)만큼의 띠다.
 * 항로는 그 띠를 스치듯 지나가며 "여행 카드" 결만 남긴다. 도장 원은 뺐다 — 패널 뒤에
 * 숨어 의미가 없고, 프레임에서 잘려 보이면 지저분했다. (2026-09-14)
 *
 * ⚠️ 장식은 보조다. 패널 안(읽는 면)에는 아무 장식도 없다.
 * ⚠️ variant 로 항로 시작점을 세 가지로 바꿔 같은 테마끼리도 똑같이 보이지 않게 한다.
 */
function FrameBackdrop({
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
  const startX = width * (0.2 + variant * 0.15);
  const route = `M ${startX} ${height} C ${width * 0.45} ${height * 0.75}, ${width * 0.7} ${height * 0.3}, ${width} ${height * 0.12}`;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={theme.paperStart} />
          <Stop offset="1" stopColor={theme.paperEnd} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />
      {/* 프레임만 보이므로 한 단 진하게 — 흰 패널과 대비가 나야 테마가 읽힌다. */}
      <Rect x={0} y={0} width={width} height={height} fill={theme.pattern} opacity={0.14} />
      <Path
        d={route}
        stroke={theme.pattern}
        strokeWidth={1.2}
        strokeDasharray="3 4"
        fill="none"
        opacity={0.35}
      />
    </Svg>
  );
}

/**
 * 흰 패널의 실루엣. 둥근 사각형인데 **왼쪽 변 가운데가 바깥(프레임 쪽)으로 뾰족하게 나온다.**
 * 시안의 인쇄면 모양이다. 테두리·그림자로 흉내 내지 않고 Path 로 실제 윤곽을 그린다.
 *
 * 패널 콘텐츠 뒤에 absolute 로 깔리며, Svg 폭은 패널 폭 + NOTCH_DEPTH 라 돌출부가
 * 패널 왼쪽 밖(프레임 띠 위)까지 그려진다. 바깥 카드는 overflow hidden 이지만
 * 돌출부는 FRAME 안에 머물러 잘리지 않는다.
 */
function PanelShape({
  width,
  height,
  theme,
}: {
  width: number;
  height: number;
  theme: GroupCardTheme;
}) {
  const r = PANEL_RADIUS;
  const d = NOTCH_DEPTH;
  const mid = height / 2;
  // 좌표는 Svg 기준 — 패널의 x=0 이 Svg 의 x=d 다.
  const path = [
    `M ${d + r} 0`,
    `H ${d + width - r}`,
    `A ${r} ${r} 0 0 1 ${d + width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${d + width - r} ${height}`,
    `H ${d + r}`,
    `A ${r} ${r} 0 0 1 ${d} ${height - r}`,
    `V ${mid + NOTCH_HALF}`,
    `L 0 ${mid}`,
    `L ${d} ${mid - NOTCH_HALF}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${d + r} 0`,
    'Z',
  ].join(' ');

  return (
    <Svg
      width={width + d}
      height={height}
      style={{ position: 'absolute', left: -d, top: 0 }}
      pointerEvents="none"
    >
      <Path d={path} fill="#FFFFFF" stroke={theme.rule} strokeWidth={1} />
    </Svg>
  );
}

/**
 * 장식용 칩. 실물 카드의 IC 칩 자리 — 뉴트럴 메탈 톤 사각형에 가는 선 두 줄.
 * 의미도 동작도 없다. 화면 읽기(접근성)에서 뺀다.
 */
function CardChip() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: CHIP_WIDTH,
        height: CHIP_HEIGHT,
        borderRadius: 4,
        backgroundColor: '#DDD8CC',
        borderWidth: 1,
        borderColor: '#C7C0B1',
        overflow: 'hidden',
        justifyContent: 'space-evenly',
      }}
    >
      <View style={{ height: 1, backgroundColor: '#B9B1A1', opacity: 0.9 }} />
      <View style={{ height: 1, backgroundColor: '#B9B1A1', opacity: 0.9 }} />
      <View
        style={{
          position: 'absolute',
          left: CHIP_WIDTH * 0.38,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundColor: '#B9B1A1',
          opacity: 0.9,
        }}
      />
    </View>
  );
}

/**
 * 한 줄짜리 여행 표시 — 여행지 칸(고정 폭 · 말줄임) + 기간 칸(고정 폭 · 왼쪽 정렬).
 *
 *   [오사카 · 외 1건 ][ ][10.31 – 11.01]
 *    ↑ 88 · 말줄임     6   ↑ 112 · 왼쪽 정렬
 *
 * '외 N건' 은 여행지 뒤에 shrink-0 으로 붙여 여행지가 잘려도 남는다.
 * 줄 전체는 self-start 라 카드 오른쪽까지 뻗지 않는다.
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
    <View style={{ height: TRIP_LINE_HEIGHT }} className="flex-row items-center self-start">
      <View
        className="flex-row items-center"
        style={{ width: DESTINATION_COL_WIDTH, marginRight: DATE_COL_GAP }}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
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
 * 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수 · 만든 날(GROUP=모임 · PERSONAL=첫 개인 여행)을 담는다.
 *
 *   ┏━ 테마색 프레임(FRAME) ━━━━━━━━━━━━━━━━━━━━━━┓
 *   ┃ ┌ 흰 패널(인쇄면) ─────────────────────────┐ ┃
 *   ┃ │ [logo] TripPot 모임              👥 4명 │ ┃   ← 브랜드 라벨 · 인원(PERSONAL 은 종류)
 *   ┃ │ [칩] 여행계                             │ ┃   ← 모임명 = 카드의 주인공 · 칩은 이름 옆
 *   ┃ │ 준비 중인 여행                           │ ┃
 *   ┃◀│ 오사카        10.31 – 11.01             │ ┃   ← 여행지 칸 + 기간 칸, 왼쪽에 묶음
 *   ┃ │ 후쿠오카 · 외 1건  12.04 – 12.07         │ ┃      (◀ = 패널 왼쪽 변 가운데 돌출부)
 *   ┃ │ ──────────────────────────────────────  │ ┃
 *   ┃ │ 지난 여행 2회          CREATED 26/09/04 │ ┃   ← 한 줄 · PERSONAL 은 첫 개인 여행 생성일
 *   ┃ └─────────────────────────────────────────┘ ┃
 *   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
 *
 * 색은 카드마다 다르다 — 목록이 cardTheme.assignGroupCardThemes 로 겹치지 않게 배정해 준다.
 * (2026-09-14) 색은 **바깥 프레임에만** 있다. 안쪽은 흰 패널 — 실물 카드의 인쇄면이다.
 * 장식은 프레임의 항로 한 줄과 패널 왼쪽 위의 칩뿐. 읽는 면은 깨끗하다.
 * 패널은 왼쪽 변 가운데가 프레임 쪽으로 뾰족하게 나온 실루엣(PanelShape)이다.
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
 *   - 아랫줄 오른쪽(CREATED)은 GROUP · PERSONAL 모두 한 줄이다
 *   - 편집 UI 는 윗줄 오른쪽 자리와 absolute 테두리라 세로에 영향이 없다
 * 따라서 GROUP · PERSONAL · 편집 모드 모두 카드 크기가 같다.
 */
export function GroupTravelCard({
  group,
  theme,
  onPress,
  editMode = false,
  selected = false,
  onToggleSelect,
  actionsDisabled = false,
}: Props) {
  const { ongoingTrips, pastTripCount } = group;
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
  // 흰 패널 크기. 돌출부가 있는 실루엣(PanelShape)을 이 크기로 그린다.
  const [panel, setPanel] = useState({ width: 0, height: 0 });
  const onPanelLayout = (e: LayoutChangeEvent) =>
    setPanel({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

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
      className="overflow-hidden active:opacity-85"
      style={{
        // Svg 가 그려지기 전 첫 프레임의 바탕색. 그라데이션 시작색과 같다.
        backgroundColor: theme.paperStart,
        borderRadius: CARD_RADIUS,
        padding: FRAME,
        // 한 장씩 떠 보일 만큼만. 테두리는 없다 — 그림자가 분리를 맡는다.
        shadowColor: theme.ink,
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {size.width > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <FrameBackdrop width={size.width} height={size.height} theme={theme} variant={variant} />
        </View>
      ) : null}

      {/*
        흰 패널 — 실물 카드의 인쇄면. 프레임 안에 inset.
        배경·테두리는 View 가 아니라 PanelShape(Path)가 그린다 — 왼쪽 변 가운데 돌출부 때문이다.
        View 자체는 투명하고 크기만 잰다.
      */}
      <View
        onLayout={onPanelLayout}
        style={{
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 11,
        }}
      >
        {panel.width > 0 ? (
          <PanelShape width={panel.width} height={panel.height} theme={theme} />
        ) : null}
        {/*
          윗줄 — 왼쪽 칩 + 브랜드 라벨, 오른쪽 인원(GROUP) 또는 종류(PERSONAL).
          편집 모드면 오른쪽 자리에 선택 원이 대신 들어간다. 왼쪽·높이는 그대로다.
          ⚠️ 브랜드는 작다. 카드의 주인공은 아래 모임명이다.
        */}
        <View className="flex-row items-center justify-between" style={{ height: 20 }}>
          {/* [로고 + TripPot 모임] … [인원]. 칩은 여기가 아니라 아래 모임명 줄에 있다. */}
          <View className="flex-row items-center">
            <View className="flex-row items-center">
              <Image
                source={require('@/assets/logo.png')}
                style={{ width: 18, height: 15 }}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="TripPot"
              />
              <Text
                className="ml-1"
                style={{ fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: -0.1, color: theme.accent }}
              >
                {/* 개인 여행 카드는 모임이 아니라 '모임' 을 붙이지 않는다. 종류는 오른쪽 PERSONAL 이 말한다. */}
                {group.kind === 'GROUP' ? 'TripPot 모임' : 'TripPot'}
              </Text>
            </View>
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

        {/*
          모임명 줄 — [칩] [이름]. 칩은 카드의 identity(이름) 옆에 붙는 시각 요소다. (2026-09-15)
          칩 폭 + 간격만큼 이름 폭이 줄지만 28+10 이라 한글 8자 안팎은 그대로 들어간다. 넘치면 말줄임.
        */}
        <View className="mt-2.5 flex-row items-center" style={{ gap: 10 }}>
          <CardChip />
          <Text
            numberOfLines={1}
            className="flex-1"
            style={{ fontSize: 20, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5, color: theme.ink }}
          >
            {group.name}
          </Text>
        </View>

        {/* 준비 중인 여행. 라벨 + 고정 2줄. */}
        <View className="mt-2.5">
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

        {/*
          아랫줄 — 왼쪽 지난 여행, 오른쪽 `CREATED 26/09/14` 한 줄(GROUP 만).
          실물 카드의 유효기간 줄이다. 구분선은 여행 슬롯에서 조금 더 떨어뜨렸다(mt-3.5).
        */}
        <View
          className="mt-3.5 flex-row items-center justify-between pt-2.5"
          style={{ borderTopWidth: 1, borderTopColor: theme.rule, height: 34 }}
        >
          <Text style={{ fontSize: 11.5, lineHeight: 16, color: theme.secondary, ...NUM }}>
            {`지난 여행 ${pastTripCount}회`}
          </Text>

          {/*
            CREATED — GROUP 은 groups.created_at, PERSONAL 은 가장 먼저 만든 개인 여행의
            trips.created_at(firstCreatedAt · "처음 개인 여행을 준비한 날"). (2026-09-15)
            ⚠️ PERSONAL 에 모임 생성일은 없다. 정렬용 createdAt(최근)도 쓰지 않는다.
          */}
          <View className="flex-row items-baseline" style={{ gap: 6 }}>
            <MetaLabel theme={theme}>CREATED</MetaLabel>
            <Text
              style={{ fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: theme.ink, ...NUM }}
            >
              {formatCardDate(group.kind === 'GROUP' ? group.createdAt : group.firstCreatedAt)}
            </Text>
          </View>
        </View>
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
