// ============================================================================
// BUDGET-01 예산 상세  ·  /trips/:tripId/budget
//
// **서비스의 중심 데이터 화면이다.** 거래내역이 아니라 예산 계획을 먼저 보여준다.
// "이번 여행에서 어디에 얼마를 쓸 계획이지?" 에 답한다. (docs/09 §2-3)
//
// 하는 일
//   ① 전체 예산 현황 (목표·준비·실제·잔여·사용률)
//   ② 카테고리 8개 → BUDGET-02
//   ③ 가상 금고 배분 계산·저장 (lib/budget/vault.ts)
//   ④ 예산 미확정 여행이면 추천값으로 확정
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/budget/.
// ============================================================================
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  BudgetCategoryRow,
  BudgetOverviewCard,
  PersonalizationBanner,
  type BudgetCategoryRowData,
  type PersonalizationItem,
} from '@/components/budget';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { EVENTS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { perPerson } from '@/lib/budget/recommendation';
import { allocateVault } from '@/lib/budget/vault';
import {
  APPLIED_SOURCE,
  CATEGORY_CODE_TO_ANALYTICS,
  TRIP_OWNER_TYPE,
  type CategoryCode,
} from '@/lib/constants/status';
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  getBudgetByTripId,
  getBudgetCategories,
  updateBudgetCategoriesPrepared,
  updateBudgetCategory,
  updateTripBudget,
  type BudgetCategory,
  type TripBudget,
} from '@/lib/supabase/queries/budgets';
import { getTravelFund, type FundSource } from '@/lib/supabase/queries/funds';
import {
  applyPersonalizedBudget,
  getPersonalizedBudget,
  savePersonalizedAmounts,
  type PersonalizedBudgetSuggestion,
} from '@/lib/supabase/queries/personalization';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

type BudgetData = {
  trip: Trip;
  budget: TripBudget;
  categories: BudgetCategory[];
  fund: FundSource | null;
};

