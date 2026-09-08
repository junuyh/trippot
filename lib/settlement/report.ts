// ============================================================================
// 정산 리포트 데이터 (SETTLE-01)
//
// 화면이 가진 값을 리포트 두 종류가 함께 쓰는 하나의 모양으로 정리한다.
//   A. 정산 명세서 (PDF)   lib/settlement/reportHtml.ts
//   B. 결산 카드 (이미지)   components/settlement/SettlementCard.tsx
//
// ⚠️ 순수 계산이다. DB 도 네트워크도 타지 않는다.
//
// ============================================================================
// 확정 스냅샷을 우선한다
// ============================================================================
//
//   settlements.category_snapshot_json 은 **확정 시점의 값**이다.
//   확정 뒤에 예산을 고쳐도 이 값은 안 움직인다.
//
//   리포트는 "그때 그 숫자" 여야 한다. 공유한 뒤에 앱에서 예산을 손봤다고
//   상대가 받은 문서와 값이 달라지면, 그 문서는 증빙 구실을 못 한다.
//   그래서 스냅샷이 있으면 스냅샷을, 없으면 현재 카테고리 값을 쓴다.
//
// ⚠️ 확정 전에는 리포트를 만들지 않는다. 화면이 그 판단을 한다.
//
// ============================================================================
// v3 (2026-09-08) — 리포트를 '표' 에서 '읽는 문서' 로
// ============================================================================
//
//   받는 사람이 묻는 순서대로 답한다.
//     ① 그래서 잘 다녀왔나        결론 한 문장 + 사용률
//     ② 얼마 썼나                 총액 · 1인당 · 하루 · 1인 하루
//     ③ 어디에 썼나               구성 비중
//     ④ 계획과 얼마나 달랐나       편차 (다음 여행 개인화의 근거)
//     ⑤ 언제 썼나                 일자별 흐름  ← 새로 넣었다
//     ⑥ 증빙                      카테고리 표 · 거래 내역 전체
//
//   숫자는 헤드라인과 증빙 표만 원 단위고, 나머지는 만원이다. (format.ts)
//   여섯 자리 숫자가 줄마다 반복되면 읽기 전에 지친다.
// ============================================================================
import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type ReportCategory = {
  categoryCode: CategoryCode;
  label: string;
  plannedAmount: number;
  actualAmount: number;
  /** 실제 − 계획. 양수면 더 썼다 */
  diff: number;
};

export type ReportTransaction = {
  name: string;
  amount: number;
  /** ISO 또는 'YYYY-MM-DD' */
  occurredAt: string | null;
  categoryLabel: string | null;
};

/** 일자별 지출 한 칸 */
export type DailySpend = {
  key: string;
  /** 'D1' · '여행 전' · '여행 후' */
  label: string;
  /** '5.14' 같은 날짜. 여행 전·후는 null */
  sub: string | null;
  amount: number;
  /** 여행 기간 안의 날인가 */
  inTrip: boolean;
};

export type ReportVerdict = {
  title: string;
  tone: 'saved' | 'exact' | 'over';
};

export type ReportInput = {
  destination: string;
  /** 'YYYY-MM-DD' */
  startDate: string | null;
  endDate: string | null;
  headcount: number;
  groupName: string | null;
  /** 확정 시각 ISO. 없으면 null */
  confirmedAt: string | null;

  /** 누적 모금액. 결제로 줄지 않는 값이다 (IA v2 §2-4-1) */
  raisedAmount: number;
  targetAmount: number;
  actualAmount: number;

  categories: ReportCategory[];
  /**
   * 확정 지출 전체. 환불 완료·취소·확인 필요는 화면이 이미 뺐다.
   * 명세서의 거래 내역과 일자별 흐름에 쓴다.
   */
  transactions: ReportTransaction[];
  /** 여행 유형 한 줄. 없으면 null */
  typeLabel: string | null;
  typeSummary: string | null;
};

export type SettlementReport = ReportInput & {
  nights: number;
  days: number;
  /** 실제 − 목표. 음수면 아꼈다 */
  difference: number;
  /** 실제 ÷ 목표. basis point. 9800 = 98% */
  usageRateBp: number;
  verdict: ReportVerdict;
  /** 1인당 실제 사용액 */
  perPersonAmount: number;
  /** 하루 평균 */
  perDayAmount: number;
  /** 1인 하루 */
  perPersonPerDayAmount: number;
  /** 남은 금액. 음수로 내려가지 않는다 */
  remainingAmount: number;
  /** 실제 사용액이 큰 순서. 카드에 상위 3개를 쓴다 */
  topSpent: ReportCategory[];
  /** 계획보다 덜 쓴 카테고리. 많이 아낀 순 */
  topSaved: ReportCategory[];
  /** 편차가 큰 순. 기록 없는 카테고리는 뒤로 */
  byDeviation: ReportCategory[];
  /** 일자별 지출. 여행 기간이 없으면 빈 배열 */
  dailySpends: DailySpend[];
  /** '2026.09.18 – 09.21' */
  periodLabel: string;
  /** '2026.09.25' */
  confirmedLabel: string | null;
};

/** 'YYYY-MM-DD' → '2026.09.18' */
function dot(date: string): string {
  return date.replaceAll('-', '.');
}

