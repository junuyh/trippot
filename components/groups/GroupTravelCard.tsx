import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { TRIP_STATUS, TRIP_STATUS_LABEL } from '@/lib/constants/status';

import { pickGroupCardVariant, type GroupCardTheme } from './cardTheme';
import { formatCardDate, formatMemberCount, formatShortDateRange } from './format';
import type { GroupTravelCardData, GroupTripItem } from './types';

// ============================================================================
// GROUP-01 모임 카드 = **흰색 세로형 캐리어 네임 태그** (2026-09-18 · Iteration 2)
//
//           ╲ ╱               ← 평평한 스트랩 두 끝이 위로 벌어진다 (모임 색 · CORD_ROOM)
//            ▬                ← 작은 띠 매듭
//        ╱───◯───╲            ← 어깨 사선 · 실제로 뚫린 구멍(evenodd) · 중립 테
//       │         2명 │      ← 메타 · 오른쪽 끝선 (개인: [유저 아이콘] 개인)
//       │   로드트립   │      ← 모임명 · **가로 중앙** · 모임 색
//       │             │
//       │ 준비 중인 여행 │
//       │ 니스   09.17–…│     ← 여행지 왼쪽 · 기간 오른쪽
//       │ 오사카 10.31–…│
//       │          외 1건│
//       │             │
//       │ 지난 여행 0회 │
//       │ ─────────── │
//       │ CREATED 26/…│      ← 왼쪽 라벨 · 오른쪽 값
//        ╰───────────╯       ← 작은 radius
//
// 몸통은 모든 카드가 같다 — 흰 바탕 · 얇은 중립 테두리 · 약한 그림자 · 작은 radius.
// 모임 구분은 **끈 색 + 모임명 색**뿐(canonical color). 몸통을 색으로 채우지 않는다.
// 장식은 없다. 태그라는 표시는 실루엣 · 구멍 · 평평한 스트랩 · 작은 매듭으로 충분하다.
// 톤은 여행준비홈과 같은 제품군: 큰 잉크 타이틀 · 자간 있는 작은 라벨 · 제한된 radius · 넉넉한 여백.
// 2열 그리드용 — 폭은 목록이 정해 주고, 높이는 콘텐츠와 무관하게 고정(세로로 길다).
// ============================================================================

/** 카드에 그리는 진행 중 여행 최대 건수. 초과분은 보조행 '외 N건' 으로 접는다. */
const MAX_VISIBLE_TRIPS = 2;
/** 여행 한 건 = 한 줄 (여행지 왼쪽 · 기간 오른쪽). */
const TRIP_LINE = 22;
/** '외 N건' 보조행. 없을 때도 자리를 비워 둔다 — 카드 높이 고정. */
const TRIP_EXTRA_LINE = 14;
/** 진행 중 여행 영역 고정 높이. 0건이든 6건이든 같다 — "같은 화면의 모든 카드는 같은 높이". */
const TRIP_SLOT_HEIGHT = TRIP_LINE * MAX_VISIBLE_TRIPS + TRIP_EXTRA_LINE;
/** 기간 열 폭. '12.28 – 27.01.03'(가장 긴 꼴)이 11px 로 들어간다. 여행지는 나머지를 쓰고 말줄임. */
const DATE_COL_WIDTH = 84;

/** 태그 위로 나가는 끈 끝 공간. 카드 View 의 위쪽 padding 이고 태그 몸통은 이 아래에서 시작한다. */
const CORD_ROOM = 26;
/** 머리 영역(구멍). 정보는 이 아래에서 시작한다. */
const HEAD_HEIGHT = 54;
const SIDE = 14;
const BOTTOM = 18;
/** 어깨: 위 변이 양쪽에서 이만큼 좁고, SHOULDER_HEIGHT 까지 사선으로 벌어진다. */
const SHOULDER_RATIO = 0.22;
const SHOULDER_HEIGHT = 30;
/** 모서리 — 작게. 둥근 카드가 아니라 태그다. */
const TOP_RADIUS = 3;
const JOINT_RADIUS = 3;
const BOTTOM_RADIUS = 8;
/** 구멍 — 위 변 가운데. 몸통 Path 의 evenodd 서브패스라 뒤가 그대로 비친다. */
const HOLE_CY = 19;
const HOLE_R = 4.5;

