// ============================================================================
// 여행 취소(CXL) 판정·계산 — 순수 함수
//
// ⚠️ DB 도 네트워크도 타지 않는다. 조회는 lib/supabase/queries/tripCancel.ts 다.
//    CXL 스펙 §6 은 이 둘을 한 파일에 두라고 하지만, CLAUDE.md §7 이
//    "모든 DB Query 는 queries/ 안에" 로 정해 두었고 그쪽이 우선한다. (§0)
//
// ⚠️ lib/trip/stage.ts 와 같은 결이다. 상태는 DB 가 갖고, **판정은 여기서** 한다.
// ============================================================================
import { TRIP_STATUS, type TripStatus } from "@/lib/constants/status";

/** 되돌릴 수 있는 시간. 24시간이 아니다. (POL-CXL-030) */
export const RESTORE_WINDOW_HOURS = 72;

// ── 요청 가능 여부 ──────────────────────────────────────────────────────────

export type CancelBlockReason =
  | "ALREADY_SETTLED"
  | "ALREADY_CANCELED"
  | "ALREADY_PENDING"
  | "NOT_MEMBER";

/**
 * 취소를 요청할 수 있는가. (POL-CXL-002 ~ 004 · 060)
 *
 * ⚠️ **지출 유무를 판정에 쓰지 않는다.** 출발 전 선결제가 정상이라 지출이
 *    있다고 막거나 경고하면 정상 사용자를 가로막는다. (POL-CXL-004)
 *
 * ⚠️ 여행장 전용이 아니다. ACTIVE 멤버 누구나 요청한다. (POL-CXL-060)
 *    대신 확정에는 전원 동의가 필요하다.
 */
export function canRequestCancel(input: {
  status: TripStatus;
  isActiveMember: boolean;
}): { allowed: boolean; reason?: CancelBlockReason } {
  // 결산이 확정된 여행은 취소할 수 없다. 버튼 자체를 노출하지 않는다 (POL-CXL-003)
  if (input.status === TRIP_STATUS.SETTLED) {
    return { allowed: false, reason: "ALREADY_SETTLED" };
  }
  if (input.status === TRIP_STATUS.CANCELED) {
    return { allowed: false, reason: "ALREADY_CANCELED" };
  }
  if (input.status === TRIP_STATUS.CANCEL_PENDING) {
    return { allowed: false, reason: "ALREADY_PENDING" };
  }
  if (!input.isActiveMember) {
    return { allowed: false, reason: "NOT_MEMBER" };
  }
  return { allowed: true };
}

// ── 자금 요약 ───────────────────────────────────────────────────────────────

export type FundKind = "ACCOUNT" | "MANUAL" | "ZERO";

/**
 * 남은 금액. **자금 방식마다 계산식이 다르다.** (POL-CXL-015)
 *
 * ⚠️⚠️ ACCOUNT 에서 `잔액 − 지출` 을 다시 하지 않는다. ⚠️⚠️
 *       현재 잔액은 이미 지출이 빠진 값이라 또 빼면 **이중 차감**이다.
 *
 *   ACCOUNT   현재 잔액 그대로
 *   MANUAL    누적 모금액 − 실제 지출
 *   ZERO      0 (화면이 박스를 통째로 숨긴다)
 */
export function cancelRemainingAmount(input: {
  fundKind: FundKind;
  /** ACCOUNT 의 현재 잔액 */
  currentBalance: number;
  /** MANUAL 의 누적 모금액 */
  totalSaved: number;
  /** 실제 지출 합계 */
  actualSpent: number;
}): number {
  if (input.fundKind === "ZERO") return 0;
  if (input.fundKind === "ACCOUNT") return input.currentBalance;
  return Math.max(0, input.totalSaved - input.actualSpent);
}

/**
 * 1인당 분배 금액. **10원 단위로 버린다.**
 *
 * ⚠️ 1명 이하면 null 이다. 화면이 분배 줄을 그리지 않는다. (POL-CXL-017)
 *    혼자인데 "1명이 똑같이 나누면" 은 말이 안 된다.
 *
 * ⚠️ 이건 **근사값**이다. trip.headcount 는 여행 인원이지 돈 낸 사람 수가
 *    아니고, CONTRIB-01 이 뼈대라 납부 비례를 알 수 없다. 그래서 화면이
 *    '똑같이 나누면' · '약' 을 붙이고 지시형 표현을 쓰지 않는다.
 */
