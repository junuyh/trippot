// ============================================================================
// 초대 화면 공통 껍데기 — Header 아래 단색 연보라 배경 위의 종이 초대장 (2026-09-16 · 외곽 2026-09-20 최종 시안)
//
//   [기존 흰색 Header — 건드리지 않는다. root Stack 의 native header 그대로]
//   ─────────────────────────────────────────
//   [INVITE_THEME.background 단색 배경 — 화면을 채운다 (2026-09-20 · primarySoft)]
//     [궤도선 뒤 겹 — 왼쪽 위 · 오른쪽 아래 모서리에 각각 하나(시안 곡선). 서로 이어지지 않는다]
//     [종이 초대장 — 폭 ≈ 88% · 높이 = 내용 높이 · 큰 rounded rectangle]
//        TP 로고(primary tint) + "TripPot"
//        짧은 divider
//        children  (상태별 내용)
//        footer    (CTA — 내용 바로 아래, 정해진 간격)
//        (종이 안: 결 → 궤도선 앞 겹(가장자리에서 스며듦) → 내용)          + 작은 비행기 1개
//
// 2026-09-20 외곽만 최종 시안으로: 네 모서리 concave cutout 제거 → rounded rectangle, 배경 primary → primarySoft,
//   궤도선 + 비행기 장식 추가. 종이 색 · 결(paper-grain) · 그림자 · 폭 · minHeight · 안쪽 여백 · 내용은 그대로.
//   장식은 종이 실측(onLayout)에 비례해 그린다 — 상태별로 종이가 길어져도 같은 비율. 터치는 전부 통과.
//
// 높이 원칙: 초대장은 **내용이 정하되, 상태가 바뀌어도 높이가 줄지 않는다.** (2026-09-17)
//   기준은 가장 긴 상태(INV-02 NONE · "초대 수락하기")의 실제 layout 높이 = CARD_MIN_HEIGHT.
//   짧은 상태(승인 대기 · ACTIVE)는 같은 높이의 카드 안에서 내용을 세로 가운데에 둔다.
//   내용이 그보다 길어지면(작은 기기 · 인원 초과 안내) 그만큼 자란다 — 고정 height 가 아니라 minHeight.
// 위치 원칙: 그렇게 정해진 카드를 **Header 아래 보라 viewport 의 세로 가운데**에 둔다 —
//   바깥 ScrollView contentContainer 의 flexGrow:1 + justifyContent:center 가 남는 공간만 나눈다.
//   카드가 viewport 보다 길어지면 그때만 스크롤한다. 고정 height 없음 → 잘리지 않는다.
// 모양 원칙 (2026-09-20): 큰 rounded rectangle(CARD_RADIUS). 카드에는 아주 옅은 그림자만 — 종이가 배경
//   위에 살짝 떠 있는 정도. 배경은 단색 연보라. 카드는 옅은 아이보리 + 아주 은은한 종이 결
//   (assets/paper-grain.png 128px 타일을 repeat · 낮은 불투명도). 텍스트는 그 위의 실제 컴포넌트다.
//   우표 · 도장 · 얼룩 · 접힘 · 강한 grain · gradient · 반짝이 없음. 장식은 궤도선 + 비행기뿐.
// 로고: 공용 assets/logo.png 원본 그대로(tint 없음). 워드마크 에셋이 없어 "TripPot" 은 Text.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, FeDropShadow, Filter, G, Path } from 'react-native-svg';

const PAPER_GRAIN = require('@/assets/paper-grain.png');

import { INVITE_THEME } from './inviteTheme';

/** 종이 모서리. 최종 시안의 큰 rounded rectangle — 지나치게 둥글지 않게. (2026-09-20 · cutout 폐기) */
const CARD_RADIUS = 22;
/** 초대장 폭. 좌우 보라 여백이 시안(≈ 88%)과 같아지게. */
const CARD_WIDTH = '88%';
/** 초대장 안쪽 좌우 여백. */
const INNER_H = 24;
/**
 * 모든 상태가 공유하는 초대장 최소 높이. (2026-09-17)
 * INV-02 NONE 상태의 실제 onLayout 값이다 — ACTIVE 상태 실측 556.67 (iPhone 17 · 카드 폭 354)
 * + 안내문 한 줄(lineHeight 20)만큼 긴 NONE 상태 = 576.67 → 올림. 픽셀 추측값이 아니다.
 * 상태 전환(초대 수락하기 ↔ 승인 대기)에서 종이 높이가 튀지 않게 한다.
 */
