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

/**
 * 목록 보기 방식. (시안 v1)
 *
 * ⚠️ 2026-09-03 · 필터와 정렬 **두 축을 하나로 합쳤다.**
 *    앞서는 '확인 필요를 금액순으로' 를 만들려고 축을 갈랐는데,
 *    칩 한 줄 + 정렬 토글 한 줄이 되면서 목록보다 조작부가 커졌다.
 *    시안대로 네 가지 보기 중 하나를 고르는 방식으로 되돌린다.
 *    '큰 금액순' 은 필터가 아니라 **보기**다 — 입금을 빼고 금액순으로 세운다.
 */
type FundView = "ALL" | "MAJOR" | "REVIEW" | "REFUND";

export default function ScreenFUND01() {
  const {
    tripId,
    categoryId,
    transactionId,
    filter: filterParam,
  } = useLocalSearchParams<{
    tripId: string;
    categoryId?: string;
    transactionId?: string;
    /** all | major | review | refund */
    filter?: string;
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
    return wanted === "MAJOR" || wanted === "REVIEW" || wanted === "REFUND"
      ? (wanted as FundView)
      : "ALL";
  });

  /** ?transactionId= 로 들어왔을 때 한 번만 상세로 보낸다 */
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
  const [toast, setToast] = useState<string | null>(null);

  /*
   * ⚠️ 2026-09-03 · 카테고리 변경 · 계획 연결 · 연결 해제는 전부
   *    거래 상세 화면(FUND-03)으로 옮겼다. 목록은 보여주고 넘기는 일만 한다.
   */
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

  const visibleTransactions = useMemo(() => {
    // ⚠️ '전체' 는 입금까지 포함한다. 출금만 남기면 FUND-01 에서 '입출금 전체
    //    내역' 으로 들어왔는데 방금 넣은 입금이 사라져 빈 화면이 된다.
    let rows = [...(data?.transactions ?? [])];

    if (view === "REVIEW") return rows.filter((t) => reviewReason(t) !== null);
    if (view === "REFUND") return rows.filter((t) => isRefundRelated(t));
    if (view === "MAJOR") {
      // 큰 금액순은 **지출을 크게 쓴 순서**다. 입금이 섞이면 1위가 입금이 된다.
      return rows
        .filter((t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL)
        .sort((a, b) => b.amount - a.amount);
    }
    return rows;
  }, [data?.transactions, view]);

  /** 탭 배지에 쓸 건수 */
  const counts = useMemo(() => {
    const rows = data?.transactions ?? [];
    return {
      all: rows.length,
      review: rows.filter((t) => reviewReason(t) !== null).length,
      refund: rows.filter((t) => isRefundRelated(t)).length,
    };
  }, [data?.transactions]);

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
    if (view === "REFUND") {
      const total = rows.reduce((sum, t) => sum + t.amount, 0);
      return {
        label: `환불 내역 ${rows.length}건`,
        value: `${total.toLocaleString("ko-KR")}원`,
      };
    }
    const spent = rows
      .filter((t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL)
      .filter((t) => reviewReason(t) === null)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      label: view === "MAJOR" ? "큰 금액부터 표시" : `전체 ${rows.length}건`,
      value: `${spent.toLocaleString("ko-KR")}원`,
    };
  }, [view, visibleTransactions]);

  // 날짜별로 묶는다. 거래는 이미 occurred_at 내림차순으로 온다.
  const sections = useMemo(() => {
    const byCategory = new Map(
      (data?.categories ?? []).map((c) => [c.id, c.category_code]),
    );
    const groups: { title: string; total: number; data: Transaction[] }[] = [];

    /**
     * ⚠️ 큰 금액순에서는 날짜로 묶지 않는다.
     *    금액순으로 세워 놓고 날짜 머리글을 얹으면 4/20 → 4/25 → 5/16 → 5/15
     *    처럼 날짜가 뒤죽박죽으로 보여, 목록이 정렬돼 있다는 사실 자체가
     *    안 읽힌다. 이때는 한 덩어리로 둔다.
     */
    if (view === "MAJOR") {
      groups.push({ title: "", total: 0, data: [...visibleTransactions] });
    }

    for (const transaction of view === "MAJOR" ? [] : visibleTransactions) {
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
    // 큰 금액순은 날짜 묶음이 아니라 합계를 적을 자리가 없다.
    if (view !== "MAJOR") {
      for (const group of groups) {
        group.total = group.data
          .filter((t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL)
          .reduce((sum, t) => sum + t.amount, 0);
      }
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
            { key: "MAJOR", label: "큰 금액순" },
            {
              key: "REVIEW",
              label:
                counts.review > 0 ? `확인 필요 ${counts.review}` : "확인 필요",
            },
            {
              key: "REFUND",
              label: counts.refund > 0 ? `환불 ${counts.refund}` : "환불",
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
                onPress={() =>
                  router.push(
                    `/trips/${data.trip.id}/funds/transactions/${transaction.id}`,
                  )
                }
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
    </View>
  );
}
