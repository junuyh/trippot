// ============================================================================
// 초기자본 — 여행을 만들 때 적은 모음 금액을 입출금 내역에 보여 주는 줄
//
// ⚠️ 왜 만들어 넣는가 (2026-09-21 테스트)
//
//    여행을 만들 때 적은 모음 금액은 fund_sources.current_amount 에만 들어가고
//    transactions 에는 남지 않는다. 그래서 입출금 내역을 열면 그 돈이 없다.
//    "200만원이 어디서 왔는지 내역에 없다" 가 된다. 누적 모금액에는 더해지는데
//    목록에는 없으니 합계와 목록이 서로 다른 말을 한다.
//
// ⚠️ 그래서 **거래를 새로 만들어 넣지 않고 화면에서만 한 줄 그린다.**
//    진짜 거래를 넣으면 current_amount 와 이중으로 잡혀 누적 모금액이 두 배가
//    된다. current_amount 를 0으로 옮기는 길도 있지만, 모임 카드(groups.ts)가
//    그 값만 읽고 있어 모임 화면 금액이 0으로 보인다.
//
// ⚠️ 이 줄은 **누를 수 없다.** 진짜 거래가 아니라 상세 화면이 없다.
//    id 에 접두사를 붙여 호출부가 가려낸다.
//
// ⚠️ 계좌 연결 여행에는 만들지 않는다. 그쪽 current_amount 는 '모은 돈' 이
//    아니라 계좌 잔액이라 '초기자본' 이 아니다.
// ============================================================================
import { FUND_SOURCE_TYPE, TRANSACTION_TYPE, REFUND_STATUS } from "@/lib/constants/status";

export const SEED_DEPOSIT_ID = "seed-deposit";

/** 이 id 는 진짜 거래가 아니다. 상세로 보내지 않는다 */
export function isSeedDeposit(id: string): boolean {
  return id === SEED_DEPOSIT_ID;
}

export type SeedDepositRow = {
  id: string;
  name: string;
  amount: number;
  occurredAt: string;
  transactionType: string;
  refundStatus: string;
  categoryCode: null;
  needsReview: false;
};

export function buildSeedDepositRow(
  fund: {
    source_type: string;
    current_amount: number;
    created_at: string;
  } | null,
): SeedDepositRow | null {
  if (!fund) return null;
  if (fund.current_amount <= 0) return null;
  // 계좌·목업 계좌 잔액은 '모은 돈' 이 아니다
  if (fund.source_type !== FUND_SOURCE_TYPE.MANUAL) return null;

  return {
    id: SEED_DEPOSIT_ID,
    name: "초기자본",
    amount: fund.current_amount,
    occurredAt: fund.created_at,
    transactionType: TRANSACTION_TYPE.DEPOSIT,
    refundStatus: REFUND_STATUS.NONE,
    categoryCode: null,
    needsReview: false,
  };
}
