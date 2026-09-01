// ============================================================================
// TRIP-HOME-01 여행 준비 홈 / TRIP-HOME-02 종료 상태 여행 홈  ·  /trips/:tripId
//
// **같은 라우트를 trip.status 로 분기한다.** (docs/04_v3 §5)
//   PLANNING / TRAVELING → 준비 홈
//   ENDED / SETTLED      → 종료 홈
//
// ⚠️ useScreenView 에 trip.status 를 반드시 넘긴다. 없으면 "종료된 여행 홈에
//    들어온 사람 중 몇 명이 결산을 확정했는가" 를 잴 수 없다. (docs/06 §7-0)
//
// 이 화면은 금융 대시보드가 아니다. **돈을 모을수록 여행이 가까워지는 경험**을
// 보여준다. 티켓의 비행기가 준비율만큼 도착지로 움직이는 게 그 장치다.
//
// 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/trip-home/.
// ============================================================================
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  JourneySteps,
  RecentTransactionList,
  TravelTicketCard,
  TripGuideCards,
  VaultGrid,
  type RecentTransaction,
  type VaultCategory,
} from '@/components/trip-home';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { allocateVault, journeyStages } from '@/lib/budget/vault';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  TRIP_STATUS,
  type CategoryCode,
  type TransactionType,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getBudgetByTripId,
  getBudgetCategories,
  updateBudgetCategoriesPrepared,
  type BudgetCategory,
  type TripBudget,
} from '@/lib/supabase/queries/budgets';
import { getTravelFund, type FundSource } from '@/lib/supabase/queries/funds';
import { getGroupById } from '@/lib/supabase/queries/groups';
import { getTransactions, type Transaction } from '@/lib/supabase/queries/transactions';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

