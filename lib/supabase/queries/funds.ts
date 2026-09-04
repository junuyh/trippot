// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import {
  CATEGORY_METHOD,
  FUND_SOURCE_TYPE,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
} from "@/lib/constants/status";
import { supabase } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type FundSource = Tables<"fund_sources">;
export type FinancialAccount = Tables<"financial_accounts">;
export type FundSourceUpdate = TablesUpdate<"fund_sources">;

export type FundSourceInsert = TablesInsert<"fund_sources">;

/**
 * 여행자금을 등록한다. fund_sources.trip_id 는 UNIQUE 라 여행당 하나뿐이다.
 *
 * ⚠️ 직접입력 금액과 계좌 잔액을 절대 합산하지 않는다. (CLAUDE.md 3장)
 *    current_amount 는 항상 **단일 소스** 기준이다.
 *    ACCOUNT/MOCK 이면 계좌 잔액, MANUAL 이면 사용자가 적은 값, ZERO 면 0.
 */
export async function createFundSource(
  input: FundSourceInsert,
): Promise<FundSource> {
  const { data, error } = await supabase
    .from("fund_sources")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * 모임의 연결 가능한 Mock 계좌.
 *
 * ⚠️ financial_accounts 는 group_id 만 갖는다. 개인 여행에는 계좌가 붙지 않는다.
 *    개인 사용자는 직접 입력 또는 0원으로 시작한다. 계좌 연결은 필수가 아니다.
 *    (CLAUDE.md 3장, AC-01)
 */
export async function getGroupAccounts(
  groupId: string,
): Promise<FinancialAccount[]> {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("group_id", groupId)
    .is("disconnected_at", null)
    .order("connected_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getTravelFund(
  tripId: string,
): Promise<FundSource | null> {
  // ⚠️ 현재 여행자금은 항상 **단일 소스** 기준이다.
  //    직접입력 금액과 계좌 잔액을 합산하지 않는다. (CLAUDE.md 3장)
  //    current_amount 하나만 보면 된다.
  const { data, error } = await supabase
    .from("fund_sources")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * ⚠️ current_amount 는 항상 **단일 소스** 기준 값이다. (CLAUDE.md 3장)
 *    직접입력 금액과 연결계좌 잔액을 절대 합산하지 않는다.
 */
export async function updateTravelFund(
  tripId: string,
  patch: FundSourceUpdate,
): Promise<FundSource> {
  const { data, error } = await supabase
    .from("fund_sources")
    .update(patch)
    .eq("trip_id", tripId)
    .select()
    .single();

  if (error) throw error;
  return data;
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
  const { data: account, error: accountError } = await supabase
    .from("financial_accounts")
    .select("current_balance")
    .eq("id", financialAccountId)
    .single();
  if (accountError) throw accountError;

  /**
   * ⚠️ 수기로 넣은 입금 거래를 **함께 지운다.**
   *
   *    누적 모금액 = fund_sources.current_amount + 입금 거래 합계 다. (IA v2 §2-4-1)
   *    계좌 잔액으로 대체하면서 기존 입금 거래를 남겨 두면 같은 돈이 두 번
   *    잡혀 준비율이 부풀려진다. '기존 수기 금액 제외' 는 등록 금액만이 아니라
   *    수기로 쌓아 온 입금 기록까지를 뜻한다. (CLAUDE.md 3장)
   *
   *    ⚠️ 출금은 건드리지 않는다. 실제로 쓴 돈이고 예산의 실제 사용액에
   *       이미 반영돼 있다. 지우면 카테고리별 결산이 어긋난다.
   *
   *    hard delete 가 아니라 deleted_at 이라 되돌릴 여지를 남긴다.
   */
  const { error: purgeError } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("transaction_type", TRANSACTION_TYPE.DEPOSIT)
    .eq("source_type", TRANSACTION_SOURCE_TYPE.MANUAL)
    .is("deleted_at", null);
  if (purgeError) throw purgeError;

  // ⚠️ 더하지 않는다. 대체한다. (CLAUDE.md 3장 — 단일 소스)
  return updateTravelFund(tripId, {
    source_type: FUND_SOURCE_TYPE.ACCOUNT,
    current_amount: account.current_balance,
    financial_account_id: financialAccountId,
    switched_from_manual_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  });
}

/**
 * 연결 해제. 계좌 기준에서 직접 입력으로 돌아간다.
 *
 * ⚠️ 마지막으로 동기화된 잔액을 그대로 이어받는다. 0 으로 되돌리면
 *    사용자는 모아 둔 돈이 사라졌다고 읽는다. 계좌 연결을 끊는 것이지
 *    돈을 버리는 게 아니다.
 */
export async function disconnectAccount(tripId: string): Promise<FundSource> {
  const current = await getTravelFund(tripId);
  return updateTravelFund(tripId, {
    source_type: FUND_SOURCE_TYPE.MANUAL,
    current_amount: current?.current_amount ?? 0,
    financial_account_id: null,
    last_synced_at: null,
  });
}

// ============================================================================
// 새 계좌 연결 (Mock) — FUND-02
//
// ⚠️ **시연용 Mock 이다.** 실제 오픈뱅킹 연결이 아니다. 은행을 고르면 미리
//    준비된 계좌 한 개가 '조회된 것처럼' 나오고, 누르면 연결된다.
//    실서비스에서는 이 함수를 기관 인증 → 계좌 조회 결과로 바꾼다.
//
// ⚠️ 연결과 동시에 그 계좌의 **기존 결제 내역 한 건을 가져온다.**
//    계좌를 연결하면 거래가 자동으로 들어온다는 것이 이 기능의 핵심이라,
//    연결 직후 지출 목록이 비어 있으면 무엇이 좋아졌는지 보이지 않는다.
// ============================================================================

/** 시연용 Mock 계좌. 실제 계좌 조회 결과 자리다 */
export const MOCK_BANK = {
  institutionCode: "092",
  accountName: "주디주씨의 모임통장",
  maskedAccountNumber: "1000-**-4800480",
  balance: 4_800_000,
} as const;

/** 연결과 함께 따라 들어오는 기존 결제. 항공권은 보통 가장 먼저 결제한다 */
const MOCK_IMPORTED_SPEND = {
  name: "대한항공",
  amount: 2_300_000,
  categoryCode: "AIRFARE",
  confidence: 98,
} as const;

export type MockConnectResult = {
  fund: FundSource;
  /** 함께 들어온 거래 이름. 화면에서 안내에 쓴다 */
  importedName: string;
  importedAmount: number;
};

/**
 * Mock 계좌를 만들고 이 여행에 연결한다. 기존 결제 1건도 함께 가져온다.
 *
 * ⚠️ 이미 같은 계좌가 있으면 다시 만들지 않는다. 시연에서 연결·해제를
 *    여러 번 반복해도 계좌 목록이 불어나면 안 된다.
 */
export async function connectMockAccount(
  tripId: string,
  groupId: string | null,
): Promise<MockConnectResult> {
  // ── 계좌 (있으면 재사용) ────────────────────────────────────────────────
  let accountId: string | null = null;
  const { data: existing, error: findError } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("masked_account_number", MOCK_BANK.maskedAccountNumber)
    .eq("institution_code", MOCK_BANK.institutionCode)
    .limit(1);
  if (findError) throw findError;
  accountId = existing?.[0]?.id ?? null;

  if (!accountId) {
    const { data: created, error: createError } = await supabase
      .from("financial_accounts")
      .insert({
        group_id: groupId,
        institution_code: MOCK_BANK.institutionCode,
        masked_account_number: MOCK_BANK.maskedAccountNumber,
        current_balance: MOCK_BANK.balance,
        is_mock: true,
        connected_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (createError) throw createError;
    accountId = created.id;
  }

  // ── 연결 ────────────────────────────────────────────────────────────────
  const fund = await convertToAccount(tripId, accountId);

  // ── 계좌에 있던 결제 1건을 가져온다 ────────────────────────────────────
  //    ⚠️ 이미 가져왔으면 다시 넣지 않는다. 연결을 두 번 해도 중복되면 안 된다.
  const { data: already, error: dupError } = await supabase
    .from("transactions")
    .select("id")
    .eq("trip_id", tripId)
    .eq("financial_account_id", accountId)
    .eq("name", MOCK_IMPORTED_SPEND.name)
    .is("deleted_at", null)
    .limit(1);
  if (dupError) throw dupError;

  if (!already?.length) {
    // 항공 카테고리가 있으면 자동 분류까지 해서 넣는다
    const { data: budget } = await supabase
      .from("trip_budgets")
      .select("id")
      .eq("trip_id", tripId)
      .maybeSingle();
    let categoryId: string | null = null;
    if (budget) {
      const { data: category } = await supabase
        .from("budget_categories")
        .select("id")
        .eq("trip_budget_id", budget.id)
        .eq("category_code", MOCK_IMPORTED_SPEND.categoryCode)
        .maybeSingle();
      categoryId = category?.id ?? null;
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      trip_id: tripId,
      financial_account_id: accountId,
      budget_category_id: categoryId,
      source_type: TRANSACTION_SOURCE_TYPE.MOCK,
      transaction_type: TRANSACTION_TYPE.WITHDRAWAL,
      occurred_at: new Date().toISOString(),
      name: MOCK_IMPORTED_SPEND.name,
      amount: MOCK_IMPORTED_SPEND.amount,
      category_method: categoryId ? CATEGORY_METHOD.AUTO : CATEGORY_METHOD.NONE,
      category_confidence: categoryId ? MOCK_IMPORTED_SPEND.confidence : null,
    });
    if (insertError) throw insertError;

    // 카테고리 실제 사용액에 더한다. 화면끼리 숫자가 어긋나면 안 된다
    if (categoryId) {
      const { data: category } = await supabase
        .from("budget_categories")
        .select("actual_amount")
        .eq("id", categoryId)
        .single();
      await supabase
        .from("budget_categories")
        .update({
          actual_amount:
            (category?.actual_amount ?? 0) + MOCK_IMPORTED_SPEND.amount,
        })
        .eq("id", categoryId);
    }
  }

  return {
    fund,
    importedName: MOCK_IMPORTED_SPEND.name,
    importedAmount: MOCK_IMPORTED_SPEND.amount,
  };
}