const CARD_MIN_HEIGHT = 577;

// ── 궤도선 · 비행기 ──────────────────────────────────────────────────────────
// 최종 시안(~/Desktop/초대 화면 최종 이미지 시안.png · 941×1672 · 종이 765×1178px)을 **픽셀로 읽어** 옮겼다. (2026-09-21)
//   종이 밖 흰 선 픽셀 4,638개 + 종이 위 흰 선 픽셀(모서리)을 고리별로 모아 최소제곱 타원을 맞췄다.
//   실제 픽셀과의 잔차 RMS: 왼쪽 위 5.1px · 오른쪽 아래 3.2px (종이 폭 765px 기준 → 앱에서 약 2pt · 1.5pt).
//   그 곡선을 24점으로 잡아 Catmull-Rom → cubic Bézier 로 잇는다. 좌표는 시안 픽셀. 왼쪽 위 고리는 종이 왼쪽 위,
//   오른쪽 아래 고리는 종이 오른쪽 아래 모서리가 원점. 화면에서는 **균일 배율(우리 종이 폭 / 765)** 만 곱하고
//   제 모서리로 평행이동한다 — x·y 를 따로 늘리지 않는다.
//   시안에서 잰 값 — 왼쪽 위: 중심 (198,55) · 장반경 289 · 단반경 88 · 장축 154.6°(오른쪽 위로 향하는 사선).
//                    오른쪽 아래: 중심 (615,1058) · 장반경 280 · 단반경 87 · 장축 140.4°.
//   종이 가장자리 교차(시안 px · 종이 원점): 왼쪽 위 = 왼쪽 y74 진입 → 위 x113 이탈(모서리 위 짧은 호) ·
//     위 x433 진입 → 왼쪽 y203 이탈(종이 뒤 숨은 현). 오른쪽 아래 = 오른쪽 y872 이탈 · y1033 재진입 → 아래 x597 이탈
//     (CTA 오른쪽·아래를 지나는 종이 위 대각선) · 아래 x401 진입(종이 뒤 숨은 현).
// 겹 (아래 → 위): 배경 → 뒤 겹(고리 전체) → 종이 → 앞 겹(같은 path · 모서리 영역만 클립) → 종이 내용 → 비행기.
//   앞 겹은 종이 View 안(결 뒤 · 내용 앞). 로고 · CTA 가 항상 선 위. 내용을 피하려고 곡선을 옮기지 않았다.
//   앞 겹 클립은 "종이 위 호" 만 담고, 그 호의 양 끝은 종이 가장자리라 끝점이 드러나지 않는다. 페이드 없음.
// 선: 흰 2.2pt 하나 + 은은한 glow · 아주 약한 보라 그림자(ORBIT_GLOW · ORBIT_SHADOW). 앞·뒤 같은 stroke · 필터. 이중선 없음.
const MOCK_PAPER_W = 765;
/** 왼쪽 위 고리 — 시안 px, 종이 왼쪽 위 원점, 24점 */
const TL_SAMPLES: readonly (readonly [number, number])[] = [
  [-63, 180], [-64, 155], [-47, 123], [-13, 87], [35, 48], [94, 11], [160, -24], [229, -54],
  [296, -76], [356, -89], [405, -92], [441, -85], [459, -69], [460, -44], [443, -12], [410, 24],
  [362, 62], [302, 100], [236, 135], [167, 165], [100, 187], [40, 200], [-9, 203], [-44, 196],
];
/** 오른쪽 아래 고리 — 시안 px, 종이 오른쪽 아래 원점, 24점 */
const BR_SAMPLES: readonly (readonly [number, number])[] = [
  [-366, 57], [-373, 34], [-365, 0], [-342, -42], [-306, -89], [-260, -139], [-206, -187], [-148, -231],
  [-91, -267], [-37, -294], [9, -308], [43, -310], [65, -299], [72, -275], [64, -241], [41, -199],
  [5, -152], [-41, -102], [-95, -54], [-153, -10], [-210, 26], [-264, 53], [-309, 67], [-344, 69],
];
/**
 * 왼쪽 위 고리 전체 평행이동(pt · 배율 없이 그대로 더한다). (2026-09-21 미세조정)
 * 시안 그대로 두면 오른쪽 아래 고리와 대각선 균형이 약간 위·오른쪽으로 치우쳐 보여, 모양·크기·각도는 그대로 두고
 * 왼쪽 13pt · 아래 17pt 만 옮겼다(11 → 17 은 최종 미세조정 · 아래 고리와 대칭감). 로고(x≥140 · y≥40)에는 닿지 않는다
 * (모서리 위 호는 왼쪽 가장자리 y≈60 → 위 가장자리 x≈13 사이). 꼭대기는 종이 위 26pt 로 헤더와 멀다.
 */
