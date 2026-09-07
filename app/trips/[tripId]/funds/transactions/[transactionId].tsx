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
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { TripHomeButton } from "@/components/navigation/TripHomeButton";
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Loading,
} from "@/components/ui";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  CATEGORY_CODE_LABEL,
  CATEGORY_CODE_TO_ANALYTICS,
  CATEGORY_METHOD,
  MAPPED_BY,
  REFUND_STATUS,
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
import {
  deleteTransaction,
  getTransactionById,
  reviewReason,
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
};

export default function ScreenFUND03() {
  const { tripId, transactionId } = useLocalSearchParams<{
    tripId: string;
    transactionId: string;
  }>();
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);

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
      const [categories, planItems, accounts] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        budget ? getBudgetPlanItems(budget.id) : Promise.resolve([]),
        trip.group_id ? getGroupAccounts(trip.group_id) : Promise.resolve([]),
      ]);

      setData({
        trip,
        transaction,
        categories,
        planItems,
        maskedAccountNumber: accounts[0]?.masked_account_number ?? null,
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
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "거래 상세" }} />
        <Loading message="거래를 불러오는 중…" />
      </View>
    );
  }
  if (notFound || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "거래 상세" }} />
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
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "거래 상세" }} />
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

  const rows: [string, string][] = [
    ["거래명", transaction.name ?? "이름 없는 거래"],
    ["거래일", format(parseISO(transaction.occurred_at), "yyyy년 M월 d일")],
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
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "거래 상세" }} />

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

        {canEdit ? (
          <View style={{ marginTop: 22, gap: 8 }}>
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

      {/* ── 계획 항목 연결 ── */}
      <BottomSheet
        visible={linking}
        title="계획 항목에 연결"
        description="연결하면 그 계획의 카테고리로 함께 옮겨요. 계획에는 실제 결제 금액이 표시돼요."
        onClose={() => setLinking(false)}
      >
        <View style={{ paddingTop: 12, gap: 8 }}>
          {data.planItems.length === 0 ? (
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
            data.planItems.map((plan) => {
              const category = data.categories.find(
                (c) => c.id === plan.budget_category_id,
              );
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.name} 에 연결`}
                  disabled={busy}
                  onPress={() => void handleLinkPlan(plan.id)}
                  className="flex-row items-center active:bg-gray-50"
                  style={{
                    gap: 10,
                    padding: 13,
                    borderWidth: 1,
                    borderColor: "#e5e8ec",
                    borderRadius: 12,
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
                      style={{ marginTop: 3, fontSize: 10, color: "#858e9c" }}
                    >
                      {category
                        ? CATEGORY_CODE_LABEL[
                            category.category_code as CategoryCode
                          ]
                        : "카테고리 없음"}
                      {" · 예상 "}
                      {plan.expected_amount.toLocaleString("ko-KR")}원
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
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
