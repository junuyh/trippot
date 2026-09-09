// ============================================================================
// 정산 명세서 HTML (SETTLE-01 · v5 · 2026-09-09)
//
// expo-print 이 이 HTML 을 PDF 로 만든다. 모임원에게 보내는 증빙 문서다.
//
// ⚠️ 순수 함수다. 문자열만 만든다.
//
// ============================================================================
// v5 — 앱 정산 내용을 **긴 영수증 한 장**으로
// ============================================================================
//
//   v4 는 정산 화면을 표로 옮긴 문서였다. 정확했지만 "우리 서비스" 로 읽히지
//   않았다. v5 는 공유 이미지(SettlementCard)와 같은 종이다. 회색 바탕 위에
//   흰 영수증 한 장, 위아래 톱니, 점선 구분선, 등폭 숫자, 이중선, 바코드.
//   내용은 SETTLE-01 화면 그대로다.
//
//     머리글        TRIPPOT · {CITY} TRIP RECEIPT · 기간 · 인원 · 확정일
//     그림          이미지와 같은 그림 (receiptArt · 여행마다 고정)
//     SUMMARY       최종 사용 금액 · 목표 · 남은/초과 · 사용률 · 1인당 · 건수
//     CATEGORIES    카테고리별 예산 / 실제 / 차이 (편차 큰 순, 화면과 같다)
//     TRAVEL FUND   누적 모금 · 사용 · 남은 여행자금 (모금액이 있을 때만)
//     TRANSACTIONS  날짜별로 묶은 전체 지출. "언제 썼나" 는 이걸로 답한다
//     TOTAL · 도장 · 바코드
//
//   금액은 전부 원 단위다. 색은 잉크·회색·결과색(절약 초록 / 초과 국기색) 셋뿐.
//
// ⚠️ 외부 리소스를 쓰지 않는다. 폰트도 이미지도 링크하지 않는다.
//    그림은 인라인 SVG 다. PDF 생성은 오프라인에서도 되어야 한다.
//
// ⚠️ 사용자 입력이 그대로 들어가는 자리가 있다(여행지·모임명·거래명).
//    반드시 escape 한다. 안 하면 따옴표 하나로 문서가 깨진다.
// ============================================================================
import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';
import { countryTheme } from '@/lib/constants/countryTheme';
import type { DestinationCode } from '@/lib/constants/destinations';
import { CATEGORY_CODE_LABEL } from '@/lib/constants/status';

import { won, wonSigned } from './format';
import { pickReceiptArt, receiptArtSvg } from './receiptArt';
import type { SettlementReport } from './report';

export type { ReportTransaction } from './report';

export type ReportHtmlOptions = {
  /** 국기 색. 초과 표시에만 쓴다 */
  accent: string;
  /** 국기 이모지 */
  flag: string;
  /** 'TOKYO'. 없으면 '' */
  nameEn: string;
  /** 그림에 쓴다. 직접 입력 목적지는 null */
  countryKo: string | null;
  destinationCode: DestinationCode | null;
  airportCode: string | null;
};

const INK = '#141b28';
const MUTED = '#6f7885';
const FAINT = '#9aa3af';
const SAVED = '#19865f';

