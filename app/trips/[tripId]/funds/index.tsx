// ============================================================================
// FUND-01 여행자금 / 입출금 관리  ·  /trips/:tripId/funds
//
// 여행자금을 **관리하는** 자리다. 목록만 보는 자리가 아니다. (IA v2 §2-4)
//   ① 현재 여행자금 — 누적 모금액 · 목표 · 앞으로 필요한 금액
//   ② 자금 추가 / 차감          ← 계좌를 연결하지 않은 사용자의 유일한 조정 수단
//   ③ 최근 입출금 10건 (카테고리 구분 없이 최신순)
//   ④ 입출금 전체 내역 → /funds/transactions
//   ⑤ 계좌 연결 / 전환 → FUND-02
//
// ⚠️ 누적 모금액과 현재 잔액을 혼용하지 않는다. (IA v2 §2-4-1)
//    결제로 줄어드는 것은 잔액이지 모은 금액이 아니다.
//
// ⚠️ 자금 추가·차감을 fund_sources.current_amount 직접 수정으로 처리하지 않는다.
//    거래로 남겨야 **언제 얼마를 모았는지**가 남는다. 그게 없으면
//    "하루 얼마씩 모으면 목표에 닿아요" 의 근거도, 결산·개인화에 쓸 데이터도
//    만들어지지 않는다.
//
// 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/fund/.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  FundSummaryCard,
  ReceiptScanningOverlay,
  ReceiptSourceSheet,
  RecentFundList,
  TransactionSheet,
  type FundDraft,
} from "@/components/fund";
import { TripHomeButton } from "@/components/navigation/TripHomeButton";
import { isTripEnded } from "@/lib/trip/tripStatus";
import { DateRangeCalendar } from "@/components/trip-create";
import {
  BottomSheet,
  Button,
  CurrencyInput,
  EmptyState,
  ErrorState,
  Input,
  Toast,
  useToast,
  Loading, HeaderBackButton } from "@/components/ui";
