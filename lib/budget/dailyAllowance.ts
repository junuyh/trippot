// ============================================================================
// 오늘 쓸 수 있는 돈 — 여행 중 홈(TRIP-HOME-01)의 TODAY 카드
//
// 수기 입력의 가장 짧은 보상 루프다. 어제 쓴 걸 적으면 오늘 얼마 써도 되는지가
// 바로 나온다. 계좌 연결 없이도 "기록할 이유" 가 생긴다. (2026-09-09)
//
//   오늘 쓸 수 있는 돈 = (전체 예산 − 오늘 이전까지 쓴 돈) ÷ 남은 일수(오늘 포함)
//
// ⚠️ 오늘 쓴 돈은 분자에서 빼지 않는다. 낮에 한 건 적을 때마다 "오늘 쓸 수 있는
//    돈" 이 줄어들면 기준이 흔들린다. 대신 "오늘 N원 썼고 M원 남았다" 로 따로 말한다.
// ⚠️ 예산은 카테고리 planned_amount 합이다. 여행자금(모금액)이 아니다.
//    돈이 얼마 있느냐가 아니라 얼마 쓰기로 했느냐가 기준이다. (CLAUDE.md 2장)
// ⚠️ 천원 단위로 내림한다. "43,271원" 은 기준으로 못 쓴다.
// ⚠️ 순수 함수. 날짜는 호출부가 넘긴다 (테스트·화면 모두 오늘을 주입한다).
// ============================================================================
import { differenceInCalendarDays, isSameDay, parseISO } from "date-fns";

import { REFUND_STATUS, TRANSACTION_TYPE } from "@/lib/constants/status";

export type DailyAllowanceInput = {
  /** 'YYYY-MM-DD' */
  startDate: string | null;
  endDate: string | null;
  /** 카테고리 planned_amount 합 */
  budgetTotal: number;
  /** 지출 거래. 삭제된 것은 이미 빠져 있다 */
  transactions: {
    amount: number;
    occurred_at: string;
    transaction_type: string;
    refund_status: string;
  }[];
  today: Date;
};

export type DailyAllowance = {
  /** 여행 며칠째. 1부터 */
  dayIndex: number;
  /** 오늘 포함 남은 일수 */
  daysLeft: number;
  /** 오늘 쓸 수 있는 돈. 천원 단위 */
  allowance: number;
  /** 오늘 지금까지 쓴 돈 */
  spentToday: number;
  /** allowance − spentToday. 음수면 오늘 예산을 넘겼다 */
  todayLeft: number;
  /** 오늘 이전까지 쓰고 남은 예산 */
  remainingBudget: number;
};

function isSpend(t: DailyAllowanceInput["transactions"][number]): boolean {
  return (
    t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL &&
    t.refund_status !== REFUND_STATUS.REFUNDED &&
    t.refund_status !== REFUND_STATUS.CANCELED
  );
}

/**
 * 여행 기간 안이 아니거나 예산이 없으면 null. 화면은 그때 카드를 그리지 않는다.
 */
export function dailyAllowance(input: DailyAllowanceInput): DailyAllowance | null {
  if (!input.startDate || !input.endDate || input.budgetTotal <= 0) return null;
  const start = parseISO(input.startDate);
  const end = parseISO(input.endDate);
  const dayIndex = differenceInCalendarDays(input.today, start) + 1;
  const daysLeft = differenceInCalendarDays(end, input.today) + 1;
  if (dayIndex < 1 || daysLeft < 1) return null;

  let spentToday = 0;
  let spentBefore = 0;
  for (const t of input.transactions) {
    if (!isSpend(t)) continue;
    if (isSameDay(parseISO(t.occurred_at), input.today)) spentToday += t.amount;
    else if (parseISO(t.occurred_at) < input.today) spentBefore += t.amount;
  }

  const remainingBudget = Math.max(0, input.budgetTotal - spentBefore);
  const allowance = Math.floor(remainingBudget / daysLeft / 1000) * 1000;

  return {
    dayIndex,
    daysLeft,
    allowance,
    spentToday,
    todayLeft: allowance - spentToday,
    remainingBudget,
  };
}
