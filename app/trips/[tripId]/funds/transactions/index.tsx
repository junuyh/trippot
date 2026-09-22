// ============================================================================
// 입출금 전체 내역  ·  /trips/:tripId/funds/transactions
//
// FUND-01(여행자금 관리 허브)에서 '입출금 전체 내역' 으로 들어온다.
//
// 진입 param
//   ?categoryId=      그 카테고리 지출만 (BUDGET-02 '전체 내역 보기')
//   ?transactionId=   진입 즉시 그 거래의 상세 시트를 연다
//                     (BUDGET-02 연결된 계획 → 지출 상세)
//
// ⚠️ 거래 상세를 별도 화면이 아니라 **바텀시트**로 연다. 목록에서 하나 눌러
//    카테고리를 고치는 게 결산 검토의 대부분이라, 화면을 오갈 이유가 없다.
//    다만 다른 화면에서 특정 거래를 지목해 열 수 있어야 하므로
//    ?transactionId= 로 주소를 만들어 둔다.
// ============================================================================
import { format, isSameDay, parseISO } from "date-fns";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTransactionSheet } from "@/lib/hooks/useTransactionSheet";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Modal, Pressable, SectionList, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { TripHomeButton } from "@/components/navigation/TripHomeButton";
import { useCurrentUserId } from "@/lib/auth/AuthProvider";
import { canEditTransaction } from "@/lib/trip/transactionPermission";
import { isTripEnded } from "@/lib/trip/tripStatus";
import {
  TransactionDetailBody,
  TransactionSheet,
  type TransactionDetail,
} from "@/components/fund";
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Loading, HeaderBackButton } from "@/components/ui";
import { SCREENS } from "@/lib/analytics/events";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  CATEGORY_CODE_LABEL,
  CATEGORY_METHOD,
  REFUND_STATUS,
  type RefundStatus,
  type TransactionType,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  type CategoryCode,
  FUND_SOURCE_TYPE,
} from "@/lib/constants/status";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { CATEGORY_CODE_TO_ANALYTICS, MAPPED_BY } from "@/lib/constants/status";
import {
  amountSign,
  statusLabel,
  transactionIcon,
} from "@/lib/constants/transactionIcon";
import { useScreenView } from "@/lib/hooks/useScreenView";
import { useTripContext } from "@/lib/hooks/useTripContext";
import {
  getBudgetByTripId,
  getBudgetCategories,
  getBudgetPlanItems,
  type BudgetCategory,
  type BudgetPlanItem,
} from "@/lib/supabase/queries/budgets";
import {
  deleteTransaction,
  getTransactions,
  isRefundRelated,
  reviewReason,
  reviewReasonLabel,
  linkTransactionToPlanItem,
  syncPlanItemActual,
  updateTransactionMapping,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import { getGroupAccounts, getTravelFund } from "@/lib/supabase/queries/funds";
import { listActiveTripMembers } from "@/lib/supabase/queries/tripMembers";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

type FundsData = {
  trip: Trip;
  categories: BudgetCategory[];
  /** 이 여행의 모든 계획 항목. 거래를 계획에 연결할 때 후보로 쓴다 */
  planItems: BudgetPlanItem[];
  transactions: Transaction[];
  /** 마스킹된 계좌번호. 연결 계좌가 없으면 null (NFR-002) */
  maskedAccountNumber: string | null;
  /**
   * 참여자 id → 이름. 거래를 적은 사람을 줄에 붙이는 데 쓴다.
   * ⚠️ 모임 여행에서만 채운다. 개인 여행은 비어 있다. (FUND-01 과 같은 규칙)
   */
  memberNameById: Map<string, string>;
};

/**
 * 목록 보기 방식. (시안 v1)
 *
 * ⚠️ 2026-09-03 · 필터와 정렬 **두 축을 하나로 합쳤다.**
 *    앞서는 '확인 필요를 금액순으로' 를 만들려고 축을 갈랐는데,
 *    칩 한 줄 + 정렬 토글 한 줄이 되면서 목록보다 조작부가 커졌다.
 *    시안대로 네 가지 보기 중 하나를 고르는 방식으로 되돌린다.
 *    '큰 금액순' 은 필터가 아니라 **보기**다 — 입금을 빼고 금액순으로 세운다.
 */
/**
 * 확인이 필요한 이유별 안내 문구.
 *
 * ⚠️ AUTO_GUESS 와 LOW_CONFIDENCE 를 갈라 쓴다. 직접 적은 거래를 추측해
 *    붙인 경우는 확신도가 95% 여도 확인을 받는데, 여기에 "확신이 낮아요" 를
 *    쓰면 같은 화면에 적힌 신뢰도 95% 와 정면으로 어긋난다.
 */
const REVIEW_NOTE: Record<string, string | null> = {
  UNCATEGORIZED: "분류되지 않은 거래예요. 카테고리를 확인해 주세요.",
  LOW_CONFIDENCE: "자동으로 분류했지만 확신이 낮아요. 맞는지 확인해 주세요.",
  AUTO_GUESS:
    "직접 적은 거래를 거래명으로 추측해 분류했어요. 맞는지 확인해 주세요.",
  REFUND_PENDING:
    "환불이 예정된 거래예요. 아직 돈이 돌아오지 않아 지출에 남아 있어요.",
  NONE: null,
};

type FundView = "ALL" | "DEPOSIT" | "SPEND" | "REVIEW";

export default function ScreenFUND01() {
  const {
    tripId,
    categoryId,
    transactionId,
    filter: filterParam,
    from,
  } = useLocalSearchParams<{
    tripId: string;
    categoryId?: string;
    transactionId?: string;
    /** all | major | review | refund */
    filter?: string;
    /** 'settlement' 이면 결산에서 들어온 것이다. 뒤로 갈 곳을 정한다 */
    from?: string;
  }>();

  /*
    ⚠️ 뒤로가기는 들어온 곳으로. 결산에서 '전체 지출 보기' 로 들어온 사람이
       뒤로 누르면 여행자금으로 가 버려서, 결산으로 돌아갈 길이 없었다.
       (2026-09-21 2차)
  */
  const parentHref =
    from === "settlement"
      ? `/trips/${tripId}/settlement`
      : `/trips/${tripId}/funds`;
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);
  const userId = useCurrentUserId();

  const [data, setData] = useState<FundsData | null>(null);
  const [loading, setLoading] = useState(true);
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
      const [categories, transactions, accounts, fund, members] =
        await Promise.all([
          budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
          getTransactions(trip.id, categoryId ? { categoryId } : undefined),
          trip.group_id
            ? getGroupAccounts(trip.group_id)
            : Promise.resolve([]),
          getTravelFund(trip.id),
          /*
            ⚠️ 모임 여행일 때만 참여자 이름을 읽는다. 한 번만 읽고 줄마다
               Map 에서 찾는다. 실패해도 목록을 막지 않는다 — 이름 없이 그린다.
               (2026-09-22 테스트 — 입력자 이름이 최근 내역에만 보였다)
          */
          trip.group_id
            ? listActiveTripMembers(trip.id).catch(() => [])
            : Promise.resolve([]),
        ]);
      /**
       * ⚠️ **이 여행에 실제로 붙은 계좌**만 '연결됨' 으로 보여준다.
       *    모임에 계좌가 있다는 이유로 accounts[0] 을 보여주면, 직접 입력으로
       *    관리 중인 여행에서도 '연결 계좌 자동 분류 · 연결됨' 이 떠서
       *    사용자가 연결된 줄로 착각한다. (2026-09-10 · FUND-02 와 같은 문제)
       */
      const linked =
        fund &&
        (fund.source_type === FUND_SOURCE_TYPE.ACCOUNT ||
          fund.source_type === FUND_SOURCE_TYPE.MOCK)
          ? (accounts.find((a) => a.id === fund.financial_account_id) ?? null)
          : null;
      // 계획 항목은 카테고리별로 나뉘어 있어 한 번에 모은다
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
        categories,
        planItems,
        transactions,
        maskedAccountNumber: linked?.masked_account_number ?? null,
        memberNameById,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [categoryId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenView(SCREENS.TRANSACTION_LIST);

  /**
   * 목록 필터. (IA v2 §2-4-2)
   *
   * ⚠️ '확인 필요' 는 지금 판정할 수 있는 것만 본다 —
   *    카테고리 없음 · 자동 분류 신뢰도 낮음.
   *    계획 연결 후보 다중 · 카드 승인↔출금 중복 · 환불·취소는
   *    판정할 칼럼이 없어 넣지 않았다. 없는 근거로 '확인 필요' 를 띄우면
   *    사용자는 무엇을 고쳐야 할지 알 수 없다.
   */
  /** ?filter= 로 들어오면 그 보기로 시작한다 (SETTLE-01 → 확인 필요 등) */
  const [view, setView] = useState<FundView>(() => {
    const wanted = (filterParam ?? "").toUpperCase();
    return wanted === "DEPOSIT" || wanted === "SPEND" || wanted === "REVIEW"
      ? (wanted as FundView)
      : "ALL";
  });

  /**
   * 카테고리 필터. 빈 배열이면 전체다.
   *
   * ⚠️ 보기(전체·입금·지출·확인 필요)와 **다른 축**이다. 칩 하나로 합치면
   *    "지출 중 식비" 를 고를 수 없다. 그래서 보기는 칩, 카테고리는 시트다.
   */
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  /** 시트에서 고르는 중인 값. 적용을 눌러야 위 상태로 넘어간다 */
  const [filterDraft, setFilterDraft] = useState<string[] | null>(null);
  /** 계획 연결 시트를 띄울 거래. null 이면 닫는다 */

  /** ?transactionId= 로 들어왔을 때 한 번만 상세로 보낸다 */
  const openedRef = useRef(false);
  /** 상세 시트에 띄울 거래. null 이면 닫는다 (시안 v1) */
  /*
    상세 시트가 완전히 닫힌 뒤에 연결 시트를 연다. iOS 는 Modal 위에 Modal 을
    열면 두 번째가 뜨지 않는다. setTimeout 은 안드로이드 폴백이다.
  */

  /**
   * 행별 Swipeable 참조.
   *
   * 수정·삭제를 누른 뒤 열린 행을 직접 닫는다. 닫지 않으면 시트를 저장하고
   * 돌아와도 '수정 / 삭제' 버튼이 그대로 남아, 사용자가 오른쪽으로 다시
   * 밀어야 원래 화면이 된다. 방금 끝낸 동작의 흔적이 남는 셈이다.
   */
  const swipeRefs = useRef(new Map<string, SwipeableMethods | null>());

  const closeSwipe = useCallback((transactionId: string) => {
    swipeRefs.current.get(transactionId)?.close();
  }, []);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * 시트에서 쓰는 값. 상세 본문은 components/fund/TransactionDetailBody 가 그린다.
   *
   * ⚠️ 카테고리 코드를 화면이 붙여 준다. 컴포넌트가 예산 테이블을 다시 읽지
   *    않게 한다. (CLAUDE.md 9장)
   */

  /*
    거래 상세 시트. 여행자금·카테고리 예산과 같은 것을 쓴다.
    ⚠️ 시트 하나 안에서 상세 · 수정 · 카테고리 · 계획 연결이 모두 끝난다.
       시트 위에 시트를 열면 iOS 에서 두 번째가 뜨지 않고 화면이 먹통이 된다.
  */
  const txSheet = useTransactionSheet({
    onChanged: () => load(),
    tripStatus: data?.trip.status,
    categories: data?.categories ?? [],
    planItems: data?.planItems ?? [],
    tripId: data?.trip.id ?? null,
    onNotice: (message) => setToast(message),
    memberNameById: data?.memberNameById,
    userId,
  });

  const [sheetBusy, setSheetBusy] = useState(false);
  /** 카테고리를 바꾸는 중인 거래 */



  // 삭제는 되돌릴 수 없다. 먼저 확인한다. (NFR-003)
  const handleDelete = useCallback(
    (transaction: Transaction) => {
      Alert.alert(
        "이 거래를 삭제할까요?",
        `${transaction.name ?? "이름 없는 거래"} · ${transaction.amount.toLocaleString("ko-KR")}원`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "삭제",
            style: "destructive",
            onPress: () => {
              void deleteTransaction(transaction.id)
                .then(() => load())
                .catch(() => setError(true));
            },
          },
        ],
      );
    },
    [load],
  );

  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  const categoryLabel = useMemo(() => {
    if (!categoryId || !data) return null;
    const found = data.categories.find(
      (category) => category.id === categoryId,
    );
    return found
      ? CATEGORY_CODE_LABEL[found.category_code as CategoryCode]
      : null;
  }, [categoryId, data]);

  /**
   * ?transactionId= 로 들어오면 그 거래 상세로 바로 보낸다.
   *
   * ⚠️ 2026-09-03 · 상세를 시트가 아니라 **별도 화면**으로 옮겼다. (FUND-03)
   *    SETTLE-01 주요 지출·BUDGET-02 연결 계획에서 곧장 들어오는 자리라,
   *    시트로 두면 뒤로가기가 목록을 거치지 않고 바로 닫혀 맥락이 끊긴다.
   */
  useEffect(() => {
    if (!tripId || !transactionId || openedRef.current) return;
    openedRef.current = true;
    router.replace(`/trips/${tripId}/funds/transactions/${transactionId}`);
  }, [tripId, transactionId]);

  /**
   * 카테고리 필터로 좁힌 뒤의 기준 목록.
   *
   * ⚠️ 탭 건수도 여기서 센다. 필터를 걸었는데 탭에는 전체 건수가 남아 있으면
   *    "전체 27" 을 눌러도 3건만 나와 숫자가 거짓말이 된다.
   *
   * ⚠️ 카테고리를 고르면 입금은 빠진다. 입금에는 예산 카테고리가 없다.
   */
  const scopedTransactions = useMemo(() => {
    const rows = data?.transactions ?? [];
    if (selectedCategoryIds.length === 0) return rows;
    const wanted = new Set(selectedCategoryIds);
    return rows.filter(
      (t) => t.budget_category_id && wanted.has(t.budget_category_id),
    );
  }, [data?.transactions, selectedCategoryIds]);

  const visibleTransactions = useMemo(() => {
    // ⚠️ '전체' 는 입금까지 포함한다. 출금만 남기면 FUND-01 에서 '입출금 전체
    //    내역' 으로 들어왔는데 방금 넣은 입금이 사라져 빈 화면이 된다.
    let rows = [...scopedTransactions];

    if (view === "REVIEW") return rows.filter((t) => reviewReason(t) !== null);
    if (view === "DEPOSIT")
      return rows.filter(
        (t) => t.transaction_type === TRANSACTION_TYPE.DEPOSIT,
      );
    if (view === "SPEND")
      return rows.filter(
        (t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL,
      );
    return rows;
  }, [scopedTransactions, view]);

  /** 탭 배지에 쓸 건수 */
  const counts = useMemo(() => {
    const rows = scopedTransactions;
    return {
      all: rows.length,
      deposit: rows.filter(
        (t) => t.transaction_type === TRANSACTION_TYPE.DEPOSIT,
      ).length,
      spend: rows.filter(
        (t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL,
      ).length,
      review: rows.filter((t) => reviewReason(t) !== null).length,
    };
  }, [scopedTransactions]);

  /**
   * 목록 위 요약 줄. 보기마다 말이 달라진다.
   *
   * ⚠️ '확인 필요' 는 금액을 합치지 않는다. 분류가 안 끝난 금액을 더해서
   *    보여주면 확정된 지출 합계처럼 읽힌다.
   */
  const summary = useMemo(() => {
    const rows = visibleTransactions;
    if (view === "REVIEW") {
      return { label: `확인할 거래 ${rows.length}건`, value: "확인 후 반영" };
    }
    if (view === "DEPOSIT") {
      const total = rows.reduce((sum, t) => sum + t.amount, 0);
      return {
        label: `입금 ${rows.length}건`,
        value: `+${total.toLocaleString("ko-KR")}원`,
      };
    }
    /**
     * ⚠️ 환불 완료·취소는 지출 합계에서 뺀다. getFundTotals() 와 같은 기준이다.
     *    돌려받은 돈을 쓴 돈으로 세면 화면과 잔액이 어긋난다.
     */
    const spent = rows
      .filter((t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL)
      .filter(
        (t) => !isRefundRelated(t) || t.refund_status === REFUND_STATUS.PENDING,
      )
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      label:
        view === "SPEND" ? `지출 ${rows.length}건` : `전체 ${rows.length}건`,
      value: `−${spent.toLocaleString("ko-KR")}원`,
    };
  }, [view, visibleTransactions]);

  // 날짜별로 묶는다. 거래는 이미 occurred_at 내림차순으로 온다.
  const sections = useMemo(() => {
    const byCategory = new Map(
      (data?.categories ?? []).map((c) => [c.id, c.category_code]),
    );
    const groups: { title: string; total: number; data: Transaction[] }[] = [];

    for (const transaction of visibleTransactions) {
      const when = parseISO(transaction.occurred_at);
      const last = groups[groups.length - 1];
      if (last && isSameDay(parseISO(last.data[0].occurred_at), when)) {
        last.data.push(transaction);
      } else {
        groups.push({
          title: format(when, "M월 d일"),
          total: 0,
          data: [transaction],
        });
      }
    }

    // 날짜별 출금 합계. 입금은 자금 유입이라 지출 합계에 넣지 않는다.
    for (const group of groups) {
      group.total = group.data
        .filter((t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL)
        .reduce((sum, t) => sum + t.amount, 0);
    }

    return groups.map((group) => ({
      ...group,
      data: group.data.map((transaction) => ({
        transaction,
        categoryCode: transaction.budget_category_id
          ? ((byCategory.get(transaction.budget_category_id) as
              CategoryCode | undefined) ?? null)
          : null,
      })),
    }));
  }, [data?.categories, view, visibleTransactions]);

  /** 필터 칩 옆에 적는 이름들. '식비 · 교통 · 쇼핑' */
  const selectedCategoryLabels = useMemo(() => {
    if (selectedCategoryIds.length === 0) return "";
    const wanted = new Set(selectedCategoryIds);
    return (data?.categories ?? [])
      .filter((category) => wanted.has(category.id))
      .map(
        (category) =>
          CATEGORY_CODE_LABEL[category.category_code as CategoryCode],
      )
      .join(" · ");
  }, [data?.categories, selectedCategoryIds]);

  const title = categoryLabel ? `${categoryLabel} 지출` : "전체 지출내역";

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title }} />
        <Loading message="내역을 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title }} />
        <EmptyState
          icon="receipt-outline"
          title="여행을 찾을 수 없어요"
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
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title }} />
        <ErrorState
          message="내역을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  /*
    ⚠️ 목록이 비었다고 화면 전체를 EmptyState 로 갈아끼우지 않는다.
       그러면 보기 탭·필터·요약 줄까지 같이 사라져, 방금 고른 조건을 되돌릴
       방법이 없어진다. 비어 있음은 **목록 자리에서만** 말한다.
  */

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title }} />

      {/*
        연결 계좌 안내는 여기서만 보여준다.
        카테고리 화면(BUDGET-02)에서는 지출 자체에 집중하도록 숨겼다.
      */}
      {data.maskedAccountNumber ? (
        <View
          className="flex-row items-center gap-2.5"
          style={{
            paddingHorizontal: 16,
            paddingVertical: 13,
            backgroundColor: "#f5f7fa",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="card-outline" size={16} color="#5d6674" />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#121a2a" }}>
              연결 계좌 자동 분류
            </Text>
            <Text style={{ fontSize: 9, color: "#7d8797", marginTop: 3 }}>
              {data.maskedAccountNumber}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: "#e8f7f0",
              borderRadius: 20,
              paddingHorizontal: 7,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: "900", color: "#2d8a63" }}>
              연결됨
            </Text>
          </View>
        </View>
      ) : null}

      {/*
        ── 보기 ── (시안 v1)
        네 가지 중 하나를 고른다. 정렬을 따로 두지 않는다 —
        칩 한 줄 + 정렬 토글 한 줄이면 목록보다 조작부가 커진다.
      */}
      <View
        className="flex-row"
        style={{ gap: 7, paddingHorizontal: 16, paddingTop: 12 }}
      >
        {(
          [
            {
              key: "ALL",
              label: counts.all > 0 ? `전체 ${counts.all}` : "전체",
            },
            {
              key: "DEPOSIT",
              label: counts.deposit > 0 ? `입금 ${counts.deposit}` : "입금",
            },
            {
              key: "SPEND",
              label: counts.spend > 0 ? `지출 ${counts.spend}` : "지출",
            },
            {
              key: "REVIEW",
              label:
                counts.review > 0 ? `확인 필요 ${counts.review}` : "확인 필요",
            },
          ] as const
        ).map((chip) => {
          const active = view === chip.key;
          return (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setView(chip.key)}
              className="active:opacity-70"
              style={{
                paddingHorizontal: 11,
                paddingVertical: 7,
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
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/*
        ── 카테고리 필터 ──
        ⚠️ ?categoryId= 로 들어온 화면에는 그리지 않는다. 이미 그 카테고리로
           좁혀진 목록이라, 여기서 또 카테고리를 고르면 두 조건이 겹쳐
           무엇 때문에 비었는지 알 수 없다.
      */}
      {!categoryId ? (
        <View
          className="flex-row items-center"
          style={{ gap: 8, paddingHorizontal: 16, paddingTop: 10 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카테고리로 거르기"
            onPress={() => setFilterDraft(selectedCategoryIds)}
            className="flex-row items-center active:opacity-70"
            style={{
              gap: 4,
              paddingHorizontal: 11,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor:
                selectedCategoryIds.length > 0 ? theme.primary : "#e5e8ec",
              backgroundColor:
                selectedCategoryIds.length > 0 ? theme.primarySoft : "#fff",
            }}
          >
            <Ionicons
              name="options-outline"
              size={13}
              color={selectedCategoryIds.length > 0 ? theme.primary : "#687281"}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: selectedCategoryIds.length > 0 ? "800" : "400",
                color:
                  selectedCategoryIds.length > 0 ? theme.primary : "#687281",
              }}
            >
              {selectedCategoryIds.length > 0
                ? `카테고리 ${selectedCategoryIds.length}`
                : "카테고리"}
            </Text>
          </Pressable>

          {selectedCategoryIds.length > 0 ? (
            <>
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontSize: 11, color: "#8b94a2" }}
              >
                {selectedCategoryLabels}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="카테고리 필터 지우기"
                onPress={() => setSelectedCategoryIds([])}
                className="active:opacity-70"
                style={{ paddingHorizontal: 4, paddingVertical: 4 }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "800", color: "#687281" }}
                >
                  초기화
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {/* 요약 줄. 지금 보고 있는 게 무엇이고 얼마인지 한 줄로 말한다 */}
      <View
        className="flex-row items-center justify-between"
        style={{
          marginHorizontal: 16,
          marginTop: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: "#f5f6f8",
        }}
      >
        <Text style={{ fontSize: 11, color: "#687281" }}>{summary.label}</Text>
        <Text style={{ fontSize: 13, fontWeight: "900", color: "#121a2a" }}>
          {summary.value}
        </Text>
      </View>

      <SectionList
        ListEmptyComponent={
          <View style={{ paddingTop: 40 }}>
            <EmptyState
              icon="receipt-outline"
              title={
                selectedCategoryIds.length > 0 || view !== "ALL"
                  ? "조건에 맞는 거래가 없어요"
                  : "아직 거래 내역이 없어요"
              }
              description={
                selectedCategoryIds.length > 0 || view !== "ALL"
                  ? "보기나 카테고리를 바꿔 보세요."
                  : "계좌를 연결하거나 지출을 직접 입력하면 여기에 쌓여요."
              }
            />
          </View>
        }
        sections={sections}
        keyExtractor={(item) => item.transaction.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          // 제목이 빈 섹션(큰 금액순)은 머리글 자리를 비운다
          section.title === "" ? (
            <View style={{ height: 12 }} />
          ) : (
            <View
              className="flex-row items-center justify-between"
              style={{
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 8,
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "800", color: "#121a2a" }}
              >
                {section.title}
              </Text>
              {section.total > 0 ? (
                <Text style={{ fontSize: 11, color: "#8b94a2" }}>
                  지출 {section.total.toLocaleString("ko-KR")}원
                </Text>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => {
          const { transaction, categoryCode } = item;
          const reason = reviewReason(transaction);
          const iconInput = {
            transactionType: transaction.transaction_type as TransactionType,
            refundStatus: transaction.refund_status as RefundStatus,
            categoryCode,
          };
          const sign = amountSign(iconInput);
          /*
            ⚠️ 남이 적은 거래는 밀어도 수정·삭제가 안 나온다. (2026-09-22 테스트)
               RLS 가 기록자만 고치게 되어 있어, 보여 주면 눌렀다가 실패한다.
               판정은 lib/trip/transactionPermission 한 곳에서 한다.
          */
          const editable = canEditTransaction(transaction, userId);

          return (
            <Swipeable
              ref={(node) => {
                // 화면에서 사라진 행의 참조는 지운다. 안 지우면 계속 쌓인다.
                if (node) swipeRefs.current.set(transaction.id, node);
                else swipeRefs.current.delete(transaction.id);
              }}
              overshootRight={false}
              enabled={editable}
              renderRightActions={() => (
                <View className="flex-row">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="거래 상세 열기"
                    onPress={() => {
                      closeSwipe(transaction.id);
                      // 수정은 상세 화면에서 한다 (FUND-03)
                      router.push(
                        `/trips/${data.trip.id}/funds/transactions/${transaction.id}`,
                      );
                    }}
                    style={{ width: 72, backgroundColor: "#4b5563" }}
                    className="items-center justify-center"
                  >
                    <Ionicons name="pricetag-outline" size={17} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: "800",
                        marginTop: 3,
                      }}
                    >
                      수정
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="거래 삭제"
                    onPress={() => {
                      closeSwipe(transaction.id);
                      handleDelete(transaction);
                    }}
                    style={{ width: 72, backgroundColor: "#e1394a" }}
                    className="items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={17} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: "800",
                        marginTop: 3,
                      }}
                    >
                      삭제
                    </Text>
                  </Pressable>
                </View>
              )}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${transaction.name ?? "이름 없는 거래"} 상세 보기`}
                /* 상세는 별도 화면이다 (FUND-03) */
                /* 목록에서는 시트로 연다 (시안 v1). 다른 화면에서 오는 딥링크만 전체 화면 */
                onPress={() => txSheet.open(transaction)}
                className="flex-row items-center gap-3 active:bg-gray-50"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderColor: "#f1f3f5",
                  backgroundColor: "#fff",
                }}
              >
                {/* 아이콘 규칙은 한 군데서 정한다 (lib/constants/transactionIcon.ts) */}
                <View
                  style={{
                    width: 39,
                    height: 39,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#f5f7f9",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>
                    {transactionIcon(iconInput)}
                  </Text>
                </View>

                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 14, color: "#121a2a" }}
                  >
                    {transaction.name ?? "이름 없는 거래"}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: "#8b94a2", marginTop: 3 }}
                  >
                    {[
                      categoryCode
                        ? CATEGORY_CODE_LABEL[categoryCode]
                        : "미분류",
                      transaction.source_type === TRANSACTION_SOURCE_TYPE.MANUAL
                        ? "직접 입력"
                        : "연결 계좌",
                      /*
                        누가 적었는지. 모임 여행에서만 채워져 있다. 옛 기록·계좌
                        거래는 created_by_user_id 가 null 이라 아무것도 붙지 않는다.
                      */
                      transaction.created_by_user_id
                        ? data.memberNameById.get(transaction.created_by_user_id)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {/* 왜 확인이 필요한지 이유를 적는다. 배지만 달면 뭘 고칠지 모른다 */}
                  {reason ? (
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: theme.primary,
                        marginTop: 3,
                      }}
                    >
                      {reviewReasonLabel(reason)}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: sign === "+" ? theme.primary : "#121a2a",
                    }}
                  >
                    {sign}
                    {transaction.amount.toLocaleString("ko-KR")}원
                  </Text>
                  {/* 할 일이 있는 줄에만 말이 붙는다 */}
                  {statusLabel({ ...iconInput, needsReview: reason !== null }) ? (
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 9,
                        fontWeight: "700",
                        color: reason ? "#e83d4d" : "#a3a9b3",
                      }}
                    >
                      {statusLabel({
                        ...iconInput,
                        needsReview: reason !== null,
                      })}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Swipeable>
          );
        }}
      />

      {/*
        ── 거래 상세 ── (2026-09-21 4차)

        ⚠️ 여행자금·카테고리 예산과 **같은 시트**를 쓴다. 예전에는 이 화면만
           따로 그려서, 여기서는 수정·삭제가 없고 '카테고리 변경' 을 누르면
           시트 위에 시트를 열다가 화면이 먹통이 됐다.
      */}
      <TransactionSheet controller={txSheet} theme={theme} />


      {/*
        ── 카테고리 필터 ──
        ⚠️ 시트 안에서는 draft 로만 고른다. 고를 때마다 목록이 바뀌면
           시트에 가려 결과가 안 보이고, 취소할 방법도 없다.
      */}
      <BottomSheet
        visible={filterDraft !== null}
        title="카테고리로 보기"
        description="여러 개를 고를 수 있어요."
        onClose={() => setFilterDraft(null)}
      >
        <View className="flex-row flex-wrap" style={{ gap: 8, paddingTop: 14 }}>
          {(data?.categories ?? []).map((category) => {
            const code = category.category_code as CategoryCode;
            const picked = (filterDraft ?? []).includes(category.id);
            return (
              <Pressable
                key={category.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }}
                onPress={() =>
                  setFilterDraft((prev) => {
                    const current = prev ?? [];
                    return picked
                      ? current.filter((id) => id !== category.id)
                      : [...current, category.id];
                  })
                }
                className="flex-row items-center active:opacity-70"
                style={{
                  gap: 6,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: picked ? theme.primary : "#e5e8ec",
                  backgroundColor: picked ? theme.primarySoft : "#fff",
                }}
              >
                <Text style={{ fontSize: 14 }}>{CATEGORY_EMOJI[code]}</Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: picked ? "800" : "500",
                    color: picked ? theme.primary : "#3d4654",
                  }}
                >
                  {CATEGORY_CODE_LABEL[code]}
                </Text>
                {picked ? (
                  <Ionicons
                    name="checkmark"
                    size={13}
                    color={theme.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row" style={{ gap: 10, paddingTop: 18 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFilterDraft([])}
            className="items-center justify-center active:opacity-70"
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e5e8ec",
            }}
          >
            <Text
              style={{ fontSize: 13, fontWeight: "800", color: "#687281" }}
            >
              전체 해제
            </Text>
          </Pressable>
          <View style={{ flex: 2 }}>
            <Button
              label={
                (filterDraft ?? []).length > 0
                  ? `${(filterDraft ?? []).length}개 적용하기`
                  : "전체 보기"
              }
              onPress={() => {
                setSelectedCategoryIds(filterDraft ?? []);
                setFilterDraft(null);
              }}
            />
          </View>
        </View>
      </BottomSheet>

    </View>
  );
}
