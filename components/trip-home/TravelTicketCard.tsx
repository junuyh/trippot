// TRIP-HOME 여행 티켓.
//
// 전달받은 HTML 시안(.boarding-pass)의 치수를 그대로 옮겼다.
//   visual  215px · 배경 #f5f7fa · 상단 라운드 16 · 도시명 워터마크
//   fund    padding 25/22/22 · amount 40px · bar 5px
//   절취선  두 영역 사이 점선 + 좌우 노치
//
// ⚠️ 항공권을 연상시키되 **실제 탑승권으로 오인하지 않게** 한다.
//    'BOARDING PASS' 대신 'NEXT TRIP · 도시' 를 쓴다.
//
// ⚠️ 비행기 위치 = 여행자금 준비율. 0% 출발지, 100% 도착지.
//    돈을 모을수록 비행기가 도착지로 움직인다. 이 화면의 핵심 은유다.
//
// ⚠️ 노치는 페이지 배경색 원으로 카드 테두리를 지워 만든다.
//    흰 원을 카드 위에 얹는 게 아니라 **테두리를 끊어** 실제로 파인 것처럼 보이게 한다.
//    (진짜 마스킹은 react-native-svg 가 필요한데 아직 설치돼 있지 않다)
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import type { CountryTheme } from '@/lib/constants/countryTheme';

const VISUAL_HEIGHT = 215;
/** 절취선 노치 반지름. 카드 좌우 경계 중앙에 원의 절반이 물린다 */
const NOTCH_R = 9;
const RADIUS = 16;
const LINE = '#e5e8ec';
const VISUAL_BG = '#f5f7fa';

/**
 * 티켓 위쪽(여정) 영역의 외곽선.
 *
 * 위 모서리는 둥글고, 아래쪽 좌우에는 노치의 **위쪽 4분원**이 파여 있다.
 * 이 path 로 실제로 잘라내므로 흰 원을 덮어 가리는 방식이 아니다.
 */
function topPath(w: number): string {
  return [
    `M ${RADIUS},0`,
    `H ${w - RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${w},${RADIUS}`,
    `V ${VISUAL_HEIGHT - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w - NOTCH_R},${VISUAL_HEIGHT}`,
    `H ${NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 0,${VISUAL_HEIGHT - NOTCH_R}`,
    `V ${RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${RADIUS},0`,
    'Z',
  ].join(' ');
}

/** 티켓 아래쪽(자금) 영역. 위쪽 좌우에 노치의 **아래쪽 4분원**이 파여 있다. */
function bottomPath(w: number, h: number): string {
  const top = 0;
  return [
    `M 0,${top + NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${NOTCH_R},${top}`,
    `H ${w - NOTCH_R}`,
    `A ${NOTCH_R},${NOTCH_R} 0 0 0 ${w},${top + NOTCH_R}`,
    `V ${h - RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 ${w - RADIUS},${h}`,
    `H ${RADIUS}`,
    `A ${RADIUS},${RADIUS} 0 0 1 0,${h - RADIUS}`,
    'Z',
  ].join(' ');
}

