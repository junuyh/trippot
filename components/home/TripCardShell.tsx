// HOME-01 여행 카드 껍데기 — 가로 티켓.
//
// 왼쪽에 국가 색 스텁(세로 글자), 오른쪽에 흰 본문.
// 좌우 가장자리와 스텁 경계가 **반원으로 실제로 파여 있다.**
//
// ⚠️ 흰 원을 위에 덮는 방식이 아니다. SVG path 에서 호를 빼서 모양 자체를 잘라낸다.
//    원을 덮으면 카드 뒤 배경색이 바뀌는 순간 들통난다.
//    준비 홈의 components/trip-home/TravelTicketCard 와 같은 방식이다.
import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const STUB_WIDTH = 38;
/** 모서리 둥글기 */
const R = 14;
/** 가장자리에 파인 반원 반지름 */
const NOTCH_R = 7;
/** 스텁 경계의 구멍 개수 */
const PERFORATIONS = 9;

const LINE = '#E9ECF0';

/**
 * 카드 전체 외곽선. 좌우 가장자리 한가운데가 반원으로 파인다.
 *
 * 오른쪽은 내려가면서, 왼쪽은 올라가면서 호를 그린다.
 * 둘 다 카드 안쪽으로 볼록해야 파인 것처럼 보인다.
 */
function bodyPath(w: number, h: number): string {
  const cy = h / 2;
  return [
    `M ${R},0`,
    `H ${w - R}`,
    `A ${R},${R} 0 0 1 ${w},${R}`,
    `V ${cy - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w},${cy + NOTCH_R}`,
    `V ${h - R}`,
    `A ${R},${R} 0 0 1 ${w - R},${h}`,
    `H ${R}`,
    `A ${R},${R} 0 0 1 0,${h - R}`,
    `V ${cy + NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 0,${cy - NOTCH_R}`,
    `V ${R}`,
    `A ${R},${R} 0 0 1 ${R},0`,
    'Z',
  ].join(' ');
}

/** 왼쪽 스텁. 왼쪽 모서리만 둥글고 왼쪽 가장자리에도 같은 반원이 파인다. */
function stubPath(h: number): string {
  const cy = h / 2;
  return [
    `M ${STUB_WIDTH},0`,
    `H ${R}`,
    `A ${R},${R} 0 0 0 0,${R}`,
    `V ${cy - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 1 0,${cy + NOTCH_R}`,
    `V ${h - R}`,
    `A ${R},${R} 0 0 0 ${R},${h}`,
    `H ${STUB_WIDTH}`,
    'Z',
  ].join(' ');
}

type Props = {
  /** 스텁 배경색. 지난 여행은 회색을 넘긴다. */
  stubColor: string;
  /** 스텁에 세로로 세우는 글자. 보통 영문 도시명. */
  stubLabel: string;
  /** 스텁 글자색. */
  stubTextColor: string;
  children: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  /** 지나간 여행. 톤을 낮춘다. */
  muted?: boolean;
};

export function TripCardShell({
  stubColor,
  stubLabel,
  stubTextColor,
  children,
  accessibilityLabel,
  onPress,
  muted = false,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLayout={handleLayout}
      className="flex-row active:opacity-80"
      style={{
        opacity: muted ? 0.9 : 1,
        shadowColor: '#111827',
        shadowOpacity: 0.07,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
      }}
    >
      {size.width > 0 ? (
        <Svg
          width={size.width}
          height={size.height}
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <Path d={bodyPath(size.width, size.height)} fill="#FFFFFF" stroke={LINE} strokeWidth={1} />
          <Path d={stubPath(size.height)} fill={stubColor} />
        </Svg>
      ) : null}

      {/* 스텁 글자 */}
      <View style={{ width: STUB_WIDTH }} className="items-center justify-center">
        <Text
          numberOfLines={1}
          style={{
            color: stubTextColor,
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 1.6,
            transform: [{ rotate: '-90deg' }],
            width: 160,
            textAlign: 'center',
          }}
        >
          {stubLabel}
        </Text>
      </View>

      {/* 스텁 경계의 절취 구멍 */}
      <View
        className="absolute bottom-2 top-2 justify-between"
        style={{ left: STUB_WIDTH - 1.5, width: 3 }}
        pointerEvents="none"
      >
        {Array.from({ length: PERFORATIONS }).map((_, i) => (
          <View key={i} className="h-[3px] w-[3px] rounded-full bg-white" />
        ))}
      </View>

      {/* 오른쪽 본문 */}
      <View className="flex-1 px-4 py-3">{children}</View>
    </Pressable>
  );
}
