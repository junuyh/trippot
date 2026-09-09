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
  FUND_SOURCE_TYPE,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  TRIP_STATUS,
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

/** 이전 여행에서 이 모임이 연결했던 계좌. 어느 여행이었는지도 같이 준다 */
export type PreviouslyLinkedAccount = {
  account: FinancialAccount;
  /** 그 계좌를 썼던 여행. 안내 문구에 쓴다 */
  tripDestination: string | null;
};

/**
 * 같은 모임의 **다른 여행**이 연결했던 계좌 중 가장 최근 것.
 *
 * FUND-02 에서 "지난 여행에서 연결한 계좌가 있어요. 같은 계좌로 연결할까요?"
 * 안내에 쓴다. 이 여행이 아직 계좌를 안 붙였을 때 모임 계좌 목록을 그냥
 * 늘어놓으면 이미 연결된 것처럼 읽힌다. (2026-09-09)
 *
 * ⚠️ 해제된 계좌(disconnected_at)는 뺀다. 다시 붙일 수 없는 계좌를 권하지 않는다.
 */
export async function getPreviouslyLinkedAccount(
  groupId: string,
  excludeTripId: string,
): Promise<PreviouslyLinkedAccount | null> {
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, destination")
    .eq("group_id", groupId)
    .neq("id", excludeTripId);
  if (tripsError) throw tripsError;
  if (!trips || trips.length === 0) return null;

  const { data: funds, error: fundsError } = await supabase
    .from("fund_sources")
    .select("trip_id, financial_account_id, updated_at")
    .in("trip_id", trips.map((t) => t.id))
    .not("financial_account_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (fundsError) throw fundsError;
  const latest = funds?.[0];
  if (!latest?.financial_account_id) return null;

  const { data: account, error: accountError } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("id", latest.financial_account_id)
    .is("disconnected_at", null)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) return null;

  return {
    account,
    tripDestination: trips.find((t) => t.id === latest.trip_id)?.destination ?? null,
  };
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

    /**
     * 카테고리뿐 아니라 **세부 계획 항목까지 연결한다.**
     *
     * ⚠️ 카테고리만 붙이면 "항공에 230만원을 썼다" 까지만 알 수 있다.
     *    사용자가 세운 계획(예: '대형항공사 직항' 240만원)과 이어져야
     *    "계획보다 10만원 아꼈다" 를 말할 수 있고, 그게 이 서비스가 하려는
     *    일이다.
     *
     * ⚠️ **아직 지출이 붙지 않은 계획**만 고른다. 이미 연결된 계획에 또
     *    붙이면 한 계획에 두 결제가 얹혀 실제 금액이 부풀려진다.
     *    후보가 여럿이면 금액이 가장 가까운 것을 고른다 — 같은 카테고리
     *    안에서 어느 계획의 결제인지는 금액이 가장 잘 말해 준다.
     */
    let planItemId: string | null = null;
    if (categoryId) {
      const { data: candidates } = await supabase
        .from("budget_plan_items")
        .select("id, expected_amount, actual_amount, status")
        .eq("budget_category_id", categoryId)
        .neq("status", BUDGET_PLAN_ITEM_STATUS.CANCELED);

      const open = (candidates ?? []).filter((row) => row.actual_amount === 0);
      if (open.length > 0) {
        planItemId = open.reduce((best, row) =>
          Math.abs(row.expected_amount - MOCK_IMPORTED_SPEND.amount) <
          Math.abs(best.expected_amount - MOCK_IMPORTED_SPEND.amount)
            ? row
            : best,
        ).id;
      }
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      trip_id: tripId,
      financial_account_id: accountId,
      budget_category_id: categoryId,
      budget_plan_item_id: planItemId,
      source_type: TRANSACTION_SOURCE_TYPE.MOCK,
      transaction_type: TRANSACTION_TYPE.WITHDRAWAL,
      occurred_at: new Date().toISOString(),
      name: MOCK_IMPORTED_SPEND.name,
      amount: MOCK_IMPORTED_SPEND.amount,
      category_method: categoryId ? CATEGORY_METHOD.AUTO : CATEGORY_METHOD.NONE,
      category_confidence: categoryId ? MOCK_IMPORTED_SPEND.confidence : null,
    });
    if (insertError) throw insertError;

    // 연결한 계획의 실제 금액과 상태를 채운다. 화면이 '결제 완료' 로 읽는 값이다
    if (planItemId) {
      await supabase
        .from("budget_plan_items")
        .update({
          actual_amount: MOCK_IMPORTED_SPEND.amount,
          status: BUDGET_PLAN_ITEM_STATUS.DONE,
        })
        .eq("id", planItemId);
    }

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

/** GROUP-02 연결 계좌 한 줄. **어느 여행의 계좌인지**까지 담는다. */
export type GroupTripAccount = {
  tripId: string;
  /** 여행 목적지. 같은 계좌가 여러 여행에 붙어 있을 때 구분해 준다. */
  destination: string | null;
  /** trips.status. 어느 상태의 여행까지 다룰지는 쓰는 화면이 정한다. */
  status: string;
  accountId: string;
  institutionCode: string | null;
  maskedAccountNumber: string | null;
};

/**
 * 모임의 여행들에 실제로 연결된 계좌.
 *
 * ⚠️ getGroupAccounts 와 다르다. 그쪽은 financial_accounts.group_id 로만 읽어
 *    **모임에 달린 계좌**를 준다. 그 결과에는 tripId 가 없어서, 화면에서
 *    계좌를 눌러도 어느 여행의 계좌 연결 화면으로 보낼지 알 수 없다.
 *
 *    계좌 관리 화면은 여행 단위(/trips/:tripId/funds/connect)뿐이다.
 *    그래서 여기서는 **fund_sources 를 기준으로** 읽는다.
 *    fund_sources.trip_id 는 unique 라 여행 하나에 자금 출처 하나다.
 *    (supabase/migrations/20260827000001_init_schema.sql)
 *
 * ⚠️ 임의로 여행 하나를 골라 대표로 삼지 않는다. 같은 계좌가 두 여행에
 *    연결돼 있으면 두 줄로 나온다. 각 줄이 자기 여행으로 간다.
 *
 * ⚠️ 계좌를 붙이지 않은 여행(수기 입력 · ZERO)은 나오지 않는다.
 *    financial_account_id 가 null 이라 !inner 조인에서 빠진다.
 */
export async function getGroupTripAccounts(
  groupId: string,
): Promise<GroupTripAccount[]> {
  const { data, error } = await supabase
    .from("fund_sources")
    .select(
      "trip_id, trips!inner(id, destination, group_id, status), financial_accounts!inner(id, institution_code, masked_account_number, disconnected_at)",
    )
    .eq("trips.group_id", groupId)
    .neq("trips.status", TRIP_STATUS.DELETED)
    .is("financial_accounts.disconnected_at", null);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    tripId: row.trip_id,
    destination: row.trips.destination,
    status: row.trips.status,
    accountId: row.financial_accounts.id,
    institutionCode: row.financial_accounts.institution_code,
    maskedAccountNumber: row.financial_accounts.masked_account_number,
  }));
}