const TL_OFFSET = { x: -13, y: 17 };
/** 뒤 겹 SVG 여유. 시안 기준 최대 돌출 ≈ 종이 밖 43pt(위) · 33pt(오른쪽) */
const ORBIT_PAD = 80;
/** 선 굵기(pt). 시안 4.5px × 0.4627 = 2.0 → 시인성 보강으로 +0.2 (2026-09-21) */
const ORBIT_STROKE_WIDTH = 2.2;
/**
 * 시인성 보강 — 흰 선 하나가 "조금 더 또렷해 보이는" 정도. (2026-09-21)
 *   glow   흰색 · blur 2.6 · 24% · 오프셋 0 — 선 주변에서만 은은하게 (최종 미세조정에서 한 단계 강화)
 *   shadow 브랜드 보라 · blur 1.2 · 11% · 아래로 1pt — 검은 그림자 · 두 번째 선처럼 보이는 값 금지
 * 앞·뒤 겹이 같은 필터를 쓴다. 네온 · outline 아님.
 */
const ORBIT_GLOW = { blur: 2.6, opacity: 0.24 };
const ORBIT_SHADOW = { blur: 1.2, opacity: 0.11, dy: 1 };
/**
 * 앞 겹 클립(종이 좌표 · 종이 폭 비율). 종이 위 호만 담는다.
 *   왼쪽 위: 삼각형 (0,0)·(0.385W,0)·(0,0.214W) — 현재 path(TL_OFFSET 반영)에서 모서리 위 호는 왼쪽 y≈41pt → 위 x≈74pt 를
 *     지나고, 숨은 현은 위 x≈198pt → 왼쪽 y≈110pt 를 지난다. 두 곡선의 가장자리 교차점 중간(왼쪽 76pt · 위 136pt)을 잇는
 *     빗변이 경계라 호는 전부 안(빗변 기준 0.55), 현은 전부 밖(1.46). 가장자리 쪽으로 4pt 여유를 둬 sub-pixel 틈을 없앤다.
 *     ⚠️ 전에는 사각형(0.17W×0.18W)이었는데 Y 를 내린 뒤 호가 위 가장자리에 닿는 x 가 74pt 로 늘어 60pt 에서 잘렸다(끊김).
 *   오른쪽 아래: 대각선 (W,H−67)→(W−78,H) 을 담고 숨은 현((W−168,H)→(W,H−142)) 은 밖인 다각형(두 선의 중간선이 경계).
 */
const OVER_TL_TRI = { topX: 0.385, leftY: 0.214, margin: 4 };
const OVER_BR_POLY: readonly (readonly [number, number])[] = [
  [-0.348, 0], [-0.124, -0.19], [0.056, -0.34], [0.17, -0.34], [0.17, 0],
];
/**
 * 비행기 — 시안 48px → 22pt. 왼쪽 위 고리 위쪽 호 위, x = PLANE_X_RATIO·W + TL_OFFSET.x.
 * 시안 위치는 0.309W. 2026-09-21 미세조정으로 같은 궤도 위에서 진행 방향으로 0.091W(≈32pt) 더 오른쪽(0.36 → 0.40 은 최종 조정).
 */
