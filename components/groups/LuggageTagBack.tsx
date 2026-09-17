// ============================================================================
// 캐리어 태그 **뒷면** — 모임 상세(GROUP-02) · 개인 여행 상세 상단 공용 껍데기 (2026-09-17)
//
//   ╲┌────────────────────────────────┐
//   ◯│ [라벨]                          │   ← 목록 카드(앞면)와 **같은 실루엣**(luggageTag.ts):
//    │ ━━━━━━ 포켓 입구 ━━━━━━━━━━━━━ │      왼쪽 사선 머리 · 실제로 뚫린 끈 구멍
//    │ ┌── 흰 정보지(꽂힌 카드) ────┐   │
//    │ │ children                   │   │
//    │ └────────────────────────────┘   │
//   ╱└────────────────────────────────┘
//
// 목록에서 누른 태그를 뒤집어 정보지를 읽는 느낌. 같은 모임 색(canonical theme) 몸통.
// 정보 구조는 부모가 정한다(모임: 이름·연필·만든 날·멤버 / 개인: 제목·설명). 질감 · 사진 같은 사실감 없음.
// ============================================================================
import { useId, useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { GroupCardTheme } from './cardTheme';
import { TAG_HOLE_CX, TAG_HOLE_R, luggageTagBodyPath, luggageTagHolePath } from './luggageTag';

const HEAD = 38;
const SIDE = 14;
const BOTTOM = 14;

type Props = {
  theme: GroupCardTheme;
  /** 태그 몸통 위 라벨 알약 글자. 예: 'TRIPPOT 모임' · 'PERSONAL' */
  label: string;
  /** 꽂힌 흰 정보지 안 내용 */
  children: ReactNode;
};

export function LuggageTagBack({ theme, label, children }: Props) {
  const gradientId = useId();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const body = size.width > 0 ? luggageTagBodyPath(size.width, size.height) : '';

  return (
    <View
      onLayout={onLayout}
      style={{
        paddingTop: HEAD,
        paddingLeft: SIDE + 4,
        paddingRight: SIDE,
        paddingBottom: BOTTOM,
        // 몸통 · 구멍 · 테두리는 Svg 가 그린다. 그림자는 그려진 실루엣을 따라간다.
        backgroundColor: 'transparent',
        shadowColor: theme.ink,
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      }}
    >
      {size.width > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Svg width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={theme.tagStart} />
                <Stop offset="1" stopColor={theme.tagEnd} />
              </LinearGradient>
            </Defs>
            <Path d={body} fill={`url(#${gradientId})`} fillRule="evenodd" />
            <Path d={luggageTagHolePath()} fill="none" stroke={theme.ink} strokeWidth={1.5} opacity={0.35} />
            <Path d={body} fill="none" fillRule="evenodd" stroke={theme.ink} strokeWidth={1} opacity={0.22} />
          </Svg>
        </View>
      ) : null}

      {/* 머리: 라벨 알약 — 구멍 오른쪽부터 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: TAG_HOLE_CX + TAG_HOLE_R + 9,
          top: 0,
          height: HEAD,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 9.5, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8, color: theme.accent }}>
            {label}
          </Text>
        </View>
      </View>

      {/* 포켓 입구 — 정보지가 여기로 꽂혀 있다는 한 줄. 카드 위 가장자리에 걸친다. */}
      <View
        style={{
          marginBottom: -3,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.ink,
          opacity: 0.28,
        }}
      />

      {/* 꽂힌 흰 정보지 */}
      <View
        style={{
          marginHorizontal: 4,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.rule,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 14,
          shadowColor: theme.ink,
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {children}
      </View>
    </View>
  );
}
