// ============================================================================
// TRIP-HOME-01 여행 준비 홈 / TRIP-HOME-02 종료 상태 여행 홈  ·  /trips/:tripId
//
// **같은 라우트를 trip.status 로 분기한다.** (docs/04_v3 §5, docs/09 §2-2)
//   PLANNING / TRAVELING → 준비 홈 (TRIP-HOME-01)
//   ENDED / SETTLED      → 종료 홈 (TRIP-HOME-02)
//
// ⚠️ useScreenView 에 trip.status 를 반드시 넘긴다.
//    screen_name 만으로는 둘이 구별되지 않아 "종료된 여행 홈에 들어온 사람 중
//    몇 명이 결산을 확정했는가"를 잴 수 없다. 결산 도달률의 분모가 사라진다.
//    (docs/06 §7-0)
//
// 생성 이후의 **핵심 상시 화면**이다. "우리 여행 준비가 지금 어느 정도 됐지?"
// 에 답한다. (docs/02 §3)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/trip-home/.
// ============================================================================
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  BudgetVaultList,
  FundProgressCard,
  RecentTransactionList,
  TripSummaryCard,
  type RecentTransaction,
  type VaultCategory,
} from '@/components/trip-home';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import {
  FUND_SOURCE_TYPE,
  TRIP_STATUS,
  type CategoryCode,
  type FundSourceType,
  type TransactionType,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getBudgetByTripId,
  getBudgetCategories,
  type BudgetCategory,
  type TripBudget,
} from '@/lib/supabase/queries/budgets';
import { getTravelFund, type FundSource } from '@/lib/supabase/queries/funds';
import { getGroupById } from '@/lib/supabase/queries/groups';
import { getTransactions, type Transaction } from '@/lib/supabase/queries/transactions';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

/** 준비 홈에 보여줄 최근 내역 건수. 전체는 FUND-01 이 담당한다. */
const RECENT_LIMIT = 5;

type TripHomeData = {
  trip: Trip;
  budget: TripBudget | null;
  categories: BudgetCategory[];
  fund: FundSource | null;
  transactions: Transaction[];
  groupName: string | null;
};

