// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export type Transaction = Tables<'transactions'>;

export type TransactionListOptions = {
  /** 지정하면 해당 카테고리 거래만. */
  categoryId?: string;
  /** 지정하면 입금/출금 한쪽만. */
  transactionType?: Transaction['transaction_type'];
};

export async function getTransactions(
  tripId: string,
  options?: TransactionListOptions,
): Promise<Transaction[]> {
  // TODO: transactions 조회. trip_id = tripId, deleted_at is null.
  //       occurred_at 내림차순 정렬. options 로 추가 필터.
  return [];
}

export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  // TODO: transactions 단건 조회. .maybeSingle() 사용.
  return null;
}

/**
 * 거래 ↔ 예산 연결 갱신.
 *
 * - MVP 는 1 거래 = 1 카테고리다. 한 거래를 여러 BudgetItem 에 나눠 매핑하지 않는다.
 * - 입금(DEPOSIT)은 예산 실제 사용금액에 포함하지 않는다. 출금(WITHDRAWAL)만 합산한다.
 * - 연결이 바뀌면 budget_categories.actual_amount / budget_plan_items.actual_amount
 *   재계산이 필요하다.
 */
export async function updateTransactionMapping(
  transactionId: string,
  mapping: {
    categoryId: string | null;
    budgetItemId?: string | null;
    categoryMethod: Transaction['category_method'];
  },
): Promise<Transaction> {
  // TODO: transactions 의 budget_category_id / budget_plan_item_id / category_method 갱신 후
  //       갱신된 행 반환. 이어서 actual_amount 재계산.
  throw new Error('[queries/transactions] updateTransactionMapping 미구현');
}
