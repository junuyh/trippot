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
import { Ionicons } from "@expo/vector-icons";
import { Alert, Modal, Pressable, SectionList, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Loading,
} from "@/components/ui";
import { SCREENS } from "@/lib/analytics/events";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  CATEGORY_CODE_LABEL,
  CATEGORY_METHOD,
  REFUND_STATUS,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  type CategoryCode,
} from "@/lib/constants/status";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { CATEGORY_CODE_TO_ANALYTICS, MAPPED_BY } from "@/lib/constants/status";
import { useScreenView } from "@/lib/hooks/useScreenView";
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
  updateTransactionMapping,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import { getGroupAccounts } from "@/lib/supabase/queries/funds";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

type FundsData = {
  trip: Trip;
  categories: BudgetCategory[];
  /** 이 여행의 모든 계획 항목. 거래를 계획에 연결할 때 후보로 쓴다 */
  planItems: BudgetPlanItem[];
  transactions: Transaction[];
  /** 마스킹된 계좌번호. 연결 계좌가 없으면 null (NFR-002) */
  maskedAccountNumber: string | null;
};

/** 목록 필터 */
type FundFilter = "ALL" | "REVIEW" | "REFUND";

/**
 * 정렬은 필터와 **다른 축**이다.
 *
 * ⚠️ 시안은 '큰 금액순' 을 필터 칩에 넣었는데, 그러면 '확인 필요' 를 보면서
 *    금액순으로 볼 수 없다. 확인할 거래 중 금액 큰 것부터 보는 건 자연스러운
 *    요구라 축을 갈랐다.
 */
type FundSort = "RECENT" | "AMOUNT_DESC" | "AMOUNT_ASC";

