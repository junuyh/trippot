// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import {
  BUDGET_PLAN_ITEM_STATUS,
  CATEGORY_METHOD,
  REFUND_STATUS,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
} from "@/lib/constants/status";
import { supabase } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/types/database";

export type Transaction = Tables<"transactions">;
export type TransactionInsert = TablesInsert<"transactions">;

export type TransactionListOptions = {
  /** 지정하면 해당 카테고리 거래만. */
  categoryId?: string;
  /** 지정하면 입금/출금 한쪽만. */
  transactionType?: Transaction["transaction_type"];
  /** 최근 N건만. 준비 홈의 '최근 여행자금 내역' 처럼 일부만 필요할 때 쓴다. */
  limit?: number;
};

export async function getTransactions(
  tripId: string,
  options?: TransactionListOptions,
): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("trip_id", tripId)
    // 삭제된 거래는 목록에도 합계에도 들어가면 안 된다
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  if (options?.categoryId)
    query = query.eq("budget_category_id", options.categoryId);
  if (options?.transactionType)
    query = query.eq("transaction_type", options.transactionType);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * 지출 직접 입력.
 *
 * 계좌 연동 없이 쓴 돈을 사용자가 손으로 적는 경로다.
 * source_type = 'MANUAL', category_method = 'USER' 로 남긴다.
 * 자동 분류(AUTO)와 구분돼야 분류 정확도를 잴 수 있다. (docs/06 §7-3)
 *
 * ⚠️ 출금(WITHDRAWAL)만 예산 실제 사용액에 합산된다. 입금은 자금 유입이다.
 */
export async function createTransaction(
  input: TransactionInsert,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTransactionById(
  transactionId: string,
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * 거래 ↔ 예산 연결 갱신.
 *
 * - MVP 는 1 거래 = 1 카테고리다. 한 거래를 여러 BudgetItem 에 나눠 매핑하지 않는다.
 * - 입금(DEPOSIT)은 예산 실제 사용금액에 포함하지 않는다. 출금(WITHDRAWAL)만 합산한다.
 * - 연결이 바뀌면 budget_categories.actual_amount / budget_plan_items.actual_amount
 *   재계산이 필요하다.
 */
/**
 * 카테고리의 실제 사용액을 거래에서 다시 계산해 저장한다.
 *
 * ⚠️ actual_amount 는 **출금 거래의 합**이다. 화면이 더하거나 빼서 맞추면
 *    거래를 옮기거나 지울 때 금방 어긋난다. 항상 다시 세어 넣는다.
 *    입금은 자금 유입이라 예산 사용액에 넣지 않는다. (ERD §3)
 */
export async function recalcCategoryActual(
  categoryId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("budget_category_id", categoryId)
    .eq("transaction_type", TRANSACTION_TYPE.WITHDRAWAL)
    .is("deleted_at", null);

  if (error) throw error;
  const total = (data ?? []).reduce((sum, row) => sum + row.amount, 0);

  const { error: updateError } = await supabase
    .from("budget_categories")
    .update({ actual_amount: total })
    .eq("id", categoryId);

  if (updateError) throw updateError;
  return total;
}

/**
 * 거래 삭제. 물리 삭제가 아니라 deleted_at 을 채운다.
 *
 * 실제로 일어난 거래를 지우면 나중에 계좌 내역과 대조할 수 없다.
 * 삭제 후 해당 카테고리의 실제 사용액을 다시 계산한다.
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const { data, error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", transactionId)
    .select("budget_category_id")
    .single();

  if (error) throw error;
  if (data.budget_category_id)
    await recalcCategoryActual(data.budget_category_id);
}

export async function updateTransactionMapping(
  transactionId: string,
  mapping: {
    categoryId: string | null;
    budgetItemId?: string | null;
    categoryMethod: Transaction["category_method"];
    /**
     * 자동 분류의 확신도(0~100). AUTO 일 때만 의미가 있다.
     * ⚠️ 넘기지 않으면 건드리지 않는다. 사용자가 직접 고친 분류에
     *    예전 자동 분류의 확신도가 남아 있으면 reviewReason() 이
     *    '신뢰도 낮음' 으로 계속 잡는다.
     */
    categoryConfidence?: number | null;
  },
): Promise<Transaction> {
  // 옮기기 전 카테고리를 먼저 확인한다. 옮기고 나면 알 수 없다.
  const { data: before, error: beforeError } = await supabase
    .from("transactions")
    .select("budget_category_id, budget_plan_item_id")
    .eq("id", transactionId)
    .single();
  if (beforeError) throw beforeError;

  const { data, error } = await supabase
    .from("transactions")
    .update({
      budget_category_id: mapping.categoryId,
      budget_plan_item_id: mapping.budgetItemId ?? null,
      category_method: mapping.categoryMethod,
      // 사용자가 직접 고친 분류면 확신도를 지운다. 자동 분류의 흔적이다.
      category_confidence:
        mapping.categoryConfidence !== undefined
          ? mapping.categoryConfidence
          : mapping.categoryMethod === CATEGORY_METHOD.USER
            ? null
            : undefined,
    })
    .eq("id", transactionId)
    .select()
    .single();
  if (error) throw error;

  // 떠난 카테고리와 새로 붙은 카테고리 양쪽을 다시 센다.
  // 한쪽만 하면 옮긴 금액이 두 곳에 남거나 어디에도 없게 된다.
  const affected = new Set(
    [before.budget_category_id, mapping.categoryId].filter(Boolean) as string[],
  );
  for (const categoryId of affected) await recalcCategoryActual(categoryId);

  // 계획 항목도 마찬가지다. 여기를 빼먹으면 거래를 연결해도 BUDGET-02 의
  // '실제 780,000원 · 20,000원 절약' 이 갱신되지 않고, 계획이 잠기지도 않는다.
  const affectedItems = new Set(
    [before.budget_plan_item_id, mapping.budgetItemId].filter(
      Boolean,
    ) as string[],
  );
  for (const itemId of affectedItems) await recalcPlanItemActual(itemId);

  return data;
}

