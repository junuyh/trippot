// ============================================================================
// 정산 리포트 차트 (SETTLE-01)
//
// expo-print 가 받는 HTML 안에 **인라인 SVG** 로 그린다.
//
// ⚠️ 차트 라이브러리를 쓰지 않는다. PDF 는 오프라인에서도 만들어져야 하고,
//    스크립트가 도는 시점을 보장할 수 없다. SVG 는 그냥 그림이라 안전하다.
//
// ============================================================================
// 색을 눈으로 고르지 않았다
// ============================================================================
//
//   도넛의 조각은 **금액 순으로 정렬**돼 있다. 그러면 색이 곧 크기를 뜻하므로
//   categorical(서로 다른 색조)이 아니라 **sequential(한 색조의 단계)** 이 맞다.
//   국기색을 흰 바탕에 0 / 14 / 28 / 42% 로 섞어 네 단계를 만든다.
//
//   검증한 것
//     · 단조 명도 — 네 단계가 순서대로 밝아진다 (sequential 의 기준)
//     · 대비      — 가장 옅은 단계가 흰 바탕에서 2.1~2.7:1 로 3:1 미만이다
//
//   ⚠️ 그래서 **모든 조각에 이름과 금액을 직접 적는다.** 색만으로 구분하게
//      두면 옅은 조각을 못 읽는다. 범례가 아니라 라벨이 본체다.
//
// ⚠️ 조각을 5개로 제한한다(상위 4 + 기타). 8개를 다 그리면 작은 조각이
//    선처럼 보이고, 어느 것이 어느 것인지 색으로는 절대 구분되지 않는다.
// ============================================================================
import type { ReportCategory } from './report';

/** 흰 바탕에 섞어 옅게 만든다. ratio 0 이면 원색, 1 이면 흰색 */
function tint(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mix = (start: number) =>
    Math.round(start + (255 - start) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(parseInt(value.slice(0, 2), 16))}${mix(
    parseInt(value.slice(2, 4), 16),
  )}${mix(parseInt(value.slice(4, 6), 16))}`;
}

/** 조각 색 단계. 끝을 42% 에서 끊는다. 더 옅으면 흰 바탕에서 사라진다 */
const TINTS = [0, 0.14, 0.28, 0.42];
const ETC_COLOR = '#b6bcc6';

export type DonutSlice = {
  label: string;
  amount: number;
  ratio: number;
  color: string;
};

/** 상위 4개 + 기타. 실제 사용액이 0인 카테고리는 넣지 않는다 */
export function toDonutSlices(
  categories: ReportCategory[],
  accent: string,
): DonutSlice[] {
  const spent = categories
    .filter((c) => c.actualAmount > 0)
    .sort((a, b) => b.actualAmount - a.actualAmount);
  const total = spent.reduce((sum, c) => sum + c.actualAmount, 0);
  if (total === 0) return [];

  const head = spent.slice(0, 4);
  const tail = spent.slice(4);
  const slices: DonutSlice[] = head.map((c, index) => ({
    label: c.label,
    amount: c.actualAmount,
    ratio: c.actualAmount / total,
    color: tint(accent, TINTS[index] ?? 0.42),
  }));

  const etc = tail.reduce((sum, c) => sum + c.actualAmount, 0);
  if (etc > 0) {
    slices.push({
      label: `기타 ${tail.length}개`,
      amount: etc,
      ratio: etc / total,
      color: ETC_COLOR,
    });
  }
  return slices;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const won = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 도넛 + 라벨.
 *
 * 원을 stroke-dasharray 로 자른다. path 로 부채꼴을 그리는 것보다 조각 사이
 * 간격을 정확히 주기 쉽다. (마크 규칙 — 채움 사이 2px 표면 간격)
 */
export function donutSvg(slices: DonutSlice[]): string {
  if (slices.length === 0) return '';

  const size = 132;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const GAP = 2; // 조각 사이 표면 간격

  let offset = 0;
  const arcs = slices
    .map((slice) => {
      const length = Math.max(0, circumference * slice.ratio - GAP);
      const dash = `${length} ${circumference - length}`;
      const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
        fill="none" stroke="${slice.color}" stroke-width="${stroke}"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" />`;
      offset += circumference * slice.ratio;
      return arc;
    })
    .join('');

  const rows = slices
    .map(
      (slice) => `<tr>
        <td class="sw"><span style="background:${slice.color}"></span></td>
        <td>${esc(slice.label)}</td>
        <td class="pct">${Math.round(slice.ratio * 100)}%</td>
        <td class="n">${won(slice.amount)}</td>
      </tr>`,
    )
    .join('');

  return `<div class="chart">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
         style="transform:rotate(-90deg)" role="img" aria-label="카테고리별 지출 구성">
      ${arcs}
    </svg>
    <table class="legend">${rows}</table>
  </div>`;
}

