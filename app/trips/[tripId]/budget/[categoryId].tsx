// ============================================================================
// BUDGET-02 카테고리 상세  ·  /trips/:tripId/budget/:categoryId
//
// TRIP-03 에서 확정한 카테고리 예산과 세부 항목을 다시 확인하고 수정하는 화면이다.
//
// ⚠️ 계획과 지출을 **중복 차감하지 않는다.**
//      계획 비율 = 선택된 계획 합계 ÷ 설정 예산
//      지출 비율 = 실제 지출 합계 ÷ 설정 예산
//      남은 금액 = 설정 예산 - 실제 지출 합계      ← 계획은 빼지 않는다
//
// ⚠️ 편집은 **로컬에 모았다가 '변경 내용 저장' 에서 한 번에 반영**한다.
//    체크를 껐다 켰다 할 때마다 DB 를 때리면 왕복이 잦고, 중간에 나가면
//    일부만 저장된 상태가 남는다. 상단 수치는 즉시 갱신된다.
//
// 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/budget/.
// ============================================================================
import { format } from "date-fns";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  CategoryHeroCard,
  ExpenseCard,
  PlanItemCard,
  type ExpenseDraft,
  type ExpenseItem,
  type PlanDraft,
  type PlanItem,
} from "@/components/budget";
import {
  BottomSheet,
  Button,
  CurrencyInput,
  EmptyState,
  ErrorState,
  Input,
  Loading,
} from "@/components/ui";
import { DateRangeCalendar } from "@/components/trip-create";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { perPerson } from "@/lib/budget/recommendation";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  APPLIED_SOURCE,
  BUDGET_PLAN_ITEM_STATUS,
  CATEGORY_CODE,
  CATEGORY_CODE_LABEL,
  CATEGORY_CODE_TO_ANALYTICS,
  CATEGORY_METHOD,
  PLAN_DISPLAY_MODE,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  type CategoryCode,
  type PlanDisplayMode,
} from "@/lib/constants/status";
import {
  createBudgetPlanItem,
  deleteBudgetPlanItem,
  getBudgetByTripId,
  getBudgetCategories,
  getBudgetPlanItems,
  updateBudgetCategory,
  updateBudgetPlanItem,
  updateTripBudget,
  type BudgetCategory,
  type BudgetPlanItem,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import { getGroupAccounts } from "@/lib/supabase/queries/funds";
import {
  createTransaction,
  getTransactions,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";
import {
  getSpendingProfile,
  personalizeFromProfile,
} from "@/lib/supabase/queries/personalization";
import { TRIP_OWNER_TYPE } from "@/lib/constants/status";
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from "@/lib/constants/devUser";

/** 카테고리별 대표 이모지. 계획 항목 썸네일 기본값으로도 쓴다 */
const CATEGORY_EMOJI: Record<CategoryCode, string> = {
  [CATEGORY_CODE.AIRFARE]: "✈️",
  [CATEGORY_CODE.LODGING]: "🏨",
  [CATEGORY_CODE.FOOD]: "🍽️",
  [CATEGORY_CODE.TRANSPORT]: "🚇",
  [CATEGORY_CODE.ACTIVITY]: "🎡",
  [CATEGORY_CODE.SHOPPING]: "🛍️",
  [CATEGORY_CODE.INSURANCE]: "🛡️",
  [CATEGORY_CODE.CONTINGENCY]: "💰",
};

type CategoryData = {
  trip: Trip;
  budget: TripBudget;
  allCategories: BudgetCategory[];
  category: BudgetCategory;
  items: BudgetPlanItem[];
  transactions: Transaction[];
  maskedAccountNumber: string | null;
};

/** 실제 지출은 최근 몇 건까지 보여줄지 */
const RECENT_EXPENSE_LIMIT = 10;

export default function ScreenBUDGET02() {
  const { tripId, categoryId } = useLocalSearchParams<{
    tripId: string;
    categoryId: string;
  }>();

  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // ── 로컬 편집 상태 ────────────────────────────────────────────────────
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId || !categoryId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    setNotFound(false);

    try {
      const trip = await getTripById(tripId);
      const budget = trip ? await getBudgetByTripId(trip.id) : null;
      if (!trip || !budget) {
        setNotFound(true);
        return;
      }

      const allCategories = await getBudgetCategories(budget.id);
      // 이 여행에 속한 카테고리인지 확인한다. 다른 여행의 categoryId 로 들어와도
      // 남의 데이터를 보여주지 않는다. (CLAUDE.md 7장)
      const category = allCategories.find((c) => c.id === categoryId);
      if (!category) {
        setNotFound(true);
        return;
      }

      const [items, transactions, accounts] = await Promise.all([
        getBudgetPlanItems(category.id),
        getTransactions(trip.id, {
          categoryId: category.id,
          transactionType: TRANSACTION_TYPE.WITHDRAWAL,
          // 최근 10건만. 전체는 '전체 내역 보기' 로 넘긴다.
          // 한 건 더 받아 더 있는지 판단한다
          limit: RECENT_EXPENSE_LIMIT + 1,
        }),
        trip.group_id ? getGroupAccounts(trip.group_id) : Promise.resolve([]),
      ]);

      setData({
        trip,
        budget,
        allCategories,
        category,
        items,
        transactions,
        maskedAccountNumber: accounts[0]?.masked_account_number ?? null,
      });
      setPlans(
        items.map((item) => ({
          id: item.id,
          name: item.name,
          expectedAmount: item.expected_amount,
          actualAmount: item.actual_amount,
          // CANCELED 는 사용자가 계획에서 뺀 항목이다
          selected: item.status !== BUDGET_PLAN_ITEM_STATUS.CANCELED,
          emoji: CATEGORY_EMOJI[category.category_code as CategoryCode],
          displayMode: item.display_mode as PlanDisplayMode,
          // 실제 지출이 붙은 항목은 빼거나 지울 수 없다.
          // 이미 쓴 돈이 달린 계획을 없애면 '계획에 없는 지출' 이 생겨
          // 계획 대비 실제 비교가 성립하지 않는다.
          locked: item.actual_amount > 0,
        })),
      );
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

  // ── 지난 여행 지출 분석 ───────────────────────────────────────────────
  //
  // BUDGET-01 과 **같은 계산**을 쓴다. 두 화면이 다른 금액을 말하면 안 된다.
  const [insight, setInsight] = useState<{
    personalizedAmount: number;
    recommendedAmount: number;
    diff: number;
    deviationBp: number;
    applied: boolean;
  } | null>(null);
  const [applyingInsight, setApplyingInsight] = useState(false);
  const insightLoadedRef = useRef(false);

  useEffect(() => {
    if (!data || insightLoadedRef.current) return;
    insightLoadedRef.current = true;

    const scope =
      data.trip.owner_type === TRIP_OWNER_TYPE.GROUP && data.trip.group_id
        ? ({ ownerType: "GROUP", groupId: data.trip.group_id } as const)
        : // TODO: 로그인 연동 시 교체
          ({
            ownerType: "PERSONAL",
            userId: data.trip.owner_user_id ?? DEV_USER_ID,
          } as const);

    void getSpendingProfile(scope)
      .then((profile) => {
        if (!profile) return;
        const [result] = personalizeFromProfile(profile, [
          {
            key: data.category.id,
            categoryCode: data.category.category_code,
            recommendedAmount: data.category.recommended_amount,
          },
        ]);
        if (!result) return;
        setInsight({
          personalizedAmount: result.personalizedAmount,
          recommendedAmount: data.category.recommended_amount,
          diff: result.personalizedAmount - data.category.recommended_amount,
          deviationBp: (result.basis as { deviationBp: number }).deviationBp,
          applied: data.category.applied_source === APPLIED_SOURCE.PERSONALIZED,
        });
      })
      // 분석은 부가 기능이다. 실패해도 예산 화면은 그대로 보여준다.
      .catch(() => undefined);
  }, [data]);

  /**
   * 과거 지출 반영 토글. **바꾸는 즉시 이 카테고리 설정 예산에 반영한다.**
   * 별도의 적용 버튼을 두지 않는다. (스펙)
   */
  const handleToggleInsight = useCallback(
    async (next: boolean) => {
      if (!data || !insight || applyingInsight) return;
      setApplyingInsight(true);
      const nextAmount = next
        ? insight.personalizedAmount
        : insight.recommendedAmount;

      try {
        await updateBudgetCategory(data.category.id, {
          planned_amount: nextAmount,
          applied_source: next
            ? APPLIED_SOURCE.PERSONALIZED
            : APPLIED_SOURCE.DEFAULT,
        });
        const total = data.allCategories.reduce(
          (sum, c) =>
            sum + (c.id === data.category.id ? nextAmount : c.planned_amount),
          0,
        );
        await updateTripBudget(data.budget.id, {
          target_amount: total,
          per_person_amount: perPerson(total, data.trip.headcount),
        });

        track(EVENTS.PERSONALIZATION_APPLIED, {
          trip_id: data.trip.id,
          source: "budget_category",
          applied: next,
          category:
            CATEGORY_CODE_TO_ANALYTICS[
              data.category.category_code as CategoryCode
            ],
        });

        setInsight((prev) => (prev ? { ...prev, applied: next } : prev));
        await load();
        setToast(
          next ? "지난 여행 기준을 반영했어요" : "기본 추천으로 되돌렸어요",
        );
      } catch {
        setError(true);
      } finally {
        setApplyingInsight(false);
      }
    },
    [applyingInsight, data, insight, load],
  );

  /** 연결된 계획을 누르면 그 계획에 붙은 지출 상세로 보낸다 */
  const handleOpenLinkedPlan = useCallback(
    (planItemId: string) => {
      if (!data) return;
      const linked = data.transactions.find(
        (t) => t.budget_plan_item_id === planItemId,
      );
      if (!linked) {
        setToast("연결된 지출을 찾지 못했어요");
        return;
      }
      router.push(`/trips/${data.trip.id}/transactions/${linked.id}`);
    },
    [data],
  );

  // ── 설정 예산 수정 ────────────────────────────────────────────────────
  const [editingBudget, setEditingBudget] = useState(false);
  const [draftAmount, setDraftAmount] = useState<number | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);

  const handleSaveBudget = useCallback(async () => {
    if (!data || savingBudget) return;
    const next = draftAmount ?? 0;
    const from = data.category.planned_amount;
    if (next === from) {
      setEditingBudget(false);
      return;
    }

    setSavingBudget(true);
    try {
      // 사용자가 고친 값이므로 applied_source 가 'user' 다.
      // recommended_amount 는 건드리지 않는다. (CLAUDE.md 4장)
      await updateBudgetCategory(data.category.id, {
        planned_amount: next,
        applied_source: APPLIED_SOURCE.USER,
      });

      // 카테고리 합이 곧 목표 여행비다.
      const total = data.allCategories.reduce(
        (sum, c) => sum + (c.id === data.category.id ? next : c.planned_amount),
        0,
      );
      await updateTripBudget(data.budget.id, {
        target_amount: total,
        per_person_amount: perPerson(total, data.trip.headcount),
      });

      track(EVENTS.BUDGET_CATEGORY_EDITED, {
        trip_id: data.trip.id,
        category:
          CATEGORY_CODE_TO_ANALYTICS[
            data.category.category_code as CategoryCode
          ],
        from_amount: from,
        to_amount: next,
        applied_source: APPLIED_SOURCE.USER,
      });

      setEditingBudget(false);
      await load();
      setToast("예산을 저장했어요");
    } catch {
      setError(true);
    } finally {
      setSavingBudget(false);
    }
  }, [data, draftAmount, load, savingBudget]);

  // ── 계획 항목 (로컬) ──────────────────────────────────────────────────
  const [addingPlan, setAddingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState<PlanDraft>({
    name: "",
    amount: null,
    displayMode: PLAN_DISPLAY_MODE.TOTAL,
  });
  const [planNameError, setPlanNameError] = useState<string | null>(null);

  /**
   * 계획이 바뀌면 설정 예산을 다시 계산한다.
   *
   *   설정 예산 = 선택된 계획 합계 + 여유 예산
   *
   * 여유 예산은 사용자가 설정 예산을 계획 합계보다 크게 잡아 둔 차액이다.
   * 계획을 더하거나 빼도 그 여유는 그대로 유지한다.
   *
   * ⚠️ **실제 지출이 있으면 건드리지 않는다.** (스펙)
   *    이미 결제가 일어난 뒤에 계획을 지웠다고 설정 예산을 줄이면
   *    남은 예산이 음수가 되고, 쓴 돈보다 작은 예산이 남는다.
   *    실제 결제는 실제 사용과 남은 예산만 바꾼다.
   */
  const syncBudgetFromPlans = useCallback(
    (nextPlans: PlanItem[]) => {
      if (!data) return;
      const spent = data.transactions.reduce((sum, t) => sum + t.amount, 0);
      if (spent > 0) return;

      const before = plans
        .filter((item) => item.selected)
        .reduce((sum, item) => sum + item.expectedAmount, 0);
      const reserve = Math.max(0, data.category.planned_amount - before);
      const after = nextPlans
        .filter((item) => item.selected)
        .reduce((sum, item) => sum + item.expectedAmount, 0);
      const nextBudget = after + reserve;
      if (nextBudget === data.category.planned_amount) return;

      void updateBudgetCategory(data.category.id, {
        planned_amount: nextBudget,
      })
        .then(() => {
          const total = data.allCategories.reduce(
            (sum, c) =>
              sum + (c.id === data.category.id ? nextBudget : c.planned_amount),
            0,
          );
          return updateTripBudget(data.budget.id, {
            target_amount: total,
            per_person_amount: perPerson(total, data.trip.headcount),
          });
        })
        .then(() => load())
        // 예산 반영이 실패해도 계획 변경 자체는 이미 저장됐다.
        // 다음 진입에서 다시 맞춘다.
        .catch(() => undefined);
    },
    [data, load, plans],
  );

  // ⚠️ 체크 해제는 **즉시 반영**한다. 따로 저장을 누르지 않아도 예산에 적용된다.
  //    화면 수치를 먼저 바꾸고 저장은 뒤에서 돌린다. 실패하면 되돌린다.
  const handleTogglePlan = useCallback(
    (id: string) => {
      const target = plans.find((item) => item.id === id);
      if (!target || target.locked) return;

      const nextSelected = !target.selected;
      const nextPlans = plans.map((item) =>
        item.id === id ? { ...item, selected: nextSelected } : item,
      );
      setPlans(nextPlans);
      syncBudgetFromPlans(nextPlans);

      void updateBudgetPlanItem(id, {
        status: nextSelected
          ? BUDGET_PLAN_ITEM_STATUS.PLANNED
          : BUDGET_PLAN_ITEM_STATUS.CANCELED,
      })
        .then(() => {
          if (!data) return;
          track(EVENTS.BUDGET_PLAN_ITEM_EDITED, {
            trip_id: data.trip.id,
            category:
              CATEGORY_CODE_TO_ANALYTICS[
                data.category.category_code as CategoryCode
              ],
            item_id: id,
          });
        })
        .catch(() => {
          // 저장이 실패하면 화면도 되돌린다. 안 그러면 새로고침 때 값이 튄다
          setPlans((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, selected: target.selected } : item,
            ),
          );
          setToast("변경을 저장하지 못했어요");
        });
    },
    [data, plans, syncBudgetFromPlans],
  );

  const handleDeletePlan = useCallback(
    (id: string) => {
      const target = plans.find((item) => item.id === id);
      if (!target || target.locked) return;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const nextPlans = plans.filter((item) => item.id !== id);
      setPlans(nextPlans);
      syncBudgetFromPlans(nextPlans);

      void deleteBudgetPlanItem(id)
        .then(() => {
          if (!data) return;
          track(EVENTS.BUDGET_PLAN_ITEM_DELETED, {
            trip_id: data.trip.id,
            category:
              CATEGORY_CODE_TO_ANALYTICS[
                data.category.category_code as CategoryCode
              ],
            item_id: id,
          });
        })
        .catch(() => {
          setPlans((prev) => [...prev, target]);
          setToast("삭제하지 못했어요");
        });
    },
    [data, plans, syncBudgetFromPlans],
  );

  const handleConfirmAddPlan = useCallback(async () => {
    if (!data) return;
    const name = planDraft.name.trim();
    if (!name) {
      setPlanNameError("항목 이름을 입력해 주세요.");
      return;
    }

    try {
      const created = await createBudgetPlanItem({
        budget_category_id: data.category.id,
        name,
        // ⚠️ 저장하는 값은 언제나 총액이다. display_mode 는 보여주는 방식일 뿐
        //    금액을 바꾸지 않는다. (BUDGET-02 v2 스펙)
        expected_amount: planDraft.amount ?? 0,
        display_mode: planDraft.displayMode,
        status: BUDGET_PLAN_ITEM_STATUS.PLANNED,
        sort_order: plans.length + 1,
      });
      track(EVENTS.BUDGET_PLAN_ITEM_ADDED, {
        trip_id: data.trip.id,
        category:
          CATEGORY_CODE_TO_ANALYTICS[
            data.category.category_code as CategoryCode
          ],
        planned_amount: planDraft.amount ?? 0,
        item_id: created.id,
      });

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const nextPlans: PlanItem[] = [
        ...plans,
        {
          id: created.id,
          name: created.name,
          expectedAmount: created.expected_amount,
          actualAmount: 0,
          selected: true,
          emoji: CATEGORY_EMOJI[data.category.category_code as CategoryCode],
          displayMode: planDraft.displayMode,
          locked: false,
        },
      ];
      setPlans(nextPlans);
      // 계획이 늘면 설정 예산도 그만큼 늘린다. 여유 예산은 그대로 유지된다.
      syncBudgetFromPlans(nextPlans);
      setPlanDraft({
        name: "",
        amount: null,
        displayMode: PLAN_DISPLAY_MODE.TOTAL,
      });
      setPlanNameError(null);
      setAddingPlan(false);
    } catch {
      setToast("추가하지 못했어요");
    }
  }, [data, planDraft, plans, syncBudgetFromPlans]);

  // ── 지출 직접 입력 (로컬) ─────────────────────────────────────────────
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => ({
    name: "",
    amount: null,
    // 기본은 오늘. 폼에서 바꿀 수 있다
    occurredOn: format(new Date(), "yyyy-MM-dd"),
  }));
  const [expenseNameError, setExpenseNameError] = useState<string | null>(null);

  // ⚠️ 지출도 즉시 반영한다. 실제로 쓴 돈이라 미뤄둘 이유가 없다.
  const handleConfirmAddExpense = useCallback(async () => {
    if (!data) return;
    const name = expenseDraft.name.trim();
    if (!name) {
      setExpenseNameError("지출 항목을 입력해 주세요.");
      return;
    }
    if (!expenseDraft.amount || expenseDraft.amount <= 0) {
      setExpenseNameError("금액을 입력해 주세요.");
      return;
    }

    try {
      await createTransaction({
        trip_id: data.trip.id,
        budget_category_id: data.category.id,
        source_type: TRANSACTION_SOURCE_TYPE.MANUAL,
        transaction_type: TRANSACTION_TYPE.WITHDRAWAL,
        // 사용자가 고른 날짜. 시간은 정오로 둬 시간대 경계에서 날짜가 밀리지 않게 한다
        occurred_at: `${expenseDraft.occurredOn}T12:00:00+09:00`,
        name,
        amount: expenseDraft.amount,
        category_method: CATEGORY_METHOD.USER,
      });

      // actual_amount 는 거래의 합이다. 거래를 넣었으면 함께 올린다.
      await updateBudgetCategory(data.category.id, {
        actual_amount: data.category.actual_amount + expenseDraft.amount,
      });

      setExpenseDraft({
        name: "",
        amount: null,
        occurredOn: format(new Date(), "yyyy-MM-dd"),
      });
      setExpenseNameError(null);
      setAddingExpense(false);
      await load();
      setToast("지출을 기록했어요");
    } catch {
      setToast("저장하지 못했어요");
    }
  }, [data, expenseDraft, load]);

  // ── 파생값 ────────────────────────────────────────────────────────────
  // 한 건 더 받아왔으므로 초과분이 있으면 '전체 내역 보기' 를 띄운다
  const hasMoreExpenses =
    (data?.transactions.length ?? 0) > RECENT_EXPENSE_LIMIT;

  const expenses: ExpenseItem[] = useMemo(
    () =>
      (data?.transactions ?? [])
        .slice(0, RECENT_EXPENSE_LIMIT)
        .map((transaction) => ({
          id: transaction.id,
          name: transaction.name ?? "이름 없는 거래",
          amount: transaction.amount,
          occurredAt: transaction.occurred_at,
          auto: transaction.category_method === CATEGORY_METHOD.AUTO,
        })),
    [data?.transactions],
  );

  const plannedTotal = useMemo(
    () =>
      plans
        .filter((plan) => plan.selected)
        .reduce((sum, plan) => sum + plan.expectedAmount, 0),
    [plans],
  );

  /**
   * 여유 예산 = 설정 예산 − 선택된 계획 합계.
   *
   * DB 행이 아니라 차액이다. 사용자가 설정 예산을 계획보다 크게 잡아 둔 만큼이
   * 곧 여유다. 전체 여행 공통 '예비비' 카테고리와는 다른 개념이라
   * 카테고리 안에서는 '여유 예산' 이라고 부른다. (스펙)
   */
  const reserveAmount = Math.max(
    0,
    (data?.category.planned_amount ?? 0) - plannedTotal,
  );
  const spentTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "카테고리" }} />
        <Loading message="불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "카테고리" }} />
        <EmptyState
          icon="pricetag-outline"
          title="카테고리를 찾을 수 없어요"
          description="삭제되었거나 이 여행의 카테고리가 아니에요."
          actionLabel="예산으로"
          onAction={() => router.replace(`/trips/${tripId}/budget`)}
        />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "카테고리" }} />
        <ErrorState message="불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  const code = data.category.category_code as CategoryCode;
  const label = CATEGORY_CODE_LABEL[code];
  const destinationMeta = findDestinationByName(data.trip.destination);
  const nights =
    data.trip.start_date && data.trip.end_date
      ? Math.max(
          0,
          Math.round(
            (new Date(data.trip.end_date).getTime() -
              new Date(data.trip.start_date).getTime()) /
              86400000,
          ),
        )
      : null;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: label }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 여행 메타 */}
        <View
          className="flex-row items-center justify-between"
          style={{ marginHorizontal: 3, marginBottom: 14 }}
        >
          <Text style={{ fontSize: 11, color: "#7d8797" }}>
            {[
              data.trip.destination,
              nights !== null ? `${nights}박 ${nights + 1}일` : null,
              `${data.trip.headcount}명`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View
            style={{
              backgroundColor: theme.primarySoft,
              borderRadius: 20,
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{ fontSize: 10, color: theme.primary, fontWeight: "700" }}
            >
              {destinationMeta?.flag ?? "🌍"}{" "}
              {destinationMeta?.nameEn ?? theme.code}
            </Text>
          </View>
        </View>

        <CategoryHeroCard
          theme={theme}
          emoji={CATEGORY_EMOJI[code]}
          budgetAmount={data.category.planned_amount}
          plannedTotal={plannedTotal}
          spentTotal={spentTotal}
          preparedAmount={data.category.prepared_amount}
          recommendedAmount={data.category.recommended_amount}
          onStartEdit={() => {
            setDraftAmount(data.category.planned_amount);
            setEditingBudget(true);
          }}
        />

        {/*
          지난 여행 지출 분석. 배경 없는 전구 + 추천 금액 + 토글이다.
          토글을 바꾸면 이 카테고리 설정 예산에 즉시 반영한다.
          별도의 적용 버튼을 두지 않는다. (스펙)
        */}
        {insight ? (
          <View
            style={{
              marginTop: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: "#e5e8ec",
              borderRadius: 14,
              backgroundColor: "#fff",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 20, alignSelf: "flex-start" }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: "#858e9c" }}>
                지난 여행 지출 분석
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  lineHeight: 17,
                  color: "#111827",
                }}
              >
                {label} 예산을{" "}
                <Text style={{ color: theme.primary, fontWeight: "800" }}>
                  {Math.abs(insight.diff).toLocaleString("ko-KR")}원
                </Text>{" "}
                {insight.diff > 0 ? "늘려볼까요?" : "줄여볼까요?"}
              </Text>
              <Text style={{ marginTop: 5, fontSize: 9, color: "#858e9c" }}>
                지난 여행에서 계획보다{" "}
                {Math.abs(insight.deviationBp / 100)
                  .toFixed(1)
                  .replace(/\.0$/, "")}
                %{" "}
                {insight.deviationBp > 0 ? "더 사용했어요." : "덜 사용했어요."}
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="지난 여행 지출 예산에 반영"
              accessibilityState={{
                checked: insight.applied,
                disabled: applyingInsight,
              }}
              disabled={applyingInsight}
              onPress={() => void handleToggleInsight(!insight.applied)}
              style={{
                width: 42,
                height: 24,
                borderRadius: 20,
                backgroundColor: insight.applied ? theme.primary : "#d9dde3",
                opacity: applyingInsight ? 0.5 : 1,
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: "#fff",
                  marginLeft: insight.applied ? 21 : 3,
                }}
              />
            </Pressable>
          </View>
        ) : null}

        {/* 세부 계획 */}
        <View style={{ marginTop: 27 }}>
          <View
            className="flex-row items-end justify-between"
            style={{ marginHorizontal: 3, marginBottom: 11 }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#121a2a" }}>
              세부 계획
            </Text>
            <Text style={{ fontSize: 10, color: "#7d8797" }}>
              {plans.filter((plan) => plan.selected).length}개 선택됨
            </Text>
          </View>
          <PlanItemCard
            items={plans}
            headcount={data.trip.headcount}
            theme={theme}
            reserveAmount={reserveAmount}
            onToggle={handleTogglePlan}
            onDelete={handleDeletePlan}
            onOpenLinked={handleOpenLinkedPlan}
            onStartAdd={() => setAddingPlan(true)}
          />
        </View>

        {/* 실제 지출 */}
        <View style={{ marginTop: 27 }}>
          <View
            className="flex-row items-end justify-between"
            style={{ marginHorizontal: 3, marginBottom: 11 }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#121a2a" }}>
              실제 지출
            </Text>
            {/* 연결 계좌와 거래 정보는 여기서 확인한다 (스펙) */}
            <Text
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  `/trips/${data.trip.id}/funds?categoryId=${data.category.id}`,
                )
              }
              style={{ fontSize: 10, color: "#7d8797" }}
            >
              지출 항목 상세 보기 ›
            </Text>
          </View>
          <ExpenseCard
            expenses={expenses}
            theme={theme}
            onStartAdd={() => setAddingExpense(true)}
            onPressMore={
              hasMoreExpenses
                ? () =>
                    router.push(
                      `/trips/${data.trip.id}/funds?categoryId=${data.category.id}`,
                    )
                : undefined
            }
          />
        </View>
      </ScrollView>

      {/* ── 계획 항목 추가 ── */}
      <BottomSheet
        visible={addingPlan}
        title="계획 항목 추가"
        description="총액은 그대로 두고, 화면에 보일 금액 기준만 고를 수 있어요."
        onClose={() => {
          setAddingPlan(false);
          setPlanNameError(null);
        }}
        footer={
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="secondary"
                onPress={() => {
                  setAddingPlan(false);
                  setPlanNameError(null);
                }}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="추가"
                onPress={() => void handleConfirmAddPlan()}
              />
            </View>
          </View>
        }
      >
        <View style={{ gap: 13, paddingTop: 13 }}>
          <Input
            label="항목 이름"
            required
            value={planDraft.name}
            onChangeText={(name) => {
              setPlanDraft({ ...planDraft, name });
              if (planNameError) setPlanNameError(null);
            }}
            placeholder="예: 도쿄 왕복 항공권"
            error={planNameError}
            maxLength={30}
          />
          <CurrencyInput
            label="총 예상 금액"
            required
            value={planDraft.amount}
            onChangeValue={(amount) => setPlanDraft({ ...planDraft, amount })}
          />

          <View>
            <Text
              style={{
                marginBottom: 7,
                fontSize: 11,
                fontWeight: "800",
                color: "#111827",
              }}
            >
              금액 표시 방식
            </Text>
            <View className="flex-row" style={{ gap: 8 }}>
              {[
                { mode: PLAN_DISPLAY_MODE.TOTAL, label: "총액으로 표시" },
                {
                  mode: PLAN_DISPLAY_MODE.PER_PERSON,
                  label: `1인당 × ${data.trip.headcount}명`,
                },
              ].map((option) => {
                const active = planDraft.displayMode === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      setPlanDraft({ ...planDraft, displayMode: option.mode })
                    }
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: active ? theme.primary : "#e5e8ec",
                      backgroundColor: active ? theme.primarySoft : "#fff",
                      borderRadius: 11,
                      paddingVertical: 11,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: active ? "900" : "400",
                        color: active ? theme.primary : "#687281",
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 표시 방식만 달라지고 합산 총액은 그대로다 (스펙) */}
            <View
              style={{
                marginTop: 10,
                borderRadius: 11,
                backgroundColor: "#f5f6f8",
                padding: 11,
              }}
            >
              <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
                {planDraft.displayMode === PLAN_DISPLAY_MODE.PER_PERSON &&
                data.trip.headcount > 0 ? (
                  <>
                    총{" "}
                    <Text style={{ color: "#111827", fontWeight: "700" }}>
                      {(planDraft.amount ?? 0).toLocaleString("ko-KR")}원
                    </Text>
                    {" · 1인당 "}
                    <Text style={{ color: "#111827", fontWeight: "700" }}>
                      {Math.round(
                        (planDraft.amount ?? 0) / data.trip.headcount,
                      ).toLocaleString("ko-KR")}
                      원 × {data.trip.headcount}명
                    </Text>
                  </>
                ) : (
                  <>
                    총{" "}
                    <Text style={{ color: "#111827", fontWeight: "700" }}>
                      {(planDraft.amount ?? 0).toLocaleString("ko-KR")}원
                    </Text>
                    으로 추가돼요.
                  </>
                )}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>

      {/* ── 지출 직접 입력 ── */}
      <BottomSheet
        visible={addingExpense}
        title="지출 직접 입력"
        description="연결 계좌는 지출 항목 상세 화면에서 확인할 수 있어요."
        onClose={() => {
          setAddingExpense(false);
          setExpenseNameError(null);
        }}
        footer={
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="secondary"
                onPress={() => {
                  setAddingExpense(false);
                  setExpenseNameError(null);
                }}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="입력"
                onPress={() => void handleConfirmAddExpense()}
              />
            </View>
          </View>
        }
      >
        <View style={{ gap: 13, paddingTop: 13 }}>
          <Input
            label="지출 항목"
            required
            value={expenseDraft.name}
            onChangeText={(name) => {
              setExpenseDraft({ ...expenseDraft, name });
              if (expenseNameError) setExpenseNameError(null);
            }}
            placeholder="예: 항공권 좌석 지정"
            error={expenseNameError}
            maxLength={30}
          />
          <CurrencyInput
            label="금액"
            required
            value={expenseDraft.amount}
            onChangeValue={(amount) =>
              setExpenseDraft({ ...expenseDraft, amount })
            }
          />
          <View>
            <Text
              style={{
                marginBottom: 7,
                fontSize: 11,
                fontWeight: "800",
                color: "#111827",
              }}
            >
              결제 날짜
            </Text>
            {/* 지출은 이미 쓴 돈이라 과거 날짜를 고를 수 있어야 한다 */}
            <DateRangeCalendar
              mode="single"
              disablePast={false}
              startDate={expenseDraft.occurredOn}
              endDate={expenseDraft.occurredOn}
              onChange={(next) => {
                if (next.startDate) {
                  setExpenseDraft({
                    ...expenseDraft,
                    occurredOn: next.startDate,
                  });
                }
              }}
            />
          </View>
        </View>
      </BottomSheet>

      {/* ── 설정 예산 수정 ── */}
      <BottomSheet
        visible={editingBudget}
        title="설정 예산 수정"
        description="세부 계획보다 크게 잡은 금액은 여유 예산으로 자동 배정돼요."
        onClose={() => setEditingBudget(false)}
        footer={
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="secondary"
                onPress={() => setEditingBudget(false)}
                disabled={savingBudget}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="적용"
                loading={savingBudget}
                onPress={() => void handleSaveBudget()}
              />
            </View>
          </View>
        }
      >
        <View style={{ gap: 11, paddingTop: 13 }}>
          <CurrencyInput
            label="설정 예산"
            required
            value={draftAmount}
            onChangeValue={setDraftAmount}
          />
          <View
            style={{
              borderRadius: 11,
              backgroundColor: "#f5f6f8",
              padding: 11,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
              {(draftAmount ?? 0) >= plannedTotal
                ? `세부 계획 외 ${((draftAmount ?? 0) - plannedTotal).toLocaleString("ko-KR")}원이 여유 예산으로 배정돼요.`
                : `세부 계획 합계보다 ${(plannedTotal - (draftAmount ?? 0)).toLocaleString("ko-KR")}원 부족해요.`}
            </Text>
            <Text style={{ marginTop: 5, fontSize: 10, color: "#9aa1ab" }}>
              추천 금액은{" "}
              {data.category.recommended_amount.toLocaleString("ko-KR")}
              원이에요.
            </Text>
          </View>
        </View>
      </BottomSheet>

      {toast ? (
        <View
          style={{
            position: "absolute",
            bottom: 96,
            alignSelf: "center",
            backgroundColor: "#151b27",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
          onLayout={() => setTimeout(() => setToast(null), 1600)}
        >
          <Text style={{ color: "#fff", fontSize: 11 }}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}