const PLANE_SIZE = 22;
const PLANE_X_RATIO = 0.4;

type PaperSize = { width: number; height: number };
type Pt = { x: number; y: number };

/** 시안 샘플 → 종이 좌표(pt). 균일 배율 + 모서리 평행이동 */
function orbitPoints(size: PaperSize, corner: 'tl' | 'br'): Pt[] {
  const k = size.width / MOCK_PAPER_W;
  const samples = corner === 'tl' ? TL_SAMPLES : BR_SAMPLES;
  const ox = corner === 'tl' ? TL_OFFSET.x : size.width;
  const oy = corner === 'tl' ? TL_OFFSET.y : size.height;
  return samples.map(([x, y]) => ({ x: ox + x * k, y: oy + y * k }));
}

/** 폐곡선 Catmull-Rom(장력 0.5) → cubic Bézier 제어점. 앞·뒤 겹 · 비행기 배치가 같은 결과를 쓴다 */
function catmullRomSegments(pts: Pt[]): { p1: Pt; c1: Pt; c2: Pt; p2: Pt }[] {
  const n = pts.length;
  const out: { p1: Pt; c1: Pt; c2: Pt; p2: Pt }[] = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    out.push({
      p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    });
  }
  return out;
}

/** SVG path 문자열. offset 은 SVG 원점(뒤 겹은 ORBIT_PAD, 앞 겹은 0) */
function orbitPathD(pts: Pt[], offset: number): string {
  const segs = catmullRomSegments(pts);
  const f = (v: number) => (v + offset).toFixed(2);
  const head = `M${f(segs[0].p1.x)} ${f(segs[0].p1.y)}`;
  const body = segs
    .map((s) => `C${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.p2.x)} ${f(s.p2.y)}`)
    .join(' ');
  return `${head} ${body} Z`;
}

/** Bézier 를 잘게 나눈 점들(접선 포함). 비행기 자리 계산용 — 그리는 path 와 같은 제어점에서 나온다 */
function orbitDense(pts: Pt[], stepsPerSeg = 8): { x: number; y: number; tx: number; ty: number }[] {
  const out: { x: number; y: number; tx: number; ty: number }[] = [];
  for (const s of catmullRomSegments(pts)) {
    for (let i = 0; i < stepsPerSeg; i += 1) {
      const t = i / stepsPerSeg;
      const u = 1 - t;
      const x = u * u * u * s.p1.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p2.x;
      const y = u * u * u * s.p1.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p2.y;
      const tx = 3 * u * u * (s.c1.x - s.p1.x) + 6 * u * t * (s.c2.x - s.c1.x) + 3 * t * t * (s.p2.x - s.c2.x);
      const ty = 3 * u * u * (s.c1.y - s.p1.y) + 6 * u * t * (s.c2.y - s.c1.y) + 3 * t * t * (s.p2.y - s.c2.y);
      out.push({ x, y, tx, ty });
    }
  }
  return out;
}

/**
 * 비행기 자리 — 왼쪽 위 고리의 **위쪽 호**에서 x = PLANE_X_RATIO·W 인 점(시안에서 비행기 중심이 놓인 x).
 * 기수는 접선(오른쪽 진행)을 따른다. angle 은 화면 좌표의 회전각(도 · 시계 방향 양수).
 */
