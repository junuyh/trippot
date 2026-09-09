// ============================================================================
// 정산 명세서(PDF) 그래프 — 영수증 잉크로 그린 SVG 문자열
//
// v5 명세서는 숫자가 줄줄이 나열돼 "읽고 싶지 않다" 는 피드백을 받았다.
// 그래프를 넣되 **영수증 언어**를 지킨다. 잉크 한 색의 농도, 얇은 선, 등폭 숫자.
// 색은 초과(국기색)·절약(초록) 두 곳에만 쓴다.
//
//   donutSvg        지출 구성. 상위 4개 + 기타. 가운데에 1위 카테고리와 비중
//   budgetBarsSvg   카테고리별 계획 대비 실제. 실제는 채운 막대, 계획은 세로 눈금.
//                   계획을 넘긴 만큼은 국기색으로 이어 그린다
//   dailyBarsSvg    일자별 지출. 여행 중 날짜로 눈금을 잡고, 여행 전·후는
//                   회색으로 따로 둔다 (항공·숙소 선결제가 여행 중 막대를 납작하게
//                   만들지 않게)
//   gaugeSvg        예산 사용률 한 줄. 목표 100% 자리에 눈금
//
// ⚠️ 순수 함수. 폰트는 상속하므로 <text> 에 family 를 주지 않는다 (숫자는
//    class 로 mono 를 붙인다). 외부 리소스 없음.
// ⚠️ 사용자 입력(거래명)은 여기 들어오지 않는다. 카테고리 라벨은 상수다.
// ============================================================================
import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';

import { manShort } from './format';
import type { DailyGroup, ReportCategory } from './report';

const INK = '#141b28';
const MUTED = '#6f7885';
const FAINT = '#9aa3af';
const TRACK = '#eceff3';
/** 잉크 농도 5단계. 도넛 조각·범례에 같은 순서로 쓴다 */
export const INK_SHADES = ['#141b28', '#4b5563', '#8b94a2', '#c3c9d1', '#e3e7ec'] as const;

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 지출 구성 도넛 ────────────────────────────────────────────────────────────

export type DonutSlice = { label: string; emoji: string; amount: number; ratio: number; color: string };

/** 실제 사용액 기준 상위 4개 + 기타. 0원은 뺀다 */
export function toDonutSlices(categories: ReportCategory[], limit = 4): DonutSlice[] {
  const spent = categories.filter((c) => c.actualAmount > 0).sort((a, b) => b.actualAmount - a.actualAmount);
  const total = spent.reduce((sum, c) => sum + c.actualAmount, 0);
  if (total === 0) return [];
  const head = spent.slice(0, limit);
  const rest = spent.slice(limit);
  const slices: DonutSlice[] = head.map((c, i) => ({
    label: c.label,
    emoji: CATEGORY_EMOJI[c.categoryCode] ?? '',
    amount: c.actualAmount,
    ratio: c.actualAmount / total,
    color: INK_SHADES[Math.min(i, INK_SHADES.length - 1)],
  }));
  if (rest.length > 0) {
    const amount = rest.reduce((sum, c) => sum + c.actualAmount, 0);
    slices.push({ label: `기타 ${rest.length}개`, emoji: '', amount, ratio: amount / total, color: INK_SHADES[4] });
  }
  return slices;
}

/** 도넛 + 오른쪽 범례. width 는 전체 폭 */
export function donutSvg(slices: DonutSlice[], width: number): string {
  if (slices.length === 0) return '';
  const size = 132;
  const r = 48;
  const stroke = 18;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = slices
    .map((s) => {
      const len = circ * s.ratio;
      // 조각 사이 1.5px 틈. 흰 배경이라 잉크 조각끼리 붙어 보이지 않는다
      const gap = slices.length > 1 ? 1.5 : 0;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${Math.max(0, len - gap).toFixed(2)} ${(circ - Math.max(0, len - gap)).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return el;
    })
    .join('');
  const top = slices[0];
  const center = `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="18" font-weight="800" fill="${INK}" class="mono">${Math.round(top.ratio * 100)}%</text><text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="${MUTED}">${esc(top.label)}</text>`;

  const lx = size + 18;
  const rowH = 20;
  const legend = slices
    .map((s, i) => {
      const y = 14 + i * rowH;
      return `<rect x="${lx}" y="${y - 7}" width="9" height="9" rx="2" fill="${s.color}" stroke="${i >= 3 ? '#cfd5dc' : 'none'}" stroke-width="0.5"/>
<text x="${lx + 15}" y="${y}" font-size="10.5" font-weight="700" fill="${INK}">${s.emoji ? `${s.emoji} ` : ''}${esc(s.label)}</text>
<text x="${width - 74}" y="${y}" text-anchor="end" font-size="10" fill="${MUTED}" class="mono">${Math.round(s.ratio * 100)}%</text>
<text x="${width}" y="${y}" text-anchor="end" font-size="10.5" font-weight="700" fill="${INK}" class="mono">${s.amount.toLocaleString('ko-KR')}원</text>`;
    })
    .join('');
  const height = Math.max(size, 14 + slices.length * rowH);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0 ${((height - size) / 2).toFixed(1)})">${arcs}${center}</g>${legend}</svg>`;
}

