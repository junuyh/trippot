// ============================================================================
// 정산 리포트 데이터 (SETTLE-01)
//
// 화면이 가진 값을 리포트 두 종류가 함께 쓰는 하나의 모양으로 정리한다.
//   A. 정산 명세서 (PDF)   lib/settlement/reportHtml.ts
//   B. 정산 영수증 (이미지) components/settlement/SettlementCard.tsx
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
// v4 (2026-09-08) — 그래프를 걷어내고 영수증으로
// ============================================================================
//
//   v3 은 누적 막대·좌우 편차 막대·일자별 막대를 넣었다. 셋 다 읽는 법을
//   먼저 배워야 하는 그림이었고, 앱의 다른 화면 어디에도 없는 모양이었다.
//   (카테고리 목록도 2026-09-03 에 막대를 걷어냈다 — "무늬로 읽힌다")
//
//   v4 는 앱이 이미 쓰는 언어로 돌아간다. **영수증**이다.
//     · 카드 이미지 = TRIP-HOME-02 의 여행 영수증을 정식 한 장으로 늘린 것
//     · 명세서(PDF) = 같은 영수증을 A4 문서로 편 것
//   숫자는 전부 원 단위다. 영수증은 정확한 숫자가 있는 자리다.
//   "언제 썼나" 는 그래프 대신 **날짜별로 묶은 거래 내역**으로 답한다.
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
  /** 카테고리에 안 묶인 거래는 null */
  categoryCode: CategoryCode | null;
};

/** 날짜별로 묶은 거래. 명세서의 거래 내역 한 묶음 */
export type DailyGroup = {
  key: string;
  /** 'D1' · '여행 전' · '여행 후' · '날짜 없음' */
  label: string;
  /** '5.14 (목)'. 여행 전·후·날짜 없음은 null */
  dateLabel: string | null;
  inTrip: boolean;
  amount: number;
  transactions: ReportTransaction[];
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
   * 명세서의 거래 내역에 쓴다.
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
  /** 남은 여행자금 = 누적 모금액 − 실제 사용액. 음수로 내려가지 않는다 */
  remainingAmount: number;
  /** 실제 사용액이 큰 순서. 0원인 카테고리는 뺀다 */
  bySpent: ReportCategory[];
  /** 편차가 큰 순. 기록 없는 카테고리는 뒤로 */
  byDeviation: ReportCategory[];
  /** 계획보다 가장 많이 쓴 카테고리. 없으면 null */
  biggestOver: ReportCategory | null;
  /** 계획보다 가장 많이 아낀 카테고리. 없으면 null */
  biggestSaved: ReportCategory | null;
  /** 날짜별 거래 묶음. 여행 전 → D1..Dn → 여행 후 → 날짜 없음 */
  dailyGroups: DailyGroup[];
  /** '2026.09.18 – 09.21' */
  periodLabel: string;
  /** '2026.09.25' */
  confirmedLabel: string | null;
};