/**
 * 계획 항목의 실제 사용금액을 다시 센다.
 *
 * ⚠️ 이 계획에 연결된 **출금 거래의 합**이다. 화면이 더하거나 빼서 맞추면
 *    연결을 옮겼을 때 어긋난다. 언제나 다시 세어 덮어쓴다.
 *
 * ⚠️ 환불 완료·결제 취소는 나간 돈이 아니라 뺀다.
 *    환불 '예정' 은 아직 돈이 나가 있어 그대로 센다. (FundTotals 와 같은 규칙)
 */
export async function recalcPlanItemActual(
  planItemId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, refund_status")
    .eq("budget_plan_item_id", planItemId)
    .eq("transaction_type", TRANSACTION_TYPE.WITHDRAWAL)
    .is("deleted_at", null);
  if (error) throw error;

  const total = (data ?? [])
    .filter(
      (row) =>
        row.refund_status !== REFUND_STATUS.REFUNDED &&
        row.refund_status !== REFUND_STATUS.CANCELED,
    )
    .reduce((sum, row) => sum + row.amount, 0);

  const { error: updateError } = await supabase
    .from("budget_plan_items")
    .update({ actual_amount: total })
    .eq("id", planItemId);
  if (updateError) throw updateError;

  return total;
}

/**
 * 여행자금 집계. (IA v2 §2-4-1)
 *
 * ⚠️ **누적 모금액과 현재 잔액을 혼용하지 않는다.**
 *
 *   누적 모금액 = 등록 금액 + 입금(DEPOSIT) 합계
 *   현재 잔액   = 누적 모금액 − 출금(WITHDRAWAL) 합계
 *
 * 결제로 줄어드는 것은 **잔액**이지 모은 금액이 아니다.
 * 항공권을 샀다고 여행 준비 진행률이 뒤로 가면 안 된다.
 *
 * 모금 자체가 취소된 경우(잘못 넣은 입금)는 그 DEPOSIT 거래를 지운다.
 * 지워지면 여기 합계에서도 빠져 누적 모금액이 다시 계산된다.
 */
export type FundTotals = {
  /** 입금 거래 합계. fund_sources.current_amount 는 포함하지 않는다 */
  depositTotal: number;
  /** 출금 거래 합계 */
  withdrawalTotal: number;
};