// ── 카테고리별 계획 대비 실제 ────────────────────────────────────────────────

/**
 * 한 줄에 카테고리 하나. 실제는 채운 막대, 계획은 세로 눈금.
 * 실제가 계획을 넘으면 넘은 구간을 accent 로 이어 그리고, 아끼면 눈금까지
 * 남은 구간을 점선 테두리로 비워 둔다.
 */
export function budgetBarsSvg(
  categories: ReportCategory[],
  width: number,
  accent: string,
  saved: string,
): string {
  const rows = [...categories]
    .filter((c) => c.plannedAmount > 0 || c.actualAmount > 0)
    .sort((a, b) => b.actualAmount - a.actualAmount);
  if (rows.length === 0) return '';
  const max = Math.max(...rows.map((c) => Math.max(c.plannedAmount, c.actualAmount)), 1);
  const labelW = 84;
  const valueW = 118;
  const barX = labelW;
  const barW = width - labelW - valueW;
  const rowH = 26;
  const barH = 10;

  const body = rows
    .map((c, i) => {
      const y = i * rowH + 13;
      const planX = barX + (c.plannedAmount / max) * barW;
      const actualW = (c.actualAmount / max) * barW;
      const none = c.actualAmount === 0;
      const over = c.diff > 0;
      const diffColor = none || c.diff === 0 ? FAINT : over ? accent : saved;
      const diffText = none ? '기록 없음' : c.diff === 0 ? '계획대로' : `${over ? '+' : '−'}${manShort(Math.abs(c.diff))}`;
      const track = `<rect x="${barX}" y="${y - barH / 2}" width="${barW}" height="${barH}" rx="2" fill="${TRACK}"/>`;
      // 실제: 계획까지는 잉크, 넘긴 만큼은 국기색
      const inkW = Math.min(actualW, planX - barX);
      const fill = `<rect x="${barX}" y="${y - barH / 2}" width="${Math.max(0, inkW).toFixed(2)}" height="${barH}" rx="2" fill="${INK}"/>`;
      const overFill = over
        ? `<rect x="${planX.toFixed(2)}" y="${y - barH / 2}" width="${(actualW - (planX - barX)).toFixed(2)}" height="${barH}" fill="${accent}"/>`
        : '';
      const tick = `<line x1="${planX.toFixed(2)}" y1="${y - barH / 2 - 4}" x2="${planX.toFixed(2)}" y2="${y + barH / 2 + 4}" stroke="${INK}" stroke-width="1.4"/>`;
      return `<text x="0" y="${y + 4}" font-size="10.5" font-weight="700" fill="${INK}">${CATEGORY_EMOJI[c.categoryCode] ?? ''} ${esc(c.label)}</text>
${track}${fill}${overFill}${tick}
<text x="${width - 52}" y="${y + 4}" text-anchor="end" font-size="10.5" font-weight="700" fill="${INK}" class="mono">${manShort(c.actualAmount)}</text>
<text x="${width}" y="${y + 4}" text-anchor="end" font-size="9.5" font-weight="${none ? 400 : 700}" fill="${diffColor}" class="mono">${diffText}</text>`;
    })
    .join('');
  const height = rows.length * rowH + 4;
  // 범례는 마지막 줄 아래 따로. 줄 위에 얹으면 겹친다
  const legend = `<g transform="translate(${barX} ${height + 12})"><line x1="0" y1="-8" x2="0" y2="2" stroke="${INK}" stroke-width="1.4"/><text x="6" y="0" font-size="8.5" fill="${FAINT}">계획</text><rect x="34" y="-8" width="14" height="8" rx="2" fill="${INK}"/><text x="52" y="0" font-size="8.5" fill="${FAINT}">실제</text><rect x="78" y="-8" width="14" height="8" fill="${accent}"/><text x="96" y="0" font-size="8.5" fill="${FAINT}">계획 초과</text></g>`;
  return `<svg width="${width}" height="${height + 18}" viewBox="0 0 ${width} ${height + 18}" xmlns="http://www.w3.org/2000/svg">${body}${legend}</svg>`;
}