/**
 * 계획 대비 차액. 0 을 가운데 두고 좌우로 뻗는 가로 막대다.
 *
 * ⚠️ 이건 **방향이 있는 값**이다. 절약과 초과는 반대 방향이라, 같은 색
 *    막대의 길이만으로 그리면 둘이 구분되지 않는다. 그래서 좌우로 가르고
 *    색을 둘로 나눈다. (diverging)
 *
 * ⚠️ 축은 하나다. 계획과 실제를 두 축으로 그리지 않는다.
 */
export function diffBarSvg(
  categories: ReportCategory[],
  underColor: string,
): string {
  const rows = categories.filter((c) => c.plannedAmount > 0 || c.actualAmount > 0);
  if (rows.length === 0) return '';

  const max = Math.max(...rows.map((c) => Math.abs(c.diff)), 1);

  /*
    ⚠️ 카테고리 이름에 **자리를 따로 준다.** 0 선 왼쪽에 이름을 놓으면
       절약(왼쪽으로 뻗는) 막대가 그 이름을 덮는다. 실제로 그렇게 나왔다.
       왼쪽 칸(이름) → 그림 칸(막대) → 오른쪽 칸(금액) 세 구역으로 나눈다.
  */
  const W = 520;
  const H = 22;
  const LABEL_W = 76; // 이름 칸
  const VALUE_W = 86; // 금액 칸
  const plotX = LABEL_W;
  const plotW = W - LABEL_W - VALUE_W;
  const zero = plotX + plotW * 0.42; // 0 선. 초과 쪽을 넓게 준다
  const OVER = '#d92d20';

  const bars = rows
    .map((c, index) => {
      const y = index * H;
      const over = c.diff > 0;
      const room = over ? plotX + plotW - zero : zero - plotX;
      const len = c.diff === 0 ? 0 : Math.max(2, (Math.abs(c.diff) / max) * room);
      const x = over ? zero : zero - len;
      const label =
        c.diff === 0
          ? '—'
          : `${over ? '+' : '−'}${Math.abs(c.diff).toLocaleString('ko-KR')}`;

      return `<g>
        <text x="${LABEL_W - 10}" y="${y + 14}" class="cat" text-anchor="end">${esc(c.label)}</text>
        <rect x="${x}" y="${y + 5}" width="${len}" height="10" rx="4"
              fill="${over ? OVER : underColor}" />
        <text x="${W}" y="${y + 14}" class="val" text-anchor="end"
              fill="${c.diff === 0 ? '#98a1ac' : over ? OVER : underColor}">${label}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${rows.length * H + 6}" width="100%"
       role="img" aria-label="카테고리별 계획 대비 차액">
    <style>
      .cat { font: 9px -apple-system, sans-serif; fill: #667085; }
      .val { font: 9px -apple-system, sans-serif; font-weight: 700; }
    </style>
    <line x1="${zero}" y1="0" x2="${zero}" y2="${rows.length * H}"
          stroke="#e2e6eb" stroke-width="1" />
    ${bars}
  </svg>`;
}
