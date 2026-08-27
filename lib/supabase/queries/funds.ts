// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesUpdate } from '@/types/database';

export type FundSource = Tables<'fund_sources'>;
export type FinancialAccount = Tables<'financial_accounts'>;
export type FundSourceUpdate = TablesUpdate<'fund_sources'>;

export async function getTravelFund(tripId: string): Promise<FundSource | null> {
  // TODO: fund_sources 단건 조회 (trip_id UNIQUE). .maybeSingle() 사용.
  return null;
}

/**
 * ⚠️ current_amount 는 항상 **단일 소스** 기준 값이다. (CLAUDE.md 3장)
 *    직접입력 금액과 연결계좌 잔액을 절대 합산하지 않는다.
 */
export async function updateTravelFund(
  tripId: string,
  patch: FundSourceUpdate,
): Promise<FundSource> {
  // TODO: fund_sources update 후 갱신된 행 반환.
  throw new Error('[queries/funds] updateTravelFund 미구현');
}

/**
 * 수기 → 계좌 전환. (CLAUDE.md 3장)
 *
 *   초기화 안내 → 사용자 확인 → 기존 수기 금액 제외 → 계좌 잔액으로 대체 → 이후 계좌 기준
 *
 * ⚠️ 기존 current_amount 에 계좌 잔액을 **더하지 않는다. 대체한다.**
 *    사용자 확인은 이 함수 호출 전에 화면에서 받는다. 이 함수는 확인이 끝난 뒤에만 부른다.
 */
export async function convertToAccount(
  tripId: string,
  financialAccountId: string,
): Promise<FundSource> {
  // TODO: 1) financial_accounts 에서 current_balance 조회
  //       2) fund_sources 를 source_type='ACCOUNT',
  //          current_amount = 계좌 잔액(더하지 말 것),
  //          financial_account_id, switched_from_manual_at = now() 로 갱신
  //       3) 갱신된 행 반환
  throw new Error('[queries/funds] convertToAccount 미구현');
}
