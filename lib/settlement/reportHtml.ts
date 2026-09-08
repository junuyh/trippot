// ============================================================================
// 정산 명세서 HTML (SETTLE-01 · v3)
//
// expo-print 이 이 HTML 을 PDF 로 만든다.
//
// ⚠️ 순수 함수다. 문자열만 만든다.
//
// ============================================================================
// 왜 이 순서인가 (v3 · 2026-09-08)
// ============================================================================
//
//   받는 사람이 묻는 순서대로 답한다. 표를 먼저 들이밀지 않는다.
//     ① 식별       누가 · 언제 · 어떤 여행
//     ② 결론       "잘 다녀왔나" 한 문장 + 총액 + 사용률 게이지 + 1인당·하루
//     ③ 어디에     구성 비중 (가로 누적 막대)
//     ④ 계획 대비  편차 (좌우 막대)
//     ⑤ 언제       일자별 흐름  ← v3 에서 넣었다
//     ⑥ 증빙       카테고리 표(원 단위) · 거래 내역 전체
//
//   숫자는 결론의 총액과 증빙 표만 원 단위다. 그림에는 만원을 쓴다.
//   여섯 자리 숫자가 줄마다 반복되면 읽기 전에 지친다.
//
// ⚠️ 외부 리소스를 쓰지 않는다. 폰트도 이미지도 링크하지 않는다.
//    PDF 생성은 오프라인에서도 되어야 하고, 링크가 죽으면 문서가 깨진다.
//
// ⚠️ 사용자 입력이 그대로 들어가는 자리가 있다(여행지·모임명·거래명).
//    반드시 escape 한다. 안 하면 따옴표 하나로 표가 깨진다.
// ============================================================================
import { manwon, won } from './format';
import type { SettlementReport } from './report';
import { compositionBarSvg, dailyBarsSvg, diffBarSvg, toDonutSlices } from './reportChart';

