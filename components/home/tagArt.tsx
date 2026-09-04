// ============================================================================
// 지난 여행 태그의 나라 그림 (2026-09-04)
//
// 러기지 태그 한 장이 "어느 나라에 다녀왔는가" 를 글자 없이도 말하게 한다.
// 도쿄 태그에는 후지산과 도리이가, 세부 태그에는 야자수와 바다가 있어야
// 목록을 훑을 때 도시 이름을 읽기 전에 어느 여행인지 알아본다.
//
// 구성은 두 겹이다.
//
//   1. 실루엣   lib/constants/countryLandmark 를 그대로 쓴다.
//              후지산·에펠탑·콜로세움·동방명주·타이베이101·빅토리아하버·야자수가
//              이미 있고, 모르는 나라는 언덕으로 떨어진다. 여기서 다시 그리면
//              같은 나라를 두 벌 관리하게 된다.
//
//   2. 덧그림   이 파일. 실루엣만으로 부족한 그 나라의 인상을 얹는다.
//              도리이·벚꽃 / 구름 / 사이프러스 / 홍등 / 천등 / 정크선 / 갈매기·물결
//
// ⚠️ countryLandmark 는 여러 화면이 함께 쓰는 파일이라 고치지 않았다. (CLAUDE.md 5장)
//    태그에만 필요한 장식은 전부 이 파일 안에 있다.
//
// ⚠️ 좌표계는 countryLandmark 와 같은 100 × 60 이고 y = 60 이 지면이다.
//    덧그림도 같은 좌표계라야 실루엣과 발이 맞는다.
//
// ⚠️ 색은 두 가지뿐이다 — 그 여행의 국가색(countryTheme.primary)과 종이 위 회색.
//    참고 디자인처럼 여러 색을 쓰면 카드마다 색 조합이 달라져 목록이 알록달록해진다.
// ============================================================================
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { countryLandmark } from '@/lib/constants/countryLandmark';

/** 덧그림 한 조각의 색 역할. 실제 색은 그리는 쪽에서 국가색과 함께 정한다. */
type Role = 'accent' | 'ink' | 'soft';

type Piece = { d: string; role: Role };
type Stroke = Piece & { w?: number };
type Dot = { cx: number; cy: number; r: number; role: Role };

export type TagArt = {
  /** 왼쪽 띠에 세로로 적는 현지 표기. 한자권이 아니면 영문과 같다. */
  native: string;
  /** 왼쪽 띠의 영문 국가명. */
  latin: string;
  /** 띠 위쪽 작은 아이콘. 그 나라를 떠올리게 하는 것 하나. */
  icon: 'airplane' | 'flower' | 'wine' | 'pizza' | 'flame' | 'balloon' | 'boat' | 'leaf';
  /** 실루엣을 국가색으로 칠할지. 실루엣 자체가 그 나라 색인 나라만 accent 다. */
  landmarkRole: 'accent' | 'ink';
  /**
   * 실루엣에 딸린 동그라미를 그릴지.
   *
   * ⚠️ 일본·기타 국가의 동그라미는 **해**다. 태그는 위쪽에 해를 따로 그리므로
   *    그대로 두면 해가 두 개가 된다. 중국의 동그라미는 동방명주의 구체라 그린다.
   */
  landmarkCircles: boolean;
  /** 아래 가장자리 무늬. 바다를 낀 나라는 물결, 나머지는 항공우편 사선이다. */
  edge: 'stripe' | 'wave';
  fills?: Piece[];
  strokes?: Stroke[];
  dots?: Dot[];
};

/** 실루엣의 종이색 회색. 국가색과 다투지 않게 무채색에 가깝다. */
const SILHOUETTE = '#a8a394';
/** 구름처럼 더 물러나야 하는 것. */
const SOFT = '#ded7c5';

function roleColor(role: Role, accent: string): string {
  if (role === 'accent') return accent;
  if (role === 'soft') return SOFT;
  return SILHOUETTE;
}

// ── 나라별 덧그림 ──────────────────────────────────────────────────────────