function planePlacement(size: PaperSize): { x: number; y: number; angle: number } {
  const targetX = size.width * PLANE_X_RATIO + TL_OFFSET.x;
  const dense = orbitDense(orbitPoints(size, 'tl'), 16);
  // ⚠️ 목표 x 를 지나는 점은 위쪽 호와 (종이 뒤) 아래쪽 호 둘이다. 목표 x 근처(±4pt)의 점 중 **가장 위(y 최소)** 를
  //    고른다. 단순히 x 가 가장 가까운 점을 고르면 샘플 간격 때문에 아래쪽 호가 뽑혀 비행기가 종이 안에 놓인다.
  const near = dense.filter((p) => Math.abs(p.x - targetX) <= 4);
  const pool = near.length > 0 ? near : dense;
  let best = pool[0];
  for (const p of pool) if (p.y < best.y) best = p;
  const sign = best.tx < 0 ? -1 : 1;
  return { x: best.x, y: best.y, angle: (Math.atan2(sign * best.ty, sign * best.tx) * 180) / Math.PI };
}

/** Ionicons airplane 글리프는 기본이 오른쪽(0°)을 향한다. (2026-09-20 시뮬에서 회전 0 으로 실측) */
const PLANE_GLYPH_OFFSET_DEG = 0;

/** 시인성 필터 — glow(흰) 위에 아주 약한 보라 그림자. 앞·뒤 겹이 같은 정의를 쓴다 */
function OrbitStyleFilter() {
  return (
    <Filter id="invite-orbit-style" x="-25%" y="-25%" width="150%" height="150%">
      <FeDropShadow
        dx={0}
        dy={0}
        stdDeviation={ORBIT_GLOW.blur}
        floodColor={INVITE_THEME.onPrimary}
        floodOpacity={ORBIT_GLOW.opacity}
        result="glow"
      />
      <FeDropShadow
        in="glow"
        dx={0}
        dy={ORBIT_SHADOW.dy}
        stdDeviation={ORBIT_SHADOW.blur}
        floodColor={INVITE_THEME.primary}
        floodOpacity={ORBIT_SHADOW.opacity}
      />
    </Filter>
  );
}

/** 두 고리를 그린다. 앞·뒤 겹이 같은 함수를 부르므로 path · 선 스타일 · 필터가 같다 */
function OrbitPaths({ size, offset }: { size: PaperSize; offset: number }) {
  return (
    <>
      <Defs>
        <OrbitStyleFilter />
      </Defs>
      {(['tl', 'br'] as const).map((corner) => (
        <Path
          key={corner}
          d={orbitPathD(orbitPoints(size, corner), offset)}
          fill="none"
          stroke={INVITE_THEME.onPrimary}
          strokeWidth={ORBIT_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#invite-orbit-style)"
        />
      ))}
    </>
  );
}

/** 뒤 겹 — 종이 아래. 종이 밖으로 나온 부분이 보인다 */
function OrbitBack({ size }: { size: PaperSize }) {
  const { width, height } = size;
  return (
    <Svg
      pointerEvents="none"
      width={width + ORBIT_PAD * 2}
      height={height + ORBIT_PAD * 2}
      style={{ position: 'absolute', top: -ORBIT_PAD, left: -ORBIT_PAD }}
    >
      <OrbitPaths size={size} offset={ORBIT_PAD} />
    </Svg>
  );
}

/** 앞 겹 — 종이 안(결 뒤 · 내용 앞). 같은 path 를 종이 좌표로 그리고 "종이 위 호" 영역만 클립한다 */
function OrbitFront({ size }: { size: PaperSize }) {
  const { width, height } = size;
  const w = width;
  const m = OVER_TL_TRI.margin;
  const tlRect = `M${-m} ${-m} L${(w * OVER_TL_TRI.topX).toFixed(1)} ${-m} L${-m} ${(w * OVER_TL_TRI.leftY).toFixed(1)} Z`;
  const brPoly =
    OVER_BR_POLY.map(([rx, ry], i) => `${i === 0 ? 'M' : 'L'}${(width + rx * w).toFixed(1)} ${(height + ry * w).toFixed(1)}`).join(' ') +
    ' Z';
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <ClipPath id="invite-orbit-over-paper">
          <Path d={`${tlRect} ${brPoly}`} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#invite-orbit-over-paper)">
        <OrbitPaths size={size} offset={0} />
      </G>
    </Svg>
  );
}