export type { ReportTransaction } from './report';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 부호를 붙인다. 0 이면 '—' */
function signed(value: number): string {
  if (value === 0) return '—';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString('ko-KR')}원`;
}

export function buildSettlementReportHtml(
  report: SettlementReport,
  /** 국기 색. 강조에만 쓴다 */
  accent: string,
): string {
  const OVER = '#d92d20';
  const SAVED = '#18865e';
  const tone =
    report.verdict.tone === 'saved' ? SAVED : report.verdict.tone === 'over' ? OVER : '#101828';
  const rate = (report.usageRateBp / 100).toFixed(1).replace(/\.0$/, '');
  const over = report.usageRateBp > 10000;
  // 게이지. 목표를 100 으로 두고 실제를 채운다. 넘치면 목표 자리에 표식
  const targetPct = over ? (10000 / report.usageRateBp) * 100 : 100;
  const fillPct = over ? 100 : report.usageRateBp / 100;

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
    report.transactions.length === 0
      ? ''
      : `<h2>거래 내역 <span class="count">${report.transactions.length}건 · 확정 지출 전체</span></h2>
         <table class="tx">
           <thead><tr><th>날짜</th><th>내용</th><th>분류</th><th class="n">금액</th></tr></thead>
           <tbody>${report.transactions
             .map(
               (t) => `<tr>
                 <td class="date">${t.occurredAt ? esc(t.occurredAt.slice(0, 10).replaceAll('-', '.')) : '—'}</td>
                 <td>${esc(t.name)}</td>
                 <td class="muted">${t.categoryLabel ? esc(t.categoryLabel) : '미분류'}</td>
                 <td class="n">${won(t.amount)}</td>
               </tr>`,
             )
             .join('')}</tbody>
           <tfoot><tr><td colspan="3">합계</td><td class="n">${won(report.actualAmount)}</td></tr></tfoot>
         </table>`;

  const daily = dailyBarsSvg(report.dailySpends, accent);
  const inTrip = report.dailySpends.filter((b) => b.inTrip);
  const peakBase = inTrip.some((b) => b.amount > 0) ? inTrip : report.dailySpends;
  const peak = peakBase.reduce(
    (best, b) => (b.amount > (best?.amount ?? 0) ? b : best),
    peakBase[0],
  );
  const outside = report.dailySpends.filter((b) => !b.inTrip && b.amount > 0);

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
  header { display: flex; justify-content: space-between; align-items: flex-end;
           border-bottom: 2px solid ${accent}; padding-bottom: 12px; }
  .brand { font-size: 9px; font-weight: 800; letter-spacing: 1.5px; color: ${accent}; }
  h1 { margin: 6px 0 4px; font-size: 21px; letter-spacing: -0.5px; }
  .meta { color: #667085; font-size: 10px; }
  .stamp { font-size: 9px; color: #98a1ac; text-align: right; line-height: 1.6; }

  /* ② 결론 */
  .hero { margin: 18px 0 0; padding: 16px 18px; border: 1px solid #e2e6eb; border-radius: 10px; }
  .hero .title { font-size: 16px; font-weight: 800; color: ${tone}; }
  .hero .total { margin-top: 4px; font-size: 26px; font-weight: 900; letter-spacing: -0.8px;
                 font-variant-numeric: tabular-nums; }
  .hero .total small { font-size: 12px; font-weight: 700; margin-left: 2px; }
  .hero .sub { color: #667085; font-size: 10px; }
  .hero .sub b { color: ${tone}; }
  .gauge { position: relative; margin-top: 12px; height: 9px; border-radius: 5px; background: #eef0f3; }
  .gauge .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; background: ${over ? OVER : tone}; }
  .gauge .target-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; background: #101828; }
  .gauge .mark { position: absolute; top: -3px; width: 2px; height: 15px; background: #101828; border-radius: 1px; }
  .gauge-legend { display: flex; justify-content: space-between; margin-top: 4px; font-size: 9px; color: #98a1ac; }
  .gauge-legend b { color: ${tone}; }
  .tiles { display: flex; margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef0f3; }
  .tiles div { flex: 1; }
  .tiles div + div { border-left: 1px solid #eef0f3; padding-left: 12px; }
  .tiles small { display: block; color: #98a1ac; font-size: 9px; }
  .tiles b { display: block; margin-top: 3px; font-size: 13px; }

  .funds { display: flex; margin: 10px 0 0; border: 1px solid #e2e6eb; border-radius: 8px; background: #f9fafb; }
  .funds div { flex: 1; padding: 9px 14px; }
  .funds div + div { border-left: 1px solid #e2e6eb; }
  .funds small { display: block; color: #8d939d; font-size: 9px; }
  .funds b { display: block; margin-top: 3px; font-size: 12px; }
  .funds .hl { color: ${accent}; }

  h2 { margin: 22px 0 8px; font-size: 13px; }
  h2 .count { margin-left: 5px; color: #98a1ac; font-size: 10px; font-weight: 400; }
  h2 .hint { float: right; color: #98a1ac; font-size: 9px; font-weight: 400; }

  .box { padding: 12px 16px; border: 1px solid #e2e6eb; border-radius: 8px; }
  .composition .legend { width: 100%; margin-top: 8px; }
  .legend td { padding: 4px 0; border: 0; font-size: 10px; }
  .legend .sw { width: 14px; }
  .legend .sw span { display: inline-block; width: 9px; height: 9px; border-radius: 2px; }
  .legend .pct { width: 38px; color: #8d939d; text-align: right; }
  .legend .n { text-align: right; font-variant-numeric: tabular-nums; }
  .axis { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 4px; }
  .axis .l { color: ${accent}; font-weight: 700; }
  .axis .r { color: ${OVER}; font-weight: 700; }
  .axis .c { color: #98a1ac; }
  .caption { margin-top: 6px; font-size: 10px; color: #667085; }
  .caption b { color: ${accent}; }

  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #eceff2; text-align: left; }
  thead th { background: #f6f8fa; color: #667085; font-size: 9px; font-weight: 700; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { border-top: 2px solid #101828; border-bottom: 0; font-weight: 800; }
  .over { color: ${OVER}; }
  .under { color: ${SAVED}; }
  .muted { color: #98a1ac; }
  .tx .date { color: #667085; white-space: nowrap; }

  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e6eb;
           color: #98a1ac; font-size: 9px; line-height: 1.6; }
</style></head>
<body>
  <header>
    <div>
      <div class="brand">TRIPPOT · TRIP REPORT</div>
      <h1>${esc(report.destination)} 정산 명세서</h1>
      <div class="meta">
        ${esc(report.periodLabel)} · ${report.nights}박 ${report.days}일 · ${report.headcount}명
        ${report.groupName ? ` · ${esc(report.groupName)}` : ''}
      </div>
    </div>
    <div class="stamp">
      ${report.confirmedLabel ? `확정 ${esc(report.confirmedLabel)}<br />` : ''}
      확정 시점의 기록
    </div>
  </header>

  <div class="hero">
    <div class="title">${esc(report.verdict.title)}</div>
    <div class="total">${report.actualAmount.toLocaleString('ko-KR')}<small>원</small></div>
    <div class="sub">
      목표 ${manwon(report.targetAmount)}
      ${report.difference !== 0 ? ` · <b>${report.difference < 0 ? `${manwon(-report.difference)} 남김` : `${manwon(report.difference)} 초과`}</b>` : ''}
      ${report.typeLabel ? ` · 이번 여행은 <b>${esc(report.typeLabel)}</b>` : ''}
    </div>
    <div class="gauge">
      <div class="fill" style="width:${fillPct}%"></div>
      ${over ? `<div class="target-fill" style="width:${targetPct}%"></div>` : ''}
      <div class="mark" style="left:calc(${targetPct}% - 1px)"></div>
    </div>
    <div class="gauge-legend"><span><b>예산의 ${rate}% 사용</b></span><span>목표 100%</span></div>
    <div class="tiles">
      <div><small>1인당 지출</small><b>${manwon(report.perPersonAmount)}</b></div>
      <div><small>일평균 지출</small><b>${manwon(report.perDayAmount)}</b></div>
      <div><small>1인 일평균</small><b>${manwon(report.perPersonPerDayAmount)}</b></div>
    </div>
  </div>

  <div class="funds">
    <div><small>누적 모금액</small><b>${won(report.raisedAmount)}</b></div>
    <div><small>실제 사용액</small><b>${won(report.actualAmount)}</b></div>
    <div><small>남은 금액</small><b class="hl">${won(report.remainingAmount)}</b></div>
  </div>

  <h2>지출 구성 <span class="hint">카테고리별 비중</span></h2>
  <div class="box">${compositionBarSvg(toDonutSlices(report.categories, accent))}</div>

  <h2>계획 대비 편차 <span class="hint">편차가 큰 순 · 막대 길이는 금액</span></h2>
  <div class="box">
    <div class="axis"><span class="l">◀ 절약</span><span class="c">계획</span><span class="r">초과 ▶</span></div>
    ${diffBarSvg(report.byDeviation, SAVED)}
  </div>

  ${
    daily
      ? `<h2>일자별 지출 <span class="hint">여행 전 결제 포함</span></h2>
  <div class="box">
    ${daily}
    ${peak && peak.amount > 0 ? `<div class="caption">최대 지출일 <b>${esc(peak.label)}</b> · ${manwon(peak.amount)}${outside.map((b) => ` · ${esc(b.label)} 결제 ${manwon(b.amount)}`).join('')}</div>` : ''}
  </div>`
      : ''
  }

  <h2>카테고리별 정산 내역 <span class="hint">원 단위</span></h2>
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
    금액은 원 단위이고 환율 변환은 포함하지 않았어요. 그림의 금액은 만원 단위로 줄여 적었어요. · TripPot
  </footer>
</body></html>`;
}