/** 일본 — 후지산(실루엣) 앞의 도리이와 벚꽃 가지 */
const JAPAN: TagArt = {
  native: '日本',
  latin: 'JAPAN',
  icon: 'flower',
  landmarkRole: 'ink',
  landmarkCircles: false,
  edge: 'stripe',
  fills: [
    // 기둥 두 개가 산 앞에 선다. 산보다 진한 국가색이라 앞으로 읽힌다
    { d: 'M 48 60 L 50 34 L 54 34 L 53 60 Z', role: 'accent' },
    { d: 'M 68 60 L 66 34 L 62 34 L 63 60 Z', role: 'accent' },
    { d: 'M 47 38 L 69 38 L 69 41.5 L 47 41.5 Z', role: 'accent' },
    // 위로 휜 가사기. 도리이를 도리이로 보이게 하는 건 이 곡선이다
    { d: 'M 42 29 Q 58 25 74 29 L 74 33 Q 58 29 42 33 Z', role: 'accent' },
  ],
  strokes: [{ d: 'M 98 3 Q 90 9 82 18', role: 'ink', w: 0.9 }],
  dots: [
    { cx: 84, cy: 8, r: 2.4, role: 'accent' },
    { cx: 91, cy: 12, r: 2.2, role: 'accent' },
    { cx: 86, cy: 16, r: 1.8, role: 'accent' },
    { cx: 94, cy: 19, r: 1.5, role: 'accent' },
  ],
};

/** 프랑스 — 에펠탑(실루엣) 위 구름과 새 */
const FRANCE: TagArt = {
  native: 'FRANCE',
  latin: 'FRANCE',
  icon: 'wine',
  landmarkRole: 'ink',
  landmarkCircles: true,
  edge: 'stripe',
  strokes: [
    { d: 'M 6 34 q 2.5 -2.5 5 0 q 2.5 -2.5 5 0', role: 'ink', w: 0.9 },
    { d: 'M 16 26 q 2 -2 4 0 q 2 -2 4 0', role: 'ink', w: 0.8 },
  ],
  dots: [
    { cx: 14, cy: 15, r: 4.5, role: 'soft' },
    { cx: 21, cy: 14, r: 6, role: 'soft' },
    { cx: 28, cy: 16, r: 4, role: 'soft' },
    { cx: 78, cy: 24, r: 4, role: 'soft' },
    { cx: 85, cy: 23, r: 5.5, role: 'soft' },
    { cx: 92, cy: 25, r: 3.5, role: 'soft' },
  ],
};

/** 이탈리아 — 콜로세움(실루엣) 양옆의 사이프러스 */
const ITALY: TagArt = {
  native: 'ITALIA',
  latin: 'ITALY',
  icon: 'pizza',
  landmarkRole: 'ink',
  landmarkCircles: true,
  edge: 'stripe',
  fills: [
    { d: 'M 8 60 Q 4 42 8 26 Q 12 42 8 60 Z', role: 'accent' },
    { d: 'M 93 60 Q 89 45 93 31 Q 97 45 93 60 Z', role: 'accent' },
  ],
};

/** 중국 — 동방명주(실루엣) 앞에 매달린 홍등 */
const CHINA: TagArt = {
  native: '中國',
  latin: 'CHINA',
  icon: 'flame',
  landmarkRole: 'ink',
  landmarkCircles: true,
  edge: 'stripe',
  fills: [
    {
      d: 'M 11 16 Q 11 11.5 16 11.5 Q 21 11.5 21 16 Q 21 20.5 16 20.5 Q 11 20.5 11 16 Z',
      role: 'accent',
    },
    { d: 'M 24 9 Q 24 5.5 27 5.5 Q 30 5.5 30 9 Q 30 12.5 27 12.5 Q 24 12.5 24 9 Z', role: 'accent' },
  ],
  strokes: [
    { d: 'M 16 0 L 16 11.5', role: 'accent', w: 0.8 },
    { d: 'M 27 0 L 27 5.5', role: 'accent', w: 0.8 },
    // 등 아래로 늘어진 술
    { d: 'M 16 20.5 L 16 24', role: 'accent', w: 1 },
    { d: 'M 27 12.5 L 27 15.5', role: 'accent', w: 1 },
  ],
};

/** 대만 — 타이베이101(실루엣) 옆으로 떠오르는 천등 */
const TAIWAN: TagArt = {
  native: '臺灣',
  latin: 'TAIWAN',
  icon: 'balloon',
  landmarkRole: 'ink',
  landmarkCircles: true,
  edge: 'stripe',
  fills: [
    { d: 'M 13 13 L 22 13 L 24 22 L 11 22 Z', role: 'accent' },
    { d: 'M 26 28 L 33 28 L 34.5 34 L 24.5 34 Z', role: 'accent' },
    { d: 'M 78 20 L 86 20 L 88 28 L 76 28 Z', role: 'accent' },
  ],
};