export default function ScreenBUDGET01() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** 이번 진입에서 금고 배분을 이미 저장했는지 */
  const syncedRef = useRef(false);

  // ── 개인화 제안 ───────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<PersonalizedBudgetSuggestion[]>([]);
  const [basedOnTripCount, setBasedOnTripCount] = useState(0);
  const [personalizationExpanded, setPersonalizationExpanded] = useState(false);
  const [applyingPersonalization, setApplyingPersonalization] = useState(false);
  /** 이번 진입에서 사용자가 제안을 닫았는가. 닫으면 다시 띄우지 않는다 */
  const [personalizationDismissed, setPersonalizationDismissed] = useState(false);
  /** personalization_offered 를 이 진입에서 이미 쐈는지 */
  const offeredRef = useRef(false);

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
      if (!budget) {
        setNotFound(true);
        return;
      }
      const [categories, fund] = await Promise.all([
        getBudgetCategories(budget.id),
        getTravelFund(trip.id),
      ]);

      setData({ trip, budget, categories, fund });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  // 화면에 들어올 때마다 다시 읽는다.
  //
  // useEffect 는 최초 마운트에서만 돈다. 예산 상세에서 금액을 고치고 돌아오거나,
  // 자금이 바뀐 뒤 다시 들어오면 옛 숫자가 그대로 남는다.
  // 금액을 보여주는 화면에서 옛 값은 틀린 값이다.
  useFocusEffect(
    useCallback(() => {
      syncedRef.current = false;
      void load();
    }, [load]),
  );

  // ── 가상 금고 배분 ────────────────────────────────────────────────────
  //
  // 현재 여행자금을 결제 시점이 빠른 카테고리부터 채운다. (lib/budget/vault.ts)
  // 자금이 바뀌면 배분도 달라지므로, 화면에 들어올 때 다시 계산해 저장한다.
  // 저장된 값과 같으면 쓰지 않는다. 들어올 때마다 8번씩 UPDATE 하지 않는다.
  useEffect(() => {
    if (!data || syncedRef.current) return;

    const allocations = allocateVault(
      data.fund?.current_amount ?? 0,
      data.categories.map((category) => ({
        categoryCode: category.category_code as CategoryCode,
        plannedAmount: category.planned_amount,
      })),
    );

    const changed = allocations
      .map((allocation, index) => ({
        id: data.categories[index].id,
        preparedAmount: allocation.preparedAmount,
        stored: data.categories[index].prepared_amount,
      }))
      .filter((item) => item.preparedAmount !== item.stored);

    if (changed.length === 0) {
      syncedRef.current = true;
      return;
    }

    syncedRef.current = true;
    void updateBudgetCategoriesPrepared(
      changed.map(({ id, preparedAmount }) => ({ id, preparedAmount })),
    )
      .then(() =>
        setData((prev) =>
          prev
            ? {
                ...prev,
                categories: prev.categories.map((category, index) => ({
                  ...category,
                  prepared_amount: allocations[index].preparedAmount,
                })),
              }
            : prev,
        ),
      )
      // 배분 저장이 실패해도 화면은 계속 보여준다. 다음 진입에서 다시 시도한다.
      .catch(() => undefined);
  }, [data]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    syncedRef.current = false;
    void load();
  }, [load]);

  // ── 개인화 제안 불러오기 ──────────────────────────────────────────────
  //
  // ⚠️ 개인 여행 데이터는 개인에, 모임 여행 데이터는 해당 모임에만 누적한다.
  //    다른 소유 단위로 승계하지 않는다. (docs/06 §7-6 확정 정책)
  //    그래서 scope 를 여행의 소유 단위에서 그대로 가져온다.
  useEffect(() => {
    if (!data || offeredRef.current) return;
    // 예산을 아직 확정하지 않았으면 비교할 기준이 없다. 확정 후에 제안한다.
    if (data.budget.target_amount <= 0) return;

    offeredRef.current = true;

    const scope =
      data.trip.owner_type === TRIP_OWNER_TYPE.GROUP && data.trip.group_id
        ? ({ ownerType: 'GROUP', groupId: data.trip.group_id } as const)
        : // TODO: 로그인 연동 시 교체
          ({ ownerType: 'PERSONAL', userId: data.trip.owner_user_id ?? DEV_USER_ID } as const);

    void getPersonalizedBudget(data.trip.id, scope)
      .then(async (result) => {
        if (result.length === 0) return;

        // 제안값을 personalized_amount 에 저장해 둔다.
        // ⚠️ planned_amount 는 건드리지 않는다. 사용자가 확정하기 전이다.
        await savePersonalizedAmounts(result).catch(() => undefined);

        const first = result[0].basis as { basedOnTripCount: number; deviationBp: number };
        setSuggestions(result);
        setBasedOnTripCount(first.basedOnTripCount);

        // 제안을 실제로 보여준 시점에만 쏜다. 노출 모수다. (docs/06 §7-6)
        track(EVENTS.PERSONALIZATION_OFFERED, {
          trip_id: data.trip.id,
          based_on_trip_count: first.basedOnTripCount,
          top_category: CATEGORY_CODE_TO_ANALYTICS[result[0].category_code as CategoryCode],
          deviation_rate: first.deviationBp,
        });
      })
      // 개인화는 부가 기능이다. 실패해도 예산 화면은 그대로 보여준다.
      .catch(() => undefined);
  }, [data]);

  const handleApplyPersonalization = useCallback(async () => {
    if (!data || suggestions.length === 0 || applyingPersonalization) return;
    setApplyingPersonalization(true);

    try {
      // 여기가 개인화가 planned_amount 를 쓰는 **유일한 경로**다.
      // 사용자가 '반영하기' 를 눌렀을 때만 실행된다. (CLAUDE.md 4장)
      await applyPersonalizedBudget(suggestions);

      // 카테고리 합이 곧 목표 여행비다. 하나가 바뀌면 총액도 바뀐다.
      const changed = new Map(suggestions.map((sg) => [sg.id, sg.personalized_amount ?? 0]));
      const total = data.categories.reduce(
        (sum, category) => sum + (changed.get(category.id) ?? category.planned_amount),
        0,
      );
      await updateTripBudget(data.budget.id, {
        target_amount: total,
        per_person_amount: perPerson(total, data.trip.headcount),
      });

      // 저장에 성공한 뒤에만 쏜다. 가설 4 의 핵심 지표다.
      track(EVENTS.PERSONALIZATION_APPLIED, {
        trip_id: data.trip.id,
        applied: true,
      });

      setSuggestions([]);
      syncedRef.current = false;
      await load();
    } catch {
      setError(true);
    } finally {
      setApplyingPersonalization(false);
    }
  }, [applyingPersonalization, data, load, suggestions]);

  const handleDismissPersonalization = useCallback(() => {
    if (!data) return;
    setPersonalizationDismissed(true);
    // 거절도 기록해야 한다. 노출 대비 반영률의 분모가 성립한다.
    track(EVENTS.PERSONALIZATION_APPLIED, {
      trip_id: data.trip.id,
      applied: false,
    });
  }, [data]);

  // ── 예산 확정 (미확정 여행) ───────────────────────────────────────────
  //
  // 추천값(recommended_amount)은 이미 있다. 사용자가 확정만 하면 된다.
  // 시드의 오사카가 이 상태다.
  const handleConfirmRecommended = useCallback(async () => {
    if (!data || confirming) return;
    setConfirming(true);

    try {
      const total = data.categories.reduce((sum, c) => sum + c.recommended_amount, 0);

      await Promise.all(
        data.categories.map((category) =>
          updateBudgetCategory(category.id, {
            planned_amount: category.recommended_amount,
            // 추천을 그대로 받아들인 것이므로 'user' 가 아니다. (CLAUDE.md 4장)
            applied_source: APPLIED_SOURCE.DEFAULT,
          }),
        ),
      );

      await updateTripBudget(data.budget.id, {
        target_amount: total,
        per_person_amount: perPerson(total, data.trip.headcount),
        confirmed_at: new Date().toISOString(),
      });

      // 저장에 성공한 뒤에만 쏜다. (docs/06 §11)
      track(EVENTS.BUDGET_TARGET_CONFIRMED, {
        trip_id: data.trip.id,
        target_amount: total,
        member_count: data.trip.headcount,
        per_person_amount: perPerson(total, data.trip.headcount),
        // 추천을 그대로 받았으므로 수정한 카테고리가 없다
        edited_category_count: 0,
      });

      syncedRef.current = false;
      await load();
    } catch {
      setError(true);
    } finally {
      setConfirming(false);
    }
  }, [confirming, data, load]);

  // ── 파생값 ────────────────────────────────────────────────────────────
  const rows: BudgetCategoryRowData[] = useMemo(
    () =>
      (data?.categories ?? []).map((category) => ({
        id: category.id,
        categoryCode: category.category_code as CategoryCode,
        plannedAmount: category.planned_amount,
        preparedAmount: category.prepared_amount,
        actualAmount: category.actual_amount,
      })),
    [data?.categories],
  );

  const personalizationItems: PersonalizationItem[] = useMemo(() => {
    const byId = new Map((data?.categories ?? []).map((c) => [c.id, c]));
    return suggestions.flatMap((suggestion) => {
      const category = byId.get(suggestion.id);
      if (!category || suggestion.personalized_amount === null) return [];
      const basis = suggestion.basis as { deviationBp: number; clamped: boolean };
      return [
        {
          categoryId: suggestion.id,
          categoryCode: suggestion.category_code as CategoryCode,
          recommendedAmount: category.recommended_amount,
          personalizedAmount: suggestion.personalized_amount,
          deviationBp: basis.deviationBp,
          clamped: basis.clamped,
        },
      ];
    });
  }, [data?.categories, suggestions]);

  const totals = useMemo(() => {
    const categories = data?.categories ?? [];
    return {
      prepared: categories.reduce((sum, c) => sum + c.prepared_amount, 0),
      actual: categories.reduce((sum, c) => sum + c.actual_amount, 0),
      recommended: categories.reduce((sum, c) => sum + c.recommended_amount, 0),
    };
  }, [data?.categories]);

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '예산' }} />
        <Loading message="예산을 불러오는 중…" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '예산' }} />
        <EmptyState
          icon="wallet-outline"
          title="예산을 찾을 수 없어요"
          description="여행이 삭제되었거나 예산이 만들어지지 않았어요."
          actionLabel="여행 홈으로"
          onAction={() => router.replace(`/trips/${tripId}`)}
        />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '예산' }} />
        <ErrorState message="예산을 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  const confirmed = data.budget.target_amount > 0;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-5 pb-10 pt-4 gap-6"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Stack.Screen options={{ title: '예산' }} />

      {confirmed ? (
        <BudgetOverviewCard
          targetAmount={data.budget.target_amount}
          preparedAmount={totals.prepared}
          actualAmount={totals.actual}
        />
      ) : (
        // 아직 확정하지 않은 예산. 추천값은 이미 계산돼 있다.
        <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
          <View>
            <Text className="text-xs text-gray-500">추천 예산</Text>
            <Text className="mt-0.5 text-3xl font-bold text-gray-900">
              {totals.recommended.toLocaleString('ko-KR')}원
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              {data.trip.headcount}명 · 1인{' '}
              {perPerson(totals.recommended, data.trip.headcount).toLocaleString('ko-KR')}원
            </Text>
          </View>
          <Text className="text-xs leading-4 text-gray-500">
            아직 목표 여행비를 정하지 않았어요. 추천 금액으로 시작한 뒤 카테고리별로
            바꿀 수 있어요.
          </Text>
          <Button
            label="이 금액으로 확정하기"
            loading={confirming}
            onPress={() => void handleConfirmRecommended()}
          />
        </View>
      )}

      {/* 개인화 제안 — 추천 + 근거 → 사용자 확인 (CLAUDE.md 4장) */}
      {!personalizationDismissed && personalizationItems.length > 0 ? (
        <PersonalizationBanner
          basedOnTripCount={basedOnTripCount}
          items={personalizationItems}
          expanded={personalizationExpanded}
          onToggle={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setPersonalizationExpanded((prev) => !prev);
          }}
          onApply={() => void handleApplyPersonalization()}
          onDismiss={handleDismissPersonalization}
          applying={applyingPersonalization}
        />
      ) : null}

      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-base font-semibold text-gray-900">카테고리별 예산</Text>
          <Text className="text-xs text-gray-400">항목을 눌러 자세히 보기</Text>
        </View>

        <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {rows.map((row, index) => (
            <View
              key={row.id}
              className={index > 0 ? 'border-t border-gray-100' : undefined}
            >
              <BudgetCategoryRow
                category={row}
                onPress={(categoryId) =>
                  router.push(`/trips/${data.trip.id}/budget/${categoryId}`)
                }
              />
            </View>
          ))}
        </View>

        {confirmed ? (
          <Text className="px-1 text-xs leading-4 text-gray-400">
            연한 막대는 금고에 배분된 금액이에요. 결제 시점이 빠른 항공·숙소부터
            채워집니다.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