/** 중립색 — 여행준비홈과 같은 잉크 · 회색 · 테두리. 모임 색은 여기 없다. */
const INK = '#111827';
const GRAY = '#8C94A0';
const GRAY_LIGHT = '#A9B0BA';
const BORDER = '#E3E6EB';
const DIVIDER = '#EDF0F2';
const HOLE_RING = '#D3D7DE';

/** 끈 끝이 벌어지는 방향 변형 수. 같은 색끼리도 조금 다르게 보이는 작은 비대칭. */
const LEAN_VARIANTS = 3;

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

type Pt = [number, number];

/** 꼭짓점마다 반지름이 다른 둥근 다각형. 각 꼭짓점을 r 만큼 앞뒤에서 잘라 Q 곡선으로 잇는다. */
function roundedPolygon(points: Pt[], radii: number[]): string {
  const n = points.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const [px, py] = points[i];
    const [ax, ay] = points[(i - 1 + n) % n];
    const [bx, by] = points[(i + 1) % n];
    const la = Math.hypot(ax - px, ay - py);
    const lb = Math.hypot(bx - px, by - py);
    const d = Math.min(radii[i], la / 2, lb / 2);
    const sx = px + ((ax - px) / la) * d;
    const sy = py + ((ay - py) / la) * d;
    const ex = px + ((bx - px) / lb) * d;
    const ey = py + ((by - py) / lb) * d;
    parts.push(
      `${i === 0 ? 'M' : 'L'} ${sx.toFixed(2)} ${sy.toFixed(2)} Q ${px} ${py} ${ex.toFixed(2)} ${ey.toFixed(2)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/** 태그 실루엣 — 위 변(좁음) → 어깨 사선 → 곧은 옆 변 → 작은 radius 의 아래 모서리. */
function tagOutline(width: number, height: number, top: number): string {
  const s = Math.round(width * SHOULDER_RATIO);
  const points: Pt[] = [
    [s, top],
    [width - s, top],
    [width, top + SHOULDER_HEIGHT],
    [width, top + height],
    [0, top + height],
    [0, top + SHOULDER_HEIGHT],
  ];
  return roundedPolygon(points, [
    TOP_RADIUS,
    TOP_RADIUS,
    JOINT_RADIUS,
    BOTTOM_RADIUS,
    BOTTOM_RADIUS,
    JOINT_RADIUS,
  ]);
}

/** 반시계 원 서브패스. 몸통 뒤에 evenodd 로 붙이면 구멍이 된다. */
function holeSubpath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/** 같은 hue 를 t(0~1)만큼 어둡게 — 스트랩 그늘 전용(10%). 제목 · 스트랩 면에는 쓰지 않는다. */
function darken(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * (1 - t));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * 평평한 스트랩 한 조각 — (x0,y0) 폭 w0 에서 (x1,y1) 폭 w1 로 가는 사각형. 둥근 끈이 아니라 얇은 리본.
 */
function strapPath(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts = [
    [x0 + (nx * w0) / 2, y0 + (ny * w0) / 2],
    [x1 + (nx * w1) / 2, y1 + (ny * w1) / 2],
    [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2],
    [x0 - (nx * w0) / 2, y0 - (ny * w0) / 2],
  ];
  return `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
}

/**
 * 스트랩 — **단색 filled shape**. 외곽선 · 질감 · 하이라이트 없음. 입체감은 같은 hue 10% 어두운 면을
 * 아래·오른쪽으로 0.7 민 것뿐. 끝은 같은 색 1px stroke(round join)로만 아주 살짝 둥글다.
 */
function Strap({ d, base, shade }: { d: string; base: string; shade: string }) {
  return (
    <>
      <Path d={d} fill={shade} stroke={shade} strokeWidth={1} strokeLinejoin="round" transform="translate(0.5 0.7)" />
      <Path d={d} fill={base} stroke={base} strokeWidth={1} strokeLinejoin="round" />
    </>
  );
}

/**
 * 태그 그림 — 카드 View 와 같은 크기의 Svg 한 장. 흰 몸통 · 구멍 · 스트랩 · 작은 매듭.
 *
 * 스트랩: 평평한 끈 두 가닥이 구멍을 통과해 바로 위에서 작은 띠로 묶이고, 그 위로 두 끝이
 * 벌어지며 짧게 뻗는다. 고리 · 리본 bow 없음. 그리는 순서가 "통과" 를 만든다:
 *   ① 구멍 뒤를 지나는 토막 → ② 흰 몸통(구멍은 뚫림 · ①이 비친다) → ③ 구멍 테 → ④ 끈 끝 · 매듭
 */
function TagArtwork({
  width,
  height,
  theme,
  lean,
  selected,
}: {
  width: number;
  height: number;
  theme: GroupCardTheme;
  /** -1 · 0 · 1 — 끈 끝이 벌어지는 방향 */
  lean: number;
  selected: boolean;
}) {
  const tagHeight = height - CORD_ROOM;
  const cx = width / 2;
  const hy = CORD_ROOM + HOLE_CY;
  const body = `${tagOutline(width, tagHeight, CORD_ROOM)} ${holeSubpath(cx, hy, HOLE_R)}`;

  // 스트랩 색 = 모임 canonical color 그대로(변환 없음). 그늘만 같은 hue 10% 어둡게.
  const cord = theme.tagStart;
  const cordShade = darken(theme.tagStart, 0.1);

  const tilt = lean * 3;
  const knotY = hy - 9;
  // 구멍을 지나 매듭까지 — 몸통 뒤. 구멍으로만 보인다. (폭 2.6 평평한 띠)
  const through = strapPath(cx, hy + 8, cx, knotY, 2.6, 2.6);
  // 매듭 위로 뻗는 두 끝 — 매듭 쪽은 좁고(2.6) 끝으로 갈수록 약간 넓다(3.6). 위 CORD_ROOM 안에서 끝난다.
  const endLeft = strapPath(cx - 1.4, knotY - 1.5, cx - 10 + tilt, 5, 2.6, 3.6);
  const endRight = strapPath(cx + 1.4, knotY - 1.5, cx + 9 + tilt, 4, 2.6, 3.6);
  // 매듭 — 두 가닥을 한 번 조인 작은 사다리꼴 띠(왼쪽 3.8 → 오른쪽 3.0). 캐릭터 매듭 · bow 없음.
  const knot = strapPath(cx - 3.6, knotY, cx + 3.6, knotY, 3.8, 3.0);

  return (
    <Svg width={width} height={height} pointerEvents="none">
      {/* ① 구멍 뒤로 지나가는 띠 */}
      <Strap d={through} base={cord} shade={cordShade} />

      {/* ② 흰 몸통 — 얇은 중립 테두리. 구멍이 뚫려 있다 */}
      <Path d={body} fill="#FFFFFF" fillRule="evenodd" stroke={BORDER} strokeWidth={1} />

      {/* ③ 구멍 테 — 중립 1.2px. 매듭보다 눈에 띄지 않게. */}
      <Circle cx={cx} cy={hy} r={HOLE_R + 0.6} fill="none" stroke={HOLE_RING} strokeWidth={1.2} />

      {/* ④ 끈 끝 · 매듭 */}
      <Strap d={endLeft} base={cord} shade={cordShade} />
      <Strap d={endRight} base={cord} shade={cordShade} />
      <Strap d={knot} base={cord} shade={cordShade} />

      {/* 편집 모드 선택 — 실루엣을 따라 얇은 accent 테두리. 몸통은 그대로 흰색. */}
      {selected ? (
        <Path d={body} fill="none" fillRule="evenodd" stroke={theme.tagEnd} strokeWidth={1.5} />
      ) : null}
    </Svg>
  );
}

/**
 * 여행 한 줄 — 왼쪽 여행지(남는 폭 · 말줄임) · 오른쪽 기간(고정 폭 · 오른쪽 끝선).
 *   니스            09.17 – 09.19
 *   오사카          10.31 – 11.01
 */
function TripLine({ trip, statusNote }: { trip: GroupTripItem; statusNote?: string }) {
  return (
    <View className="flex-row items-center" style={{ height: TRIP_LINE }}>
      <View className="flex-1 flex-row items-center">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="shrink"
          style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', color: INK }}
        >
          {trip.destination ?? '여행지 미정'}
        </Text>
        {/* 섹션 라벨과 상태가 다른 줄에만 작게 상태를 적는다. (여행 중 라벨 아래의 준비 중 여행) */}
        {statusNote ? (
          <Text
            numberOfLines={1}
            className="shrink-0"
            style={{ fontSize: 10, lineHeight: 18, color: GRAY_LIGHT }}
          >
            {` · ${statusNote}`}
          </Text>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          width: DATE_COL_WIDTH,
          textAlign: 'right',
          fontSize: 11,
          lineHeight: 18,
          color: GRAY,
          ...NUM,
        }}
      >
        {formatShortDateRange(trip.startDate, trip.endDate)}
      </Text>
    </View>
  );
}

/** 작은 대문자 라벨 — 자간 있는 uppercase. 여행준비홈의 라벨 문법. */
function MetaLabel({ children, color = GRAY }: { children: string; color?: string }) {
  return (
    <Text style={{ fontSize: 9, lineHeight: 12, letterSpacing: 1.3, fontWeight: '700', color }}>
      {children}
    </Text>
  );
}

/**
 * 모임 카드 — 흰색 세로형 캐리어 네임 태그. (docs/09_IA_v1.md §3-1)
 *
 * 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수 · 만든 날(GROUP=모임 · PERSONAL=첫 개인 여행)을 담는다.
 * 몸통은 모든 카드가 같은 흰 태그다. 모임 구분은 끈 색과 모임명 색(canonical color)뿐 —
 * 목록이 cardTheme.assignGroupCardThemes 로 겹치지 않게 배정해 준다. 개인 여행은 lavender 고정.
 *
 * 정렬 (사용자 시안 기준): 모임명 = 가로 중앙 · 인원/PERSONAL = 오른쪽 · 여행지 왼쪽/기간 오른쪽 ·
 * CREATED 왼쪽/값 오른쪽. 블록 사이는 넉넉히 띄워 위·중간·아래가 따로 읽힌다.
 *
 * 일반 모드 — 카드를 누르면 모임 상세로 간다. (docs/03 POL-NAV-001)
 * 편집 모드 — 상세 이동을 막고 선택 토글로 바꾼다. 선택 원은 메타 줄 왼쪽에 들어가고(인원은 오른쪽 유지),
 *            선택되면 실루엣을 따라 얇은 accent 테두리가 **덧그려진다**(Svg · 크기 불변).
 *
 * ── 높이 정책 ─────────────────────────────────────────────────────────────
 * 폭은 목록(2열 그리드)이 정하고, 높이는 콘텐츠와 무관하게 정해진다.
 *   - 모든 텍스트가 1줄 고정 + 명시적 leading
 *   - 진행 중 여행 영역은 건수와 무관하게 TRIP_SLOT_HEIGHT 고정('외 N건' 행 포함)
 *   - 편집 UI 는 메타 줄 안과 Svg 테두리라 세로에 영향이 없다
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
  const lean = pickGroupCardVariant(group, LEAN_VARIANTS) - 1;
  // 모임명 · 메타 · 선택 원 = canonical vivid 그대로. (tagEnd 는 한 단 진한 값이라 제목에 쓰면 탁해 보였다 · 2026-09-18)
  const accent = theme.tagStart;

  const visibleTrips = ongoingTrips.slice(0, MAX_VISIBLE_TRIPS);
  const hiddenCount = ongoingTrips.length - visibleTrips.length;

  /**
   * 섹션 라벨 = 대표 여행(첫 줄)의 상태. 화면이 여행 중을 먼저 세워 보내므로 첫 줄이 TRAVELING 이면
   * '여행 중인 여행', 아니면 '준비 중인 여행'. 상태는 trips.status(DB) 그대로 — 여기서 날짜로 판정하지 않는다.
   * 라벨 문구는 앱 기존 표현(TRIP_STATUS_LABEL · MY 목록 "지금 여행 중인 여행이 없어요")에 맞춘다. (2026-09-18)
   */
  const representativeTraveling = visibleTrips[0]?.status === TRIP_STATUS.TRAVELING;
  const tripSectionLabel = representativeTraveling
    ? `${TRIP_STATUS_LABEL.TRAVELING}인 여행`
    : `${TRIP_STATUS_LABEL.PLANNING}인 여행`;

  // 개인 여행은 숨길 수 없다. 숨김 설정이 group_id 기준이라 대상이 없다.
  const selectable = group.kind === 'GROUP';
  const showSelectedRing = editMode && selectable && selected;

  // 태그 그림(Svg)은 카드 크기에 맞춘다.
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
      className="active:opacity-85"
      style={{
        // 몸통 · 구멍 · 끈은 전부 TagArtwork(Svg)가 그린다. View 는 투명.
        backgroundColor: 'transparent',
        paddingTop: CORD_ROOM + HEAD_HEIGHT,
        paddingHorizontal: SIDE,
        paddingBottom: BOTTOM,
        // 아주 약한 그림자. 투명 View 의 그림자는 그려진 내용(태그 실루엣)을 따라간다.
        shadowColor: INK,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {size.width > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <TagArtwork
            width={size.width}
            height={size.height}
            theme={theme}
            lean={lean}
            selected={showSelectedRing}
          />
        </View>
      ) : null}

      {/* 메타 줄 — 인원(GROUP) / 개인(PERSONAL) 은 **오른쪽 끝선**, 같은 문법. 편집 모드 선택 원은 왼쪽. */}
      <View className="flex-row items-center justify-between" style={{ height: 16 }}>
        <View>
          {editMode && selectable ? (
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={selected ? accent : theme.unselected}
            />
          ) : null}
        </View>
        {group.kind === 'GROUP' ? (
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={12} color={GRAY} />
            <Text
              className="ml-1"
              style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: GRAY, ...NUM }}
            >
              {formatMemberCount(group.memberCount)}
            </Text>
          </View>
        ) : (
          // 개인 여행은 모임원이 없다. 인원 자리에 같은 문법으로 [MY 유저 아이콘] 개인. '1명' 을 만들지 않는다.
          // 아이콘은 MY 탭 · 프로필과 같은 Ionicons person(-outline). (2026-09-18 · PERSONAL 라벨 폐기)
          <View className="flex-row items-center">
            <Ionicons name="person-outline" size={12} color={accent} />
            <Text className="ml-1" style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: accent }}>
              개인
            </Text>
          </View>
        )}
      </View>

      {/* 모임명 — 카드의 주인공. **가로 중앙**. 모임 색. */}
      <Text
        numberOfLines={1}
        style={{
          marginTop: 10,
          textAlign: 'center',
          fontSize: 18,
          lineHeight: 24,
          fontWeight: '800',
          letterSpacing: -0.3,
          color: accent,
        }}
      >
        {group.name}
      </Text>

      {/* 진행 중 여행 — 섹션 라벨(대표 여행 상태) + 고정 슬롯(2줄 + 보조행). 제목과 넉넉히 띄운다. */}
      <Text
        style={{ marginTop: 24, fontSize: 9.5, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5, color: GRAY }}
      >
        {tripSectionLabel}
      </Text>
      <View style={{ height: TRIP_SLOT_HEIGHT, marginTop: 6 }}>
        {visibleTrips.length === 0 ? (
          <View style={{ height: TRIP_LINE }} className="justify-center">
            <Text style={{ fontSize: 12, lineHeight: 18, color: GRAY_LIGHT }}>준비 중인 여행이 없어요.</Text>
          </View>
        ) : (
          <>
            {visibleTrips.map((trip) => {
              const lineTraveling = trip.status === TRIP_STATUS.TRAVELING;
              const statusNote =
                lineTraveling === representativeTraveling
                  ? undefined
                  : lineTraveling
                    ? TRIP_STATUS_LABEL.TRAVELING
                    : TRIP_STATUS_LABEL.PLANNING;
              return <TripLine key={trip.tripId} trip={trip} statusNote={statusNote} />;
            })}
            {/* 보조행 — 오른쪽 끝선(기간 열)에 맞춘다. */}
            {hiddenCount > 0 ? (
              <Text
                style={{
                  height: TRIP_EXTRA_LINE,
                  textAlign: 'right',
                  fontSize: 10,
                  lineHeight: TRIP_EXTRA_LINE,
                  color: GRAY_LIGHT,
                  ...NUM,
                }}
              >
                {`외 ${hiddenCount}건`}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* 하단 블록 — 중간 블록과 크게 띄운다. 지난 여행 → divider → CREATED 줄. */}
      <Text style={{ marginTop: 20, fontSize: 11, lineHeight: 16, color: GRAY, ...NUM }}>
        {`지난 여행 ${pastTripCount}회`}
      </Text>

      <View style={{ marginTop: 12, height: 1, backgroundColor: DIVIDER }} />

      {/*
        CREATED 줄 — 왼쪽 라벨 · 오른쪽 값, 한 줄.
        GROUP 은 groups.created_at, PERSONAL 은 가장 먼저 만든 개인 여행의
        trips.created_at(firstCreatedAt · "처음 개인 여행을 준비한 날"). (2026-09-15)
        ⚠️ PERSONAL 에 모임 생성일은 없다. 정렬용 createdAt(최근)도 쓰지 않는다.
      */}
      <View className="flex-row items-center justify-between" style={{ marginTop: 12, height: 16 }}>
        <MetaLabel>CREATED</MetaLabel>
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', color: INK, ...NUM }}>
          {formatCardDate(group.kind === 'GROUP' ? group.createdAt : group.firstCreatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}