import { useCurrentUserId } from "@/lib/auth/AuthProvider";
import { useTransactionSheet } from "@/lib/hooks/useTransactionSheet";
import { listActiveTripMembers } from "@/lib/supabase/queries/tripMembers";
import { currentBalance, raisedTotal } from "@/lib/fund/fundTotals";
import { SCREENS } from "@/lib/analytics/events";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  FUND_SOURCE_TYPE,
  CATEGORY_CODE_LABEL,
  CATEGORY_METHOD,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  TRIP_STATUS,
  type CategoryCode,
  type RefundStatus,
  type TransactionType,
  type TripStatus,
} from "@/lib/constants/status";
import {
  receiptAmountKrw,
  receiptCurrencyNote,
  receiptDateNote,
  receiptItemsLabel,
  type ReceiptScanResult,
} from "@/lib/budget/receiptScan";
import { useReceiptScan } from "@/lib/hooks/useReceiptScan";
import type { ReceiptImageSource } from "@/lib/receipt/pickReceiptImage";
import { useScreenView } from "@/lib/hooks/useScreenView";
import { useTripContext } from "@/lib/hooks/useTripContext";
import {
  getBudgetByTripId,
  getBudgetCategories,
  getBudgetPlanItems,
  type BudgetCategory,
  type BudgetPlanItem,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import { classifyTransaction } from "@/lib/supabase/queries/transactionClassify";
import {
  createExpenseWithAutoLink,
  getFundTotals,
  getTransactions,
  reviewReason,
  updateTransactionMapping,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

/** 허브에 보여줄 최근 내역 건수. 전체는 /funds/transactions 가 담당한다 */
const RECENT_LIMIT = 10;

type FundData = {
  trip: Trip;
  budget: TripBudget | null;
  /** 지출 기록에서 고를 카테고리 목록 */
  categories: BudgetCategory[];
  /** 거래 시트가 '연결된 계획' 이름을 그리는 데 쓴다 */
  planItems: BudgetPlanItem[];
  fund: FundSource | null;
  transactions: Transaction[];
  depositTotal: number;
  withdrawalTotal: number;
  /**
   * 참여자 id → 이름. 모임 여행에서 '누가 적었는지' 를 목록에 쓴다.
   * 개인 여행이면 비어 있다 — 적은 사람이 나 하나라 줄마다 같은 이름이 반복된다.
   */
  memberNameById: Map<string, string>;
};

export default function ScreenFUND01() {
  const { tripId, scan: scanParam } = useLocalSearchParams<{
    tripId: string;
    /** 'receipt' 면 들어오자마자 영수증 기록 방법을 묻는다 (여행 홈 TODAY 카드) */
    scan?: string;
  }>();
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);
  useScreenView(SCREENS.TRANSACTION_LIST);
  const userId = useCurrentUserId();
  /** 거래 시트의 저장 결과를 알리는 토스트 */
  const fundToast = useToast();

  const [data, setData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    setNotFound(false);

    try {
      const trip = await getTripById(tripId);
      if (!trip) {
        setNotFound(true);
        return;
      }
      const budget = await getBudgetByTripId(trip.id);
      const [categories, fund, transactions, totals, members] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getTravelFund(trip.id),
        getTransactions(trip.id, { limit: RECENT_LIMIT }),
        getFundTotals(trip.id),
        /*
          ⚠️ 모임 여행일 때만 참여자 이름을 읽는다. 개인 여행은 적은 사람이
             나 하나라 줄마다 같은 이름이 붙을 뿐이다. 실패해도 목록을
             막지 않는다 — 이름 없이 그린다.
        */
        trip.group_id
          ? listActiveTripMembers(trip.id).catch(() => [])
          : Promise.resolve([]),
      ]);
      // 계획 항목은 카테고리별로 나뉘어 있어 한 번에 모은다. 전체 내역 화면과 같다
      const planItems = (
        await Promise.all(
          categories.map((category) => getBudgetPlanItems(category.id)),
        )
      ).flat();

      const memberNameById = new Map(
        members
          .filter((member) => member.user_id !== null)
          .map((member) => [member.user_id as string, member.name]),
      );
      setData({
        trip,
        budget,
        categories,
        planItems,
        fund,
        transactions,
        depositTotal: totals.depositTotal,
        withdrawalTotal: totals.withdrawalTotal,
        memberNameById,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  /*
    거래 상세 바텀시트. 최근 입출금을 누르면 여기서 열린다.
    ⚠️ 저장이 끝나면 목록을 다시 읽는다. 금액을 고치면 누적·잔액도 바뀐다.
  */
  const txSheet = useTransactionSheet({
    onChanged: () => load(),
    tripStatus: data?.trip.status,
    categories: data?.categories ?? [],
    planItems: data?.planItems ?? [],
    tripId: data?.trip.id ?? null,
    onNotice: (message) => fundToast.show(message),
    // 시트에도 누가 적었는지 붙인다. 모임 여행이 아니면 빈 Map 이다
    memberNameById: data?.memberNameById,
  });

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // ── 자금 추가 / 차감 ──────────────────────────────────────────────────
  const [sheetType, setSheetType] = useState<TransactionType | null>(null);
  const [draft, setDraft] = useState<FundDraft>({ name: "", amount: null });
  /** 거래 날짜 'yyyy-MM-dd'. 오늘로 시작한다 */
  const [occurredOn, setOccurredOn] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** 최근 입출금 필터. 전체 / 입금 / 지출 */
  const [listFilter, setListFilter] = useState<"ALL" | "IN" | "OUT">("ALL");

  /**
   * 지출 기록에서 고른 카테고리. null 이면 안 골랐다는 뜻이다. (시안 v1)
   *
   * ⚠️ 안 고르면 미분류로 남기고 '확인 필요' 로 잡는다. 임의로 하나 고르면
   *    그 카테고리의 실제 사용액이 사용자가 정하지도 않은 근거로 부풀려진다.
   */
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);

  // ── 영수증으로 기록 ──────────────────────────────────────────────────
  //
  //   지출 버튼 → 방법 시트(촬영 / 앨범 / 직접 입력) → 사진 → Edge Function 이
  //   가맹점·금액·날짜·카테고리를 읽음 → **지출 폼에 채워서** 보여줌 → 사용자가
  //   확인하고 '기록하기'. 읽은 값은 제안이지 확정이 아니다. (CLAUDE.md 3장)
  //
  //   ⚠️ 영수증이 고른 카테고리는 category_method=AUTO 로 저장돼 '확인 필요' 에
  //      잡힌다. 사용자가 폼에서 다른 칩을 고르면 그때부터 USER 다.
  const [sourceOpen, setSourceOpen] = useState(false);
  /** 폼에 채운 영수증. 배너와 저장 방식(AUTO)을 정한다. 직접 입력이면 null */
  const [receipt, setReceipt] = useState<ReceiptScanResult | null>(null);
  /** 영수증이 고른 카테고리 id. 사용자가 바꿨는지 비교한다 */
  const receiptCategoryRef = useRef<string | null>(null);
  const receiptScan = useReceiptScan({
    destination: data?.trip.destination ?? null,
    tripStart: data?.trip.start_date ?? null,
    tripEnd: data?.trip.end_date ?? null,
  });

  /**
   * 거래명으로 카테고리를 추측해 붙인다.
   *
   * ⚠️ 추측이지 확정이 아니다. category_method 를 AUTO 로 남겨
   *    '확인 필요' 에 잡히게 한다. 사용자가 거래 상세에서 확인해야 확정된다.
   *    (CLAUDE.md 3장 — 추천이 사용자 대신 확정하지 않는다)
   *
   * ⚠️ 못 맞히면 아무것도 하지 않는다. 미분류로 두는 것이 틀린 분류보다 낫다.
   *    엉뚱한 카테고리가 붙으면 그 카테고리의 실제 사용액이 틀렸다는 것조차
   *    사용자가 눈치채기 어렵다.
   */
  const autoClassify = useCallback(
    async (transactionId: string, name: string, amount: number) => {
      if (!data) return;
      try {
        const result = await classifyTransaction({
          name,
          destination: data.trip.destination,
          amount,
        });
        if (!result.classification) return;

        const category = data.categories.find(
          (c) => c.category_code === result.classification!.categoryCode,
        );
        // 이 여행에 없는 카테고리를 골랐으면 붙이지 않는다
        if (!category) return;

        await updateTransactionMapping(transactionId, {
          categoryId: category.id,
          categoryMethod: CATEGORY_METHOD.AUTO,
          categoryConfidence: result.classification.confidence,
        });
        await load();
      } catch {
        // 분류는 부가 기능이다. 실패해도 거래는 그대로 남는다.
      }
    },
    [data, load],
  );

  const openSheet = useCallback((type: TransactionType) => {
    setDraft({ name: "", amount: null });
    setOccurredOn(format(new Date(), "yyyy-MM-dd"));
    setDraftCategoryId(null);
    setNameError(null);
    setReceipt(null);
    receiptCategoryRef.current = null;
    setSheetType(type);
  }, []);

  /**
   * 영수증을 읽어 지출 폼에 채운다. 못 읽으면 훅이 안내하고 여기서는 아무것도 안 한다.
   *
   * ⚠️ 방법 시트(Modal)가 **완전히 내려간 뒤**에 사진 선택기를 연다. 닫히는 중에
   *    열면 iOS 가 조용히 무시하고 아무 일도 안 일어난다. iOS 는 Modal 의
   *    onDismiss 로, 그 콜백이 없는 Android 는 타이머로 이어 간다. 둘 중 먼저 온
   *    쪽만 실행되게 ref 로 막는다.
   */
  const pendingSourceRef = useRef<ReceiptImageSource | null>(null);
  const runPendingScan = useCallback(async () => {
    const source = pendingSourceRef.current;
    if (!source) return;
    pendingSourceRef.current = null;

    const result = await receiptScan.scan(source);
    if (!result || !data) return;

    const category = result.categoryCode
      ? (data.categories.find((c) => c.category_code === result.categoryCode) ?? null)
      : null;
    setDraft({ name: result.merchant ?? "영수증 지출", amount: receiptAmountKrw(result) });
    setOccurredOn(result.date ?? format(new Date(), "yyyy-MM-dd"));
    setDraftCategoryId(category?.id ?? null);
    receiptCategoryRef.current = category?.id ?? null;
    setNameError(null);
    setReceipt(result);
    setSheetType(TRANSACTION_TYPE.WITHDRAWAL);
  }, [data, receiptScan]);

  const handleReceipt = useCallback(
    (source: ReceiptImageSource) => {
      pendingSourceRef.current = source;
      setSourceOpen(false);
      // Android 폴백. iOS 는 onDismiss 가 먼저 와서 이 타이머는 빈손으로 끝난다
      setTimeout(() => void runPendingScan(), 700);
    },
    [runPendingScan],
  );

  /**
   * '직접 입력' 도 방법 시트가 **완전히 내려간 뒤**에 지출 폼을 연다.
   *
   * ⚠️ 방법 시트를 닫는 것과 같은 순간에 폼 시트(또 하나의 Modal)를 열면
   *    iOS 가 새 Modal 을 띄우지 못한다. 폼이 안 뜨거나 투명한 막이 남아
   *    화면이 눌리지 않았다. 촬영·앨범(runPendingScan)과 같은 방식으로
   *    iOS 는 onDismiss, Android 는 타이머로 이어 가고 ref 로 한 번만 연다.
   *    입금은 방법 시트를 거치지 않아 이 문제가 없었다.
   */
  const pendingManualRef = useRef(false);
  const runPendingManual = useCallback(() => {
    if (!pendingManualRef.current) return;
    pendingManualRef.current = false;
    openSheet(TRANSACTION_TYPE.WITHDRAWAL);
  }, [openSheet]);

  /** 여행 홈 TODAY 카드에서 ?scan=receipt 로 들어오면 바로 방법을 묻는다. 한 번만 */
  const scanParamUsedRef = useRef(false);
  useEffect(() => {
    // 확정된 여행은 기록 자체를 막으므로 자동으로 열지도 않는다 (지출이라 결산 중은 연다)
    if (scanParam !== "receipt" || !data || scanParamUsedRef.current) return;
    if ((data.trip.status as TripStatus) === TRIP_STATUS.SETTLED) return;
    scanParamUsedRef.current = true;
    setSourceOpen(true);
  }, [data, scanParam]);

  const handleSubmit = useCallback(async () => {
    if (!data || !sheetType || saving) return;
    const name = draft.name.trim();
    if (!name) {
      setNameError("내용을 입력해 주세요.");
      return;
    }
    if (!draft.amount || draft.amount <= 0) {
      setNameError(null);
      return;
    }

    setSaving(true);
    try {
      /*
        ⚠️ 지출이고 카테고리가 있으면 이름이 사실상 같은 세부 계획에 자동으로
           붙는다. (2026-09-22 결정 — 95% 이상 같을 때만, 풀 수 있다)
           입금·미분류는 그냥 저장된다.
      */
      const { transaction: created, linkedPlanItemId } =
        await createExpenseWithAutoLink({
        trip_id: data.trip.id,
        // 직접 입력한 자금 이동이다. 계좌에서 불러온 거래가 아니다.
        source_type: TRANSACTION_SOURCE_TYPE.MANUAL,
        transaction_type: sheetType,
        // 사용자가 고른 날짜다. DB 는 UTC 로 저장하고 화면에서 KST 로 읽는다.
        occurred_at: parseISO(occurredOn).toISOString(),
        name,
        amount: draft.amount,
        /*
          ⚠️ 누가 적었는지 남긴다. (2026-09-21 테스트) 모임 자금은 여러 사람이
             같은 목록에 적는 자리라, 날짜와 금액만 남으면 "이 20만원 누가
             넣었지" 가 반복된다. 계좌에서 들어온 거래는 사람이 적은 게
             아니라 이 칸을 비운다.
        */
        created_by_user_id: userId ?? null,
        /**
         * ⚠️ 입금에는 카테고리를 붙이지 않는다. 예산을 쓴 게 아니라
         *    자금이 들어온 것이다. 붙이면 그 예산의 실제 사용액이 부풀려진다.
         *
         * ⚠️ 지출인데 안 골랐으면 그대로 비워 둔다. 임의로 채우지 않는다.
         *    reviewReason() 이 '미분류' 로 잡아 확인 필요 목록에 올린다.
         */
        budget_category_id:
          sheetType === TRANSACTION_TYPE.WITHDRAWAL ? draftCategoryId : null,
        /**
         * 사용자가 직접 고른 분류다.
         * ⚠️ 안 골랐으면 NONE 이다. 이 칼럼은 not null default 'NONE' 이라
         *    null 을 넣을 수 없다. NONE 은 '아직 분류 안 함' 을 뜻한다.
         */
        category_method: draftCategoryId
          ? receipt && receiptCategoryRef.current === draftCategoryId
            ? CATEGORY_METHOD.AUTO // 영수증이 고른 그대로면 추측이다. 확인 필요에 잡힌다
            : CATEGORY_METHOD.USER
          : CATEGORY_METHOD.NONE,
        category_confidence:
          draftCategoryId && receipt && receiptCategoryRef.current === draftCategoryId
            ? receipt.confidence
            : null,
      });
      setSheetType(null);
      await load();

      // 자동으로 붙었으면 어디에 붙었는지 바로 알린다. 모르고 지나가면 풀 기회가 없다
      if (linkedPlanItemId) {
        const planName = data.planItems.find(
          (plan) => plan.id === linkedPlanItemId,
        )?.name;
        fundToast.show(
          planName
            ? `'${planName}' 계획에 자동으로 연결했어요`
            : "이름이 같은 계획에 자동으로 연결했어요",
          3200,
        );
      }

      /**
       * ── 자동 분류 ── (시안 v1: 미선택 시 AI 자동 분류 후 확인 필요)
       *
       * ⚠️ **저장을 여기에 묶지 않는다.** 위에서 거래는 이미 저장됐다.
       *    분류를 기다렸다가 저장하면 사용자가 '기록하기' 를 누르고
       *    LLM 응답만큼 멈춰 선다. 실측에서 10초를 넘긴 적이 있다.
       *    실패해도 거래는 미분류로 남아 '확인 필요' 에 잡히므로 잃는 게 없다.
       */
      if (sheetType === TRANSACTION_TYPE.WITHDRAWAL && !draftCategoryId) {
        void autoClassify(created.id, name, draft.amount);
      }
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
    /**
     * ⚠️ autoClassify · draftCategoryId · occurredOn 이 빠져 있었다.
     *    빠지면 오래된 클로저를 잡아 방금 고른 카테고리·날짜가 아니라
     *    이전 값으로 저장되고, 자동 분류도 옛 data 를 보고 돌아 아무것도 안 한다.
     */
  }, [
    autoClassify,
    data,
    draft,
    draftCategoryId,
    load,
    occurredOn,
    receipt,
    saving,
    sheetType,
  ]);

  // ── 파생값 ────────────────────────────────────────────────────────────
  const visibleTransactions = useMemo(() => {
    const rows = data?.transactions ?? [];
    if (listFilter === "ALL") return rows;
    const wanted =
      listFilter === "IN"
        ? TRANSACTION_TYPE.DEPOSIT
        : TRANSACTION_TYPE.WITHDRAWAL;
    return rows.filter((row) => row.transaction_type === wanted);
  }, [data?.transactions, listFilter]);

  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "여행자금" }} />
        <Loading message="여행자금을 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "여행자금" }} />
        <EmptyState
          icon="wallet-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace("/")}
        />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "여행자금" }} />
        <ErrorState
          message="여행자금을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  /**
   * 누적 모금액 = 등록 금액 + 입금 합계. (IA v2 §2-4-1)
   * 결제로 줄지 않는다. 잘못 넣은 입금을 지우면 그때 다시 계산된다.
   *
   * ⚠️ 식을 여기 쓰지 않는다. 여행 홈이 다른 식을 쓰고 있어서 같은 여행의
   *    금액이 두 화면에서 달랐다. lib/fund/fundTotals.ts 한 곳만 본다.
   */
  const fundTotals = {
    registeredAmount: data.fund?.current_amount ?? 0,
    depositTotal: data.depositTotal,
    withdrawalTotal: data.withdrawalTotal,
  };
  const raisedAmount = raisedTotal(fundTotals);
  /*
    ⚠️ 결산이 확정된 여행은 **더 기록할 수 없다.** (IA v2 §2-6-3)
       거래 상세는 이미 막고 있었는데 이 화면의 입금·지출 기록 버튼이
       살아 있어서, 확정된 여행에 거래를 더 넣을 수 있었다. (2026-09-21 2차)

    ⚠️⚠️ **결산 중(ENDED)도 같이 막는다.** (2026-09-21 4차)
       확정(SETTLED)만 막고 있어서, 지난 여행의 예산 카테고리에서
       '지출 항목 상세 보기' 로 이 화면에 들어오면 입금·지출을 새로 적고
       계좌까지 연결할 수 있었다. 예산 화면은 이미 "결산 중이라 예산과 계획은
       고칠 수 없어요" 라고 말하고 있는데 돈 쪽만 열려 있었다.
       결산 중에 할 일은 **이미 쓴 것을 확인하고 분류하는 것**이지
       새로 적는 것이 아니다. 거래 시트(확인 완료·카테고리 변경)는 그대로 둔다.
  */
  const settledTrip =
    (data.trip.status as TripStatus) === TRIP_STATUS.SETTLED;
  /** 결산 중 + 확정. 새로 기록하거나 계좌를 연결하는 길을 모두 닫는다 */
  const endedTrip = isTripEnded(data.trip.status);
  /** 현재 잔액 = 누적 모금액 − 출금 합계 */
  const balance = Math.max(0, currentBalance(fundTotals));
  const targetAmount = data.budget?.target_amount ?? 0;
  const connected =
    data.fund?.source_type === FUND_SOURCE_TYPE.MOCK ||
    data.fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT;

  const deposit = sheetType === TRANSACTION_TYPE.DEPOSIT;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "여행자금" }} />

        <FundSummaryCard
          theme={theme}
          raisedAmount={raisedAmount}
          balanceAmount={balance}
          targetAmount={targetAmount}
          spentAmount={data.withdrawalTotal}
          /*
            ⚠️ 결산 중이면 **입금만 닫고 지출은 연다.** (2026-09-21 4차)
               여행에서 돌아와 마지막 날 지출을 적는 일은 실제로 있다.
               이미 끝난 여행에 돈을 더 모을 일은 없다.
            ⚠️ 확정된 여행은 둘 다 닫는다. 결산 스냅샷과 어긋난다.
          */
          onRecordDeposit={
            endedTrip ? undefined : () => openSheet(TRANSACTION_TYPE.DEPOSIT)
          }
          /* 지출은 영수증/직접 입력 중에서 고른다. 입금은 영수증이 없으니 바로 폼 */
          onRecordExpense={settledTrip ? undefined : () => setSourceOpen(true)}
          lockNote={
            settledTrip
              ? "정산이 확정돼 더 기록할 수 없어요. 확정 시점의 기록을 보는 화면이에요."
              : endedTrip
                ? "결산 중이라 입금과 계좌 연결은 닫혔어요. 빠뜨린 지출은 지금도 적을 수 있어요."
                : null
          }
        />

        {/*
          ── 계좌 연결 / 전환 ──
          ⚠️ 계좌를 연결하지 않은 사용자에게는 **지금 무엇으로 관리 중인지**를
             먼저 말한다. 연결 버튼만 두면 직접 입력이 임시 상태처럼 읽히는데,
             직접 입력 사용자도 동일한 핵심 기능을 쓴다. (CLAUDE.md 3장)
        */}
        {connected || endedTrip ? null : (
          <View
            style={{
              marginTop: 12,
              padding: 13,
              borderRadius: 12,
              backgroundColor: theme.primarySoft,
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "800", color: theme.primary }}
            >
              지금은 직접 입력으로 관리 중이에요
            </Text>
            <Text
              style={{
                marginTop: 5,
                fontSize: 10,
                lineHeight: 16,
                color: "#687281",
              }}
            >
              입금과 지출을 직접 기록하고 있어요. 계좌를 연결하면 거래가
              자동으로 들어와요.
            </Text>
          </View>
        )}
        {/*
          ⚠️ 끝난 여행에서는 계좌를 연결·해제하지 않는다. (2026-09-21 4차)
             결산 중인 지난 여행에서 계좌를 새로 연결할 수 있었다. 연결하면
             그 계좌의 거래가 이 여행으로 들어와 결산 금액이 뒤에서 움직인다.
        */}
        {endedTrip ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={connected ? "연결 계좌 관리" : "계좌 연결하기"}
          onPress={() => router.push(`/trips/${data.trip.id}/funds/connect`)}
          className="active:bg-gray-50"
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: "#e8eaee",
            borderRadius: 14,
          }}
        >
          <Ionicons name="card-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#141b28" }}>
              {connected ? "연결 계좌 관리" : "계좌 연결하기"}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 10, color: "#858e9c" }}>
              {connected
                ? "연결을 해제하면 직접 입력으로 돌아가요."
                : "연결하면 입출금이 자동으로 기록돼요."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="#a8afb9" />
        </Pressable>
        )}

        {/* ── 최근 입출금 ── */}
        <View style={{ marginTop: 26 }}>
          <View
            className="flex-row items-end justify-between"
            style={{ marginHorizontal: 3, marginBottom: 11 }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#141b28" }}>
              최근 입출금
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() =>
                router.push(`/trips/${data.trip.id}/funds/transactions`)
              }
              style={{ fontSize: 10, fontWeight: "600", color: theme.primary }}
            >
              입출금 전체 내역 ›
            </Text>
          </View>

          {/* 전체 / 입금 / 지출. 정렬이 아니라 종류를 고르는 축이다 */}
          <View className="flex-row" style={{ gap: 7, marginBottom: 11 }}>
            {(
              [
                { key: "ALL", label: "전체" },
                { key: "IN", label: "입금" },
                { key: "OUT", label: "지출" },
              ] as const
            ).map((chip) => {
              const active = listFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setListFilter(chip.key)}
                  className="active:opacity-70"
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? theme.primary : "#e8eaee",
                    backgroundColor: active ? theme.primarySoft : "#fff",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: active ? "800" : "500",
                      color: active ? theme.primary : "#7c8695",
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <RecentFundList
            theme={theme}
            transactions={visibleTransactions.map((transaction) => ({
              id: transaction.id,
              name: transaction.name,
              amount: transaction.amount,
              occurredAt: transaction.occurred_at,
              transactionType: transaction.transaction_type as TransactionType,
              refundStatus: transaction.refund_status as RefundStatus,
              // 카테고리 코드는 화면이 붙여 준다. 컴포넌트가 예산을 다시 읽지 않게
              categoryCode: transaction.budget_category_id
                ? ((data.categories.find(
                    (c) => c.id === transaction.budget_category_id,
                  )?.category_code as CategoryCode | undefined) ?? null)
                : null,
              needsReview: reviewReason(transaction) !== null,
              // 누가 적었는지. 모임 여행에서만 채워져 있다
              authorName: transaction.created_by_user_id
                ? (data.memberNameById.get(transaction.created_by_user_id) ??
                  null)
                : null,
            }))}
            /*
              ⚠️ 화면으로 밀지 않고 **시트**로 연다. (2026-09-21 2차)
                 고치려고 상세 화면까지 들어가면 목록으로 돌아오는 데 또
                 한 걸음이 든다. 한 건씩 확인하는 흐름이 매번 끊겼다.
            */
            onSelect={(transactionId) => {
              const picked = data.transactions.find(
                (row) => row.id === transactionId,
              );
              if (picked) txSheet.open(picked);
            }}
          />
        </View>
      </ScrollView>

      {/* ── 자금 추가 / 차감 ── */}
      <BottomSheet
        visible={sheetType !== null}
        title={deposit ? "입금 기록" : "지출 기록"}
        description={
          deposit
            ? "모은 금액을 기록해요. 누적 입금이 늘어나요."
            : "여행에서 쓴 금액이에요. 누적 입금은 줄지 않고 쓸 수 있는 자금만 줄어요."
        }
        onClose={() => setSheetType(null)}
        footer={
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="secondary"
                onPress={() => setSheetType(null)}
                disabled={saving}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="기록하기"
                loading={saving}
                onPress={() => void handleSubmit()}
              />
            </View>
          </View>
        }
      >
        <View style={{ gap: 13, paddingTop: 13 }}>
          {receipt ? (
            <View
              style={{
                borderRadius: 12,
                backgroundColor: theme.primarySoft,
                padding: 12,
                gap: 4,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name="receipt-outline" size={14} color={theme.primary} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: theme.primary }}>
                  영수증에서 읽었어요 · 확인하고 기록해 주세요
                </Text>
              </View>
              {receiptCurrencyNote(receipt) ? (
                <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
                  {receiptCurrencyNote(receipt)}
                </Text>
              ) : null}
              {receiptDateNote(receipt, data.trip.start_date, data.trip.end_date) ? (
                <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
                  {receiptDateNote(receipt, data.trip.start_date, data.trip.end_date)}
                </Text>
              ) : null}
              {receipt.items.length > 0 ? (
                <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }} numberOfLines={3}>
                  {receiptItemsLabel(receipt.items)}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Input
            label="거래명"
            required
            value={draft.name}
            onChangeText={(name) => {
              setDraft({ ...draft, name });
              if (nameError) setNameError(null);
            }}
            placeholder={
              deposit ? "예: 9월 여행적금" : "예: 간사이 왕복 항공권"
            }
            error={nameError}
            maxLength={30}
          />
          <CurrencyInput
            label="금액"
            required
            value={draft.amount}
            onChangeValue={(amount) => setDraft({ ...draft, amount })}
          />

          {/*
            ── 예산 카테고리 ── 지출에만 낸다 (시안 v1)
            ⚠️ 필수가 아니다. 안 고르면 '확인 필요' 로 남기고 나중에 정하게 한다.
               지금 억지로 고르게 하면 아무거나 눌러 넘기고, 그 카테고리의
               실제 사용액이 틀린 채로 결산까지 간다.
          */}
          {!deposit && (data?.categories ?? []).length > 0 ? (
            <View style={{ gap: 7 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#141b28" }}
              >
                예산 카테고리
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 7 }}>
                {(data?.categories ?? []).map((category) => {
                  const active = draftCategoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() =>
                        setDraftCategoryId(active ? null : category.id)
                      }
                      className="active:opacity-70"
                      style={{
                        paddingHorizontal: 11,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: active ? theme.primary : "#e5e8ec",
                        backgroundColor: active ? theme.primarySoft : "#fff",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: active ? "800" : "400",
                          color: active ? theme.primary : "#687281",
                        }}
                      >
                        {
                          CATEGORY_CODE_LABEL[
                            category.category_code as CategoryCode
                          ]
                        }
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 10, color: "#a3a9b3" }}>
                지금 안 골라도 돼요. 나중에 거래 상세에서 정할 수 있어요.
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 7 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#141b28" }}>
              날짜
            </Text>
            {/*
              ⚠️ 오늘로 고정하지 않는다. 어제 넣은 돈을 오늘 기록하는 일이
                 흔하고, 날짜가 틀리면 "하루 얼마씩 모으면 되는지" 도 틀어진다.
            */}
            <DateRangeCalendar
              mode="single"
              startDate={occurredOn}
              endDate={occurredOn}
              onChange={(next) => {
                if (next.startDate) setOccurredOn(next.startDate);
              }}
              // 이미 지나간 입금·지출을 기록한다. 과거를 막으면 안 된다.
              disablePast={false}
              showHint={false}
            />
          </View>

          <View
            style={{
              borderRadius: 11,
              backgroundColor: "#f5f6f8",
              padding: 11,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
              {format(parseISO(occurredOn), "M월 d일")} 자로 기록돼요.
              {"\n"}
              {deposit
                ? "잘못 넣었다면 입출금 전체 내역에서 지울 수 있어요."
                : draftCategoryId
                  ? receipt && receiptCategoryRef.current === draftCategoryId
                    ? "영수증을 보고 고른 카테고리예요. 기록 뒤 '확인 필요' 에서 한 번 더 확인해요."
                    : "고른 카테고리의 실제 사용액에 바로 반영돼요."
                  : "카테고리는 비어 있어요. 거래 상세에서 지정하면 그 카테고리의 실제 사용액에 반영돼요."}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* ── 지출 기록 방법 ── 촬영 / 앨범 / 직접 입력 */}
      <ReceiptSourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        theme={theme}
        onCamera={() => handleReceipt("camera")}
        onLibrary={() => handleReceipt("library")}
        onDismiss={() => {
          void runPendingScan();
          runPendingManual();
        }}
        onManual={() => {
          pendingManualRef.current = true;
          setSourceOpen(false);
          // Android 폴백. iOS 는 onDismiss 가 먼저 와서 이 타이머는 빈손으로 끝난다
          setTimeout(runPendingManual, 700);
        }}
      />
      {/* 최근 입출금을 누르면 열리는 거래 상세. 수기 거래는 여기서 바로 고친다 */}
      <TransactionSheet controller={txSheet} theme={theme} />
      <Toast state={fundToast.state} />

      <ReceiptScanningOverlay visible={receiptScan.phase === "scanning"} />
    </View>
  );
}
