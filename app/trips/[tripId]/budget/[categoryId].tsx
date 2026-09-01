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
import { format } from 'date-fns';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, ScrollView, Text, View } from 'react-native';

import {
  CategoryHeroCard,
  ExpenseCard,
  PlanItemCard,
  type ExpenseDraft,
  type ExpenseItem,
  type PlanDraft,
  type PlanItem,
} from '@/components/budget';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { EVENTS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { perPerson } from '@/lib/budget/recommendation';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  APPLIED_SOURCE,
  BUDGET_PLAN_ITEM_STATUS,
  CATEGORY_CODE,
  CATEGORY_CODE_LABEL,
  CATEGORY_CODE_TO_ANALYTICS,
  CATEGORY_METHOD,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  type CategoryCode,
} from '@/lib/constants/status';
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
} from '@/lib/supabase/queries/budgets';
import { getGroupAccounts } from '@/lib/supabase/queries/funds';
import {
  createTransaction,
  getTransactions,
  type Transaction,
} from '@/lib/supabase/queries/transactions';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

/** 카테고리별 대표 이모지. 계획 항목 썸네일 기본값으로도 쓴다 */
const CATEGORY_EMOJI: Record<CategoryCode, string> = {
  [CATEGORY_CODE.AIRFARE]: '✈️',
  [CATEGORY_CODE.LODGING]: '🏨',
  [CATEGORY_CODE.FOOD]: '🍽️',
  [CATEGORY_CODE.TRANSPORT]: '🚇',
  [CATEGORY_CODE.ACTIVITY]: '🎡',
  [CATEGORY_CODE.SHOPPING]: '🛍️',
  [CATEGORY_CODE.INSURANCE]: '🛡️',
  [CATEGORY_CODE.CONTINGENCY]: '💰',
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
  const { tripId, categoryId } = useLocalSearchParams<{ tripId: string; categoryId: string }>();

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
        category: CATEGORY_CODE_TO_ANALYTICS[data.category.category_code as CategoryCode],
        from_amount: from,
        to_amount: next,
        applied_source: APPLIED_SOURCE.USER,
      });

      setEditingBudget(false);
      await load();
      setToast('예산을 저장했어요');
    } catch {
      setError(true);
    } finally {
      setSavingBudget(false);
    }
  }, [data, draftAmount, load, savingBudget]);

  // ── 계획 항목 (로컬) ──────────────────────────────────────────────────
  const [addingPlan, setAddingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState<PlanDraft>({ name: '', amount: null });
  const [planNameError, setPlanNameError] = useState<string | null>(null);

  // ⚠️ 체크 해제는 **즉시 반영**한다. 따로 저장을 누르지 않아도 예산에 적용된다.
  //    화면 수치를 먼저 바꾸고 저장은 뒤에서 돌린다. 실패하면 되돌린다.
  const handleTogglePlan = useCallback(
    (id: string) => {
      const target = plans.find((item) => item.id === id);
      if (!target || target.locked) return;

      const nextSelected = !target.selected;
      setPlans((prev) =>
        prev.map((item) => (item.id === id ? { ...item, selected: nextSelected } : item)),
      );

      void updateBudgetPlanItem(id, {
        status: nextSelected
          ? BUDGET_PLAN_ITEM_STATUS.PLANNED
          : BUDGET_PLAN_ITEM_STATUS.CANCELED,
      })
        .then(() => {
          if (!data) return;
          track(EVENTS.BUDGET_PLAN_ITEM_EDITED, {
            trip_id: data.trip.id,
            category: CATEGORY_CODE_TO_ANALYTICS[data.category.category_code as CategoryCode],
            item_id: id,
          });
        })
        .catch(() => {
          // 저장이 실패하면 화면도 되돌린다. 안 그러면 새로고침 때 값이 튄다
          setPlans((prev) =>
            prev.map((item) => (item.id === id ? { ...item, selected: target.selected } : item)),
          );
          setToast('변경을 저장하지 못했어요');
        });
    },
    [data, plans],
  );

  const handleDeletePlan = useCallback(
    (id: string) => {
      const target = plans.find((item) => item.id === id);
      if (!target || target.locked) return;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPlans((prev) => prev.filter((item) => item.id !== id));

      void deleteBudgetPlanItem(id)
        .then(() => {
          if (!data) return;
          track(EVENTS.BUDGET_PLAN_ITEM_DELETED, {
            trip_id: data.trip.id,
            category: CATEGORY_CODE_TO_ANALYTICS[data.category.category_code as CategoryCode],
            item_id: id,
          });
        })
        .catch(() => {
          setPlans((prev) => [...prev, target]);
          setToast('삭제하지 못했어요');
        });
    },
    [data, plans],
  );

  const handleConfirmAddPlan = useCallback(async () => {
    if (!data) return;
    const name = planDraft.name.trim();
    if (!name) {
      setPlanNameError('항목 이름을 입력해 주세요.');
      return;
    }

    try {
      const created = await createBudgetPlanItem({
        budget_category_id: data.category.id,
        name,
        expected_amount: planDraft.amount ?? 0,
        status: BUDGET_PLAN_ITEM_STATUS.PLANNED,
        sort_order: plans.length + 1,
      });
      track(EVENTS.BUDGET_PLAN_ITEM_ADDED, {
        trip_id: data.trip.id,
        category: CATEGORY_CODE_TO_ANALYTICS[data.category.category_code as CategoryCode],
        planned_amount: planDraft.amount ?? 0,
        item_id: created.id,
      });

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPlans((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          expectedAmount: created.expected_amount,
          actualAmount: 0,
          selected: true,
          emoji: CATEGORY_EMOJI[data.category.category_code as CategoryCode],
          locked: false,
        },
      ]);
      setPlanDraft({ name: '', amount: null });
      setPlanNameError(null);
      setAddingPlan(false);
    } catch {
      setToast('추가하지 못했어요');
    }
  }, [data, planDraft, plans.length]);

  // ── 지출 직접 입력 (로컬) ─────────────────────────────────────────────
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => ({
    name: '',
    amount: null,
    // 기본은 오늘. 폼에서 바꿀 수 있다
    occurredOn: format(new Date(), 'yyyy-MM-dd'),
  }));
  const [expenseNameError, setExpenseNameError] = useState<string | null>(null);

  // ⚠️ 지출도 즉시 반영한다. 실제로 쓴 돈이라 미뤄둘 이유가 없다.
  const handleConfirmAddExpense = useCallback(async () => {
    if (!data) return;
    const name = expenseDraft.name.trim();
    if (!name) {
      setExpenseNameError('지출 항목을 입력해 주세요.');
      return;
    }
    if (!expenseDraft.amount || expenseDraft.amount <= 0) {
      setExpenseNameError('금액을 입력해 주세요.');
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

      setExpenseDraft({ name: '', amount: null, occurredOn: format(new Date(), 'yyyy-MM-dd') });
      setExpenseNameError(null);
      setAddingExpense(false);
      await load();
      setToast('지출을 기록했어요');
    } catch {
      setToast('저장하지 못했어요');
    }
  }, [data, expenseDraft, load]);

  // ── 파생값 ────────────────────────────────────────────────────────────
  // 한 건 더 받아왔으므로 초과분이 있으면 '전체 내역 보기' 를 띄운다
  const hasMoreExpenses = (data?.transactions.length ?? 0) > RECENT_EXPENSE_LIMIT;

  const expenses: ExpenseItem[] = useMemo(
    () =>
      (data?.transactions ?? []).slice(0, RECENT_EXPENSE_LIMIT).map((transaction) => ({
        id: transaction.id,
        name: transaction.name ?? '이름 없는 거래',
        amount: transaction.amount,
        occurredAt: transaction.occurred_at,
        auto: transaction.category_method === CATEGORY_METHOD.AUTO,
      })),
    [data?.transactions],
  );

  const plannedTotal = useMemo(
    () => plans.filter((plan) => plan.selected).reduce((sum, plan) => sum + plan.expectedAmount, 0),
    [plans],
  );
  const spentTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const theme = useMemo(
    () => countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '카테고리' }} />
        <Loading message="불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '카테고리' }} />
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
        <Stack.Screen options={{ title: '카테고리' }} />
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
            (new Date(data.trip.end_date).getTime() - new Date(data.trip.start_date).getTime()) /
              86400000,
          ),
        )
      : null;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: label }} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 여행 메타 */}
        <View className="flex-row items-center justify-between" style={{ marginHorizontal: 3, marginBottom: 14 }}>
          <Text style={{ fontSize: 11, color: '#7d8797' }}>
            {[
              data.trip.destination,
              nights !== null ? `${nights}박 ${nights + 1}일` : null,
              `${data.trip.headcount}명`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View
            style={{ backgroundColor: theme.primarySoft, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '700' }}>
              {destinationMeta?.flag ?? '🌍'} {destinationMeta?.nameEn ?? theme.code}
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
          editing={editingBudget}
          draftAmount={draftAmount}
          onStartEdit={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setDraftAmount(data.category.planned_amount);
            setEditingBudget(true);
          }}
          onCancelEdit={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setEditingBudget(false);
          }}
          onChangeDraft={setDraftAmount}
          onSaveEdit={() => void handleSaveBudget()}
          saving={savingBudget}
        />

        {/* 세부 계획 */}
        <View style={{ marginTop: 27 }}>
          <View className="flex-row items-end justify-between" style={{ marginHorizontal: 3, marginBottom: 11 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#121a2a' }}>세부 계획</Text>
            <Text style={{ fontSize: 10, color: '#7d8797' }}>
              {plans.filter((plan) => plan.selected).length}개 선택됨
            </Text>
          </View>
          <PlanItemCard
            items={plans}
            headcount={data.trip.headcount}
            theme={theme}
            onToggle={handleTogglePlan}
            onDelete={handleDeletePlan}
            adding={addingPlan}
            draft={planDraft}
            nameError={planNameError}
            onStartAdd={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setAddingPlan(true);
            }}
            onChangeDraft={(next) => {
              setPlanDraft(next);
              if (planNameError) setPlanNameError(null);
            }}
            onCancelAdd={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setAddingPlan(false);
              setPlanNameError(null);
            }}
            onConfirmAdd={() => void handleConfirmAddPlan()}
          />
        </View>

        {/* 실제 지출 */}
        <View style={{ marginTop: 27 }}>
          <View className="flex-row items-end justify-between" style={{ marginHorizontal: 3, marginBottom: 11 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#121a2a' }}>실제 지출</Text>
            <Text style={{ fontSize: 10, color: '#7d8797' }}>계획과 비교해요</Text>
          </View>
          <ExpenseCard
            expenses={expenses}
            theme={theme}
            // 연결 계좌 안내는 전체 내역(FUND-01)에서만 보여준다.
            // 카테고리 화면에서는 지출 자체에 집중하게 한다
            maskedAccountNumber={null}
            adding={addingExpense}
            draft={expenseDraft}
            nameError={expenseNameError}
            onStartAdd={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setAddingExpense(true);
            }}
            onChangeDraft={(next) => {
              setExpenseDraft(next);
              if (expenseNameError) setExpenseNameError(null);
            }}
            onCancelAdd={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setAddingExpense(false);
              setExpenseNameError(null);
            }}
            onConfirmAdd={() => void handleConfirmAddExpense()}
            onPressMore={
              hasMoreExpenses
                ? () =>
                    router.push(
                      `/trips/${data.trip.id}/funds?categoryId=${data.category.id}`,
                    )
                : undefined
            }
          />

          <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: '#fff7e7', padding: 12 }}>
            <Text style={{ fontSize: 10, lineHeight: 15, color: '#76643f' }}>
              <Text style={{ fontWeight: '700', color: '#3e3526' }}>자동 분류가 다르면?</Text>
              {'\n'}거래를 눌러 카테고리를 바꾸는 기능은 준비 중이에요. 지금은 직접 입력으로
              보완할 수 있어요.
            </Text>
          </View>
        </View>
      </ScrollView>

      {toast ? (
        <View
          style={{
            position: 'absolute',
            bottom: 96,
            alignSelf: 'center',
            backgroundColor: '#151b27',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
          onLayout={() => setTimeout(() => setToast(null), 1600)}
        >
          <Text style={{ color: '#fff', fontSize: 11 }}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}
