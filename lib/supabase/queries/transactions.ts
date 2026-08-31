// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { TRANSACTION_TYPE } from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/types/database';

export type Transaction = Tables<'transactions'>;
export type TransactionInsert = TablesInsert<'transactions'>;

export type TransactionListOptions = {
  /** 지정하면 해당 카테고리 거래만. */
  categoryId?: string;
  /** 지정하면 입금/출금 한쪽만. */
  transactionType?: Transaction['transaction_type'];
  /** 최근 N건만. 준비 홈의 '최근 여행자금 내역' 처럼 일부만 필요할 때 쓴다. */
  limit?: number;
};

export async function getTransactions(
  tripId: string,
  options?: TransactionListOptions,
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('trip_id', tripId)
    // 삭제된 거래는 목록에도 합계에도 들어가면 안 된다
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false });

  if (options?.categoryId) query = query.eq('budget_category_id', options.categoryId);
  if (options?.transactionType) query = query.eq('transaction_type', options.transactionType);
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
export async function createTransaction(input: TransactionInsert): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .is('deleted_at', null)
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
export async function recalcCategoryActual(categoryId: string): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('budget_category_id', categoryId)
    .eq('transaction_type', TRANSACTION_TYPE.WITHDRAWAL)
    .is('deleted_at', null);

  if (error) throw error;
  const total = (data ?? []).reduce((sum, row) => sum + row.amount, 0);

  const { error: updateError } = await supabase
    .from('budget_categories')
    .update({ actual_amount: total })
    .eq('id', categoryId);

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
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', transactionId)
    .select('budget_category_id')
    .single();

  if (error) throw error;
  if (data.budget_category_id) await recalcCategoryActual(data.budget_category_id);
}

export async function updateTransactionMapping(
  transactionId: string,
  mapping: {
    categoryId: string | null;
    budgetItemId?: string | null;
    categoryMethod: Transaction['category_method'];
  },
): Promise<Transaction> {
  // 옮기기 전 카테고리를 먼저 확인한다. 옮기고 나면 알 수 없다.
  const { data: before, error: beforeError } = await supabase
    .from('transactions')
    .select('budget_category_id')
    .eq('id', transactionId)
    .single();
  if (beforeError) throw beforeError;

  const { data, error } = await supabase
    .from('transactions')
    .update({
      budget_category_id: mapping.categoryId,
      budget_plan_item_id: mapping.budgetItemId ?? null,
      category_method: mapping.categoryMethod,
    })
    .eq('id', transactionId)
    .select()
    .single();
  if (error) throw error;

  // 떠난 카테고리와 새로 붙은 카테고리 양쪽을 다시 센다.
  // 한쪽만 하면 옮긴 금액이 두 곳에 남거나 어디에도 없게 된다.
  const affected = new Set(
    [before.budget_category_id, mapping.categoryId].filter(Boolean) as string[],
  );
  for (const categoryId of affected) await recalcCategoryActual(categoryId);

  return data;
}
