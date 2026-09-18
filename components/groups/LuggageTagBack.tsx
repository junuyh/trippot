// ============================================================================
// 상세 상단 패널 — 모임 상세(GROUP-02) · 개인 여행 상세 상단 공용 껍데기 (2026-09-18 · 단순화)
//
//    ╱──────────────────────────────╲
//   │  TRIPPOT 모임                  │   ← 연한 단색(모임 색 tint) 다각형 하나. 네 모서리 같은 사선.
//   │  경한다  ✎                     │      안쪽 흰 패널 · 포켓 · 구멍 · 알약 없음 — 글자가 배경 위에 바로 놓인다.
//   │  만든 날 · 멤버 …              │
//    ╲──────────────────────────────╱
//
// 이전(캐리어 태그 뒷면 · 컬러 몸통 + 흰 정보지 2중 구조)은 폐기했다. 파일명은 import 경로를
// 지키려고 그대로 둔다. 정보 구조 · 글꼴 · 색은 부모가 정한다.
// ============================================================================
import { useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { GroupCardTheme } from './cardTheme';

/** 네 모서리 사선 컷 크기. 좌우 같은 언어. */
const CHAMFER = 16;
const PAD_X = 18;
const PAD_TOP = 16;
const PAD_BOTTOM = 18;

/** hex 색을 흰색 쪽으로 t(0~1)만큼 섞는다. 모임 색에서 아주 연한 배경 · 테두리를 만든다. */
function tintToWhite(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** 네 모서리를 같은 크기로 깎은 다각형. */
function chamferedPanelPath(width: number, height: number, c: number): string {
  return [
    `M ${c} 0`,
    `H ${width - c}`,
    `L ${width} ${c}`,
    `V ${height - c}`,
    `L ${width - c} ${height}`,
    `H ${c}`,
    `L 0 ${height - c}`,
    `V ${c}`,
    'Z',
  ].join(' ');
}

type Props = {
  theme: GroupCardTheme;
  /** 패널 위 작은 라벨 글자. 예: 'TRIPPOT 모임' · 'PERSONAL'. 알약 없이 글자만. */
  label: string;
  /** 라벨과 같은 줄 오른쪽 끝에 놓는 메타(예: 만든 날). 없으면 라벨만. (2026-09-18 · 모임 상세) */
  labelRight?: ReactNode;
  children: ReactNode;
};

export function LuggageTagBack({ theme, label, labelRight, children }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  // 배경 = 모임 색을 흰색 쪽으로 94% 섞은 아주 연한 단색 — 강조 배경이 아니라 연한 배경지.
  // 계열(파랑·초록·분홍·노랑·주황·보라)만 알아볼 정도. 테두리는 조금 덜 섞어 윤곽만 살린다. (2026-09-18)
  const fill = tintToWhite(theme.tagStart, 0.94);
  const stroke = tintToWhite(theme.tagStart, 0.82);

  return (
    <View
      onLayout={onLayout}
      style={{
        paddingTop: PAD_TOP,
        paddingHorizontal: PAD_X,
        paddingBottom: PAD_BOTTOM,
        // 배경 · 테두리는 Svg 가 그린다. 그림자는 거의 없다.
        backgroundColor: 'transparent',
        shadowColor: theme.ink,
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {size.width > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Svg width={size.width} height={size.height}>
            <Path
              d={chamferedPanelPath(size.width, size.height, CHAMFER)}
              fill={fill}
              stroke={stroke}
              strokeWidth={1}
            />
          </Svg>
        </View>
      ) : null}

      {/* 라벨 줄 — 왼쪽 라벨(알약 없는 글자만) · 오른쪽 메타(있을 때). 세로 가운데 정렬. */}
      <View
        style={{
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontSize: 9.5,
            lineHeight: 12,
            fontWeight: '800',
            letterSpacing: 1,
            color: theme.accent,
          }}
        >
          {label}
        </Text>
        {labelRight ?? null}
      </View>

      {children}
    </View>
  );
}