/** 바코드 막대. [막대 폭, 뒤 여백]. 이미지와 같은 패턴 */
const BARS: readonly [number, number][] = [
  [2, 1], [1, 1], [3, 2], [1, 1], [1, 2], [2, 1], [1, 1], [3, 1], [2, 2], [1, 1],
  [1, 1], [2, 2], [3, 1], [1, 1], [2, 1], [1, 2], [1, 1], [3, 1], [1, 2], [2, 1],
  [2, 1], [1, 1], [3, 2], [1, 1], [1, 1], [2, 2], [1, 1], [2, 1], [3, 1], [1, 2],
  [1, 1], [2, 1], [1, 1], [3, 1], [2, 2], [1, 1], [2, 1], [1, 1], [3, 1], [2, 0],
];

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 톱니 한 줄. 종이 폭 100% 로 늘어나는 SVG. up 이면 윗변 */
function toothSvg(up: boolean): string {
  const TOOTH = 12;
  const H = 7;
  const W = 600;
  const count = Math.ceil(W / TOOTH);
  const pts: string[] = [];
  if (up) {
    pts.push(`0,${H}`);
    for (let i = 0; i < count; i += 1) pts.push(`${i * TOOTH + TOOTH / 2},0`, `${(i + 1) * TOOTH},${H}`);
  } else {
    pts.push('0,0');
    for (let i = 0; i < count; i += 1) pts.push(`${i * TOOTH + TOOTH / 2},${H}`, `${(i + 1) * TOOTH},0`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block"><polygon points="${pts.join(' ')}" fill="#fff"/></svg>`;
}

function barcodeSvg(width: number, height: number): string {
  const units = BARS.reduce((sum, [b, g]) => sum + b + g, 0);
  const u = width / units;
  let x = 0;
  const rects = BARS.map(([b, g]) => {
    const r = `<rect x="${x.toFixed(2)}" y="0" width="${(b * u).toFixed(2)}" height="${height}" fill="${INK}"/>`;
    x += (b + g) * u;
    return r;
  }).join('');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

/** 영수증 한 줄. 왼쪽 이름, 오른쪽 금액 */
function line(label: string, value: string, opts: { bold?: boolean; color?: string; sub?: string } = {}): string {
  const cls = opts.bold ? 'row bold' : 'row';
  const style = opts.color ? ` style="color:${opts.color}"` : '';
  return `<div class="${cls}"><span class="l">${label}${opts.sub ? `<small>${opts.sub}</small>` : ''}</span><span class="v"${style}>${value}</span></div>`;
}

export function buildSettlementReportHtml(report: SettlementReport, options: ReportHtmlOptions): string {
  const OVER = options.accent;
  const same = report.difference === 0;
  const within = report.difference <= 0;
  const resultColor = same ? INK : within ? SAVED : OVER;
  const rate =
    report.targetAmount > 0 ? `${(report.usageRateBp / 100).toFixed(1).replace(/\.0$/, '')}%` : '—';
  const city = options.nameEn || report.destination;
  const stay = report.nights > 0 ? `${report.nights}박 ${report.days}일` : null;
  const meta = [report.periodLabel, stay, `${report.headcount}명`].filter(Boolean).join(' · ');

  const art = receiptArtSvg(
    pickReceiptArt(`${report.destination}|${report.startDate ?? ''}`, options),
    options,
    300,
    150,
  );

  // ── CATEGORIES ────────────────────────────────────────────────────────
  const plannedTotal = report.categories.reduce((sum, c) => sum + c.plannedAmount, 0);
  const categoryRows = report.byDeviation
    .map((c) => {
      const none = c.actualAmount === 0;
      const diffText = none ? '기록 없음' : c.diff === 0 ? '예산과 동일' : wonSigned(c.diff);
      const diffColor = none || c.diff === 0 ? FAINT : c.diff > 0 ? OVER : SAVED;
      return `<tr>
        <td class="e">${CATEGORY_EMOJI[c.categoryCode] ?? ''}</td>
        <td class="n">${esc(c.label)}</td>
        <td class="a muted">${won(c.plannedAmount)}</td>
        <td class="a">${won(c.actualAmount)}</td>
        <td class="a" style="color:${diffColor};font-weight:${none || c.diff === 0 ? 400 : 700}">${diffText}</td>
      </tr>`;
    })
    .join('');

  // ── TRAVEL FUND ───────────────────────────────────────────────────────
  const fund =
    report.raisedAmount > 0
      ? `<div class="dash"></div>
  <div class="sec">TRAVEL FUND<small>여행자금</small></div>
  ${line('누적 모금액', won(report.raisedAmount))}
  ${line('여행비로 사용', won(report.actualAmount))}
  ${line('남은 여행자금', won(report.remainingAmount), { bold: true, color: report.remainingAmount > 0 ? SAVED : INK })}`
      : '';

  // ── TRANSACTIONS ──────────────────────────────────────────────────────
  const txRows = report.dailyGroups
    .map((g) => {
      const head = `<tr class="day"><td colspan="2">${esc(g.label)}${g.dateLabel ? `<span class="date">${esc(g.dateLabel)}</span>` : ''}</td><td class="a">${won(g.amount)}</td></tr>`;
      const rows = g.transactions
        .map((t) => {
          const label = t.categoryCode ? CATEGORY_CODE_LABEL[t.categoryCode] : null;
          return `<tr><td class="e">${t.categoryCode ? (CATEGORY_EMOJI[t.categoryCode] ?? '') : '·'}</td><td class="n">${esc(t.name)}${label ? `<span class="cat">${esc(label)}</span>` : ''}</td><td class="a">${won(t.amount)}</td></tr>`;
        })
        .join('');
      return head + rows;
    })
    .join('');
  const tx =
    report.transactions.length === 0
      ? ''
      : `<div class="dash"></div>
  <div class="sec">TRANSACTIONS<small>거래 내역 ${report.transactions.length}건</small></div>
  <table class="tx"><tbody>${txRows}</tbody></table>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${esc(report.destination)} 여행 정산 명세서</title>
<style>
  @page { size: A4; margin: 10mm 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e9ebee; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    color: ${INK};
    font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
    font-size: 11px;
    line-height: 1.4;
    padding: 6mm 0 10mm;
  }
  .mono, .a, .v, .num { font-family: Menlo, "SF Mono", "Courier New", monospace; font-variant-numeric: tabular-nums; }

  /* 위: 여행 끝 */
  .hero { text-align: center; margin-bottom: 14px; }
  .hero .eyebrow { font-size: 9px; font-weight: 900; letter-spacing: 3px; color: ${MUTED}; }
  .hero .city { margin-top: 4px; font-size: 44px; line-height: 1; font-weight: 900; letter-spacing: 2px; font-family: "Avenir Next Condensed", "Arial Narrow", -apple-system, sans-serif; }
  .hero .meta { margin-top: 6px; font-size: 10px; letter-spacing: 0.5px; color: ${MUTED}; }

  /* 영수증 종이 */
  .paper { width: 128mm; margin: 0 auto; filter: drop-shadow(0 10px 18px rgba(15,23,42,0.16)); }
  .body { background: #fff; }
  .body { padding: 18px 22px 20px; }

  .brand { text-align: center; font-size: 11px; font-weight: 900; letter-spacing: 3px; }
  .title { text-align: center; margin-top: 4px; font-size: 9px; letter-spacing: 2.4px; color: ${FAINT}; }
  .dates { text-align: center; margin-top: 8px; font-size: 9px; color: ${FAINT}; }

  .dash { margin-top: 14px; border-top: 1px dashed #cfd5dc; }
  .dbl { margin-top: 14px; border-top: 2px solid ${INK}; }
  .dbl::after { content: ""; display: block; margin-top: 2px; border-top: 1px solid ${INK}; }

  .art { margin: 16px auto 0; width: 300px; height: 150px; border: 1px solid ${INK}; }
  .art svg { display: block; }
  .caption { text-align: center; margin-top: 10px; font-size: 10px; font-weight: 800; letter-spacing: 2px; }
  .caption + .sub { text-align: center; margin-top: 3px; font-size: 9.5px; color: ${FAINT}; }

  .sec { margin-top: 14px; font-size: 10px; font-weight: 900; letter-spacing: 2px; }
  .sec small { margin-left: 8px; font-size: 9.5px; font-weight: 400; letter-spacing: 0; color: ${MUTED}; }

  .row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; font-size: 11px; }
  .row .l { color: ${MUTED}; }
  .row .l small { margin-left: 6px; font-size: 9px; color: ${FAINT}; }
  .row .v { font-weight: 700; }
  .row.bold .l { color: ${INK}; font-weight: 800; }
  .row.total { margin-top: 12px; }
  .row.total .l { color: ${INK}; font-size: 12px; font-weight: 900; letter-spacing: 2px; }
  .row.total .v { font-size: 20px; letter-spacing: -0.5px; }
  .row.big .v { font-size: 22px; letter-spacing: -0.5px; }
  .verdict { margin-top: 4px; text-align: right; font-size: 11px; font-weight: 800; }

  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { padding: 6px 0; vertical-align: middle; font-size: 11px; border-top: 1px dotted #e3e7ec; }
  tbody tr:first-child td { border-top: 0; }
  td.e { width: 20px; font-size: 13px; text-align: center; padding-right: 4px; }
  td.n { font-weight: 700; }
  td.n .cat { margin-left: 6px; font-size: 9px; font-weight: 400; color: ${FAINT}; }
  td.a { text-align: right; white-space: nowrap; font-weight: 700; padding-left: 10px; }
  td.muted { color: ${MUTED}; font-weight: 400; }
  thead td { font-size: 8.5px; font-weight: 400; color: ${FAINT}; letter-spacing: 0.5px; border-top: 0; padding-top: 8px; padding-bottom: 2px; }
  tfoot td { border-top: 1px solid ${INK}; font-weight: 800; padding-top: 8px; }
  table.tx tr.day td { padding: 8px 0 4px; font-weight: 800; border-top: 0; }
  table.tx tr.day .date { margin-left: 8px; font-weight: 400; color: ${MUTED}; }
  table.tx tr.day + tr td { border-top: 0; }
  tr { break-inside: avoid; }

  .stamp { display: inline-block; margin-top: 16px; padding: 5px 11px; border: 1.5px solid; border-radius: 4px; font-size: 10px; font-weight: 900; letter-spacing: 1px; transform: rotate(-4deg); }
  .stamp-wrap { text-align: center; }
  .barcode { margin: 16px auto 0; width: 100%; }
  .barcode svg { display: block; width: 100%; height: 26px; }
  .issued { text-align: center; margin-top: 8px; font-size: 8px; letter-spacing: 2px; color: ${FAINT}; }
  .foot { text-align: center; margin-top: 16px; font-size: 9px; color: ${MUTED}; }
  .handle { text-align: center; margin-top: 10px; font-size: 10px; font-weight: 900; letter-spacing: 2.5px; text-decoration: underline; }
</style>
</head>
<body>

<div class="hero">
  <div class="eyebrow">TRIP COMPLETE</div>
  <div class="city">${esc(city)}</div>
  <div class="meta">${options.flag} ${esc(meta)}${report.groupName ? ` · ${esc(report.groupName)}` : ''}</div>
</div>

<div class="paper">
  ${toothSvg(true)}
  <div class="body">
    <div class="brand">TRIPPOT</div>
    <div class="title">TRIP RECEIPT</div>
    <div class="dates mono">${esc(report.periodLabel.replaceAll('.', '/'))}${report.confirmedLabel ? ` &nbsp;·&nbsp; ${report.confirmedLabel.replaceAll('.', '/')} 확정` : ''}</div>

    <div class="dash"></div>
    <div class="art">${art}</div>
    <div class="caption">${esc(city)} · ${esc(countryTheme(options.countryKo).nameEn || 'ABROAD')}</div>
    <div class="sub">${stay ? `${stay} · ` : ''}${report.headcount}명 · ${report.transactions.length}건 결제</div>

    <div class="dbl"></div>
    <div class="sec">SUMMARY<small>정산 요약</small></div>
    <div class="row total"><span class="l">TOTAL</span><span class="v">${won(report.actualAmount)}</span></div>
    ${line('목표 여행비', won(report.targetAmount))}
    ${line(within ? '남은 금액' : '초과 금액', won(Math.abs(report.difference)), { bold: true, color: resultColor })}
    ${line('예산 사용률', rate, { color: same ? INK : resultColor })}
    ${report.headcount > 1 ? line(`1인당`, won(report.perPersonAmount), { sub: `${report.headcount}명` }) : ''}
    ${line('확정 지출', `${report.transactions.length}건`)}

    <div class="dash"></div>
    <div class="sec">CATEGORIES<small>카테고리별 정산 · 편차 큰 순</small></div>
    <table>
      <thead><tr><td colspan="2">카테고리</td><td class="a">예산</td><td class="a">실제</td><td class="a">차이</td></tr></thead>
      <tbody>${categoryRows}</tbody>
      <tfoot><tr><td colspan="2">합계</td><td class="a muted">${won(plannedTotal)}</td><td class="a">${won(report.actualAmount)}</td><td class="a" style="color:${resultColor}">${same ? '예산과 동일' : wonSigned(report.difference)}</td></tr></tfoot>
    </table>

    ${fund}

    ${tx}

    <div class="dbl"></div>
    <div class="row total"><span class="l">TOTAL</span><span class="v">${won(report.actualAmount)}</span></div>
    <div class="stamp-wrap"><span class="stamp" style="color:${resultColor};border-color:${resultColor}">${esc(report.verdict.title)}${within ? ' ✓' : ''}</span></div>

    <div class="barcode">${barcodeSvg(400, 26)}</div>
    <div class="issued">${esc(city)} · ${report.headcount} TRAVELERS${report.confirmedLabel ? ` · ISSUED ${report.confirmedLabel.replaceAll('.', '/')}` : ''}</div>
    <div class="foot">TripPot 에서 결산 확정 시점의 값으로 만든 명세서예요. 확정 뒤 예산을 고쳐도 이 문서는 바뀌지 않아요.</div>
  </div>
  ${toothSvg(false)}
</div>

<div class="handle">@TRIPPOT</div>

</body>
</html>`;
}