/** 결론 한 문장. 카드·명세서·화면이 같은 문장을 쓴다 */
export function reportVerdict(usageRateBp: number, actualAmount: number): ReportVerdict {
  if (actualAmount === 0) return { title: '기록된 지출이 없어요', tone: 'exact' };
  if (usageRateBp === 10000) return { title: '계획대로 딱 맞췄어요', tone: 'exact' };
  if (usageRateBp < 10000) return { title: '예산 안에서 잘 다녀왔어요', tone: 'saved' };
  if (usageRateBp <= 10500) return { title: '예산을 살짝 넘겼어요', tone: 'over' };
  return { title: '예산보다 많이 썼어요', tone: 'over' };
}

/**
 * 거래를 날짜별로 묶는다. 여행 기간의 날마다 한 칸, 출발 전은 '여행 전',
 * 돌아온 뒤는 '여행 후' 한 칸. 없는 칸은 안 만든다.
 *
 * ⚠️ 시간대를 다루지 않으려고 날짜 문자열(앞 10자)로만 비교한다.
 *    ISO 의 앞 10자는 UTC 날짜라 KST 자정 전후 결제가 하루 밀릴 수 있다.
 *    [검토 필요] 명세서에서 하루 어긋남이 문제되면 화면에서 KST 로 변환해 넘긴다.
 */
export function toDailySpends(
  transactions: ReportTransaction[],
  startDate: string | null,
  endDate: string | null,
): DailySpend[] {
  if (!startDate || !endDate || endDate < startDate) return [];

  const byDate = new Map<string, number>();
  let before = 0;
  let after = 0;
  for (const t of transactions) {
    if (!t.occurredAt) continue;
    const day = t.occurredAt.slice(0, 10);
    if (day < startDate) before += t.amount;
    else if (day > endDate) after += t.amount;
    else byDate.set(day, (byDate.get(day) ?? 0) + t.amount);
  }

  const buckets: DailySpend[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  let index = 1;
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: `D${index}`,
      sub: `${cursor.getUTCMonth() + 1}.${cursor.getUTCDate()}`,
      amount: byDate.get(key) ?? 0,
      inTrip: true,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    index += 1;
  }
  if (before > 0) buckets.unshift({ key: 'before', label: '여행 전', sub: null, amount: before, inTrip: false });
  if (after > 0) buckets.push({ key: 'after', label: '여행 후', sub: null, amount: after, inTrip: false });
  return buckets;
}

export function buildSettlementReport(input: ReportInput): SettlementReport {
  const { startDate, endDate, headcount, targetAmount, actualAmount, raisedAmount } = input;

  const nights =
    startDate && endDate
      ? Math.max(
          0,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000,
          ),
        )
      : 0;
  const days = nights + 1;
  const people = Math.max(1, headcount);

  // 실제 사용액이 0인 카테고리는 '많이 쓴 곳' 에 넣지 않는다.
  // 0원짜리를 3위로 올리면 쓰지도 않은 항목이 대표 지출로 나온다.
  const topSpent = [...input.categories]
    .filter((c) => c.actualAmount > 0)
    .sort((a, b) => b.actualAmount - a.actualAmount)
    .slice(0, 3);

  /*
    ⚠️ 실제가 0인 카테고리는 '아낀 곳' 에서도 뺀다.
       안 쓴 것과 아직 안 적은 것은 다르다. 기록이 없는 항목을 절약으로
       세면 "기록을 안 한 사람이 가장 알뜰해 보이는" 결과가 나온다.
  */
  const topSaved = [...input.categories]
    .filter((c) => c.actualAmount > 0 && c.diff < 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);

  const byDeviation = [...input.categories].sort((a, b) => {
    const aNone = a.actualAmount === 0;
    const bNone = b.actualAmount === 0;
    if (aNone !== bNone) return aNone ? 1 : -1;
    return Math.abs(b.diff) - Math.abs(a.diff);
  });

  const usageRateBp = targetAmount > 0 ? Math.round((actualAmount / targetAmount) * 10000) : 0;

  const transactions = [...input.transactions].sort((a, b) =>
    (a.occurredAt ?? '').localeCompare(b.occurredAt ?? ''),
  );

  return {
    ...input,
    transactions,
    nights,
    days,
    difference: actualAmount - targetAmount,
    usageRateBp,
    verdict: reportVerdict(usageRateBp, actualAmount),
    perPersonAmount: Math.round(actualAmount / people),
    perDayAmount: Math.round(actualAmount / days),
    perPersonPerDayAmount: Math.round(actualAmount / people / days),
    remainingAmount: Math.max(0, raisedAmount - actualAmount),
    topSpent,
    topSaved,
    byDeviation,
    dailySpends: toDailySpends(transactions, startDate, endDate),
    periodLabel:
      startDate && endDate
        ? `${dot(startDate)} – ${dot(endDate).slice(5)}`
        : '일정 미정',
    confirmedLabel: input.confirmedAt
      ? dot(input.confirmedAt.slice(0, 10))
      : null,
  };
}

/**
 * 카테고리 스냅샷을 리포트 모양으로 옮긴다.
 *
 * @param rows settlements.category_snapshot_json 또는 현재 budget_categories
 */
export function toReportCategories(
  rows: { category_code: string; planned_amount: number; actual_amount: number }[],
): ReportCategory[] {
  return rows.map((row) => {
    const code = row.category_code as CategoryCode;
    return {
      categoryCode: code,
      label: CATEGORY_CODE_LABEL[code] ?? row.category_code,
      plannedAmount: row.planned_amount,
      actualAmount: row.actual_amount,
      diff: row.actual_amount - row.planned_amount,
    };
  });
}