/** 궤도선 위의 작은 비행기. 기존 Ionicons airplane 을 접선 방향으로 돌린다. 색은 BRAND.primary */
function OrbitPlane({ size }: { size: PaperSize }) {
  const { x, y, angle } = planePlacement(size);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - PLANE_SIZE / 2,
        top: y - PLANE_SIZE / 2,
        transform: [{ rotate: `${angle + PLANE_GLYPH_OFFSET_DEG}deg` }],
      }}
    >
      <Ionicons name="airplane" size={PLANE_SIZE} color={INVITE_THEME.primary} />
    </View>
  );
}

type Props = {
  /** 로고 · divider 아래의 상태별 내용. */
  children: ReactNode;
  /** CTA 묶음. 내용 바로 아래 정해진 간격으로 온다. 화면 하단에 붙이지 않는다. */
  footer: ReactNode;
};

export function InviteShell({ children, footer }: Props) {
  /** 종이 실측. 장식(궤도 · 비행기)이 이것에 비례한다. 첫 layout 전에는 장식을 그리지 않는다. */
  const [paper, setPaper] = useState<PaperSize | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INVITE_THEME.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 22,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* 종이 + 장식을 한 틀에. 틀의 크기 = 종이 크기(폭 88% · 높이 내용). 장식은 absolute 라 틀 크기에 영향 없음 */}
      <View style={{ width: CARD_WIDTH }}>
        {paper ? <OrbitBack size={paper} /> : null}
        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setPaper((prev) =>
              prev && prev.width === width && prev.height === height ? prev : { width, height },
            );
          }}
          style={{
            width: '100%',
            minHeight: CARD_MIN_HEIGHT,
            backgroundColor: INVITE_THEME.card,
            borderRadius: CARD_RADIUS,
            paddingHorizontal: INNER_H,
            paddingTop: 40,
            paddingBottom: 22,
            // 종이가 배경 위에 살짝 떠 있는 정도. 모달처럼 띄우지 않는다.
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 5 },
            elevation: 3,
          }}
        >
          {/* 종이 결. 카드 전체에 타일로 깔고 아주 옅게 — 글자 대비를 해치지 않는다. 터치는 통과. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: CARD_RADIUS,
              overflow: 'hidden',
            }}
          >
            <Image
              source={PAPER_GRAIN}
              resizeMode="repeat"
              accessibilityElementsHidden
              style={{ width: '100%', height: '100%', opacity: 0.6 }}
            />
          </View>

          {/* 앞 겹 궤도선 — 결 위 · 내용 아래. 로고 · 글 · CTA 가 이 위에 그려져 선을 가린다 */}
          {paper ? <OrbitFront size={paper} /> : null}

          {/* 로고 블록: TP 심볼 + TripPot 워드 + 짧은 divider */}
          <View style={{ alignItems: 'center' }}>
            {/*
              ⚠️ 확정된 로고 파일(assets/logo.png · 2026-09-18 새 로고, 브랜드 보라로 저장된 원본)을 **그대로** 쓴다.
               tintColor · filter · recolor 없음. 크기 · 위치도 그대로. (2026-09-21)
            */}
            <Image
              source={require('@/assets/logo.png')}
              style={{ width: 74, height: 60 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="TripPot"
            />
            <Text
              style={{
                marginTop: 8,
                fontSize: 15,
                fontWeight: '800',
                letterSpacing: 0.2,
                color: INVITE_THEME.primary,
              }}
            >
              TripPot
            </Text>
            <View
              style={{
                marginTop: 24,
                width: 64,
                height: 1.5,
                borderRadius: 1,
                backgroundColor: INVITE_THEME.primary,
                opacity: 0.35,
              }}
            />
          </View>

          {/* 상태별 내용. 카드가 minHeight 보다 짧은 상태면 남는 공간의 가운데에 온다. */}
          <View style={{ flexGrow: 1, justifyContent: 'center' }}>{children}</View>

          {/* CTA — 내용 바로 아래 일정한 간격. spacer 로 밀지 않는다. */}
          <View style={{ marginTop: 30 }}>{footer}</View>
        </View>
        {paper ? <OrbitPlane size={paper} /> : null}
      </View>
    </ScrollView>
  );
}