/** 홍콩 — 빅토리아 하버 스카이라인(실루엣) 앞의 정크선과 물결 */
const HONGKONG: TagArt = {
  native: '香港',
  latin: 'HONG KONG',
  icon: 'boat',
  landmarkRole: 'ink',
  landmarkCircles: true,
  edge: 'wave',
  fills: [
    { d: 'M 10 54 L 10 34 L 23 54 Z', role: 'accent' },
    { d: 'M 4 54 L 27 54 L 23 58.5 L 8 58.5 Z', role: 'accent' },
  ],
  strokes: [
    { d: 'M 30 57 q 5 -2.5 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0', role: 'accent', w: 1.1 },
  ],
};

/** 필리핀 — 야자수와 섬(실루엣) 위의 갈매기, 아래의 바다 */
const PHILIPPINES: TagArt = {
  native: 'PILIPINAS',
  latin: 'PHILIPPINES',
  icon: 'leaf',
  landmarkRole: 'accent',
  landmarkCircles: true,
  edge: 'wave',
  strokes: [
    { d: 'M 26 14 q 3 -3 6 0 q 3 -3 6 0', role: 'ink', w: 1 },
    { d: 'M 40 7 q 2.5 -2.5 5 0 q 2.5 -2.5 5 0', role: 'ink', w: 0.9 },
    { d: 'M 18 22 q 2 -2 4 0 q 2 -2 4 0', role: 'ink', w: 0.8 },
    {
      d: 'M 0 56 q 5 -2.5 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0',
      role: 'accent',
      w: 1.2,
    },
  ],
};

/** 목적지 국가를 모를 때. 언덕(실루엣) 위의 새 두 마리뿐이다 */
const DEFAULT: TagArt = {
  native: 'WORLD',
  latin: 'TRAVEL',
  icon: 'airplane',
  landmarkRole: 'ink',
  landmarkCircles: false,
  edge: 'stripe',
  strokes: [
    { d: 'M 20 18 q 3 -3 6 0 q 3 -3 6 0', role: 'ink', w: 1 },
    { d: 'M 34 10 q 2.5 -2.5 5 0 q 2.5 -2.5 5 0', role: 'ink', w: 0.9 },
  ],
};

const ART: Record<string, TagArt> = {
  일본: JAPAN,
  프랑스: FRANCE,
  이탈리아: ITALY,
  중국: CHINA,
  대만: TAIWAN,
  홍콩: HONGKONG,
  필리핀: PHILIPPINES,
};

/** 국가명으로 태그 그림을 고른다. 등록되지 않은 국가는 DEFAULT 로 떨어진다. */
export function tagArt(countryKo: string | null | undefined): TagArt {
  if (!countryKo) return DEFAULT;
  return ART[countryKo] ?? DEFAULT;
}

/**
 * 태그 아래쪽 풍경.
 *
 * 실루엣을 먼저 깔고 덧그림을 그 위에 얹는다. 순서가 바뀌면 도리이가 산 뒤로 간다.
 * 그리는 영역의 가로세로비가 100:60 과 거의 같아서 preserveAspectRatio 로
 * 바닥만 맞춰 두면 나라가 바뀌어도 지면 높이가 흔들리지 않는다.
 */
export function TagScene({
  countryKo,
  art,
  accent,
  style,
}: {
  countryKo: string | null;
  art: TagArt;
  accent: string;
  style?: StyleProp<ViewStyle>;
}) {
  const landmark = countryLandmark(countryKo);
  const landmarkFill = art.landmarkRole === 'accent' ? accent : SILHOUETTE;

  return (
    <Svg style={style} viewBox={landmark.viewBox} preserveAspectRatio="xMidYMax meet">
      {landmark.paths.map((path, index) => (
        <Path
          key={`landmark-${index}`}
          d={path.d}
          fill={landmarkFill}
          fillRule={path.fillRule ?? 'nonzero'}
          opacity={0.9}
        />
      ))}
      {art.landmarkCircles
        ? landmark.circles?.map((circle, index) => (
            <Circle
              key={`landmark-circle-${index}`}
              cx={circle.cx}
              cy={circle.cy}
              r={circle.r}
              fill={landmarkFill}
              opacity={0.9}
            />
          ))
        : null}

      {art.fills?.map((piece, index) => (
        <Path key={`fill-${index}`} d={piece.d} fill={roleColor(piece.role, accent)} />
      ))}
      {art.strokes?.map((piece, index) => (
        <Path
          key={`stroke-${index}`}
          d={piece.d}
          stroke={roleColor(piece.role, accent)}
          strokeWidth={piece.w ?? 1}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {art.dots?.map((dot, index) => (
        <Circle
          key={`dot-${index}`}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill={roleColor(dot.role, accent)}
        />
      ))}
    </Svg>
  );
}