export default function ScreenFUND01() {
  const { tripId, categoryId, transactionId } = useLocalSearchParams<{
    tripId: string;
    categoryId?: string;
    transactionId?: string;
  }>();

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
      const [categories, transactions, accounts] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getTransactions(trip.id, categoryId ? { categoryId } : undefined),
        trip.group_id ? getGroupAccounts(trip.group_id) : Promise.resolve([]),
      ]);
      // 계획 항목은 카테고리별로 나뉘어 있어 한 번에 모은다
      const planItems = (
        await Promise.all(
          categories.map((category) => getBudgetPlanItems(category.id)),
        )
      ).flat();
      setData({
        trip,
        categories,
        planItems,
        transactions,
        maskedAccountNumber: accounts[0]?.masked_account_number ?? null,
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

  // ── 카테고리 변경 ─────────────────────────────────────────────────────
  /** 편집 중인 거래. null 이면 시트를 닫는다 */
  const [editing, setEditing] = useState<Transaction | null>(null);

  /**
   * 목록 필터. (IA v2 §2-4-2)
   *
   * ⚠️ '확인 필요' 는 지금 판정할 수 있는 것만 본다 —
   *    카테고리 없음 · 자동 분류 신뢰도 낮음.
   *    계획 연결 후보 다중 · 카드 승인↔출금 중복 · 환불·취소는
   *    판정할 칼럼이 없어 넣지 않았다. 없는 근거로 '확인 필요' 를 띄우면
   *    사용자는 무엇을 고쳐야 할지 알 수 없다.
   */
  const [filter, setFilter] = useState<FundFilter>("ALL");
  const [sort, setSort] = useState<FundSort>("RECENT");

  /** 거래 상세 시트에 띄울 거래 */
  const [detail, setDetail] = useState<Transaction | null>(null);
  /** ?transactionId= 로 들어왔을 때 한 번만 자동으로 연다 */
  const openedRef = useRef(false);

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
  const [busy, setBusy] = useState(false);

  /** 계획 연결 시트를 연 거래 */
  const [linking, setLinking] = useState<Transaction | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * 거래를 계획 항목에 연결하거나 연결을 푼다.
   *
   * ⚠️ 연결하면 그 계획의 카테고리로 거래도 함께 옮긴다.
   *    계획은 항공인데 거래는 식비로 남아 있으면 두 화면이 다른 말을 한다.
   *
   * ⚠️ 연결 해제는 **여기서만** 한다. BUDGET-02 에서는 못 푼다. (스펙 9장)
   *    계획 화면에서 풀면 이미 쓴 돈이 어디로 갔는지 모르게 된다.
   */
  const handleLinkPlan = useCallback(
    async (planItemId: string | null) => {
      if (!linking || !data || linkBusy) return;
      setLinkBusy(true);
      try {
        const item = planItemId
          ? (data.planItems.find((plan) => plan.id === planItemId) ?? null)
          : null;

        await updateTransactionMapping(linking.id, {
          categoryId: item
            ? item.budget_category_id
            : linking.budget_category_id,
          budgetItemId: planItemId,
          categoryMethod: item ? CATEGORY_METHOD.USER : linking.category_method,
        });

        if (planItemId) {
          track(EVENTS.TRANSACTION_LINKED_TO_ITEM, {
            trip_id: data.trip.id,
            item_id: planItemId,
          });
        }

        setLinking(null);
        setDetail(null);
        await load();
        setToast(planItemId ? "계획에 연결했어요" : "계획 연결을 풀었어요");
      } catch {
        setToast("연결을 저장하지 못했어요");
      } finally {
        setLinkBusy(false);
      }
    },
    [data, linkBusy, linking, load],
  );

  const handleChangeCategory = useCallback(
    async (nextCategoryId: string) => {
      if (!editing || !data || busy) return;
      setBusy(true);
      try {
        await updateTransactionMapping(editing.id, {
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

        setEditing(null);
        await load();
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, data, editing, load],
  );

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

  /** ?transactionId= 로 들어오면 그 거래 상세를 바로 연다 */
  useEffect(() => {
    if (!data || !transactionId || openedRef.current) return;
    const found = data.transactions.find((t) => t.id === transactionId);
    if (!found) return;
    openedRef.current = true;
    setDetail(found);
  }, [data, transactionId]);

  const visibleTransactions = useMemo(() => {
    // ⚠️ '전체' 는 입금까지 포함한다. 출금만 남기면 FUND-01 에서 '입출금 전체
    //    내역' 으로 들어왔는데 방금 넣은 입금이 사라져 빈 화면이 된다.
    //    좁히는 건 아래 필터가 한다.
    let rows = [...(data?.transactions ?? [])];
    if (filter === "REVIEW")
      rows = rows.filter((t) => reviewReason(t) !== null);
    if (filter === "REFUND") rows = rows.filter((t) => isRefundRelated(t));

    if (sort === "AMOUNT_DESC")
      rows = [...rows].sort((a, b) => b.amount - a.amount);
    if (sort === "AMOUNT_ASC")
      rows = [...rows].sort((a, b) => a.amount - b.amount);
    return rows;
  }, [data?.transactions, filter, sort]);

  /** '확인 필요' 배지에 쓸 건수 */
  const reviewCount = useMemo(
    () =>
      (data?.transactions ?? []).filter((t) => reviewReason(t) !== null).length,
    [data?.transactions],
  );

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
  }, [data?.categories, visibleTransactions]);

  const title = categoryLabel ? `${categoryLabel} 지출` : "여행자금 내역";

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
        <Loading message="내역을 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
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
        <Stack.Screen options={{ title }} />
        <ErrorState
          message="내역을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
        <EmptyState
          icon="receipt-outline"
          title="아직 거래 내역이 없어요"
          description="계좌를 연결하거나 지출을 직접 입력하면 여기에 쌓여요."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title }} />

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
        ── 필터와 정렬 ──
        두 줄로 나눈다. 한 줄에 섞으면 '확인 필요' 를 금액순으로 볼 수 없다.
      */}
      <View
        className="flex-row"
        style={{ gap: 7, paddingHorizontal: 16, paddingTop: 12 }}
      >
        {(
          [
            { key: "ALL", label: "전체" },
            {
              key: "REVIEW",
              label: reviewCount > 0 ? `확인 필요 ${reviewCount}` : "확인 필요",
            },
            { key: "REFUND", label: "환불" },
          ] as const
        ).map((chip) => {
          const active = filter === chip.key;
          return (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(chip.key)}
              style={{
                paddingHorizontal: 12,
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

      <View
        className="flex-row items-center justify-between"
        style={{ paddingHorizontal: 16, paddingTop: 10 }}
      >
        <Text style={{ fontSize: 10, color: "#a3a9b3" }}>
          내역을 누르면 상세를 볼 수 있어요
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="정렬 바꾸기"
          onPress={() =>
            setSort((prev) =>
              prev === "RECENT"
                ? "AMOUNT_DESC"
                : prev === "AMOUNT_DESC"
                  ? "AMOUNT_ASC"
                  : "RECENT",
            )
          }
          className="flex-row items-center active:opacity-60"
          style={{ gap: 3 }}
        >
          <Ionicons name="swap-vertical" size={13} color="#687281" />
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#687281" }}>
            {sort === "RECENT"
              ? "최신순"
              : sort === "AMOUNT_DESC"
                ? "금액 큰 순"
                : "금액 작은 순"}
          </Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.transaction.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#121a2a" }}>
              {section.title}
            </Text>
            {section.total > 0 ? (
              <Text style={{ fontSize: 11, color: "#8b94a2" }}>
                지출 {section.total.toLocaleString("ko-KR")}원
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          const { transaction, categoryCode } = item;
          const deposit =
            transaction.transaction_type === TRANSACTION_TYPE.DEPOSIT;
          const auto = transaction.category_method === CATEGORY_METHOD.AUTO;
          const reason = reviewReason(transaction);

          return (
            <Swipeable
              ref={(node) => {
                // 화면에서 사라진 행의 참조는 지운다. 안 지우면 계속 쌓인다.
                if (node) swipeRefs.current.set(transaction.id, node);
                else swipeRefs.current.delete(transaction.id);
              }}
              overshootRight={false}
              renderRightActions={() => (
                <View className="flex-row">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="카테고리 변경"
                    onPress={() => {
                      closeSwipe(transaction.id);
                      setEditing(transaction);
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
                onPress={() => setDetail(transaction)}
                className="flex-row items-center gap-3 active:bg-gray-50"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderColor: "#f1f3f5",
                  backgroundColor: "#fff",
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: deposit
                      ? "#e8f7f0"
                      : auto
                        ? "#fff0e8"
                        : "#eef2f8",
                  }}
                >
                  <Ionicons
                    name={
                      deposit
                        ? "arrow-down"
                        : auto
                          ? "flash-outline"
                          : "create-outline"
                    }
                    size={15}
                    color={deposit ? "#2d8a63" : auto ? "#d97a4a" : "#5d6674"}
                  />
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
                      // ⚠️ 시안의 '민지 개인카드' 처럼 사람 이름은 붙일 수 없다.
                      //    거래와 사람을 잇는 연결이 스키마에 없다.
                      transaction.source_type === TRANSACTION_SOURCE_TYPE.MANUAL
                        ? "직접 입력"
                        : "연결 계좌",
                    ].join(" · ")}
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
                      {reason === "UNCATEGORIZED"
                        ? "카테고리 확인 필요"
                        : "자동 분류가 맞는지 확인해 주세요"}
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: deposit ? theme.primary : "#121a2a",
                  }}
                >
                  {deposit ? "+" : "−"}
                  {transaction.amount.toLocaleString("ko-KR")}원
                </Text>
              </Pressable>
            </Swipeable>
          );
        }}
      />

      {/*
        ── 거래 상세 ── (IA v2 §2-4, FUND-03 역할)
        별도 화면이 아니라 바텀시트다. 다른 화면에서 지목해 열 수 있도록
        ?transactionId= 로 주소를 만들어 뒀다.
      */}
      <BottomSheet
        visible={detail !== null}
        title="거래 상세"
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <View style={{ gap: 8 }}>
              {/*
                ⚠️ 입금에는 카테고리 변경·계획 연결을 두지 않는다.
                   입금은 자금이 들어온 것이지 예산을 쓴 게 아니다.
                   버튼을 두면 사용자는 없는 할 일을 하게 되고,
                   카테고리가 붙으면 그 예산의 실제 사용액이 부풀려진다.
              */}
              {detail.transaction_type === TRANSACTION_TYPE.DEPOSIT ? null : (
                <View className="flex-row gap-2">
                  <View style={{ flex: 1 }}>
                    <Button
                      label="카테고리 변경"
                      variant="secondary"
                      onPress={() => {
                        const target = detail;
                        setDetail(null);
                        setEditing(target);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {/* 연결 해제는 여기서만 한다. BUDGET-02 에서는 못 푼다 (스펙 9장) */}
                    <Button
                      label={
                        detail.budget_plan_item_id ? "연결 해제" : "계획 연결"
                      }
                      variant="secondary"
                      loading={linkBusy}
                      onPress={() => {
                        if (detail.budget_plan_item_id) {
                          void handleLinkPlan(null);
                          return;
                        }
                        setLinking(detail);
                        setDetail(null);
                      }}
                    />
                  </View>
                </View>
              )}
              <Button label="확인 완료" onPress={() => setDetail(null)} />
            </View>
          ) : null
        }
      >
        {detail ? (
          <View style={{ paddingTop: 14 }}>
            <Text style={{ fontSize: 11, color: "#858e9c" }}>
              {detail.transaction_type === TRANSACTION_TYPE.DEPOSIT
                ? "입금"
                : "출금"}
            </Text>
            <Text
              style={{
                marginTop: 3,
                fontSize: 28,
                fontWeight: "900",
                letterSpacing: -1.2,
                color:
                  detail.transaction_type === TRANSACTION_TYPE.DEPOSIT
                    ? theme.primary
                    : "#141b28",
              }}
            >
              {detail.transaction_type === TRANSACTION_TYPE.DEPOSIT ? "+" : "−"}
              {detail.amount.toLocaleString("ko-KR")}
              <Text style={{ fontSize: 14, letterSpacing: 0 }}>원</Text>
            </Text>

            <View
              style={{
                marginTop: 16,
                borderTopWidth: 1,
                borderColor: "#e5e8ec",
              }}
            >
              {(
                [
                  ["거래명", detail.name ?? "이름 없는 거래"],
                  [
                    "거래일",
                    format(parseISO(detail.occurred_at), "yyyy년 M월 d일"),
                  ],
                  ...(detail.transaction_type === TRANSACTION_TYPE.DEPOSIT
                    ? ([] as [string, string][])
                    : ([
                        [
                          "예산 카테고리",
                          detail.budget_category_id
                            ? (CATEGORY_CODE_LABEL[
                                (data?.categories.find(
                                  (c) => c.id === detail.budget_category_id,
                                )?.category_code ?? "") as CategoryCode
                              ] ?? "미분류")
                            : "미분류",
                        ],
                        [
                          "분류 방식",
                          detail.category_method === CATEGORY_METHOD.AUTO
                            ? `자동 분류${detail.category_confidence !== null ? ` · 신뢰도 ${detail.category_confidence}%` : ""}`
                            : detail.category_method === CATEGORY_METHOD.USER
                              ? "직접 지정"
                              : "분류 전",
                        ],
                        [
                          "연결 계좌",
                          detail.financial_account_id
                            ? (data?.maskedAccountNumber ?? "연결 계좌")
                            : "직접 입력",
                        ],
                        [
                          "연결된 계획",
                          detail.budget_plan_item_id
                            ? (data?.planItems.find(
                                (plan) =>
                                  plan.id === detail.budget_plan_item_id,
                              )?.name ?? "계획에 연결됨")
                            : "연결 안 됨",
                        ],
                      ] as [string, string][])),
                  [
                    "환불·취소",
                    detail.refund_status === REFUND_STATUS.PENDING
                      ? "환불 예정"
                      : detail.refund_status === REFUND_STATUS.REFUNDED
                        ? "환불 완료"
                        : detail.refund_status === REFUND_STATUS.CANCELED
                          ? "결제 취소"
                          : "해당 없음",
                  ],
                ] as const
              ).map(([label, value]) => (
                <View
                  key={label}
                  className="flex-row items-center justify-between"
                  style={{
                    paddingVertical: 11,
                    borderBottomWidth: 1,
                    borderColor: "#f1f3f5",
                  }}
                >
                  <Text style={{ fontSize: 11, color: "#858e9c" }}>
                    {label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#141b28",
                    }}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>

            {reviewReason(detail) ? (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 11,
                  backgroundColor: "#f5f6f8",
                  padding: 11,
                }}
              >
                <Text
                  style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}
                >
                  {reviewReason(detail) === "UNCATEGORIZED"
                    ? "아직 예산 카테고리가 없어요. 카테고리를 정하면 해당 예산의 실제 사용액에 반영돼요."
                    : reviewReason(detail) === "REFUND_PENDING"
                      ? "환불이 예정된 거래예요. 아직 돈이 돌아오지 않아 지출에는 남아 있어요."
                      : "자동으로 분류했지만 확신이 낮아요. 맞는지 확인해 주세요."}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

      {/* ── 계획 항목 연결 ── */}
      <BottomSheet
        visible={linking !== null}
        title="계획 항목에 연결"
        description="연결하면 그 계획의 카테고리로 함께 옮겨요. 계획에는 실제 결제 금액이 표시돼요."
        onClose={() => setLinking(null)}
      >
        <View style={{ paddingTop: 12, gap: 8 }}>
          {(data?.planItems ?? []).length === 0 ? (
            <Text
              style={{
                fontSize: 11,
                color: "#858e9c",
                paddingVertical: 20,
                textAlign: "center",
              }}
            >
              아직 세부 계획이 없어요. 예산 상세에서 먼저 계획을 만들어 주세요.
            </Text>
          ) : (
            (data?.planItems ?? []).map((plan) => {
              const category = data?.categories.find(
                (c) => c.id === plan.budget_category_id,
              );
              // 이미 다른 거래가 붙은 계획은 고르지 못하게 한다.
              // 한 계획에 두 거래가 붙으면 '예상 대비 실제' 가 무엇을 뜻하는지 흐려진다.
              const taken =
                plan.actual_amount > 0 &&
                plan.id !== linking?.budget_plan_item_id;
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.name} 에 연결`}
                  accessibilityState={{ disabled: taken }}
                  disabled={taken || linkBusy}
                  onPress={() => void handleLinkPlan(plan.id)}
                  className="active:bg-gray-50"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 13,
                    borderWidth: 1,
                    borderColor: "#e5e8ec",
                    borderRadius: 12,
                    opacity: taken ? 0.45 : 1,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>
                    {category
                      ? CATEGORY_EMOJI[category.category_code as CategoryCode]
                      : "📌"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#141b28",
                      }}
                    >
                      {plan.name}
                    </Text>
                    <Text
                      style={{ fontSize: 10, color: "#858e9c", marginTop: 3 }}
                    >
                      {category
                        ? CATEGORY_CODE_LABEL[
                            category.category_code as CategoryCode
                          ]
                        : "미분류"}
                      {" · 예상 "}
                      {plan.expected_amount.toLocaleString("ko-KR")}원
                      {taken ? " · 이미 연결됨" : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="#a8afb9" />
                </Pressable>
              );
            })
          )}
        </View>
      </BottomSheet>

      {/* 카테고리 변경 시트 */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setEditing(null)}
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
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#121a2a" }}>
            카테고리 변경
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: "#8b94a2", marginTop: 4 }}
          >
            {editing?.name ?? "이름 없는 거래"} ·{" "}
            {(editing?.amount ?? 0).toLocaleString("ko-KR")}원
          </Text>

          <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
            {(data?.categories ?? []).map((category) => {
              const selected = editing?.budget_category_id === category.id;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => void handleChangeCategory(category.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: selected ? theme.primary : "#e7e9ed",
                    backgroundColor: selected ? theme.primary : "#fff",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selected ? "800" : "400",
                      color: selected ? theme.onPrimary : "#121a2a",
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