export function cancelPerPersonAmount(remaining: number, headcount: number): number | null {
  if (headcount <= 1) return null;
  return Math.floor(remaining / headcount / 10) * 10;
}

/**
 * 취소 확정 시 저장할 금액 스냅샷을 만든다. (POL-CXL-011 · 015)
 *
 * ⚠️ **두 화면이 같은 식을 쓴다.** 여행 홈과 모임 상세가 각자 계산하면
 *    "ACCOUNT 는 잔액 그대로" 같은 규칙이 두 곳에 생기고, 한쪽만 고쳐진다.
 *    leaveTrip 이 두 개가 됐던 것과 같은 일이다. (2026-09-14)
 *
 * ⚠️ 순수 함수다. 숫자를 받아 숫자를 돌려준다. 조회는 부르는 쪽이 한다.
 *
 * ⚠️ maskedAccount 는 받지 않는다. 마스킹 계좌번호는 financial_accounts 에
 *    있는데 두 화면 다 그걸 읽지 않는다. 스냅샷에는 null 로 남기고 화면이
 *    "연결한 계좌" 로 대신 부른다.
 */
export function buildCancelFundSnapshot(input: {
  /** fund_sources.source_type 이 ACCOUNT 인가 */
  isAccountFund: boolean;
  /** fund_sources.current_amount */
  currentAmount: number;
  /** 입금 거래 합계 */
  depositTotal: number;
  /** 카테고리 actual_amount 합계 */
  actualSpent: number;
  /** 목표 여행비 (trip_budgets.target_amount) */
  goalAmount: number;
  /** trips.headcount */
  headcount: number;
}): {
  fund_type: FundKind;
  masked_account: null;
  total_saved: number;
  actual_spent: number;
  remaining: number;
  goal_amount: number;
  headcount: number;
  captured_at: string;
} {
  const fundKind: FundKind = input.isAccountFund
    ? "ACCOUNT"
    : input.currentAmount > 0 || input.depositTotal > 0
      ? "MANUAL"
      : "ZERO";

  /**
   * 누적 모금액.
   *
   * ⚠️ depositTotal 만 쓰지 않는다. 직접 입력한 여행자금은 거래로 남지 않고
   *    fund_sources.current_amount 에만 있다. depositTotal 만 보면 수기 입력
   *    여행의 스냅샷이 **0원으로 굳는다.** 실제로 취소 화면이 "직접 입력한
   *    여행자금 0원" 이라고 말했다. (2026-09-13 시뮬레이터에서 확인)
   */
  const totalSaved =
    input.depositTotal > 0 ? input.depositTotal : input.currentAmount;

  return {
    fund_type: fundKind,
    masked_account: null,
    total_saved: totalSaved,
    actual_spent: input.actualSpent,
    remaining: cancelRemainingAmount({
      fundKind,
      currentBalance: input.currentAmount,
      totalSaved,
      actualSpent: input.actualSpent,
    }),
    goal_amount: input.goalAmount,
    headcount: input.headcount,
    captured_at: new Date().toISOString(),
  };
}

/** 자금 박스 라벨. 방식과 지출 유무로 갈린다 */
export function cancelFundLabel(input: {
  fundKind: FundKind;
  /** ACCOUNT 일 때 마스킹된 계좌 표시. 예) "카카오뱅크 ****1234" */
  maskedAccount: string | null;
  actualSpent: number;
}): string {
  if (input.fundKind === "ACCOUNT") {
    return `${input.maskedAccount ?? "연결한 계좌"}에 남은 돈`;
  }
  return input.actualSpent > 0 ? "모은 돈에서 쓴 돈을 뺀 금액" : "직접 입력한 여행자금";
}

// ── 동의 판정 ───────────────────────────────────────────────────────────────

export type VoteValue = "AGREE" | "DISAGREE";

