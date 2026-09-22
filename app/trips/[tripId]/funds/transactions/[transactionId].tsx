// ============================================================================
// FUND-03 거래 상세  ·  /trips/:tripId/funds/transactions/:transactionId
//
// ⚠️ 2026-09-03 · **바텀시트에서 별도 화면으로 옮겼다.** (시안 v1 흐름)
//    SETTLE-01 주요 지출 · BUDGET-02 연결 계획 · FUND-01 전체 내역에서
//    곧장 들어오는 자리다. 시트로 두면 뒤로가기가 목록을 거치지 않고 바로
//    닫혀 "어디서 왔는지" 가 사라진다.
//
// 여기서 하는 일
//   ① 거래 한 건의 모든 값을 보여준다
//   ② 예산 카테고리 지정·변경
//   ③ 계획 항목 연결 / 연결 해제   ← **연결 해제는 여기서만 한다** (스펙 9장)
//   ④ 삭제
//
// ⚠️ 입금에는 카테고리·계획 연결을 두지 않는다. 입금은 자금이 들어온 것이지
//    예산을 쓴 게 아니다. 카테고리가 붙으면 그 예산의 실제 사용액이 부풀려진다.
//
// 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/fund/.
// ============================================================================
import { format, parseISO } from "date-fns";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { TripHomeButton } from "@/components/navigation/TripHomeButton";
import { isTripEnded } from "@/lib/trip/tripStatus";
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
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { sortPlansByMatch } from "@/lib/budget/planMatch";
import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  CATEGORY_CODE_LABEL,
  CATEGORY_CODE_TO_ANALYTICS,
  CATEGORY_METHOD,
  MAPPED_BY,
  REFUND_STATUS,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  TRIP_STATUS,
  type CategoryCode,
  type TripStatus,
} from "@/lib/constants/status";
import {
  getBudgetByTripId,
  getBudgetCategories,
  getBudgetPlanItems,
  type BudgetCategory,
  type BudgetPlanItem,
} from "@/lib/supabase/queries/budgets";
import { getGroupAccounts } from "@/lib/supabase/queries/funds";
import { listActiveTripMembers } from "@/lib/supabase/queries/tripMembers";
import {
  deleteTransaction,
  getTransactionById,
  reviewReason,
  updateManualTransaction,
  updateTransactionMapping,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";
import { useTripContext } from '@/lib/hooks/useTripContext';

/**
 * 확인이 필요한 이유별 안내 문구.
 *
 * ⚠️ AUTO_GUESS 와 LOW_CONFIDENCE 를 갈라 쓴다. 직접 적은 거래를 추측해
 *    붙인 경우는 확신도가 95% 여도 확인을 받는데, 여기에 "확신이 낮아요" 를
 *    쓰면 같은 화면에 적힌 신뢰도 95% 와 정면으로 어긋난다.
 */
const REVIEW_NOTE: Record<string, string> = {
  UNCATEGORIZED:
    "아직 예산 카테고리가 없어요. 카테고리를 정하면 해당 예산의 실제 사용액에 반영돼요.",
  LOW_CONFIDENCE: "자동으로 분류했지만 확신이 낮아요. 맞는지 확인해 주세요.",
  AUTO_GUESS:
    "직접 적은 거래를 거래명으로 추측해 분류했어요. 맞는지 확인해 주세요.",
  REFUND_PENDING:
    "환불이 예정된 거래예요. 아직 돈이 돌아오지 않아 지출에는 남아 있어요.",
  NONE: "",
};

type DetailData = {
  trip: Trip;
  transaction: Transaction;
  categories: BudgetCategory[];
  planItems: BudgetPlanItem[];
  /** 마스킹된 계좌번호. 연결 계좌가 없으면 null (NFR-002) */
  maskedAccountNumber: string | null;
  /**
   * 이 거래를 적은 사람 이름. 모임 여행에서 created_by_user_id 가 있을 때만.
   * 옛 기록·계좌 거래·개인 여행은 null — 모르는 것을 지어내지 않는다.
   */
  authorName: string | null;
};

export default function ScreenFUND03() {
  const { tripId, transactionId, from } = useLocalSearchParams<{
    tripId: string;
    transactionId: string;
    /**
     * 어디서 들어왔는가. 뒤로 갈 곳을 정한다.
     *   'settlement' 결산 화면
     *   없음          전체 입출금 내역 (기본)
     */
    from?: string;
  }>();

  /*
    ⚠️⚠️ 뒤로가기는 **들어온 곳**으로 돌려보낸다. (2026-09-21 2차) ⚠️⚠️

       예전에는 무조건 전체 입출금 내역으로 갔고, 거기서 또 누르면 여행자금
       으로 갔다. 결산에서 주요 지출 한 건을 눌러 본 사람은 **본 적도 없는
       화면 두 개를 지나 여행자금까지 끌려갔다.** 결산으로 돌아갈 길이 없었다.
  */
  const parentHref =
    from === "settlement"
      ? `/trips/${tripId}/settlement`
      : `/trips/${tripId}/funds/transactions`;
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** 화면 아래에 잠깐 떴다 사라지는 알림. 누른 것에 대한 즉답에만 쓴다 */
  const floatingToast = useToast();

  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  /** 연결 시트에서 고른 계획. 저장을 눌러야 실제로 붙는다 */
  const [pickedPlanId, setPickedPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 수기 거래 내용 수정 시트 */
  const [editingManual, setEditingManual] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState<number | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId || !transactionId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const [trip, transaction] = await Promise.all([
        getTripById(tripId),
        getTransactionById(transactionId),
      ]);
      // 다른 여행의 거래를 주소로 열어도 보여주지 않는다 (CLAUDE.md 7장)
      if (!trip || !transaction || transaction.trip_id !== trip.id) {
        setNotFound(true);
        return;
      }

      const budget = await getBudgetByTripId(trip.id);
      const [categories, accounts, members] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        trip.group_id ? getGroupAccounts(trip.group_id) : Promise.resolve([]),
        /*
          ⚠️ 모임 여행이고 적은 사람이 남아 있을 때만 참여자를 읽는다.
             실패해도 상세를 막지 않는다 — 이름 없이 그린다.
             (2026-09-22 테스트 — 입력자 이름이 최근 내역에만 보였다)
        */
        trip.group_id && transaction.created_by_user_id
          ? listActiveTripMembers(trip.id).catch(() => [])
          : Promise.resolve([]),
      ]);
      const authorName = transaction.created_by_user_id
        ? (members.find(
            (member) => member.user_id === transaction.created_by_user_id,
          )?.name ?? null)
        : null;

      /*
        ⚠️ 세부 계획은 **카테고리마다** 읽는다. getBudgetPlanItems 가 거르는 칸은
           budget_category_id 다. 여기서 budget.id 를 넘기고 있어서 결과가 늘
           0건이었고, 계획이 있어도 연결 시트에 "아직 세부 계획이 없어요" 가 떴다.
           거래를 계획에 붙이는 길 자체가 막혀 있었다. (2026-09-21 테스트)
           FUND-01 목록(transactions/index.tsx)이 읽는 방식과 같게 맞춘다.
      */
      const planItems = (
        await Promise.all(
          categories.map((category) => getBudgetPlanItems(category.id)),
        )
      ).flat();

      setData({
        trip,
        transaction,
        categories,
        planItems,
        maskedAccountNumber: accounts[0]?.masked_account_number ?? null,
        authorName,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [transactionId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 계획 항목에 연결하거나 연결을 푼다.
   *
   * ⚠️ 연결하면 그 계획의 카테고리로 거래도 함께 옮긴다.
   *    계획은 항공인데 거래는 식비로 남아 있으면 두 화면이 다른 말을 한다.
   */
  const handleLinkPlan = useCallback(
    async (planItemId: string | null) => {
      if (!data || busy) return;
      setBusy(true);
      try {
        const item = planItemId
          ? (data.planItems.find((plan) => plan.id === planItemId) ?? null)
          : null;

        await updateTransactionMapping(data.transaction.id, {
          categoryId: item
            ? item.budget_category_id
            : data.transaction.budget_category_id,
          budgetItemId: planItemId,
          categoryMethod: item
            ? CATEGORY_METHOD.USER
            : data.transaction.category_method,
        });

        if (planItemId) {
          track(EVENTS.TRANSACTION_LINKED_TO_ITEM, {
            trip_id: data.trip.id,
            item_id: planItemId,
          });
        }

        setLinking(false);
        await load();
        setToast(planItemId ? "계획에 연결했어요" : "계획 연결을 풀었어요");
      } catch {
        setToast("연결을 저장하지 못했어요");
      } finally {
        setBusy(false);
      }
    },
    [busy, data, load],
  );

  const handleChangeCategory = useCallback(
    async (nextCategoryId: string) => {
      if (!data || busy) return;
      setBusy(true);
      try {
        await updateTransactionMapping(data.transaction.id, {
          categoryId: nextCategoryId,
          // 사용자가 직접 고친 분류다. 자동분류 정확도를 재는 기준이 된다
          categoryMethod: CATEGORY_METHOD.USER,
        });

        const nextCode = data.categories.find(
          (c) => c.id === nextCategoryId,
        )?.category_code;
        if (nextCode) {
          // 자동분류가 틀려서 사용자가 고쳤다는 신호다. (docs/06 §7-3)
          track(EVENTS.TRANSACTION_CATEGORY_CORRECTED, {
            trip_id: data.trip.id,
            category: CATEGORY_CODE_TO_ANALYTICS[nextCode as CategoryCode],
            mapped_by: MAPPED_BY.USER,
          });
        }

        setEditing(false);
        await load();
        setToast("카테고리를 바꿨어요");
      } catch {
        setToast("카테고리를 저장하지 못했어요");
      } finally {
        setBusy(false);
      }
    },
    [busy, data, load],
  );

  /**
   * 확인 완료. 자동 분류가 맞다고 사용자가 확인한 것이다.
   *
   * ⚠️ 카테고리가 없는 거래에는 쓸 수 없다. 무엇으로 확정할지가 없다.
   *    그때는 카테고리 변경이 먼저다.
   *
   * ⚠️ category_method 를 USER 로 올린다. 그래야 reviewReason() 이 더는
   *    확인 대상으로 잡지 않는다. 자동분류 정확도 지표에도
   *    '사람이 확인함' 으로 남는다. (docs/06 §7-3)
   */
  const handleConfirmReview = useCallback(async () => {
    if (!data || busy) return;
    if (!data.transaction.budget_category_id) {
      setToast("먼저 카테고리를 정해 주세요");
      return;
    }
    setBusy(true);
    try {
      await updateTransactionMapping(data.transaction.id, {
        categoryId: data.transaction.budget_category_id,
        budgetItemId: data.transaction.budget_plan_item_id,
        categoryMethod: CATEGORY_METHOD.USER,
      });
      await load();
      setToast("거래 분류를 완료했어요");
    } catch {
      setToast("저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  }, [busy, data, load]);

  // 삭제는 되돌릴 수 없다. 먼저 확인한다. (NFR-003)
  /** 수정 시트를 연다. 지금 값을 초안에 담아 둔다 */
  const openManualEdit = useCallback(() => {
    if (!data) return;
    setDraftName(data.transaction.name ?? "");
    setDraftAmount(data.transaction.amount);
    setDraftError(null);
    setEditingManual(true);
  }, [data]);

  /**
   * 수기 거래 내용 저장.
   *
   * ⚠️ 거래일은 건드리지 않는다. 이번에 여는 것은 이름과 금액이다 —
   *    테스트에서 고치고 싶다고 한 것이 그 둘이다. 날짜까지 열면 달력
   *    컴포넌트가 붙고 확인할 것이 늘어난다. 필요해지면 그때 연다.
   */
  const handleSaveManual = useCallback(async () => {
    if (!data || busy) return;
    const amount = draftAmount ?? 0;
    if (amount <= 0) {
      setDraftError("금액을 1원 이상 넣어 주세요.");
      return;
    }
    setBusy(true);
    try {
      await updateManualTransaction(data.transaction.id, {
        name: draftName.trim() === "" ? null : draftName.trim(),
        amount,
        occurredAt: data.transaction.occurred_at,
      });
      setEditingManual(false);
      setToast("수정했어요");
      await load();
    } catch {
      setDraftError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [busy, data, draftAmount, draftName, load]);

  const handleDelete = useCallback(() => {
    if (!data) return;
    const { transaction } = data;
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
              .then(() => router.back())
              .catch(() => setToast("삭제하지 못했어요"));
          },
        },
      ],
    );
  }, [data]);

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "거래 상세" }} />
        <Loading message="거래를 불러오는 중…" />
      </View>
    );
  }
  if (notFound || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "거래 상세" }} />
        <EmptyState
          icon="receipt-outline"
          title="거래를 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 거래예요."
          actionLabel="돌아가기"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "거래 상세" }} />
        <ErrorState
          message="거래를 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const theme = countryTheme(
    findDestinationByName(data.trip.destination)?.countryKo,
  );
  const { transaction } = data;
  const deposit = transaction.transaction_type === TRANSACTION_TYPE.DEPOSIT;
  const reason = reviewReason(transaction);

  /**
   * 결산이 확정된 여행은 고칠 수 없다. (IA v2 §2-6-3)
   * 확정 뒤에 분류를 바꾸면 이미 남은 결산 스냅샷과 어긋난다.
   */
  const settled = (data.trip.status as TripStatus) === TRIP_STATUS.SETTLED;
  const canEdit = !deposit && !settled;
  /*
    ⚠️ 직접 적은 거래는 이름·금액·거래일을 고칠 수 있다. (2026-09-21 테스트 —
       "수기 입력 후 수정 불가") 잘못 적으면 지우고 다시 넣는 수밖에 없었다.
    ⚠️ 계좌에서 들어온 거래는 못 고친다. 실제 결제 기록이라 앱에서 금액을
       바꾸면 계좌 내역과 어긋난다. 입금·출금 둘 다 열어 준다 — 모임 입금을
       손으로 적는 일이 잦다.
  */
  /**
   * 이 거래를 붙일 수 있는 계획 후보.
   *
   * ⚠️ **같은 카테고리**의 계획만 본다. (2026-09-21 2차) 예전에는 여덟
   *    카테고리의 계획이 전부 나와서, 식비 지출을 항공 계획에 붙일 수
   *    있었다. 붙으면 그 거래가 항공 카테고리로 통째로 옮겨 간다.
   *    전체 내역 화면(transactions/index.tsx)이 쓰는 기준과 같게 맞춘다.
   *
   * ⚠️ 한 계획에 여러 지출이 붙는 것은 **막지 않는다.** '편의점' 계획 하나에
   *    로손·세븐일레븐·패밀리마트가 모두 붙는 게 맞다. 계획의 실제 금액은
   *    붙은 거래를 다시 합산해서 넣는다.
   */
  const planCandidates = transaction.budget_category_id
    ? data.planItems.filter(
        (item) => item.budget_category_id === transaction.budget_category_id,
      )
    : [];

  /** 연결 시트 제목의 카테고리. 어느 예산의 계획 목록인지 알린다 */
  const linkingCategoryLabel = transaction.budget_category_id
    ? (() => {
        const code = data.categories.find(
          (c) => c.id === transaction.budget_category_id,
        )?.category_code as CategoryCode | undefined;
        return code ? `[${CATEGORY_CODE_LABEL[code]}]` : "";
      })()
    : "";

  const canEditManual =
    !settled &&
    transaction.source_type === TRANSACTION_SOURCE_TYPE.MANUAL;

  const rows: [string, string][] = [
    ["거래명", transaction.name ?? "이름 없는 거래"],
    ["거래일", format(parseISO(transaction.occurred_at), "yyyy년 M월 d일")],
    // 누가 적었는지. 모임 여행에서만 채워져 있다
    ...(data.authorName
      ? ([["기록한 사람", data.authorName]] as [string, string][])
      : []),
    ...(deposit
      ? []
      : ([
          [
            "예산 카테고리",
            transaction.budget_category_id
              ? (CATEGORY_CODE_LABEL[
                  (data.categories.find(
                    (c) => c.id === transaction.budget_category_id,
                  )?.category_code ?? "") as CategoryCode
                ] ?? "미분류")
              : "미분류",
          ],
          [
            "분류 방식",
            transaction.category_method === CATEGORY_METHOD.AUTO
              ? `자동 분류${transaction.category_confidence !== null ? ` · 신뢰도 ${transaction.category_confidence}%` : ""}`
              : transaction.category_method === CATEGORY_METHOD.USER
                ? "직접 지정"
                : "분류 전",
          ],
          [
            "연결 계좌",
            transaction.financial_account_id
              ? (data.maskedAccountNumber ?? "연결 계좌")
              : "직접 입력",
          ],
          [
            "연결된 계획",
            transaction.budget_plan_item_id
              ? (data.planItems.find(
                  (plan) => plan.id === transaction.budget_plan_item_id,
                )?.name ?? "계획에 연결됨")
              : "연결 안 됨",
          ],
        ] as [string, string][])),
    [
      "환불·취소",
      transaction.refund_status === REFUND_STATUS.PENDING
        ? "환불 예정"
        : transaction.refund_status === REFUND_STATUS.REFUNDED
          ? "환불 완료"
          : transaction.refund_status === REFUND_STATUS.CANCELED
            ? "결제 취소"
            : "해당 없음",
    ],
  ];

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={parentHref} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "거래 상세" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 40,
        }}
      >
        <Text style={{ fontSize: 11, color: "#858e9c" }}>
          {deposit ? "입금" : "출금"}
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontSize: 32,
            fontWeight: "900",
            letterSpacing: -1.4,
            color: deposit ? theme.primary : "#141b28",
          }}
        >
          {deposit ? "+" : "−"}
          {transaction.amount.toLocaleString("ko-KR")}
          <Text style={{ fontSize: 15, letterSpacing: 0 }}>원</Text>
        </Text>

        <View
          style={{ marginTop: 18, borderTopWidth: 1, borderColor: "#e5e8ec" }}
        >
          {rows.map(([label, value]) => (
            <View
              key={label}
              className="flex-row items-center justify-between"
              style={{
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: "#f1f3f5",
              }}
            >
              <Text style={{ fontSize: 11, color: "#858e9c" }}>{label}</Text>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#141b28" }}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>

        {reason ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 11,
              backgroundColor: "#f5f6f8",
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 16, color: "#687281" }}>
              {REVIEW_NOTE[reason ?? "NONE"]}
            </Text>
          </View>
        ) : null}

        {settled ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 11,
              backgroundColor: "#eef2f8",
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 11, lineHeight: 16, color: "#5d6674" }}>
              결산이 확정돼 이 거래는 고칠 수 없어요. 기록을 보는 화면이에요.
            </Text>
          </View>
        ) : null}

        {/*
          ⚠️ 직접 적은 거래의 '내용 수정'. 입금·출금 둘 다 낸다.
             카테고리 변경(canEdit)은 출금에만 있어서 그 묶음 밖에 따로 둔다 —
             모임 입금을 손으로 적어 놓고 못 고치던 것이 이번 지적이다.
             (2026-09-21 테스트)
        */}
        {canEditManual ? (
          <View style={{ marginTop: 22 }}>
            <Button
              label="내용 수정"
              variant="secondary"
              onPress={openManualEdit}
            />
          </View>
        ) : null}

        {canEdit ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <View className="flex-row" style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="카테고리 변경"
                  variant="secondary"
                  onPress={() => setEditing(true)}
                />
              </View>
              <View style={{ flex: 1 }}>
                {/* 연결 해제는 여기서만 한다. BUDGET-02 에서는 못 푼다 (스펙 9장) */}
                <Button
                  label={
                    transaction.budget_plan_item_id ? "연결 해제" : "계획 연결"
                  }
                  variant="secondary"
                  loading={busy}
                  onPress={() => {
                    if (transaction.budget_plan_item_id) {
                      void handleLinkPlan(null);
                      return;
                    }
                    /*
                      ⚠️ 계획이 없으면 **시트를 열지 않는다.** (2026-09-21 2차)
                         빈 시트를 열어 "아직 세부 계획이 없어요" 를 읽히고
                         다시 닫게 하는 건 한 걸음이 헛돈다. 눌린 자리에서
                         바로 답한다.
                    */
                    if (planCandidates.length === 0) {
                      floatingToast.show(
                        transaction.budget_category_id
                          ? "이 카테고리에 연결할 세부 계획이 없어요. 예산 상세에서 계획을 먼저 만들어 주세요."
                          : "카테고리를 먼저 정해 주세요. 그 카테고리의 계획에만 연결할 수 있어요.",
                      );
                      return;
                    }
                    setLinking(true);
                  }}
                />
              </View>
            </View>

            {/*
              ⚠️ 확인이 필요한 거래에만 낸다. (시안 v1)
                 확정된 거래에 '확인 완료' 가 있으면 사용자는 매번 눌러야
                 하는 줄 안다.
            */}
            {reason ? (
              <Button
                label="확인 완료"
                loading={busy}
                onPress={() => void handleConfirmReview()}
              />
            ) : null}

            <Text
              accessibilityRole="button"
              accessibilityLabel="이 거래 삭제"
              onPress={handleDelete}
              style={{
                marginTop: 6,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "700",
                color: "#a8afb9",
              }}
            >
              이 거래 삭제
            </Text>
          </View>
        ) : null}

        {toast ? (
          <Text
            style={{
              marginTop: 16,
              textAlign: "center",
              fontSize: 11,
              color: "#687281",
            }}
          >
            {toast}
          </Text>
        ) : null}
      </ScrollView>

      <Toast state={floatingToast.state} />

      {/* ── 수기 거래 내용 수정 ── */}
      <BottomSheet
        visible={editingManual}
        title="내용 수정"
        description="직접 적은 거래라 이름과 금액을 고칠 수 있어요. 거래일은 바꾸지 않아요."
        onClose={() => setEditingManual(false)}
      >
        <View style={{ paddingTop: 12, gap: 12 }}>
          <Input
            label="내용"
            value={draftName}
            onChangeText={setDraftName}
            placeholder="예: 8월 회비"
          />
          <CurrencyInput
            label="금액"
            value={draftAmount}
            onChangeValue={setDraftAmount}
          />
          {draftError ? (
            <Text style={{ fontSize: 11, color: "#e1394a" }}>{draftError}</Text>
          ) : null}
          <Button
            label="저장"
            loading={busy}
            onPress={() => void handleSaveManual()}
          />
        </View>
      </BottomSheet>

      {/*
        ── 계획 항목 연결 ──
        ⚠️ 무슨 거래를 붙이는 중인지 위에 적고, 제목에 카테고리를 넣는다.
           고른 뒤 저장을 눌러야 붙는다. 전체 내역 화면의 시트와 같은 방식이다.
      */}
      <BottomSheet
        visible={linking}
        title={`${linkingCategoryLabel} 세부 계획에 연결`}
        description="연결하면 그 계획에 이 결제 금액이 실제 사용으로 잡혀요."
        onClose={() => {
          setLinking(false);
          setPickedPlanId(null);
        }}
      >
        <View
          style={{
            marginTop: 12,
            padding: 13,
            borderRadius: 12,
            backgroundColor: "#f5f7f9",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: "#8b94a2" }}>연결할 지출</Text>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 3,
                fontSize: 13,
                fontWeight: "800",
                color: "#121a2a",
              }}
            >
              {transaction.name ?? "이름 없는 거래"}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 10, color: "#8b94a2" }}>
              {format(parseISO(transaction.occurred_at), "M월 d일")}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "900", color: "#121a2a" }}>
            {transaction.amount.toLocaleString("ko-KR")}원
          </Text>
        </View>

        {planCandidates.length === 0 ? (
          <Text
            style={{
              fontSize: 11,
              color: "#858e9c",
              paddingVertical: 20,
              textAlign: "center",
            }}
          >
            이 카테고리에 연결할 세부 계획이 없어요. 예산 상세에서 먼저 계획을
            만들어 주세요.
          </Text>
        ) : (
          <>
            <View
              style={{
                marginTop: 16,
                borderWidth: 1,
                borderColor: "#e5e8ec",
                borderRadius: 13,
                overflow: "hidden",
              }}
            >
              {sortPlansByMatch(planCandidates, transaction.name).map(
                ({ plan, score }, index) => {
                  const picked = pickedPlanId === plan.id;
                  return (
                    <Pressable
                      key={plan.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: picked }}
                      accessibilityLabel={`${plan.name} 계획 고르기`}
                      disabled={busy}
                      onPress={() => setPickedPlanId(plan.id)}
                      className="flex-row items-center active:bg-gray-50"
                      style={{
                        gap: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderColor: "#eceef1",
                        backgroundColor: picked ? theme.primarySoft : "#fff",
                      }}
                    >
                      <Ionicons
                        name={picked ? "radio-button-on" : "radio-button-off"}
                        size={17}
                        color={picked ? theme.primary : "#c2c8d0"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 13,
                            fontWeight: picked ? "800" : "600",
                            color: "#121a2a",
                          }}
                        >
                          {plan.name}
                          {score > 0 ? (
                            <Text style={{ fontSize: 10, color: theme.primary }}>
                              {"  추천"}
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#5d6674",
                        }}
                      >
                        {plan.expected_amount.toLocaleString("ko-KR")}원
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <View style={{ marginTop: 14 }}>
              <Button
                label="이 계획에 연결"
                loading={busy}
                disabled={pickedPlanId === null}
                onPress={() => {
                  if (pickedPlanId) void handleLinkPlan(pickedPlanId);
                }}
              />
            </View>
          </>
        )}
      </BottomSheet>

      {/* ── 카테고리 변경 ── */}
      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setEditing(false)}
        />
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 34,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#141b28" }}>
            예산 카테고리
          </Text>
          <Text style={{ marginTop: 6, fontSize: 11, color: "#858e9c" }}>
            바꾸면 이 카테고리의 실제 사용액에 반영돼요.
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{ gap: 8, marginTop: 16 }}
          >
            {data.categories.map((category) => {
              const active = category.id === transaction.budget_category_id;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={busy}
                  onPress={() => void handleChangeCategory(category.id)}
                  className="active:opacity-70"
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 9,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: active ? theme.primary : "#e5e8ec",
                    backgroundColor: active ? theme.primarySoft : "#fff",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
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
        </View>
      </Modal>
    </View>
  );
}