// ── 일자별 지출 ───────────────────────────────────────────────────────────────

export function dailyBarsSvg(groups: DailyGroup[], width: number): string {
  const buckets = groups.filter((g) => g.key !== 'undated');
  if (buckets.length === 0) return '';
  const inTrip = buckets.filter((b) => b.inTrip);
  // 눈금은 여행 중 날짜 기준. 선결제(여행 전)가 크면 여행 중 막대가 다 납작해진다
  const scaleBase = inTrip.some((b) => b.amount > 0) ? inTrip : buckets;
  const max = Math.max(...scaleBase.map((b) => b.amount), 1);
  const plotH = 84;
  const labelH = 26;
  const top = 16;
  const gap = 8;
  const n = buckets.length;
  const barW = Math.min(40, (width - gap * (n - 1)) / n);
  const totalW = barW * n + gap * (n - 1);
  const x0 = (width - totalW) / 2;

  const bars = buckets
    .map((b, i) => {
      const x = x0 + i * (barW + gap);
      const capped = b.amount > max;
      const h = Math.max(b.amount > 0 ? 2 : 0, (Math.min(b.amount, max) / max) * plotH);
      const y = top + plotH - h;
      const fill = b.inTrip ? INK : '#c3c9d1';
      // 눈금을 넘긴 막대(여행 전 선결제)는 위를 톱니로 잘라 "더 있다" 를 표시
      const cap = capped
        ? `<polyline points="${x},${y + 6} ${x + barW * 0.25},${y + 2} ${x + barW * 0.5},${y + 6} ${x + barW * 0.75},${y + 2} ${x + barW},${y + 6}" fill="none" stroke="#fff" stroke-width="2"/>`
        : '';
      const value = b.amount > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" font-weight="700" fill="${b.inTrip ? INK : MUTED}" class="mono">${manShort(b.amount)}</text>` : '';
      const label = `<text x="${x + barW / 2}" y="${top + plotH + 12}" text-anchor="middle" font-size="9.5" font-weight="${b.inTrip ? 800 : 400}" fill="${b.inTrip ? INK : MUTED}">${esc(b.label)}</text>`;
      const sub = b.dateLabel ? `<text x="${x + barW / 2}" y="${top + plotH + 22}" text-anchor="middle" font-size="8" fill="${FAINT}">${esc(b.dateLabel.replace(/\s*\(.*\)$/, ''))}</text>` : '';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}"/>${cap}${value}${label}${sub}`;
    })
    .join('');
  const base = `<line x1="0" y1="${top + plotH}" x2="${width}" y2="${top + plotH}" stroke="#cfd5dc" stroke-width="1"/>`;
  const height = top + plotH + labelH;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${base}${bars}</svg>`;
}

// ── 예산 사용률 게이지 ────────────────────────────────────────────────────────

export function gaugeSvg(usageRateBp: number, width: number, accent: string, saved: string): string {
  const over = usageRateBp > 10000;
  const h = 8;
  const fillRatio = over ? 1 : usageRateBp / 10000;
  const targetX = over ? (10000 / usageRateBp) * width : width;
  const color = over ? accent : usageRateBp === 10000 ? INK : saved;
  return `<svg width="${width}" height="${h + 6}" viewBox="0 0 ${width} ${h + 6}" xmlns="http://www.w3.org/2000/svg">
<rect x="0" y="3" width="${width}" height="${h}" rx="4" fill="${TRACK}"/>
<rect x="0" y="3" width="${(fillRatio * width).toFixed(1)}" height="${h}" rx="4" fill="${color}"/>
<line x1="${targetX.toFixed(1)}" y1="0" x2="${targetX.toFixed(1)}" y2="${h + 6}" stroke="${INK}" stroke-width="1.6"/>
</svg>`;
}
