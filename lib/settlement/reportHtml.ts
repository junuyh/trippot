// ============================================================================
// 정산 명세서 HTML (SETTLE-01 · v4 · 2026-09-08)
//
// expo-print 이 이 HTML 을 PDF 로 만든다. 모임원에게 보내는 증빙 문서다.
//
// ⚠️ 순수 함수다. 문자열만 만든다.
//
// ============================================================================
// v4 — 앱의 정산 화면을 그대로 종이에 옮긴다
// ============================================================================
//
//   v3 은 게이지·누적 막대·편차 막대·일자별 막대를 넣은 "리포트" 였다.
//   그림마다 읽는 법이 달랐고, 앱 어디에도 없는 모양이라 같은 서비스로
//   읽히지 않았다. v4 는 SETTLE-01 화면과 **같은 카드·같은 줄**로 만든다.
//   화면에서 본 것이 종이에 그대로 있으면 설명이 필요 없다.
//
//     ① 정산 요약       최종 사용 금액 · 절약/초과 한 줄 · 목표/사용률/1인당/건수
//     ② 카테고리별 정산  이모지 · 카테고리 · 예산 · 실제 · 차이  (화면 목록과 같은 줄)
//     ③ 여행자금        누적 모금 · 사용 · 남은 금액 (모금액이 있을 때만)
//     ④ 거래 내역       날짜별로 묶은 전체 지출. "언제 썼나" 는 그래프 대신 이걸로 답한다
//
//   금액은 전부 원 단위다. 명세서는 정확한 숫자가 있는 자리다.
//   색은 잉크·회색·결과색(절약 초록 / 초과 국기색) 셋뿐이다.
//
// ⚠️ 외부 리소스를 쓰지 않는다. 폰트도 이미지도 링크하지 않는다.
//    PDF 생성은 오프라인에서도 되어야 하고, 링크가 죽으면 문서가 깨진다.
//
// ⚠️ 사용자 입력이 그대로 들어가는 자리가 있다(여행지·모임명·거래명).
//    반드시 escape 한다. 안 하면 따옴표 하나로 표가 깨진다.
// ============================================================================
import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';
import { CATEGORY_CODE_LABEL } from '@/lib/constants/status';

import { won, wonSigned } from './format';
import type { SettlementReport } from './report';

export type { ReportTransaction } from './report';

export type ReportHtmlOptions = {
  /** 국기 색. 초과 표시에만 쓴다 */
  accent: string;
  /** 국기 이모지 */
  flag: string;
  /** 'TOKYO'. 없으면 '' */
  nameEn: string;
};