/**
 * 동의 결과를 판정한다. (POL-CXL-061 · 062)
 *
 *   rejected   한 명이라도 반대 → 요청 즉시 폐기. 나머지 동의를 받지 않는다
 *   approved   요청자를 제외한 **전원**이 동의 → 취소 확정
 *   pending    그 외
 *
 * ⚠️ 다수결이 아니다. 만장일치다.
 * ⚠️ 동의 대상이 0명이면 approved 다. 개인 여행이 여기 해당한다. (POL-CXL-066)
 */
export function resolveVoteOutcome(input: {
  /** 동의 대상 수 = ACTIVE 멤버 − 요청자 */
  targetCount: number;
  agreedCount: number;
  hasDisagree: boolean;
}): "pending" | "approved" | "rejected" {
  if (input.hasDisagree) return "rejected";
  if (input.agreedCount >= input.targetCount) return "approved";
  return "pending";
}

// ── 만료 ────────────────────────────────────────────────────────────────────

/**
 * 요청이 만료됐는가. **조회 시점에 판정한다.** 크론을 만들지 않는다.
 *
 * 두 가지로 만료된다.
 *   시간   요청 + 7일 (POL-CXL-063)
 *   출발   출발일 도달 (POL-CXL-064)
 *
 * ⚠️ 출발일은 date 타입이라 시각이 없다. **출발일 당일부터** 만료로 본다.
 *    여행이 시작됐는데 취소 요청이 살아 있으면 안 된다.
 */
export function cancelRequestExpiry(input: {
  expiresAt: string;
  /** 여행 출발일 (YYYY-MM-DD). 없으면 시간 만료만 본다 */
  startDate: string | null;
  now: Date;
}): { expired: boolean; note?: "EXPIRED_TIME" | "DEPARTURE_REACHED" } {
  if (input.now.getTime() > new Date(input.expiresAt).getTime()) {
    return { expired: true, note: "EXPIRED_TIME" };
  }
  if (input.startDate) {
    const departure = new Date(`${input.startDate}T00:00:00+09:00`);
    if (input.now.getTime() >= departure.getTime()) {
      return { expired: true, note: "DEPARTURE_REACHED" };
    }
  }
  return { expired: false };
}

// ── 되돌리기 ────────────────────────────────────────────────────────────────

/**
 * 되돌릴 수 있는가. (POL-CXL-030)
 *
 * ⚠️ **72시간이다.** 24시간이 아니다. v5 에서 늘어났다.
 * ⚠️ 72시간이 지나면 되돌리기 수단이 없다. '이 여행 다시 준비하기'(복사)를
 *    만들지 않는다. 옛 날짜·옛 시세 예산이 새 여행에 들어간다. (POL-CXL-031)
 */
export function canRestoreTrip(input: {
  status: TripStatus;
  canceledAt: string | null;
  now: Date;
}): boolean {
  if (input.status !== TRIP_STATUS.CANCELED) return false;
  if (!input.canceledAt) return false;
  const elapsedHours =
    (input.now.getTime() - new Date(input.canceledAt).getTime()) / 3_600_000;
  return elapsedHours < RESTORE_WINDOW_HOURS;
}

/** 되돌리기 남은 시간. 배너 문구에 쓴다. 지났으면 null */
export function restoreRemainingLabel(canceledAt: string, now: Date): string | null {
  const deadline = new Date(canceledAt).getTime() + RESTORE_WINDOW_HOURS * 3_600_000;
  const leftMs = deadline - now.getTime();
  if (leftMs <= 0) return null;
  const days = Math.floor(leftMs / 86_400_000);
  const hours = Math.floor((leftMs % 86_400_000) / 3_600_000);
  return days > 0 ? `${days}일 ${hours}시간` : `${hours}시간`;
}

/**
 * 되돌린 뒤 남은 돈. **전체 변동으로 계산한다.**
 *
 * ⚠️ 화면은 5건만 보여주지만 이 계산은 전부를 쓴다. 표시된 5건만 더하면
 *    사용자가 보는 요약이 실제와 달라진다.
 */
export function restoredRemainingAmount(
  remainingAtCancel: number,
  changes: { amount: number }[],
): number {
  return changes.reduce((sum, c) => sum + c.amount, remainingAtCancel);
}
