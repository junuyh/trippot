// ============================================================================
// 캐리어 태그 실루엣 — 목록 카드(앞면 · GroupTravelCard)와 상세 상단(뒷면 · LuggageTagBack)이
// 같은 모양을 쓴다. (2026-09-17)
//
//   ┌╲──────────────────────────╮      왼쪽 = 끈이 걸리는 머리. 위·아래 모서리를 사선으로 깎고
//   │ ◯                         │      그 안쪽에 **실제로 뚫린** 구멍(evenodd cutout)이 있다.
//   │                           │      오른쪽 = 둥근 모서리. 그냥 카드다.
//   └╱──────────────────────────╯
//
// 구멍은 Path 의 evenodd 서브패스라 뒤(흰 화면)가 그대로 비친다 — 아이콘이 아니라 구멍이다.
// ============================================================================

/** 왼쪽 위·아래 모서리 사선 컷 크기 */
export const TAG_CHAMFER = 26;
/** 오른쪽 모서리 반지름 */
export const TAG_RADIUS = 18;
/** 끈 구멍 반지름 · 중심 (왼쪽 머리 안, 위쪽) */
export const TAG_HOLE_R = 6.5;
export const TAG_HOLE_CX = 21;
export const TAG_HOLE_CY = 19;

/**
 * 태그 바깥 실루엣 + 구멍. fillRule="evenodd" 로 채워야 구멍이 뚫린다.
 */
export function luggageTagBodyPath(width: number, height: number): string {
  const c = TAG_CHAMFER;
  const r = TAG_RADIUS;
  const hx = TAG_HOLE_CX;
  const hy = TAG_HOLE_CY;
  const hr = TAG_HOLE_R;
  return [
    `M ${c} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${c}`,
    `L 0 ${height - c}`,
    `V ${c}`,
    'Z',
    // 구멍(반시계 원 · evenodd)
    `M ${hx - hr} ${hy}`,
    `A ${hr} ${hr} 0 1 0 ${hx + hr} ${hy}`,
    `A ${hr} ${hr} 0 1 0 ${hx - hr} ${hy}`,
    'Z',
  ].join(' ');
}

/** 구멍 둘레 링(펀칭 자국). 몸통 위에 얇게 얹는다. */
export function luggageTagHolePath(): string {
  const hx = TAG_HOLE_CX;
  const hy = TAG_HOLE_CY;
  const hr = TAG_HOLE_R + 1;
  return `M ${hx - hr} ${hy} A ${hr} ${hr} 0 1 0 ${hx + hr} ${hy} A ${hr} ${hr} 0 1 0 ${hx - hr} ${hy} Z`;
}

/**
 * 안쪽 흰 정보 패널 — 바깥과 같은 언어(왼쪽 사선 · 오른쪽 둥근 모서리), 컷은 작다.
 */
export function luggageTagPanelPath(width: number, height: number, chamfer = 12, radius = 10): string {
  const c = chamfer;
  const r = radius;
  return [
    `M ${c} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${c}`,
    `L 0 ${height - c}`,
    `V ${c}`,
    'Z',
  ].join(' ');
}
