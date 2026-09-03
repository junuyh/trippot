// ============================================================================
// 준비 중인 여행 배너의 랜드마크 그림 (2026-09-04)
//
// **건축 펜 드로잉**이다. 아이콘이 아니다.
//
// 처음에는 사각형 몇 개로 스카이라인을 만들었다. 멀리서 보면 도시 같지만
// 가까이 보면 그냥 네모였고, 상하이인지 홍콩인지 구분되지 않았다.
// 지금은 건물마다 실제 형태를 따라 그린다 —
//   에펠탑    휘어 올라가는 다리 · 전망대 세 층 · 철 격자 · 첨탑
//   동방명주  구형 전망대 셋 · 기둥 · 세 다리 · 안테나
//   상하이타워 위로 좁아지며 비틀리는 몸통
//   진마오    탑처럼 층층이 물러나는 마디
//   금융센터  꼭대기의 사다리꼴 구멍
//   101       위로 벌어지는 마디 여덟 개
//   콜로세움  아케이드 세 층 · 다락층 창 · 무너진 오른쪽
//   후지산    분화구 테 · 설선 · 앞의 오층탑
//
// ⚠️ 선만 쓴다. 색 면을 채우지 않는다. 채우는 흰색은 **가리개**다 —
//    앞 건물이 뒷 건물을 가려야 스카이라인에 깊이가 생긴다.
//    그래서 그리는 순서가 곧 앞뒤다. 배열 순서를 바꾸면 건물이 겹쳐 비친다.
//
// ⚠️ 선은 아주 얇고 아주 옅다. 이 그림은 배경이고, 시선은 도시 이름과 금액이
//    먼저 받아야 한다. 굵기를 올리고 싶으면 그림이 아니라 카드 배치를 의심한다.
//
// ⚠️ 좌표계는 160 × 80 이고 y = 76 이 지면이다.
//    lib/constants/countryLandmark(100 × 60)와 다르다. 세부를 넣으려면
//    소수점 두 자리로 좌표를 써야 했고, 그러면 읽으면서 고치기 어렵다.
//
// ⚠️ lib/constants/countryLandmark 는 고치지 않았다. 여행 준비 홈(TRIP-HOME-01)의
//    보딩패스가 같은 파일을 쓰는데 그 화면은 담당이 다르다. (CLAUDE.md 13장)
//    지난 여행 태그(LuggageTagCard)도 실루엣 그대로다. 태그의 그림 자리는
//    이 배너의 1/4도 안 돼서 세부를 넣으면 뭉개지기만 한다.
// ============================================================================
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * 획 하나.
 *
 * `fill` 은 색을 칠하려는 게 아니라 **뒤를 가리려는** 것이다.
 * 카드 바탕색으로 칠해져서 뒤에 있는 건물의 선이 비치지 않는다.
 */
type Stroke = { d: string; w?: number; fill?: boolean };

export type LandmarkScene = { paths: Stroke[] };

const VIEW_BOX = '0 0 160 80';
/** 지면. 바다를 낀 나라는 이 대신 물결을 쓴다. */
const GROUND: Stroke = { d: 'M 2 76 H 158', w: 0.7 };

/** 기본 선 굵기. 창·격자처럼 잔 것은 이보다 더 얇다. */
const W_OUTLINE = 0.65;
const W_DETAIL = 0.4;

// ── 반복되는 것을 만드는 도구 ──────────────────────────────────────────────
// 창 40개, 격자 12단을 손으로 쓰면 하나만 어긋나도 눈에 띈다.

/** 층 선. 건물을 건물로 보이게 하는 가장 싼 세부다. */
function floors(x0: number, x1: number, top: number, bottom: number, step: number): Stroke[] {
  const out: Stroke[] = [];
  for (let y = top + step; y < bottom - 0.5; y += step) {
    out.push({ d: `M ${x0} ${round(y)} H ${x1}`, w: W_DETAIL });
  }
  return out;
}

/** 세로 창틀. 층 선과 겹치면 격자가 되어 유리 건물처럼 보인다. */
function mullions(x0: number, x1: number, top: number, bottom: number, count: number): Stroke[] {
  const step = (x1 - x0) / (count + 1);
  return Array.from({ length: count }, (_, index) => ({
    d: `M ${round(x0 + step * (index + 1))} ${top} V ${bottom}`,
    w: W_DETAIL,
  }));
}