/** 준비 홈에 보여줄 최근 내역 건수. 전체는 FUND-01(고도화)이 담당한다 */
const RECENT_LIMIT = 3;
/** 화면 배경. 티켓 노치를 이 색으로 칠해야 테두리가 끊겨 보인다 */
const PAGE_COLOR = '#ffffff';

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
  const [notFound, setNotFound] = useState(false);
  /** 이번 진입에서 금고 배분을 이미 저장했는지 */
  const syncedRef = useRef(false);

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
      const budget = await getBudgetByTripId(trip.id);
      const [categories, fund, transactions, group] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getTravelFund(trip.id),
        getTransactions(trip.id, { limit: RECENT_LIMIT }),
        trip.group_id ? getGroupById(trip.group_id) : Promise.resolve(null),
      ]);

      setData({ trip, budget, categories, fund, transactions, groupName: group?.name ?? null });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  // 화면에 들어올 때마다 다시 읽는다. 예산을 고치고 돌아오면 옛 숫자가 남는다.
  useFocusEffect(
    useCallback(() => {
      syncedRef.current = false;
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    syncedRef.current = false;
    void load();
  }, [load]);

  // ── 금고 배분 동기화 ──────────────────────────────────────────────────
  // 자금이 바뀌면 배분도 달라진다. BUDGET-01 에 들어가야만 갱신되면 여정과
  // 금고 카드의 퍼센트가 서로 다른 말을 하게 된다.
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

    syncedRef.current = true;
    if (changed.length === 0) return;

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
      // 배분 저장이 실패해도 화면은 보여준다. 다음 진입에서 다시 시도한다.
      .catch(() => undefined);
  }, [data]);

  useScreenView(SCREENS.TRIP_HOME, (data?.trip.status as TripStatus | undefined) ?? null);

  // ── 파생값 ────────────────────────────────────────────────────────────
  const destinationMeta = useMemo(
    () => findDestinationByName(data?.trip.destination),
    [data?.trip.destination],
  );
  const theme = useMemo(
    () => countryTheme(destinationMeta?.countryKo),
    [destinationMeta?.countryKo],
  );

  const vaultCategories: VaultCategory[] = useMemo(
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

  const stages = useMemo(
    () =>
      journeyStages(
        data?.fund?.current_amount ?? 0,
        (data?.categories ?? []).map((category) => ({
          categoryCode: category.category_code as CategoryCode,
          plannedAmount: category.planned_amount,
        })),
        data?.trip.destination,
      ),
    [data?.categories, data?.fund?.current_amount, data?.trip.destination],
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
  const currentAmount = fund?.current_amount ?? 0;
  const actualTotal = data.categories.reduce((sum, c) => sum + c.actual_amount, 0);
  const progress = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;

  const dDay =
    daysLeft !== null
      ? `D–${daysLeft}`
      : trip.start_date && differenceInCalendarDays(parseISO(trip.start_date), new Date()) === 0
        ? 'D–DAY'
        : null;

  // 다음 단계 안내 — 여기까지 얼마 남았는지
  const nextStage = stages.find((stage) => !stage.reached) ?? null;
  const nextTitle = nextStage
    ? `${nextStage.label}까지 ${(nextStage.threshold - currentAmount).toLocaleString('ko-KR')}원`
    : targetAmount > 0
      ? '여행 준비 완료'
      : null;
  const nextDesc = nextStage
    ? daysLeft && daysLeft > 0
      ? `하루 ${(Math.ceil((targetAmount - currentAmount) / daysLeft / 1000) * 1000).toLocaleString('ko-KR')}원씩 모으면 딱 맞아요`
      : '조금만 더 모으면 다음 단계예요'
    : '이제 가볍게 출발할 시간이에요';

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: PAGE_COLOR }}
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 13, paddingBottom: 40, gap: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Stack.Screen options={{ title: trip.destination ?? '여행 홈' }} />

      {/* ── 여행 소개 ── */}
      <View className="px-1 pt-1">
        <View className="flex-row items-center gap-1.5">
          <View className="h-[2px] w-5" style={{ backgroundColor: theme.primary }} />
          <Text
            className="text-[11px] font-extrabold tracking-widest"
            style={{ color: theme.primary }}
          >
            {ended ? 'TRIP COMPLETED' : 'NEXT DESTINATION'}
          </Text>
        </View>

        <View className="mt-3 flex-row items-start justify-between">
          <Text
            className="flex-1 text-[28px] font-extrabold leading-9"
            style={{ color: theme.neutral }}
          >
            {ended
              ? `${trip.destination ?? '여행'} 여행,\n어떻게 다녀왔을까요?`
              : `${trip.destination ?? '여행지'}로 떠날\n준비를 시작해요.`}
          </Text>
          <View className="mt-2 flex-row items-center gap-1 rounded-full bg-white px-2.5 py-1.5">
            <Text className="text-[13px]">{destinationMeta?.flag ?? '🌍'}</Text>
            <Text className="text-[10px] font-extrabold" style={{ color: theme.neutral }}>
              {theme.code}
            </Text>
          </View>
        </View>

        <Text className="mt-2 text-[13px] text-gray-500">
          {[
            trip.start_date && trip.end_date
              ? `${format(parseISO(trip.start_date), 'M.d')} — ${format(parseISO(trip.end_date), 'M.d')}`
              : null,
            `${trip.headcount}명`,
            data.groupName ?? '개인 여행',
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>
      </View>

      {ended ? (
        // ── TRIP-HOME-02 종료 상태 ──────────────────────────────────────
        <>
          <View className="gap-4 rounded-[16px] bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">목표 여행비</Text>
              <Text className="text-base font-bold" style={{ color: theme.neutral }}>
                {targetAmount.toLocaleString('ko-KR')}원
              </Text>
            </View>
            <View className="h-[1px] bg-gray-100" />
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500">실제 여행비</Text>
              <Text className="text-base font-bold" style={{ color: theme.neutral }}>
                {actualTotal.toLocaleString('ko-KR')}원
              </Text>
            </View>
            {targetAmount > 0 ? (
              <Text
                className="text-right text-sm font-bold"
                style={{ color: actualTotal > targetAmount ? theme.primary : '#1f9160' }}
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
          <TravelTicketCard
            theme={theme}
            flag={destinationMeta?.flag ?? '🌍'}
            destinationEn={destinationMeta?.nameEn ?? (trip.destination ?? 'TRIP').toUpperCase()}
            airportCode={destinationMeta?.airportCode ?? '—'}
            departLabel={trip.start_date ? format(parseISO(trip.start_date), 'MM.dd') : null}
            arriveLabel={trip.end_date ? format(parseISO(trip.end_date), 'MM.dd') : null}
            ticketDate={
              trip.start_date ? format(parseISO(trip.start_date), 'dd MMM').toUpperCase() : null
            }
            headcount={trip.headcount}
            dDayLabel={dDay}
            currentAmount={currentAmount}
            targetAmount={targetAmount}
            progress={progress}
            nextTitle={targetAmount > 0 ? nextTitle : null}
            nextDesc={targetAmount > 0 ? nextDesc : null}
            onPressFund={
              // 예산이 있을 때만 상세로 보낸다. 없으면 보여줄 게 없다
              targetAmount > 0 ? () => router.push(`/trips/${trip.id}/budget`) : undefined
            }
          />

          {/* 예산 미확정이면 여정도 금고도 의미가 없다. 먼저 정하게 한다 */}
          {targetAmount <= 0 ? (
            <View className="gap-3 rounded-[16px] bg-white p-5">
              <Text className="text-[15px] font-bold" style={{ color: theme.neutral }}>
                아직 목표 여행비를 정하지 않았어요
              </Text>
              <Text className="text-[13px] leading-5 text-gray-500">
                목표가 있어야 어디까지 왔는지, 무엇부터 준비할지 보여드릴 수 있어요.
              </Text>
              <Button
                label="목표 예산 정하기"
                onPress={() => router.push(`/trips/${trip.id}/budget`)}
              />
            </View>
          ) : (
            <>
              <View className="gap-2.5">
                <View className="flex-row items-end justify-between" style={{ marginHorizontal: 4, marginBottom: 11 }}>
                  <Text className="text-[17px] font-extrabold" style={{ color: theme.neutral }}>
                    출발까지의 여정
                  </Text>
                  <Text className="text-[10px] text-gray-400">모을수록 다음 장면이 열려요</Text>
                </View>
                <JourneySteps stages={stages} theme={theme} />
              </View>

              <View className="gap-2.5">
                <View className="flex-row items-end justify-between" style={{ marginHorizontal: 4, marginBottom: 11 }}>
                  <Text className="text-[17px] font-extrabold" style={{ color: theme.neutral }}>
                    가상 여행 금고
                  </Text>
                  <Text
                    accessibilityRole="button"
                    onPress={() => router.push(`/trips/${trip.id}/budget`)}
                    className="text-[10px] font-semibold"
                    style={{ color: theme.primary }}
                  >
                    예산 전체 보기 ›
                  </Text>
                </View>
                <VaultGrid
                  categories={vaultCategories}
                  theme={theme}
                  onSelect={(categoryId) =>
                    router.push(`/trips/${trip.id}/budget/${categoryId}`)
                  }
                />
              </View>
            </>
          )}

          {/*
            최근 내역. 항목 탭은 거래 상세(FUND-03)가 아직 없어 막아두고,
            '전체 보기' 만 내역 화면(FUND-01)으로 연결한다.
          */}
          {/*
            ⚠️ 거래가 없어도 이 섹션을 숨기지 않는다.
               여기가 여행자금 관리(FUND-01)로 들어가는 유일한 입구인데,
               숨기면 아직 아무것도 모으지 않은 사용자가 자금을 넣을 방법이 없다.
          */}
          {targetAmount > 0 ? (
            <View className="gap-2.5">
              <View
                className="flex-row items-end justify-between"
                style={{ marginHorizontal: 4, marginBottom: 11 }}
              >
                <Text style={{ fontSize: 17, fontWeight: '800', color: theme.neutral }}>
                  최근 여행자금 내역
                </Text>
                {/* 여행자금 관리(FUND-01)로 간다. 목록만이 아니라 추가·차감도 여기서 한다 */}
                <Text
                  accessibilityRole="button"
                  onPress={() => router.push(`/trips/${trip.id}/funds`)}
                  style={{ fontSize: 10, fontWeight: '600', color: theme.primary }}
                >
                  여행자금 관리 ›
                </Text>
              </View>
              {recentTransactions.length > 0 ? (
                <RecentTransactionList transactions={recentTransactions} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="여행자금 관리"
                  onPress={() => router.push(`/trips/${trip.id}/funds`)}
                  className="active:bg-gray-50"
                  style={{
                    borderWidth: 1,
                    borderColor: '#e8eaee',
                    borderRadius: 14,
                    paddingVertical: 22,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#858e9c' }}>
                    아직 입출금 내역이 없어요
                  </Text>
                  <Text
                    style={{ marginTop: 5, fontSize: 12, fontWeight: '800', color: theme.primary }}
                  >
                    모은 금액 기록하기 ›
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View className="gap-2.5">
            <View className="flex-row items-end justify-between" style={{ marginHorizontal: 4, marginBottom: 11 }}>
              <Text className="text-[17px] font-extrabold" style={{ color: theme.neutral }}>
                떠나기 전 챙겨보기
              </Text>
              <Text className="text-[10px] tracking-wider text-gray-400">TRIP GUIDE</Text>
            </View>
            <TripGuideCards
              destination={trip.destination ?? '여행'}
              theme={theme}
              onPressTips={() => router.push('/community')}
              onPressInsurance={() => router.push(`/trips/${trip.id}/insurance`)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