export async function getFundTotals(tripId: string): Promise<FundTotals> {
  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount, refund_status")
    .eq("trip_id", tripId)
    .is("deleted_at", null);

  if (error) throw error;

  let depositTotal = 0;
  let withdrawalTotal = 0;
  for (const row of data ?? []) {
    if (row.transaction_type === TRANSACTION_TYPE.DEPOSIT) {
      depositTotal += row.amount;
      continue;
    }
    // ⚠️ 환불 완료·결제 취소는 나간 돈이 아니다. 지출 합계에서 뺀다.
    //    환불 '예정' 은 아직 돈이 나가 있는 상태라 그대로 센다.
    if (
      row.refund_status === REFUND_STATUS.REFUNDED ||
      row.refund_status === REFUND_STATUS.CANCELED
    ) {
      continue;
    }
    withdrawalTotal += row.amount;
  }
  return { depositTotal, withdrawalTotal };
}

/**
 * 결산 전에 사람이 확인해야 하는 거래인가. (IA v2 §2-4-2)
 *
 * ⚠️ 지금 판정할 수 있는 것만 본다.
 *      카테고리 없음        budget_category_id is null
 *      자동 분류 신뢰도 낮음 category_confidence < 기준
 *
 *    '계획 연결 후보 다중' · '카드 승인↔출금 중복' · '환불·취소' 는
 *    판정할 칼럼이 없다. FUND-02(계좌 연결) 구현 시 스키마와 함께 정한다.
 *    없는 근거로 '확인 필요' 를 띄우면 사용자는 무엇을 고쳐야 할지 알 수 없다.
 */
export const LOW_CONFIDENCE_THRESHOLD = 70;

export type ReviewReason =
  | "UNCATEGORIZED"
  | "LOW_CONFIDENCE"
  /** 사용자가 직접 적은 거래를 우리가 추측해 붙였다. 확신도와 무관하게 확인받는다 */
  | "AUTO_GUESS"
  | "REFUND_PENDING";

export function reviewReason(transaction: Transaction): ReviewReason | null {
  // 환불이 예정된 거래는 결과를 확인해야 한다. 분류보다 먼저 물어야 할 것이다.
  if (transaction.refund_status === REFUND_STATUS.PENDING)
    return "REFUND_PENDING";
  // 입금은 예산 카테고리에 붙지 않는다. 분류를 물을 대상이 아니다.
  if (transaction.transaction_type === TRANSACTION_TYPE.DEPOSIT) return null;
  if (!transaction.budget_category_id) return "UNCATEGORIZED";

  /**
   * ⚠️ 사용자가 직접 적었는데 우리가 추측한 분류는 **확신도와 무관하게**
   *    확인을 받는다. (FUND-03 시안 v1 — "AI 자동 분류 후 확인 필요로 처리")
   *
   *    계좌에서 들어온 거래의 자동 분류와 성격이 다르다. 그쪽은 가맹점
   *    코드 같은 근거가 있지만, 이쪽은 사용자가 손으로 친 이름 한 줄이
   *    전부다. 모델이 95% 라고 답해도 그 근거는 이름뿐이다.
   */
  if (
    transaction.source_type === TRANSACTION_SOURCE_TYPE.MANUAL &&
    transaction.category_method === CATEGORY_METHOD.AUTO
  ) {
    /**
     * ⚠️ LOW_CONFIDENCE 와 구분한다. 확신도가 95% 여도 여기로 온다.
     *    "확신이 낮아요" 라고 적으면 화면에 적힌 신뢰도 95% 와 정면으로
     *    어긋난다. 사용자는 둘 중 무엇을 믿어야 할지 모른다.
     */
    return "AUTO_GUESS";
  }

  if (
    transaction.category_method === CATEGORY_METHOD.AUTO &&
    transaction.category_confidence !== null &&
    transaction.category_confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    return "LOW_CONFIDENCE";
  }
  return null;
}

/** 환불 필터 대상인가. 예정·완료·취소를 모두 보여준다 */
export function isRefundRelated(transaction: Transaction): boolean {
  return transaction.refund_status !== REFUND_STATUS.NONE;
}