export default function ScreenTripHome() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [data, setData] = useState<TripHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  /** 여행 자체가 없을 때. 잘못된 tripId 로 들어와도 Crash 하지 않는다 */
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

      // 여행을 찾은 뒤에야 나머지를 붙인다. 예산·자금이 없어도 화면은 떠야 한다.
      // (생성이 중간에 끊긴 여행이라도 최소한 요약은 보여준다)
      const budget = await getBudgetByTripId(trip.id);
      const [categories, fund, transactions, group] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getTravelFund(trip.id),
        getTransactions(trip.id, { limit: RECENT_LIMIT }),
        trip.group_id ? getGroupById(trip.group_id) : Promise.resolve(null),
      ]);

      setData({
        trip,
        budget,
        categories,
        fund,
        transactions,
        groupName: group?.name ?? null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // ── 화면 진입 로그 ────────────────────────────────────────────────────
  // trip_status 는 이 화면에서만 채운다. 아직 못 불러왔으면 null 로 나간다.
  useScreenView(SCREENS.TRIP_HOME, (data?.trip.status as TripStatus | undefined) ?? null);

  // ── 파생값 ────────────────────────────────────────────────────────────
  const vaultCategories: VaultCategory[] = useMemo(
    () =>
      (data?.categories ?? []).map((category) => ({
        id: category.id,
        categoryCode: category.category_code as CategoryCode,
        plannedAmount: category.planned_amount,
        actualAmount: category.actual_amount,
      })),
    [data?.categories],
  );

  const recentTransactions: RecentTransaction[] = useMemo(() => {
    const byId = new Map((data?.categories ?? []).map((c) => [c.id, c.category_code]));
    return (data?.transactions ?? []).map((transaction) => ({
      id: transaction.id,
      merchantName: transaction.name,
      amount: transaction.amount,
      transactionType: transaction.transaction_type as TransactionType,
      occurredAt: transaction.occurred_at,
      categoryCode: transaction.budget_category_id
        ? ((byId.get(transaction.budget_category_id) as CategoryCode | undefined) ?? null)
        : null,
    }));
  }, [data?.categories, data?.transactions]);

  const daysLeft = useMemo(() => {
    if (!data?.trip.start_date) return null;
    const left = differenceInCalendarDays(parseISO(data.trip.start_date), new Date());
    return left > 0 ? left : null;
  }, [data?.trip.start_date]);

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '여행 홈' }} />
        <Loading message="여행 정보를 불러오는 중…" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '여행 홈' }} />
        <EmptyState
          icon="airplane-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '여행 홈' }} />
        <ErrorState message="여행 정보를 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  const { trip, budget, fund } = data;
  const status = trip.status as TripStatus;
  const ended = status === TRIP_STATUS.ENDED || status === TRIP_STATUS.SETTLED;

  const targetAmount = budget?.target_amount ?? 0;
  // 카테고리 행은 있어도 계획액이 전부 0이면 사용자가 아직 확정하지 않은 것이다.
  // 시드의 오사카가 그렇다. 0원 / 0원 행 8개를 보여줘도 알려주는 게 없다.
  const budgetConfirmed = targetAmount > 0;
  const currentAmount = fund?.current_amount ?? 0;
  const actualTotal = data.categories.reduce((sum, c) => sum + c.actual_amount, 0);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-5 pb-10 pt-4 gap-6"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Stack.Screen options={{ title: trip.destination ?? '여행 홈' }} />

      <TripSummaryCard
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={trip.end_date}
        headcount={trip.headcount}
        status={status}
        groupName={data.groupName}
      />

      {ended ? (
        // ── TRIP-HOME-02 종료 상태 ──────────────────────────────────────
        <>
          <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">목표 여행비</Text>
              <Text className="text-base font-semibold text-gray-900">
                {targetAmount.toLocaleString('ko-KR')}원
              </Text>
            </View>
            <View className="h-px bg-gray-100" />
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">실제 여행비</Text>
              <Text className="text-base font-semibold text-gray-900">
                {actualTotal.toLocaleString('ko-KR')}원
              </Text>
            </View>
            {targetAmount > 0 ? (
              <Text
                className={`text-right text-sm font-medium ${
                  actualTotal > targetAmount ? 'text-red-500' : 'text-blue-600'
                }`}
              >
                {actualTotal > targetAmount ? '+' : ''}
                {(actualTotal - targetAmount).toLocaleString('ko-KR')}원
              </Text>
            ) : null}
          </View>

          <View className="gap-2.5">
            <Button
              label="여행비 결산 보기"
              onPress={() => router.push(`/trips/${trip.id}/settlement`)}
            />
            <Button
              label="같은 멤버로 다시 여행 만들기"
              variant="secondary"
              onPress={() => router.push('/trips/new/owner?entryPoint=past_trip')}
            />
          </View>
        </>
      ) : (
        // ── TRIP-HOME-01 준비 중 ────────────────────────────────────────
        <>
          <FundProgressCard
            targetAmount={targetAmount}
            currentAmount={currentAmount}
            headcount={trip.headcount}
            fundSourceType={(fund?.source_type as FundSourceType) ?? FUND_SOURCE_TYPE.ZERO}
            maskedAccountNumber={null}
            daysLeft={daysLeft}
            onSetBudget={() => router.push(`/trips/${trip.id}/budget`)}
          />

          {/* 가상 여행 금고 */}
          <View className="gap-2.5">
            <View className="flex-row items-end justify-between">
              <Text className="text-base font-semibold text-gray-900">가상 여행 금고</Text>
              <Text className="text-xs text-gray-400">항목을 눌러 자세히 보기</Text>
            </View>

            {vaultCategories.length > 0 && budgetConfirmed ? (
              <BudgetVaultList
                categories={vaultCategories}
                onSelect={(categoryId) =>
                  router.push(`/trips/${trip.id}/budget/${categoryId}`)
                }
              />
            ) : (
              <View className="items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-8">
                <Text className="text-sm text-gray-500">아직 예산을 정하지 않았어요.</Text>
                <Button
                  label="예산 정하기"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => router.push(`/trips/${trip.id}/budget`)}
                />
              </View>
            )}
          </View>

          {/* 최근 여행자금 내역 */}
          <View className="gap-2.5">
            {/*
              '전체 보기'(FUND-01)와 거래 상세(FUND-03)는 둘 다 고도화 화면이다.
              MVP 에서는 링크를 붙이지 않는다. 눌렀는데 빈 뼈대가 뜨는 것보다
              아예 없는 편이 낫다. (docs/README.md §5 #19)
            */}
            <Text className="text-base font-semibold text-gray-900">최근 여행자금 내역</Text>

            {recentTransactions.length > 0 ? (
              <RecentTransactionList transactions={recentTransactions} />
            ) : (
              <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-8">
                <Text className="text-sm text-gray-500">아직 거래 내역이 없어요.</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
