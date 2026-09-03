// ============================================================================
// 거래 아이콘 — 한 거래를 무엇으로 그릴지 (FUND-01/03 시안 v1)
//
// 목록과 상세가 **같은 규칙**을 써야 한다. 두 화면이 같은 거래를 다른 그림으로
// 그리면 사용자는 다른 거래로 읽는다.
//
// 우선순위가 있다. 위에서부터 먼저 걸리는 것을 쓴다.
//
//   ① 환불·취소   ↩️   원거래가 무엇이든 '돌려받는 중/받음' 이 먼저 보여야 한다
//   ② 입금        💰   예산 카테고리에 붙지 않는다. 돈이 들어온 사건이다
//   ③ 분류된 지출  카테고리 이모지
//   ④ 미분류 지출  ❓   확인이 필요하다는 것을 아이콘부터 알린다
//
// ⚠️ 카테고리 이모지는 CATEGORY_EMOJI 하나만 쓴다. 여기서 새로 정의하면
//    금고·예산 화면과 같은 카테고리가 다른 그림이 된다.
// ============================================================================
import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import {
  REFUND_STATUS,
  TRANSACTION_TYPE,
  type CategoryCode,
  type RefundStatus,
  type TransactionType,
} from "@/lib/constants/status";

/** 아이콘을 정하는 데 필요한 최소 정보 */
export type IconInput = {
  transactionType: TransactionType;
  refundStatus: RefundStatus;
  /** 분류된 카테고리. 없으면 미분류 */
  categoryCode: CategoryCode | null;
};

export function transactionIcon(input: IconInput): string {
  if (
    input.refundStatus === REFUND_STATUS.REFUNDED ||
    input.refundStatus === REFUND_STATUS.CANCELED
  ) {
    return "↩️";
  }
  if (input.transactionType === TRANSACTION_TYPE.DEPOSIT) return "💰";
  if (input.categoryCode) return CATEGORY_EMOJI[input.categoryCode];
  return "❓";
}

/**
 * 금액 앞에 붙일 부호.
 *
 * ⚠️ 환불 완료·결제 취소는 **`+`** 다. 돈이 돌아왔기 때문이다.
 *    getFundTotals() 도 이 거래를 지출 합계에서 빼므로 계산과 화면이 맞는다.
 *
 * ⚠️ 환불 '예정' 은 `−` 다. 아직 돈이 나가 있다. 여기서 `+` 로 보여주면
 *    아직 안 돌아온 돈을 돌아온 것으로 읽게 된다.
 */
export function amountSign(input: IconInput): "+" | "−" {
  if (
    input.refundStatus === REFUND_STATUS.REFUNDED ||
    input.refundStatus === REFUND_STATUS.CANCELED
  ) {
    return "+";
  }
  return input.transactionType === TRANSACTION_TYPE.DEPOSIT ? "+" : "−";
}

/** 금액 오른쪽 아래 작은 상태 문구 */
export function statusLabel(
  input: IconInput & { needsReview: boolean },
): string {
  if (input.refundStatus === REFUND_STATUS.REFUNDED) return "환불 완료";
  if (input.refundStatus === REFUND_STATUS.CANCELED) return "결제 취소";
  if (input.refundStatus === REFUND_STATUS.PENDING) return "환불 예정";
  if (input.needsReview) return "분류 필요";
  return "확정";
}