/**
 * 결산 전에 정리해야 할 것들. (IA v2 §2-6-1)
 *
 * ⚠️ **두 가지를 갈라서 센다.** 가는 곳이 다르다.
 *
 *   확인할 거래      카테고리가 없거나 자동 분류가 미덥다 → FUND-01 확인 필요 필터
 *   지출 미연결 계획  계획은 세웠는데 실제 지출이 안 붙었다 → 해당 BUDGET-02
 *
 *   미분류 거래는 카테고리가 없어 '어느 BUDGET-02 인가' 에 답할 수 없다.
 *   반대로 미연결 계획은 이미 카테고리가 정해져 있어 그 화면으로 보낼 수 있다.
 *
 * ⚠️ 계획에 지출이 안 붙었다는 이유만으로 **'지출이 누락됐다' 고 단정하지 않는다.**
 *    계좌가 연결돼 있지 않으면 시스템은 실제 결제가 있었는지 알 수 없다.
 *    사용자가 결제하지 않았을 수도 있다. (스펙 6장)
 */
export type SettlementChecklist = {
  /** 분류·확인이 필요한 거래 수 */
  reviewCount: number;
  /** 실제 지출이 연결되지 않은 계획 */
  unlinkedPlans: {
    id: string;
    name: string;
    expectedAmount: number;
    categoryId: string;
  }[];
};

export async function getSettlementChecklist(
  tripId: string,
  budgetId: string | null,
): Promise<SettlementChecklist> {
  const transactions = await getTransactions(tripId);
  const reviewCount = transactions.filter(
    (row) => reviewReason(row) !== null,
  ).length;

  if (!budgetId) return { reviewCount, unlinkedPlans: [] };

  const { data: categories, error: categoryError } = await supabase
    .from("budget_categories")
    .select("id")
    .eq("trip_budget_id", budgetId)
    .eq("enabled", true);
  if (categoryError) throw categoryError;

  const categoryIds = (categories ?? []).map((category) => category.id);
  if (categoryIds.length === 0) return { reviewCount, unlinkedPlans: [] };

  const { data: items, error: itemError } = await supabase
    .from("budget_plan_items")
    .select(
      "id, name, expected_amount, actual_amount, status, budget_category_id",
    )
    .in("budget_category_id", categoryIds);
  if (itemError) throw itemError;

  const unlinkedPlans = (items ?? [])
    // 사용자가 계획에서 뺀 항목은 셀 이유가 없다
    .filter((item) => item.status !== BUDGET_PLAN_ITEM_STATUS.CANCELED)
    .filter((item) => item.actual_amount === 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      expectedAmount: item.expected_amount,
      categoryId: item.budget_category_id,
    }));

  return { reviewCount, unlinkedPlans };
}

// ============================================================================
// 결산 화면이 쓰는 자금 현황 (SETTLE-01 시안 v2)
// ============================================================================

export type SettlementFunds = {
  /** 확정 지출 건수. 확인 필요·환불 완료는 빼고 센다 */
  confirmedCount: number;
  /** 아직 확인이 안 끝난 지출 합계. 결산 중에만 0 이 아니다 */
  pendingAmount: number;
  /** 환불 예정 금액. 돌려받기로 했지만 아직 안 들어온 돈 */
  refundPendingAmount: number;
  /** 큰 금액순 상위 지출 */
  major: Transaction[];
};

/**
 * 결산 화면의 '남은 여행자금' · '주요 지출' 에 필요한 값을 한 번에 모은다.
 *
 * ⚠️ 세 값을 각각 조회하지 않는다. 같은 거래 목록에서 나오는 값이라
 *    따로 읽으면 조회 사이에 거래가 바뀌었을 때 서로 안 맞는 숫자가 나온다.
 *
 * ⚠️ **환불 완료·결제 취소는 지출이 아니다.** 나간 돈이 아니라서 건수에도
 *    금액에도 넣지 않는다. (getFundTotals 와 같은 기준)
 *    환불 '예정' 은 아직 돈이 나가 있는 상태라 지출로 세되,
 *    돌려받을 금액을 따로 알려 준다.
 */
