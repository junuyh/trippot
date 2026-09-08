// ============================================================================
// 정산 명세서 HTML (SETTLE-01 · A안)
//
// expo-print 이 이 HTML 을 PDF 로 만든다.
//
// ⚠️ 순수 함수다. 문자열만 만든다.
//
// ============================================================================
// 왜 이 순서인가
// ============================================================================
//
//   경비 리포트 템플릿들이 공통으로 지키는 순서를 따랐다.
//     ① 식별 정보  누가 · 언제 · 어떤 여행
//     ② 요약       총액을 몇 초 안에 판단할 수 있게
//     ③ 분해       카테고리별 계획 vs 실제
//     ④ 명세       건별 내역
//
//   요약이 맨 위다. 이 문서를 받는 사람이 가장 먼저 묻는 것은
//   "얼마 걷어서 얼마 썼고 얼마 남았나" 하나다.
//
// ⚠️ 외부 리소스를 쓰지 않는다. 폰트도 이미지도 링크하지 않는다.
//    PDF 생성은 오프라인에서도 되어야 하고, 링크가 죽으면 문서가 깨진다.
//
// ⚠️ 사용자 입력이 그대로 들어가는 자리가 있다(여행지·모임명·거래명).
//    반드시 escape 한다. 안 하면 따옴표 하나로 표가 깨진다.
// ============================================================================
import type { SettlementReport } from './report';
import { diffBarSvg, donutSvg, toDonutSlices } from './reportChart';