type Props = {
  theme: CountryTheme;
  flag: string;
  destinationEn: string;
  airportCode: string;
  departLabel: string | null;
  arriveLabel: string | null;
  ticketDate: string | null;
  headcount: number;
  dDayLabel: string | null;

  currentAmount: number;
  targetAmount: number;
  /** 0~100 */
  progress: number;

  nextTitle: string | null;
  nextDesc: string | null;
  /** 자금 영역을 누르면 예산 상세(BUDGET-01)로 간다 */
  onPressFund?: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function TravelTicketCard({
  theme,
  flag,
  destinationEn,
  airportCode,
  departLabel,
  arriveLabel,
  ticketDate,
  headcount,
  dDayLabel,
  currentAmount,
  targetAmount,
  progress,
  nextTitle,
  nextDesc,
  onPressFund,
}: Props) {
  // 자금이 늘면 비행기가 도착지 쪽으로 미끄러진다.
  const flight = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(flight, { toValue: progress, duration: 550, useNativeDriver: false }).start();
  }, [flight, progress]);

  const widthPercent = flight.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const shortage = Math.max(0, targetAmount - currentAmount);

  // SVG 로 카드 모양을 그리려면 실제 치수가 필요하다.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  const bottomHeight = Math.max(0, size.height - VISUAL_HEIGHT);

  return (
    <View
      onLayout={handleLayout}
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      }}
    >
      {/*
        카드 모양을 SVG 로 그린다. 절취선 노치가 **실제로 파인** 구조다.
        흰 원을 위에 덮는 방식이 아니라 path 자체에 4분원이 빠져 있다.
      */}
      {size.width > 0 ? (
        <Svg
          width={size.width}
          height={size.height}
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          {/* 위쪽(여정) — 회색 배경 */}
          <Path d={topPath(size.width)} fill={VISUAL_BG} stroke={LINE} strokeWidth={1} />
          {/* 도시명 워터마크. SVG 라 자간을 HTML 그대로 줄 수 있다 */}
          <SvgText
            x={16}
            y={VISUAL_HEIGHT - 6}
            fontSize={72}
            fontWeight="900"
            letterSpacing={-5}
            fill="rgba(17,24,39,0.022)"
          >
            {destinationEn}
          </SvgText>
          {/* 아래쪽(자금) — 흰 배경 */}
          <Path
            d={bottomPath(size.width, bottomHeight)}
            fill="#ffffff"
            stroke={LINE}
            strokeWidth={1}
            translateY={VISUAL_HEIGHT}
          />
        </Svg>
      ) : null}

      {/* ── 상단: 여정 ── */}
      <View style={{ height: VISUAL_HEIGHT }}>

        {/* 상단 라벨 */}
        <View
          style={{ position: 'absolute', left: 18, right: 18, top: 18 }}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-[7px]">
            <Text style={{ fontSize: 16 }}>{flag}</Text>
            <Text
              style={{ fontSize: 10, letterSpacing: 1.3, fontWeight: '900', color: '#111827' }}
            >
              NEXT TRIP · {destinationEn}
            </Text>
          </View>
          <Text style={{ fontSize: 10, letterSpacing: 1.3, color: '#7c8492' }}>
            TRIPPOT · {theme.code}
          </Text>
        </View>

        {/* 출발지 → 도착지 */}
        <View
          style={{ position: 'absolute', left: 20, right: 20, top: 64 }}
          className="flex-row items-center"
        >
          <View>
            <Text style={{ fontSize: 9, letterSpacing: 0.8, color: '#8b94a2' }}>FROM · SEOUL</Text>
            <Text
              style={{
                fontSize: 33,
                lineHeight: 33,
                fontWeight: '900',
                letterSpacing: -1,
                color: '#111827',
                marginTop: 4,
                marginBottom: 3,
              }}
            >
              ICN
            </Text>
            {departLabel ? (
              <Text style={{ fontSize: 10, color: '#7b8491' }}>{departLabel}</Text>
            ) : null}
          </View>

          {/* 경로 — 비행기가 준비율만큼 이동한다 */}
          <View style={{ flex: 1, height: 34, justifyContent: 'center', marginHorizontal: 10 }}>
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 17,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#b8bec7',
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: 16,
                height: 2,
                width: widthPercent,
                backgroundColor: theme.primary,
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                top: 5,
                left: widthPercent,
                marginLeft: -12.5,
                width: 25,
                height: 25,
                borderRadius: 12.5,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
                shadowOpacity: 0.22,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Ionicons name="airplane" size={13} color={theme.onPrimary} />
            </Animated.View>
          </View>

          <View className="items-end">
            <Text style={{ fontSize: 9, letterSpacing: 0.8, color: '#8b94a2' }}>
              TO · {destinationEn}
            </Text>
            <Text
              style={{
                fontSize: 33,
                lineHeight: 33,
                fontWeight: '900',
                letterSpacing: -1,
                color: '#111827',
                marginTop: 4,
                marginBottom: 3,
              }}
            >
              {airportCode}
            </Text>
            {arriveLabel ? (
              <Text style={{ fontSize: 10, color: '#7b8491' }}>{arriveLabel}</Text>
            ) : null}
          </View>
        </View>

        {/* 티켓 하단 정보 */}
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 19,
            paddingTop: 13,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#cbd0d6',
          }}
          className="flex-row justify-between"
        >
          <Text style={{ fontSize: 9, letterSpacing: 0.5, color: '#8c94a0' }}>
            STATUS
            <Text style={{ fontSize: 10, color: '#111827', fontWeight: '700' }}>
              {'  '}
              {progress >= 100 ? 'READY' : 'PREPARING'}
            </Text>
          </Text>
          <Text style={{ fontSize: 9, letterSpacing: 0.5, color: '#8c94a0' }}>
            PASSENGERS
            <Text style={{ fontSize: 10, color: '#111827', fontWeight: '700' }}>
              {'  '}
              {String(headcount).padStart(2, '0')}
            </Text>
          </Text>
          <Text style={{ fontSize: 9, letterSpacing: 0.5, color: '#8c94a0' }}>
            DATE
            <Text style={{ fontSize: 10, color: '#111827', fontWeight: '700' }}>
              {'  '}
              {ticketDate ?? '—'}
            </Text>
          </Text>
        </View>
      </View>

      {/* ── 하단: 여행자금 ── */}
      <Pressable
        accessibilityRole={onPressFund ? 'button' : undefined}
        accessibilityLabel={onPressFund ? '예산 상세 보기' : undefined}
        disabled={!onPressFund}
        onPress={onPressFund}
        style={{ paddingHorizontal: 22, paddingTop: 25, paddingBottom: 22 }}
        className={onPressFund ? 'active:opacity-80' : undefined}
      >
        {/* 절취선 */}
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: 0,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#cfd4da',
          }}
        />

        <View className="flex-row items-start justify-between">
          <Text style={{ fontSize: 12, color: '#747b88', fontWeight: '700' }}>현재 여행자금</Text>
          {dDayLabel ? (
            <View
              style={{
                backgroundColor: theme.primarySoft,
                paddingHorizontal: 9,
                paddingVertical: 7,
                borderRadius: 9,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primary }}>
                {dDayLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={{
            fontSize: 40,
            lineHeight: 46,
            fontWeight: '900',
            letterSpacing: -2,
            color: '#111827',
            marginTop: 4,
            marginBottom: 6,
          }}
        >
          {currentAmount.toLocaleString('ko-KR')}
          <Text style={{ fontSize: 16, letterSpacing: 0 }}>원</Text>
        </Text>

        <View className="flex-row justify-between">
          <Text style={{ fontSize: 12, color: '#747b88' }}>
            목표 <Text style={{ color: '#111827', fontWeight: '700' }}>{won(targetAmount)}</Text>
          </Text>
          <Text style={{ fontSize: 12, color: '#747b88' }}>
            {shortage > 0 ? (
              <>
                <Text style={{ color: '#111827', fontWeight: '700' }}>{won(shortage)}</Text> 남음
              </>
            ) : (
              '목표를 모두 모았어요'
            )}
          </Text>
        </View>

        <View
          style={{ height: 5, backgroundColor: '#eceef1', marginTop: 20, marginBottom: 8, overflow: 'hidden' }}
        >
          <Animated.View
            style={{ height: '100%', width: widthPercent, backgroundColor: theme.primary }}
          />
        </View>

        <View className="flex-row justify-between">
          <Text style={{ fontSize: 11, color: '#747b88' }}>TRAVEL FUND</Text>
          <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '700' }}>
            {Math.round(progress)}% 준비됨
          </Text>
        </View>

        {nextTitle ? (
          <View
            style={{ marginTop: 17, paddingTop: 15, borderTopWidth: 1, borderColor: LINE }}
            className="flex-row items-center gap-2.5"
          >
            <Ionicons name="paper-plane-outline" size={26} color={theme.primary} />
            <View className="flex-1">
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{nextTitle}</Text>
              {nextDesc ? (
                <Text style={{ fontSize: 10, color: '#747b88', marginTop: 3 }}>{nextDesc}</Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 18, color: '#b2b7c0' }}>›</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