export async function getSettlementFunds(
  tripId: string,
  majorLimit = 3,
): Promise<SettlementFunds> {
  const rows = await getTransactions(tripId, {
    transactionType: TRANSACTION_TYPE.WITHDRAWAL,
  });

  let confirmedCount = 0;
  let pendingAmount = 0;
  let refundPendingAmount = 0;
  const spent: Transaction[] = [];

  for (const row of rows) {
    if (
      row.refund_status === REFUND_STATUS.REFUNDED ||
      row.refund_status === REFUND_STATUS.CANCELED
    ) {
      continue;
    }
    if (row.refund_status === REFUND_STATUS.PENDING) {
      refundPendingAmount += row.amount;
    }

    // 확인이 필요한 거래는 아직 '확정 지출' 이 아니다.
    if (reviewReason(row) !== null) {
      pendingAmount += row.amount;
      continue;
    }
    confirmedCount += 1;
    spent.push(row);
  }

  return {
    confirmedCount,
    pendingAmount,
    refundPendingAmount,
    major: spent.sort((a, b) => b.amount - a.amount).slice(0, majorLimit),
  };
}

/**
 * 거래를 세부 계획에 연결한다. (FUND-03 거래 상세)
 *
 * ⚠️ 연결만 하고 끝내지 않는다. 계획의 actual_amount 와 status 까지 채워야
 *    BUDGET-02 가 '결제 완료 · 지출 연결됨' 으로 읽는다. 한쪽만 바꾸면
 *    거래에는 계획이 붙었는데 계획에는 실적이 없는 상태가 된다.
 *
 * ⚠️ 실제 금액은 **그 계획에 연결된 거래의 합**으로 다시 센다. 더하지 않는다.
 *    더하면 연결을 풀었다 다시 붙일 때마다 금액이 불어난다.
 */
export async function linkTransactionToPlanItem(
  transactionId: string,
  planItemId: string,
): Promise<void> {
  const { error: linkError } = await supabase
    .from("transactions")
    .update({ budget_plan_item_id: planItemId })
    .eq("id", transactionId);
  if (linkError) throw linkError;

  await syncPlanItemActual(planItemId);
}

/**
 * 계획의 실제 금액을 연결된 거래에서 다시 센다.
 *
 * ⚠️ 환불 완료·취소된 거래는 빼고 센다. 돌려받은 돈을 쓴 돈으로 세면
 *    getFundTotals() 와 어긋난다.
 */
export async function syncPlanItemActual(planItemId: string): Promise<void> {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("amount, refund_status")
    .eq("budget_plan_item_id", planItemId)
    .eq("transaction_type", TRANSACTION_TYPE.WITHDRAWAL)
    .is("deleted_at", null);
  if (error) throw error;

  const total = (rows ?? [])
    .filter(
      (row) =>
        row.refund_status !== REFUND_STATUS.REFUNDED &&
        row.refund_status !== REFUND_STATUS.CANCELED,
    )
    .reduce((sum, row) => sum + row.amount, 0);

  await supabase
    .from("budget_plan_items")
    .update({
      actual_amount: total,
      status:
        total > 0
          ? BUDGET_PLAN_ITEM_STATUS.DONE
          : BUDGET_PLAN_ITEM_STATUS.PLANNED,
    })
    .eq("id", planItemId);
}

/**
 * 입금 거래 누적이 목표액에 처음 닿은 날. 미리미리형 판정에 쓴다.
 *
 * 입금을 시간순으로 더해 가다가 target 을 넘는 순간의 occurred_at 을 돌려준다.
 * 못 닿았으면 null. target 이 0 이하면 판정 자체가 의미 없어 null.
 *
 * ⚠️ fund_sources.current_amount(계좌 잔액·수기 금액)는 보지 않는다. 그 값에는
 *    날짜가 없어서 "언제 모았는지" 를 말할 수 없다. 입금 거래만 근거가 된다.
 */
export async function getFundReadyAt(
  tripId: string,
  target: number,
): Promise<string | null> {
  if (target <= 0) return null;
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, occurred_at")
    .eq("trip_id", tripId)
    .eq("transaction_type", TRANSACTION_TYPE.DEPOSIT)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: true });

  if (error) throw error;

  let sum = 0;
  for (const row of data ?? []) {
    sum += row.amount;
    if (sum >= target) return row.occurred_at;
  }
  return null;
}