/**
 * 철 격자. 사다리꼴 한 칸에 X 자 가새를 채운다.
 * 에펠탑 다리와 중국은행 타워가 같은 도구를 쓴다.
 */
function braces(
  top: { l: number; r: number; y: number },
  bottom: { l: number; r: number; y: number },
  rows: number,
): Stroke[] {
  const out: Stroke[] = [];
  const at = (t: number) => ({
    y: top.y + (bottom.y - top.y) * t,
    l: top.l + (bottom.l - top.l) * t,
    r: top.r + (bottom.r - top.r) * t,
  });

  for (let index = 0; index < rows; index += 1) {
    const a = at(index / rows);
    const b = at((index + 1) / rows);
    out.push({ d: `M ${round(a.l)} ${round(a.y)} L ${round(b.r)} ${round(b.y)}`, w: W_DETAIL });
    out.push({ d: `M ${round(a.r)} ${round(a.y)} L ${round(b.l)} ${round(b.y)}`, w: W_DETAIL });
    if (index < rows - 1) {
      out.push({ d: `M ${round(b.l)} ${round(b.y)} H ${round(b.r)}`, w: W_DETAIL });
    }
  }
  return out;
}

/** 아치 한 칸. 콜로세움 아케이드는 이것이 열한 번 이어진다. */
function arches(startX: number, count: number, width: number, gap: number, top: number, bottom: number): Stroke[] {
  const radius = width / 2;
  return Array.from({ length: count }, (_, index) => {
    const x = round(startX + index * (width + gap));
    return {
      d: `M ${x} ${bottom} V ${top + radius} A ${radius} ${radius} 0 0 1 ${round(x + width)} ${top + radius} V ${bottom}`,
      w: W_DETAIL,
    };
  });
}

/** 물결. 항구 도시의 지면이다. */
function water(y: number, amplitude: number, offset = 0): Stroke {
  const step = 20;
  let d = `M ${offset} ${y}`;
  for (let index = 0; index < 9; index += 1) {
    d += index === 0 ? ` q ${step / 2} ${-amplitude} ${step} 0` : ` t ${step} 0`;
  }
  return { d, w: 0.55 };
}