export type ReportTransaction = {
  name: string;
  amount: number;
  /** 'YYYY-MM-DD' 또는 ISO */
  occurredAt: string | null;
  categoryLabel: string | null;
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 부호를 붙인다. 0 이면 '—' */
function signed(value: number): string {
  if (value === 0) return '—';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString('ko-KR')}원`;
}

export function buildSettlementReportHtml(
  report: SettlementReport,
  transactions: ReportTransaction[],
  /** 국기 색. 표 머리와 강조에만 쓴다 */
  accent: string,
): string {
  const saved = report.difference < 0;

  const categoryRows = report.categories
    .map(
      (c) => `<tr>
        <td>${esc(c.label)}</td>
        <td class="n">${won(c.plannedAmount)}</td>
        <td class="n">${won(c.actualAmount)}</td>
        <td class="n ${c.diff > 0 ? 'over' : c.diff < 0 ? 'under' : ''}">${signed(c.diff)}</td>
      </tr>`,
    )
    .join('');

  /*
    거래가 없으면 부록을 아예 그리지 않는다. 빈 표를 두면 "내역이 없는 정산"
    이 아니라 "문서가 잘못 만들어졌다" 로 읽힌다.
  */
  const txSection =
    transactions.length === 0
      ? ''
      : `<h2>거래 내역 <span class="count">${transactions.length}건</span></h2>
         <table class="tx">
           <thead><tr><th>날짜</th><th>내용</th><th>분류</th><th class="n">금액</th></tr></thead>
           <tbody>${transactions
             .map(
               (t) => `<tr>
                 <td class="date">${t.occurredAt ? esc(t.occurredAt.slice(0, 10).replaceAll('-', '.')) : '—'}</td>
                 <td>${esc(t.name)}</td>
                 <td class="muted">${t.categoryLabel ? esc(t.categoryLabel) : '미분류'}</td>
                 <td class="n">${won(t.amount)}</td>
               </tr>`,
             )
             .join('')}</tbody>
         </table>`;

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8" />
<style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #101828;
    font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 11px; line-height: 1.5;
  }
  header { border-bottom: 2px solid ${accent}; padding-bottom: 12px; }
  .brand { font-size: 9px; font-weight: 800; letter-spacing: 1.5px; color: ${accent}; }
  h1 { margin: 6px 0 4px; font-size: 21px; letter-spacing: -0.5px; }
  .meta { color: #667085; font-size: 10px; }

  /* 요약 — 이 문서를 받은 사람이 가장 먼저 보는 자리 */
  .summary { display: flex; margin: 18px 0 6px; border: 1px solid #e2e6eb; border-radius: 8px; }
  .summary div { flex: 1; padding: 12px 14px; }
  .summary div + div { border-left: 1px solid #e2e6eb; }
  .summary small { display: block; color: #8d939d; font-size: 9px; }
  .summary b { display: block; margin-top: 5px; font-size: 15px; }
  .summary .hl { color: ${accent}; }

  .verdict { margin: 10px 0 22px; padding: 11px 14px; border-radius: 8px;
             background: #f6f8fa; font-size: 11px; }
  .verdict b { color: ${accent}; }

  h2 { margin: 22px 0 8px; font-size: 13px; }

  /* 도넛 + 라벨. 색이 옅은 조각도 읽히도록 라벨을 본체로 둔다 */
  .chart { display: flex; align-items: center; gap: 18px;
           padding: 14px 16px; border: 1px solid #e2e6eb; border-radius: 8px; }
  .legend { width: auto; flex: 1; }
  .legend td { padding: 4px 0; border: 0; font-size: 10px; }
  .legend .sw { width: 14px; }
  .legend .sw span { display: inline-block; width: 9px; height: 9px; border-radius: 2px; }
  .legend .pct { width: 38px; color: #8d939d; text-align: right; }
  .legend .n { text-align: right; font-variant-numeric: tabular-nums; }
  .bars { padding: 12px 16px; border: 1px solid #e2e6eb; border-radius: 8px; }
  h2 .count { margin-left: 5px; color: #98a1ac; font-size: 10px; font-weight: 400; }

  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #eceff2; text-align: left; }
  thead th { background: #f6f8fa; color: #667085; font-size: 9px; font-weight: 700; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { border-top: 2px solid #101828; border-bottom: 0; font-weight: 800; }
  .over { color: #d92d20; }
  .under { color: ${accent}; }
  .muted { color: #98a1ac; }
  .tx .date { color: #667085; white-space: nowrap; }

  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e6eb;
           color: #98a1ac; font-size: 9px; line-height: 1.6; }
</style></head>
<body>
  <header>
    <div class="brand">TRIPPOT · SETTLEMENT REPORT</div>
    <h1>${esc(report.destination)} 정산 명세서</h1>
    <div class="meta">
      ${esc(report.periodLabel)} · ${report.nights}박 ${report.days}일 · ${report.headcount}명
      ${report.groupName ? ` · ${esc(report.groupName)}` : ''}
      ${report.confirmedLabel ? ` · 확정 ${esc(report.confirmedLabel)}` : ''}
    </div>
  </header>

  <div class="summary">
    <div><small>누적 모금액</small><b>${won(report.raisedAmount)}</b></div>
    <div><small>목표 예산</small><b>${won(report.targetAmount)}</b></div>
    <div><small>실제 사용액</small><b>${won(report.actualAmount)}</b></div>
    <div><small>남은 금액</small><b class="hl">${won(report.remainingAmount)}</b></div>
  </div>

  <div class="verdict">
    목표 예산보다
    <b>${won(Math.abs(report.difference))} ${saved ? '적게 썼어요' : '더 썼어요'}</b>.
    1인당 <b>${won(report.perPersonAmount)}</b> 입니다.
    ${report.typeLabel ? ` 이번 여행은 <b>${esc(report.typeLabel)}</b> 이었어요.` : ''}
  </div>

  <h2>어디에 썼나</h2>
  ${donutSvg(toDonutSlices(report.categories, accent))}

  <h2>계획 대비 차액</h2>
  <div class="bars">${diffBarSvg(report.categories, accent)}</div>

  <h2>카테고리별 정산</h2>
  <table>
    <thead><tr><th>카테고리</th><th class="n">계획</th><th class="n">실제</th><th class="n">차액</th></tr></thead>
    <tbody>${categoryRows}</tbody>
    <tfoot><tr>
      <td>합계</td>
      <td class="n">${won(report.targetAmount)}</td>
      <td class="n">${won(report.actualAmount)}</td>
      <td class="n">${signed(report.difference)}</td>
    </tr></tfoot>
  </table>

  ${txSection}

  <footer>
    이 문서는 정산 확정 시점의 값으로 만들어졌어요. 이후 예산을 수정해도 값은 바뀌지 않아요.<br />
    금액은 원 단위이고 환율 변환은 포함하지 않았어요. · TripPot
  </footer>
</body></html>`;
}
