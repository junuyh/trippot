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
  /** 여행 유형 한 줄. 없으면 null */
  typeLabel: string | null;
  typeSummary: string | null;
};

export type SettlementReport = ReportInput & {
  nights: number;
  days: number;
  /** 실제 − 목표. 음수면 아꼈다 */
  difference: number;
  /** 1인당 실제 사용액 */
  perPersonAmount: number;
  /** 남은 금액. 음수로 내려가지 않는다 */
  remainingAmount: number;
  /** 실제 사용액이 큰 순서. 카드에 상위 3개를 쓴다 */
  topSpent: ReportCategory[];
  /** 계획보다 덜 쓴 카테고리. 많이 아낀 순 */
  topSaved: ReportCategory[];
  /** '2026.09.18 – 09.21' */
  periodLabel: string;
  /** '2026.09.25' */
  confirmedLabel: string | null;
};

/** 'YYYY-MM-DD' → '2026.09.18' */
function dot(date: string): string {
  return date.replaceAll('-', '.');
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

  return {
    ...input,
    nights,
    days: nights + 1,
    difference: actualAmount - targetAmount,
    perPersonAmount: Math.round(actualAmount / people),
    remainingAmount: Math.max(0, raisedAmount - actualAmount),
    topSpent,
    topSaved,
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
