// ============================================================================
// BUDGET-02 카테고리 상세  ·  /trips/:tripId/budget/:categoryId
//
// "이 카테고리에서 돈을 어디에 쓸 계획이지?" 에 답한다.
//
// TRIP-03 의 추천 근거가 "이 금액이 어디서 나왔나" 라면,
// 여기는 **"그 돈을 실제로 어디에 쓸 건가"** 다.
//   식비 720,000원  →  스시로 시부야 70,000 / 이치란 신주쿠 50,000 / …
//
// 하는 일
//   ① 카테고리 요약 (설정·배분·실제·잔여, 준비율·사용률)
//   ② 설정 예산 수정 → budget_category_edited
//   ③ 세부 계획 항목 추가·수정·삭제
//   ④ 이 카테고리의 실제 지출 (읽기 전용)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/budget/.
// ============================================================================
import { format, parseISO } from 'date-fns';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  CategoryOverviewCard,
  PlanItemList,
  type PlanItem,
  type PlanItemDraft,
} from '@/components/budget';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { EVENTS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { perPerson } from '@/lib/budget/recommendation';
import {
  APPLIED_SOURCE,
  CATEGORY_CODE_LABEL,
  CATEGORY_CODE_TO_ANALYTICS,
  TRANSACTION_TYPE,
  type BudgetPlanItemStatus,
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
import { getTransactions, type Transaction } from '@/lib/supabase/queries/transactions';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

type CategoryData = {
  trip: Trip;
  budget: TripBudget;
  /** 이 여행의 전체 카테고리. 예산 수정 시 목표 총액을 다시 더하는 데 필요하다 */
  allCategories: BudgetCategory[];
  category: BudgetCategory;
  items: BudgetPlanItem[];
  transactions: Transaction[];
};

export default function ScreenBUDGET02() {
  const { tripId, categoryId } = useLocalSearchParams<{ tripId: string; categoryId: string }>();

  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

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

      const [items, transactions] = await Promise.all([
        getBudgetPlanItems(category.id),
        getTransactions(trip.id, {
          categoryId: category.id,
          transactionType: TRANSACTION_TYPE.WITHDRAWAL,
        }),
      ]);

      setData({ trip, budget, allCategories, category, items, transactions });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // ── ② 설정 예산 수정 ──────────────────────────────────────────────────
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

      // 카테고리 합이 곧 목표 여행비다. 하나가 바뀌면 총액도 바뀐다.
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
    } catch {
      setError(true);
    } finally {
      setSavingBudget(false);
    }
  }, [data, draftAmount, load, savingBudget]);

  // ── ③ 세부 계획 항목 ──────────────────────────────────────────────────
  const [draft, setDraft] = useState<PlanItemDraft | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const analyticsCategory = data
    ? CATEGORY_CODE_TO_ANALYTICS[data.category.category_code as CategoryCode]
    : null;

  const handleSaveItem = useCallback(async () => {
    if (!data || !draft || savingItem) return;

    const name = draft.name.trim();
    if (!name) {
      setNameError('항목 이름을 입력해 주세요.');
      return;
    }
    const expected = draft.expectedAmount ?? 0;

    setSavingItem(true);
    try {
      if (draft.id) {
        await updateBudgetPlanItem(draft.id, { name, expected_amount: expected });
        track(EVENTS.BUDGET_PLAN_ITEM_EDITED, {
          trip_id: data.trip.id,
          category: analyticsCategory,
          item_id: draft.id,
        });
      } else {
        const created = await createBudgetPlanItem({
          budget_category_id: data.category.id,
          name,
          expected_amount: expected,
          // 새 항목은 아직 쓰지 않은 계획이다
          sort_order: data.items.length + 1,
        });
        track(EVENTS.BUDGET_PLAN_ITEM_ADDED, {
          trip_id: data.trip.id,
          category: analyticsCategory,
          planned_amount: expected,
          item_id: created.id,
        });
      }

      setDraft(null);
      setNameError(null);
      await load();
    } catch {
      setError(true);
    } finally {
      setSavingItem(false);
    }
  }, [analyticsCategory, data, draft, load, savingItem]);

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!data || deletingId) return;
      setDeletingId(itemId);
      try {
        await deleteBudgetPlanItem(itemId);
        track(EVENTS.BUDGET_PLAN_ITEM_DELETED, {
          trip_id: data.trip.id,
          category: analyticsCategory,
          item_id: itemId,
        });
        setDraft(null);
        await load();
      } catch {
        setError(true);
      } finally {
        setDeletingId(null);
      }
    },
    [analyticsCategory, data, deletingId, load],
  );

  // ── 파생값 ────────────────────────────────────────────────────────────
  const planItems: PlanItem[] = useMemo(
    () =>
      (data?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        expectedAmount: item.expected_amount,
        actualAmount: item.actual_amount,
        status: item.status as BudgetPlanItemStatus,
      })),
    [data?.items],
  );

  const plannedByItems = useMemo(
    () => planItems.reduce((sum, item) => sum + item.expectedAmount, 0),
    [planItems],
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
        <ErrorState message="카테고리를 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  const label = CATEGORY_CODE_LABEL[data.category.category_code as CategoryCode];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-5 pb-10 pt-4 gap-6"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Stack.Screen options={{ title: label }} />

      <CategoryOverviewCard
        plannedAmount={data.category.planned_amount}
        preparedAmount={data.category.prepared_amount}
        actualAmount={data.category.actual_amount}
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
        onSave={() => void handleSaveBudget()}
        saving={savingBudget}
      />

      {/* ── 세부 계획 항목 ── */}
      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-base font-semibold text-gray-900">세부 계획</Text>
          {planItems.length > 0 ? (
            <Text className="text-xs text-gray-400">
              합계 {plannedByItems.toLocaleString('ko-KR')}원
            </Text>
          ) : null}
        </View>

        <PlanItemList
          items={planItems}
          draft={draft}
          nameError={nameError}
          saving={savingItem}
          deletingId={deletingId}
          onStartAdd={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setDraft({ id: null, name: '', expectedAmount: null });
            setNameError(null);
          }}
          onStartEdit={(item) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setDraft({ id: item.id, name: item.name, expectedAmount: item.expectedAmount });
            setNameError(null);
          }}
          onChangeDraft={(next) => {
            setDraft(next);
            if (nameError) setNameError(null);
          }}
          onCancel={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setDraft(null);
            setNameError(null);
          }}
          onSave={() => void handleSaveItem()}
          onDelete={(itemId) => void handleDeleteItem(itemId)}
        />

        {/* 계획 항목 합이 설정 예산을 넘으면 알린다. 막지는 않는다 */}
        {plannedByItems > data.category.planned_amount ? (
          <Text className="px-1 text-xs text-red-500">
            계획한 항목의 합이 설정 예산보다{' '}
            {(plannedByItems - data.category.planned_amount).toLocaleString('ko-KR')}원 많아요.
          </Text>
        ) : null}
      </View>

      {/* ── 실제 지출 ── */}
      {/*
        거래 상세(FUND-03)는 고도화 화면이라 링크를 붙이지 않는다.
        읽기 전용으로 보여준다. (docs/README.md §5 #19)
      */}
      <View className="gap-2.5">
        <Text className="text-base font-semibold text-gray-900">실제 지출</Text>

        {data.transactions.length > 0 ? (
          <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {data.transactions.map((transaction, index) => (
              <View
                key={transaction.id}
                className={`flex-row items-center justify-between px-4 py-3.5 ${
                  index > 0 ? 'border-t border-gray-100' : ''
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text numberOfLines={1} className="text-base text-gray-800">
                    {transaction.name ?? '이름 없는 거래'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    {format(parseISO(transaction.occurred_at), 'M월 d일')}
                  </Text>
                </View>
                <Text className="text-base font-semibold text-gray-900">
                  {transaction.amount.toLocaleString('ko-KR')}원
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-8">
            <Text className="text-sm text-gray-500">아직 이 카테고리의 지출이 없어요.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