const INK = '#121a2a';
const MUTED = '#7c8695';
const FAINT = '#a8afb9';
const LINE = '#e8eaee';
const HAIR = '#eef0f3';
const SAVED = '#18865e';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSettlementReportHtml(
  report: SettlementReport,
  options: ReportHtmlOptions,
): string {
  const OVER = options.accent;
  const same = report.difference === 0;
  const saved = report.difference < 0;
  const resultColor = same ? INK : saved ? SAVED : OVER;
  const rate =
    report.targetAmount > 0 ? `${(report.usageRateBp / 100).toFixed(1).replace(/\.0$/, '')}%` : '—';
  const stay = report.nights > 0 ? `${report.nights}박 ${report.days}일` : null;
  const meta = [report.periodLabel, stay, `${report.headcount}명`].filter(Boolean).join(' · ');

  const verdictLine =
    report.actualAmount === 0
      ? '아직 기록된 지출이 없어요'
      : same
        ? '목표한 금액에 딱 맞췄어요'
        : `목표보다 ${won(Math.abs(report.difference))} ${saved ? '절약했어요' : '더 썼어요'}`;

  // ── ② 카테고리별 정산 ────────────────────────────────────────────────
  const plannedTotal = report.categories.reduce((sum, c) => sum + c.plannedAmount, 0);
  const categoryRows = report.byDeviation
    .map((c) => {
      const none = c.actualAmount === 0;
      const diffText = none ? '기록 없음' : same || c.diff === 0 ? '예산과 동일' : wonSigned(c.diff);
      const diffColor = none || c.diff === 0 ? FAINT : c.diff > 0 ? OVER : SAVED;
      return `<tr>
        <td class="emoji">${CATEGORY_EMOJI[c.categoryCode] ?? ''}</td>
        <td class="name">${esc(c.label)}</td>
        <td class="n muted">${won(c.plannedAmount)}</td>
        <td class="n">${won(c.actualAmount)}</td>
        <td class="n" style="color:${diffColor};font-weight:${none || c.diff === 0 ? 400 : 800}">${diffText}</td>
      </tr>`;
    })
    .join('');

  // ── ③ 여행자금 ──────────────────────────────────────────────────────
  const fundSection =
    report.raisedAmount > 0
      ? `<h2>여행자금</h2>
  <div class="tiles">
    <div class="tile"><small>누적 모금액</small><b>${won(report.raisedAmount)}</b></div>
    <div class="tile"><small>여행비로 사용</small><b>${won(report.actualAmount)}</b></div>
    <div class="tile"><small>남은 여행자금</small><b style="color:${report.remainingAmount > 0 ? SAVED : INK}">${won(report.remainingAmount)}</b></div>
  </div>`
      : '';

  // ── ④ 거래 내역 ─────────────────────────────────────────────────────
  const txRows = report.dailyGroups
    .map((g) => {
      const head = `<tr class="day">
        <td colspan="2"><b>${esc(g.label)}</b>${g.dateLabel ? `<span class="date">${esc(g.dateLabel)}</span>` : ''}</td>
        <td class="n"><b>${won(g.amount)}</b></td>
      </tr>`;
      const rows = g.transactions
        .map((t) => {
          const label = t.categoryCode ? CATEGORY_CODE_LABEL[t.categoryCode] : null;
          return `<tr>
          <td class="emoji">${t.categoryCode ? (CATEGORY_EMOJI[t.categoryCode] ?? '') : '·'}</td>
          <td class="name">${esc(t.name)}${label ? `<span class="cat">${esc(label)}</span>` : ''}</td>
          <td class="n">${won(t.amount)}</td>
        </tr>`;
        })
        .join('');
      return head + rows;
    })
    .join('');

  const txSection =
    report.transactions.length === 0
      ? ''
      : `<h2>거래 내역 <span class="count">${report.transactions.length}건</span></h2>
  <table class="tx">
    <tbody>${txRows}</tbody>
    <tfoot><tr><td colspan="2">합계 ${report.transactions.length}건</td><td class="n">${won(report.actualAmount)}</td></tr></tfoot>
  </table>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${esc(report.destination)} 여행 정산 명세서</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: ${INK};
    font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
    font-size: 11px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  b { font-weight: 800; }
  .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: ${MUTED}; }

  /* 머리글 */
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 1px solid ${LINE}; }
  .eyebrow { font-size: 9px; font-weight: 900; letter-spacing: 1.2px; color: ${FAINT}; }
  h1 { margin: 6px 0 0; font-size: 22px; line-height: 1.2; font-weight: 900; letter-spacing: -0.5px; }
  .meta { margin-top: 6px; font-size: 11px; color: ${MUTED}; font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; padding: 8px 10px; border-radius: 6px; background: ${INK}; color: #fff; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; white-space: nowrap; }

  /* 정산 요약 — SETTLE-01 상단 카드와 같은 줄 */
  .card { margin-top: 16px; border: 1px solid ${LINE}; border-radius: 14px; padding: 18px 20px; background: #fff; break-inside: avoid; }
  .card .label { font-size: 11px; color: ${MUTED}; margin-top: 12px; }
  .card .total { margin-top: 2px; font-size: 32px; line-height: 1.15; font-weight: 900; letter-spacing: -1.2px; font-variant-numeric: tabular-nums; }
  .card .total small { font-size: 14px; letter-spacing: 0; margin-left: 1px; }
  .card .verdict { margin-top: 6px; font-size: 12px; font-weight: 800; }
  .stats { display: flex; margin-top: 16px; padding-top: 14px; border-top: 1px solid ${HAIR}; }
  .stats div { flex: 1; padding-left: 12px; border-left: 1px solid ${HAIR}; }
  .stats div:first-child { padding-left: 0; border-left: 0; }
  .stats small { display: block; font-size: 9.5px; color: ${FAINT}; }
  .stats b { display: block; margin-top: 4px; font-size: 13px; font-variant-numeric: tabular-nums; }

  h2 { margin: 22px 0 8px; font-size: 14px; font-weight: 800; letter-spacing: -0.2px; }
  h2 .count { margin-left: 6px; font-size: 11px; font-weight: 400; color: ${MUTED}; }

  /* 표 — 화면의 카테고리 목록과 같은 줄 */
  table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid ${LINE}; border-radius: 14px; overflow: hidden; background: #fff; }
  th { padding: 9px 12px; font-size: 9.5px; font-weight: 400; color: ${FAINT}; text-align: left; background: #fafbfc; border-bottom: 1px solid ${HAIR}; }
  th.n { text-align: right; }
  td { padding: 10px 12px; border-top: 1px solid ${HAIR}; vertical-align: middle; }
  tbody tr:first-child td { border-top: 0; }
  td.emoji { width: 26px; padding-right: 0; font-size: 15px; text-align: center; }
  td.name { font-weight: 800; }
  td.name .cat { margin-left: 6px; font-size: 9.5px; font-weight: 400; color: ${FAINT}; }
  tfoot td { border-top: 1px solid ${LINE}; background: #fafbfc; font-weight: 800; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  /* 거래 내역 — 날짜 묶음 */
  table.tx tr.day td { background: #f5f7f9; padding: 7px 12px; font-size: 10.5px; border-top: 1px solid ${LINE}; }
  table.tx tr.day .date { margin-left: 8px; color: ${MUTED}; font-variant-numeric: tabular-nums; }
  table.tx tbody tr:first-child td { border-top: 0; }

  /* 여행자금 — 타일 */
  .tiles { display: flex; gap: 10px; break-inside: avoid; }
  .tile { flex: 1; border-radius: 10px; background: #f5f7f9; padding: 12px 13px; }
  .tile small { display: block; font-size: 9.5px; color: ${MUTED}; }
  .tile b { display: block; margin-top: 4px; font-size: 13px; font-variant-numeric: tabular-nums; }

  .foot { margin-top: 22px; padding-top: 12px; border-top: 1px dashed #c8ced5; display: flex; justify-content: space-between; font-size: 9.5px; color: ${FAINT}; }
</style>
</head>
<body>

<div class="head">
  <div>
    <div class="eyebrow">TRIPPOT · TRIP SETTLEMENT</div>
    <h1>${esc(report.destination)} 여행 정산 명세서</h1>
    <div class="meta">${esc(meta)}${report.groupName ? ` · ${esc(report.groupName)}` : ''}${report.confirmedLabel ? ` · 결산 확정 ${report.confirmedLabel}` : ''}</div>
  </div>
  <div class="badge">${options.flag} ${esc(options.nameEn || report.destination)}</div>
</div>

<div class="card">
  <div class="eyebrow">FINAL TRIP SETTLEMENT</div>
  <div class="label">최종 사용 금액</div>
  <div class="total">${report.actualAmount.toLocaleString('ko-KR')}<small>원</small></div>
  <div class="verdict" style="color:${report.actualAmount === 0 ? MUTED : resultColor}">${verdictLine}</div>
  <div class="stats">
    <div><small>목표 여행비</small><b>${won(report.targetAmount)}</b></div>
    <div><small>예산 사용률</small><b style="color:${same ? INK : resultColor}">${rate}</b></div>
    <div><small>1인당 (${report.headcount}명)</small><b>${won(report.perPersonAmount)}</b></div>
    <div><small>확정 지출</small><b>${report.transactions.length}건</b></div>
  </div>
</div>

<h2>카테고리별 정산</h2>
<table>
  <thead><tr><th colspan="2">카테고리</th><th class="n">예산</th><th class="n">실제</th><th class="n">차이</th></tr></thead>
  <tbody>${categoryRows}</tbody>
  <tfoot><tr>
    <td colspan="2">합계</td>
    <td class="n muted">${won(plannedTotal)}</td>
    <td class="n">${won(report.actualAmount)}</td>
    <td class="n" style="color:${resultColor}">${same ? '예산과 동일' : wonSigned(report.difference)}</td>
  </tr></tfoot>
</table>

${fundSection}

${txSection}

<div class="foot">
  <span>TripPot 에서 결산 확정 시점의 값으로 만든 명세서예요. 확정 뒤 예산을 고쳐도 이 문서는 바뀌지 않아요.</span>
  <span>@TRIPPOT</span>
</div>

</body>
</html>`;
}