/** 'YYYY-MM-DD' → '2026.09.18' */
function dot(date: string): string {
  return date.replaceAll('-', '.');
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → '5.14 (목)' */
export function shortDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()} (${WEEKDAY[d.getUTCDay()]})`;
}

/** 결론 한 문장. 영수증·명세서가 같은 문장을 쓴다 */
export function reportVerdict(usageRateBp: number, actualAmount: number): ReportVerdict {
  if (actualAmount === 0) return { title: '기록된 지출이 없어요', tone: 'exact' };
  if (usageRateBp === 10000) return { title: '계획대로 딱 맞췄어요', tone: 'exact' };
  if (usageRateBp < 10000) return { title: '예산 안에서 여행 완료', tone: 'saved' };
  return { title: '예산을 넘겼어요', tone: 'over' };
}

/**
 * 거래를 날짜별로 묶는다. 여행 기간의 날마다 한 묶음(거래가 없는 날은 뺀다),
 * 출발 전은 '여행 전', 돌아온 뒤는 '여행 후', 날짜가 없는 거래는 맨 뒤.
 *
 * ⚠️ 시간대를 다루지 않으려고 날짜 문자열(앞 10자)로만 비교한다.
 *    ISO 의 앞 10자는 UTC 날짜라 KST 자정 전후 결제가 하루 밀릴 수 있다.
 *    [검토 필요] 명세서에서 하루 어긋남이 문제되면 화면에서 KST 로 변환해 넘긴다.
 */
export function groupTransactionsByDay(
  transactions: ReportTransaction[],
  startDate: string | null,
  endDate: string | null,
): DailyGroup[] {
  const hasPeriod = Boolean(startDate && endDate && endDate >= startDate);
  const byDate = new Map<string, ReportTransaction[]>();
  const before: ReportTransaction[] = [];
  const after: ReportTransaction[] = [];
  const undated: ReportTransaction[] = [];

  for (const t of transactions) {
    if (!t.occurredAt) {
      undated.push(t);
      continue;
    }
    const day = t.occurredAt.slice(0, 10);
    if (hasPeriod && day < startDate!) before.push(t);
    else if (hasPeriod && day > endDate!) after.push(t);
    else byDate.set(day, [...(byDate.get(day) ?? []), t]);
  }

  const sum = (rows: ReportTransaction[]) => rows.reduce((acc, t) => acc + t.amount, 0);
  const group = (
    key: string,
    label: string,
    dateLabel: string | null,
    inTrip: boolean,
    rows: ReportTransaction[],
  ): DailyGroup => ({ key, label, dateLabel, inTrip, amount: sum(rows), transactions: rows });

  const groups: DailyGroup[] = [];
  if (before.length > 0) groups.push(group('before', '여행 전', null, false, before));

  if (hasPeriod) {
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const last = new Date(`${endDate}T00:00:00Z`);
    let index = 1;
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      const rows = byDate.get(key);
      if (rows && rows.length > 0) {
        groups.push(group(key, `D${index}`, shortDateLabel(key), true, rows));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      index += 1;
    }
  } else {
    // 여행 기간이 없으면 날짜순으로 그냥 늘어놓는다
    for (const key of [...byDate.keys()].sort()) {
      groups.push(group(key, shortDateLabel(key), null, false, byDate.get(key)!));
    }
  }

  if (after.length > 0) groups.push(group('after', '여행 후', null, false, after));
  if (undated.length > 0) groups.push(group('undated', '날짜 없음', null, false, undated));
  return groups;
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

  // 실제 사용액이 0인 카테고리는 영수증에 찍지 않는다. 안 산 물건은 영수증에 없다.
  const bySpent = [...input.categories]
    .filter((c) => c.actualAmount > 0)
    .sort((a, b) => b.actualAmount - a.actualAmount);

  const byDeviation = [...input.categories].sort((a, b) => {
    const aNone = a.actualAmount === 0;
    const bNone = b.actualAmount === 0;
    if (aNone !== bNone) return aNone ? 1 : -1;
    return Math.abs(b.diff) - Math.abs(a.diff);
  });

  const biggestOver =
    [...input.categories].filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)[0] ?? null;
  /*
    ⚠️ 실제가 0인 카테고리는 '아낀 곳' 에서 뺀다. 안 쓴 것과 아직 안 적은 것은
       다르다. 기록이 없는 항목을 절약으로 세면 "기록을 안 한 사람이 가장
       알뜰해 보이는" 결과가 나온다.
  */
  const biggestSaved =
    [...input.categories]
      .filter((c) => c.actualAmount > 0 && c.diff < 0)
      .sort((a, b) => a.diff - b.diff)[0] ?? null;

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
    remainingAmount: Math.max(0, raisedAmount - actualAmount),
    bySpent,
    byDeviation,
    biggestOver,
    biggestSaved,
    dailyGroups: groupTransactionsByDay(transactions, startDate, endDate),
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