/** 동그라미를 path 로 만든다. 그리는 순서를 선과 섞어야 앞뒤가 맞는다. */
function circle(cx: number, cy: number, r: number, fill = false, w = W_OUTLINE): Stroke {
  return {
    d: `M ${round(cx - r)} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`,
    w,
    fill,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 야자잎 한 장. 가운데 잎맥과 그 둘레로 벌어진 잎날. */
function frond(tipX: number, tipY: number, c1: string, c2: string): Stroke[] {
  return [
    { d: `M 74 37 C ${c1} ${tipX} ${tipY}`, w: W_DETAIL },
    { d: `M 74 37 C ${c2} ${tipX} ${tipY}`, w: W_OUTLINE },
  ];
}

// ── 나라별 ────────────────────────────────────────────────────────────────

/** 프랑스 — 에펠탑. 다리·전망대·격자·첨탑까지 실제 구조를 따라 그린다 */
const FRANCE: LandmarkScene = {
  paths: [
    // 다리 네 개(정면에서는 둘). 안쪽으로 휘어 올라간다
    { d: 'M 62 76 C 65.5 71.5 69 68 71 64', w: W_OUTLINE },
    { d: 'M 69.5 76 C 72 72 73.8 68.5 74.6 64', w: W_OUTLINE },
    { d: 'M 98 76 C 94.5 71.5 91 68 89 64', w: W_OUTLINE },
    { d: 'M 90.5 76 C 88 72 86.2 68.5 85.4 64', w: W_OUTLINE },
    // 다리 사이의 큰 아치. 에펠탑을 에펠탑으로 보이게 하는 곡선이다
    { d: 'M 69.5 76 C 71 63.5 89 63.5 90.5 76', w: W_DETAIL },
    { d: 'M 73.5 76 C 75 68 85 68 86.5 76', w: W_DETAIL },
    // 다리 속 철 격자
    ...braces({ l: 71, r: 74.6, y: 64 }, { l: 62, r: 69.5, y: 76 }, 3),
    ...braces({ l: 85.4, r: 89, y: 64 }, { l: 90.5, r: 98, y: 76 }, 3),

    // 1층 전망대
    { d: 'M 59 64.5 H 101 V 62 H 59 Z', w: W_OUTLINE, fill: true },
    { d: 'M 60 63.2 H 100', w: W_DETAIL },

    // 1층 → 2층 몸통
    { d: 'M 71 62 C 72.6 58 74.4 54 75.5 50.5', w: W_OUTLINE },
    { d: 'M 89 62 C 87.4 58 85.6 54 84.5 50.5', w: W_OUTLINE },
    ...braces({ l: 75.5, r: 84.5, y: 50.5 }, { l: 71, r: 89, y: 62 }, 3),

    // 2층 전망대
    { d: 'M 72 50.5 H 88 V 48.5 H 72 Z', w: W_OUTLINE, fill: true },
    { d: 'M 73 49.5 H 87', w: W_DETAIL },

    // 2층 → 꼭대기. 여기서부터는 거의 곧게 좁아진다
    { d: 'M 75.5 48.5 C 76.8 40 78.2 26 78.6 15.5', w: W_OUTLINE },
    { d: 'M 84.5 48.5 C 83.2 40 81.8 26 81.4 15.5', w: W_OUTLINE },
    ...braces({ l: 78.6, r: 81.4, y: 15.5 }, { l: 75.5, r: 84.5, y: 48.5 }, 7),

    // 꼭대기 전망대와 등대방
    { d: 'M 76 15.5 H 84 V 13.5 H 76 Z', w: W_OUTLINE, fill: true },
    { d: 'M 77.6 13.5 L 82.4 13.5 L 81.8 8.6 L 78.2 8.6 Z', w: W_OUTLINE, fill: true },
    { d: 'M 78.2 8.6 Q 80 6 81.8 8.6', w: W_DETAIL },
    // 안테나
    { d: 'M 80 6.4 V 1', w: 0.55 },
    { d: 'M 78.9 3.6 H 81.1', w: W_DETAIL },

    GROUND,
  ],
};

/** 중국 — 상하이 푸둥. 동방명주와 그 옆의 서로 다른 초고층들 */
const CHINA: LandmarkScene = {
  paths: [
    // ── 뒤쪽 저층. 앞의 것이 가릴 수 있게 먼저 그린다 ──
    { d: 'M 2 76 V 54 H 8 V 50 H 14 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(2, 14, 50, 76, 4),
    { d: 'M 16 76 V 46 L 20 42 L 24 46 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(16, 24, 46, 76, 4),
    { d: 'M 26 76 V 58 H 34 V 54 H 36 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(26, 36, 54, 76, 4.5),
    // 살짝 좁아지는 판상형
    { d: 'M 38 76 L 39 40 H 45 L 46 76 Z', w: W_OUTLINE, fill: true },
    ...floors(38.6, 45.4, 40, 76, 4),
    ...mullions(39, 45, 40, 76, 2),
    { d: 'M 41 40 V 33', w: W_DETAIL },

    // ── 동방명주 ──
    // 세 다리. 뒤쪽 다리를 먼저 그린다
    { d: 'M 58.6 76 V 52 M 61.4 76 V 52', w: W_OUTLINE },
    { d: 'M 46 76 L 56.4 48 H 58.4 L 48.6 76 Z', w: W_OUTLINE, fill: true },
    { d: 'M 74 76 L 63.6 48 H 61.6 L 71.4 76 Z', w: W_OUTLINE, fill: true },
    // 기단
    { d: 'M 50 76 V 70 H 70 V 76', w: W_OUTLINE, fill: true },
    { d: 'M 50 72.5 H 70', w: W_DETAIL },
    // 기둥
    { d: 'M 57.4 52 V 13 H 62.6 V 52 Z', w: W_OUTLINE, fill: true },
    { d: 'M 60 52 V 13', w: W_DETAIL },
    // 아래 구형 전망대
    circle(60, 44, 8.6, true),
    { d: 'M 51.6 42 H 68.4 M 52.6 47 H 67.4 M 60 35.4 V 52.6', w: W_DETAIL },
    { d: 'M 50.6 50 H 69.4', w: W_DETAIL },
    // 가운데 구
    circle(60, 25.5, 5.4, true),
    { d: 'M 54.8 24 H 65.2 M 60 20.1 V 30.9', w: W_DETAIL },
    // 꼭대기 구
    circle(60, 15, 2.8, true),
    // 안테나
    { d: 'M 60 12.2 V 1.5', w: 0.55 },
    { d: 'M 58.8 6 H 61.2 M 59.2 9 H 60.8', w: W_DETAIL },

    // ── 상하이타워. 위로 좁아지며 비틀린다 ──
    {
      d: 'M 82 76 C 83 58 85.4 38 87.4 22 Q 88 17.5 90.6 16.6 Q 93.4 17.4 94 22 C 95.4 38 96.6 58 97 76 Z',
      w: W_OUTLINE,
      fill: true,
    },
    // 비틀린 띠. 위로 갈수록 좁아진다
    ...Array.from({ length: 9 }, (_, index) => {
      const t = index / 9;
      const y = round(72 - index * 6);
      const l = round(82 + 5.4 * t);
      const r = round(97 - 5 * t);
      return { d: `M ${l} ${y} Q ${round((l + r) / 2)} ${round(y - 1.8)} ${r} ${y}`, w: W_DETAIL };
    }),

    // ── 진마오. 탑처럼 층층이 물러난다 ──
    {
      d: [
        'M 101 76 V 52 H 102.6 V 44 H 104.2 V 37 H 105.8 V 31 H 107.4 V 26 H 109 V 21',
        'H 112 V 26 H 113.6 V 31 H 115.2 V 37 H 116.8 V 44 H 118.4 V 52 H 120 V 76 Z',
      ].join(' '),
      w: W_OUTLINE,
      fill: true,
    },
    { d: 'M 102.6 52 H 118.4 M 104.2 44 H 116.8 M 105.8 37 H 115.2 M 107.4 31 H 113.6 M 109 26 H 112', w: W_DETAIL },
    ...floors(101, 120, 52, 76, 4),
    { d: 'M 110.5 21 V 12', w: 0.55 },

    // ── 세계금융센터. 꼭대기에 사다리꼴 구멍이 뚫려 있다 ──
    { d: 'M 124 76 L 128.4 23 H 137.6 L 140 76 Z', w: W_OUTLINE, fill: true },
    { d: 'M 129.6 27.5 H 136.4 L 135.6 34.5 H 130.4 Z', w: W_DETAIL },
    ...floors(125, 139.4, 36, 76, 5),
    { d: 'M 132.6 40 V 76', w: W_DETAIL },

    // ── 오른쪽 저층 ──
    { d: 'M 142 76 V 52 L 149 46 L 156 52 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(142, 156, 52, 76, 4.5),
    { d: 'M 158 76 V 60 H 152 V 76', w: W_OUTLINE, fill: true },

    // 구름과 새. 하늘이 비어 있으면 도시가 잘려 보인다
    { d: 'M 22 22 q 2.4 -4.6 6.6 -2.4 q 2.4 -4 6.6 -1.2 q 4.4 0.4 3 3.6 Z', w: W_DETAIL },
    { d: 'M 106 12 q 2 -3.8 5.4 -2 q 2 -3.2 5.4 -1 q 3.6 0.4 2.4 3 Z', w: W_DETAIL },
    { d: 'M 128 14 q 2 -2 4 0 q 2 -2 4 0', w: W_DETAIL },
    { d: 'M 138 9 q 1.6 -1.6 3.2 0 q 1.6 -1.6 3.2 0', w: W_DETAIL },

    GROUND,
  ],
};

/** 일본 — 후지산과 그 앞의 오층탑 */
const JAPAN: LandmarkScene = {
  paths: [
    // 능선. 정상이 눌린 사다리꼴이라야 후지산이다
    {
      d: 'M 2 76 C 26 68 44 52 58 34 L 66 24 Q 72 20.4 80 20 Q 88 20.4 94 24 L 102 34 C 116 52 134 68 158 76 Z',
      w: W_OUTLINE,
      fill: true,
    },
    // 분화구 테
    { d: 'M 67 23.6 Q 73 21.4 80 21 Q 87 21.4 93 23.6', w: W_DETAIL },
    { d: 'M 73 22.4 Q 80 25 87 22.4', w: W_DETAIL },
    // 설선. 눈이 흘러내린 자리라 톱니처럼 들쭉날쭉해야 눈으로 읽힌다
    {
      d: 'M 50 44 L 56 36 L 61 42 L 66 33 L 71 39 L 76 31 L 81 36 L 86 30 L 91 37 L 96 33 L 101 41 L 107 46',
      w: 0.55,
    },
    // 사면 주름
    { d: 'M 70 27 L 52 52', w: W_DETAIL },
    { d: 'M 90 27 L 108 52', w: W_DETAIL },
    { d: 'M 80 21.5 V 31', w: W_DETAIL },
    { d: 'M 62 33 L 44 60', w: W_DETAIL },
    { d: 'M 98 33 L 116 60', w: W_DETAIL },

    // ── 오층탑. 산 앞에 서서 어느 나라인지 못 박는다 ──
    { d: 'M 17 76 V 72 H 47 V 76', w: W_OUTLINE, fill: true },
    ...[
      { y: 64, hw: 13 },
      { y: 56, hw: 11.5 },
      { y: 48.5, hw: 10 },
      { y: 41.5, hw: 8.5 },
      { y: 35, hw: 7 },
    ].flatMap((roof, index, all) => {
      const cx = 32;
      const lower = index === 0 ? 72 : all[index - 1].y - 3.4;
      const bodyHalf = roof.hw - 4.4;
      return [
        // 몸통
        {
          d: `M ${round(cx - bodyHalf)} ${lower} V ${roof.y} H ${round(cx + bodyHalf)} V ${lower}`,
          w: W_OUTLINE,
          fill: true,
        },
        { d: `M ${round(cx - bodyHalf + 1.6)} ${lower} V ${roof.y}`, w: W_DETAIL },
        { d: `M ${round(cx + bodyHalf - 1.6)} ${lower} V ${roof.y}`, w: W_DETAIL },
        // 처마. 끝이 위로 들린다
        {
          d: `M ${round(cx - roof.hw)} ${roof.y} Q ${cx} ${round(roof.y - 4.4)} ${round(cx + roof.hw)} ${roof.y}`,
          w: W_OUTLINE,
          fill: true,
        },
        { d: `M ${round(cx - roof.hw)} ${roof.y} L ${round(cx - roof.hw - 1.4)} ${round(roof.y - 1.6)}`, w: W_DETAIL },
        { d: `M ${round(cx + roof.hw)} ${roof.y} L ${round(cx + roof.hw + 1.4)} ${round(roof.y - 1.6)}`, w: W_DETAIL },
        { d: `M ${round(cx - roof.hw + 1)} ${round(roof.y - 1)} H ${round(cx + roof.hw - 1)}`, w: W_DETAIL },
      ];
    }),
    // 상륜. 탑 꼭대기의 금속 장식
    { d: 'M 32 31 V 22', w: 0.55 },
    { d: 'M 30.4 28 H 33.6 M 30.8 26 H 33.2 M 31.2 24 H 32.8', w: W_DETAIL },

    // 앞의 소나무 몇 그루
    { d: 'M 6 76 L 7.4 71 L 5.6 71 L 8 66 L 6.4 66 L 9 61 L 11.6 66 L 10 66 L 12.4 71 L 10.6 71 L 12 76 Z', w: W_DETAIL },
    { d: 'M 52 76 L 53.2 72 L 51.6 72 L 54 68 L 56.4 72 L 54.8 72 L 56 76 Z', w: W_DETAIL },
    { d: 'M 140 76 L 141.4 71.5 L 139.8 71.5 L 142 67 L 144.2 71.5 L 142.6 71.5 L 144 76 Z', w: W_DETAIL },

    GROUND,
  ],
};

/** 이탈리아 — 콜로세움. 아케이드 세 층과 무너진 오른쪽 */
const ITALY: LandmarkScene = {
  paths: [
    // 기단
    { d: 'M 8 76 V 72 H 152 V 76', w: W_OUTLINE, fill: true },
    { d: 'M 10 74 H 150', w: W_DETAIL },
    // 바깥 벽. 왼쪽은 온전하고 오른쪽은 무너져 한 층 낮다
    {
      d: [
        'M 16 72 V 33 C 17 24 34 18 56 17 L 74 16.5 V 27',
        'C 98 27 120 31 132 38 C 138 41.5 140 45 140 50 V 72 Z',
      ].join(' '),
      w: W_OUTLINE,
      fill: true,
    },
    // 층을 가르는 코니스
    { d: 'M 16 58 H 140', w: W_DETAIL },
    { d: 'M 16 44 H 137', w: W_DETAIL },
    { d: 'M 16 30 H 74', w: W_DETAIL },
    // 아케이드 세 층
    ...arches(19, 11, 7, 3.2, 60, 71),
    ...arches(19, 11, 6.6, 3.6, 46, 57),
    ...arches(19, 5, 6.6, 3.6, 32, 43),
    // 다락층. 아치가 아니라 네모 창과 벽기둥이다
    ...Array.from({ length: 5 }, (_, index) => ({
      d: `M ${round(21 + index * 10.2)} 22 h 3.4 v 4.4 h -3.4 Z`,
      w: W_DETAIL,
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      d: `M ${round(18 + index * 10.2)} 29.6 V 18.6`,
      w: W_DETAIL,
    })),
    // 무너진 단면 너머로 보이는 안쪽 벽
    { d: 'M 74 27 C 90 30.5 104 35 112 41', w: W_DETAIL },
    { d: 'M 84 29.5 V 40 M 96 32.5 V 43 M 108 37 V 47', w: W_DETAIL },

    // 앞의 소나무(우산소나무). 로마 유적 사진에 늘 함께 있다
    { d: 'M 148 72 V 60', w: W_DETAIL },
    { d: 'M 140 60 Q 148 52 156 60 Q 148 57 140 60 Z', w: W_DETAIL },

    GROUND,
  ],
};

/** 대만 — 타이베이101. 위로 벌어지는 마디 여덟 개 */
const TAIWAN: LandmarkScene = {
  paths: [
    // 옆 건물
    { d: 'M 4 76 V 56 H 10 V 52 H 20 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(4, 20, 52, 76, 4),
    { d: 'M 24 76 V 48 L 32 42 L 40 48 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(24, 40, 48, 76, 4),
    ...mullions(24, 40, 48, 76, 3),
    { d: 'M 118 76 V 40 H 126 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(118, 126, 40, 76, 4),
    { d: 'M 122 40 V 32', w: W_DETAIL },
    { d: 'M 130 76 V 54 L 136 50 L 142 54 V 76 Z', w: W_OUTLINE, fill: true },
    ...floors(130, 142, 54, 76, 4.5),
    { d: 'M 146 76 V 62 H 156 V 76 Z', w: W_OUTLINE, fill: true },

    // 기단
    { d: 'M 52 76 L 54 60 H 106 L 108 76 Z', w: W_OUTLINE, fill: true },
    ...floors(53, 107, 60, 76, 4),
    { d: 'M 70 76 V 60 M 90 76 V 60', w: W_DETAIL },
    // 몸통 아래 목
    { d: 'M 73 60 V 58 M 87 60 V 58', w: W_OUTLINE },

    // 마디 여덟 개. 아래가 좁고 위가 넓다
    ...Array.from({ length: 8 }, (_, index) => {
      const bottom = round(58 - index * 6.2);
      const top = round(bottom - 5.4);
      return [
        { d: `M 73 ${bottom} L 70.8 ${top} H 89.2 L 87 ${bottom} Z`, w: W_OUTLINE, fill: true },
        { d: `M 71.2 ${round(top + 1.4)} H 88.8`, w: W_DETAIL },
        { d: `M 76.5 ${bottom} V ${top} M 80 ${bottom} V ${top} M 83.5 ${bottom} V ${top}`, w: W_DETAIL },
        { d: `M 72.4 ${round(bottom + 0.8)} H 87.6`, w: W_DETAIL },
      ];
    }).flat(),

    // 첨탑
    { d: 'M 78.6 9.2 H 81.4', w: W_DETAIL },
    { d: 'M 80 9.2 V 1.5', w: 0.55 },
    { d: 'M 78.9 5 H 81.1 M 79.3 7 H 80.7', w: W_DETAIL },

    GROUND,
  ],
};

/** 홍콩 — 빅토리아 하버. 건물마다 구조가 다르고 앞은 바다다 */
const HONGKONG: LandmarkScene = {
  paths: [
    // 왼쪽 저층
    { d: 'M 4 72 V 52 H 10 V 48 H 20 V 72 Z', w: W_OUTLINE, fill: true },
    ...floors(4, 20, 48, 72, 4),
    // 트러스가 밖으로 드러난 건물(HSBC)
    { d: 'M 26 72 V 40 H 40 V 72 Z', w: W_OUTLINE, fill: true },
    { d: 'M 26 46 H 40 M 26 54 H 40 M 26 62 H 40', w: W_DETAIL },
    { d: 'M 26 46 L 33 40 L 40 46 M 26 54 L 33 48 L 40 54 M 26 62 L 33 56 L 40 62', w: W_DETAIL },
    { d: 'M 29 40 V 32 M 37 40 V 34', w: W_DETAIL },
    // 중국은행 타워. 삼각 트러스가 얼굴이다
    { d: 'M 44 72 V 34 L 53 16 L 62 34 V 72 Z', w: W_OUTLINE, fill: true },
    { d: 'M 53 16 V 72', w: W_DETAIL },
    { d: 'M 44 58 L 53 44 L 62 58 M 44 44 L 53 30 L 62 44 M 44 72 L 53 58 L 62 72', w: W_DETAIL },
    { d: 'M 50 16 V 4 M 56 17 V 7', w: W_DETAIL },
    // 판상형
    { d: 'M 66 72 V 46 H 76 V 72 Z', w: W_OUTLINE, fill: true },
    ...floors(66, 76, 46, 72, 4),
    ...mullions(66, 76, 46, 72, 2),
    // IFC. 위로 좁아지다 왕관처럼 마무리된다
    { d: 'M 78 72 L 80.4 26 Q 82.6 19.5 86 19 Q 89.4 19.5 91.6 26 L 94 72 Z', w: W_OUTLINE, fill: true },
    ...floors(79, 93, 30, 72, 5),
    { d: 'M 86 20 V 72', w: W_DETAIL },
    { d: 'M 82 23 V 19.5 M 86 21.5 V 17.5 M 90 23 V 19.5', w: W_DETAIL },
    // 센트럴 플라자
    { d: 'M 100 72 V 28 L 107 16 L 114 28 V 72 Z', w: W_OUTLINE, fill: true },
    ...floors(100, 114, 30, 72, 4.5),
    { d: 'M 107 16 V 5', w: 0.55 },
    // 오른쪽 저층
    { d: 'M 118 72 V 50 H 130 V 46 H 132 V 72 Z', w: W_OUTLINE, fill: true },
    ...floors(118, 132, 50, 72, 4),
    { d: 'M 136 72 V 58 L 142 54 L 148 58 V 72 Z', w: W_OUTLINE, fill: true },
    { d: 'M 150 72 V 62 H 158 V 72 Z', w: W_OUTLINE, fill: true },

    // 바다와 정크선
    water(73, 1.1),
    { d: 'M 14 74 Q 26 77.5 40 74 L 36 78.5 H 19 Z', w: W_OUTLINE, fill: true },
    { d: 'M 27 74 V 54', w: W_DETAIL },
    { d: 'M 27 56 Q 36 60 38 72 L 27 72 Z', w: W_OUTLINE, fill: true },
    { d: 'M 27 60 L 33.5 62 M 27 64 L 35.5 66 M 27 68 L 37 69.5', w: W_DETAIL },
    { d: 'M 27 58 Q 20 62 19 70 L 27 70 Z', w: W_OUTLINE, fill: true },
    water(77, 0.9, -6),

    { d: 'M 128 14 q 2 -2 4 0 q 2 -2 4 0', w: W_DETAIL },
    { d: 'M 138 9 q 1.6 -1.6 3.2 0 q 1.6 -1.6 3.2 0', w: W_DETAIL },
  ],
};

/** 필리핀 — 야자수와 방카배. 앞은 바다다 */
const PHILIPPINES: LandmarkScene = {
  paths: [
    // 먼 섬과 그 위의 작은 야자수
    { d: 'M 98 70 C 110 58 128 54 142 58 C 150 60.5 155 65 158 70 Z', w: W_DETAIL, fill: true },
    { d: 'M 124 60 V 52 M 120 52 q 4 -3 8 0 M 121 50 q 3 -4 7 -1', w: W_DETAIL },
    { d: 'M 136 62 V 56 M 133 56 q 3 -2.5 6 0', w: W_DETAIL },

    // 야자수 줄기. 기울어 자라고 마디가 있다
    { d: 'M 52 72 C 55 57 62 45 72 36 L 76.5 39 C 67 47 61 58 58 72 Z', w: W_OUTLINE, fill: true },
    ...Array.from({ length: 7 }, (_, index) => {
      const t = index / 7;
      const x = round(53.5 + t * 18);
      const y = round(70 - t * 27);
      return { d: `M ${x} ${y} l ${round(4.2 - t * 0.6)} ${round(2.4 - t * 1.6)}`, w: W_DETAIL };
    }),
    // 잎 여섯 장. 가운데 잎맥과 벌어진 잎날
    ...frond(34, 33, '62 29 46 27', '63 40 48 36'),
    ...frond(44, 10, '68 23 55 14', '72 27 51 18'),
    ...frond(88, 3, '74 21 80 9', '78 22 85 10'),
    ...frond(112, 19, '86 24 102 18', '84 31 104 24'),
    ...frond(114, 48, '90 34 106 40', '88 40 104 47'),
    ...frond(80, 66, '78 46 81 56', '73 47 75 58'),
    // 코코넛
    circle(72, 39, 1.7),
    circle(76, 40.5, 1.7),
    circle(74, 43, 1.5),

    // 바다
    water(70, 1),
    // 방카배. 아우트리거가 있어야 방카다
    { d: 'M 6 71 Q 24 75 44 71 L 40 76 H 11 Z', w: W_OUTLINE, fill: true },
    { d: 'M 9 73.4 Q 24 76.4 41 73.4', w: W_DETAIL },
    { d: 'M 12 71 V 62 H 34 V 71', w: W_DETAIL },
    { d: 'M 12 66 H 34 M 18 62 V 71 M 26 62 V 71', w: W_DETAIL },
    { d: 'M 2 74 H 48', w: W_DETAIL },
    { d: 'M 12 71 L 6 74.5 M 34 71 L 42 74.5', w: W_DETAIL },
    water(77.5, 0.8, -8),

    { d: 'M 96 16 q 2.4 -2.4 4.8 0 q 2.4 -2.4 4.8 0', w: W_DETAIL },
    { d: 'M 110 10 q 1.8 -1.8 3.6 0 q 1.8 -1.8 3.6 0', w: W_DETAIL },
  ],
};

/** 목적지 국가를 모를 때. 어느 나라도 아닌 언덕과 해 */
const DEFAULT: LandmarkScene = {
  paths: [
    { d: 'M 2 76 C 24 60 44 56 62 66 C 74 72 82 74 92 74', w: W_OUTLINE },
    { d: 'M 54 76 C 74 54 96 48 118 58 C 132 64 146 70 158 72', w: W_OUTLINE },
    circle(126, 22, 9),
    { d: 'M 30 26 q 3 -3 6 0 q 3 -3 6 0', w: W_DETAIL },
    { d: 'M 48 18 q 2.4 -2.4 4.8 0 q 2.4 -2.4 4.8 0', w: W_DETAIL },
    GROUND,
  ],
};

const SCENES: Record<string, LandmarkScene> = {
  일본: JAPAN,
  프랑스: FRANCE,
  이탈리아: ITALY,
  중국: CHINA,
  대만: TAIWAN,
  홍콩: HONGKONG,
  필리핀: PHILIPPINES,
};

/** 국가명으로 그림을 고른다. 등록되지 않은 국가는 DEFAULT 로 떨어진다. */
export function landmarkScene(countryKo: string | null | undefined): LandmarkScene {
  if (!countryKo) return DEFAULT;
  return SCENES[countryKo] ?? DEFAULT;
}

/**
 * 랜드마크를 그린다.
 *
 * 배열 순서대로 그린다. 순서가 곧 앞뒤라서, 앞 건물의 흰 면이 뒤 건물의 선을 덮는다.
 * 선 굵기는 viewBox(160 × 80) 기준이라 카드가 커지고 작아져도 그림의 인상이 같다.
 */
export function LandmarkArt({
  countryKo,
  fill,
  line,
  width,
  height,
  style,
}: {
  countryKo: string | null;
  /** 가리개 색. 카드 바탕과 같아야 앞 건물이 뒤를 깨끗이 덮는다. */
  fill: string;
  /** 선 색. 아주 옅어야 배경으로 물러난다. */
  line: string;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scene = landmarkScene(countryKo);

  return (
    <Svg
      width={width}
      height={height}
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMax meet"
      style={style}
      pointerEvents="none"
    >
      {scene.paths.map((stroke, index) => (
        <Path
          key={index}
          d={stroke.d}
          fill={stroke.fill ? fill : 'none'}
          stroke={line}
          strokeWidth={stroke.w ?? W_DETAIL}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
