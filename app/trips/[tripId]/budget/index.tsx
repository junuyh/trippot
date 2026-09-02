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
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  BudgetCategoryRow,
  BudgetInsightButton,
  BudgetInsightSheet,
  BudgetTicketCard,
  type BudgetCategoryRowData,
  type InsightItem,
} from "@/components/budget";
import { Button, EmptyState, ErrorState, Loading } from "@/components/ui";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { perPerson } from "@/lib/budget/recommendation";
import { allocateVault } from "@/lib/budget/vault";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  APPLIED_SOURCE,
  CATEGORY_CODE_TO_ANALYTICS,
  TRIP_OWNER_TYPE,
  TRIP_STATUS,
  type CategoryCode,
  type TripStatus,
} from "@/lib/constants/status";
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from "@/lib/constants/devUser";
import {
  getBudgetByTripId,
  getBudgetCategories,
  updateBudgetCategoriesPrepared,
  updateBudgetCategory,
  updateTripBudget,
  type BudgetCategory,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import { getFundTotals } from "@/lib/supabase/queries/transactions";
import {
  getPersonalizedBudget,
  savePersonalizedAmounts,
  type PersonalizedBudgetSuggestion,
} from "@/lib/supabase/queries/personalization";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

type BudgetData = {
  trip: Trip;
  budget: TripBudget;
  categories: BudgetCategory[];
  fund: FundSource | null;
  /** 입금 거래 합계. 누적 모금액 계산에 쓴다 */
  depositTotal: number;
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
  const [suggestions, setSuggestions] = useState<
    PersonalizedBudgetSuggestion[]
  >([]);
  const [basedOnTripCount, setBasedOnTripCount] = useState(0);
  /** 분석 바텀시트 열림 여부 */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** 토글 저장 중인 카테고리. 그 행만 잠근다 */
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  /** 제안을 이 진입에서 이미 불러왔는지 */
  const loadedRef = useRef(false);
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
      const [categories, fund, totals] = await Promise.all([
        getBudgetCategories(budget.id),
        getTravelFund(trip.id),
        getFundTotals(trip.id),
      ]);

      setData({ trip, budget, categories, fund, depositTotal: totals.depositTotal });
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

  // ── 지난 여행 지출 분석 불러오기 ──────────────────────────────────────
  //
  // ⚠️ 개인 여행 데이터는 개인에, 모임 여행 데이터는 해당 모임에만 누적한다.
  //    다른 소유 단위로 승계하지 않는다. (docs/06 §7-6 확정 정책)
  //
  // ⚠️ 이미 반영한 여행에서도 **불러온다.** 배너였을 때는 다시 들이밀지 않으려고
  //    걸렀지만, 지금은 사용자가 눌러서 여는 바텀시트다. 걸러 버리면 이미 켜 둔
  //    토글을 끄러 들어갈 수가 없다.
  useEffect(() => {
    if (!data || loadedRef.current) return;
    // 예산을 아직 확정하지 않았으면 비교할 기준이 없다. 확정 후에 제안한다.
    if (data.budget.target_amount <= 0) return;

    loadedRef.current = true;

    const scope =
      data.trip.owner_type === TRIP_OWNER_TYPE.GROUP && data.trip.group_id
        ? ({ ownerType: "GROUP", groupId: data.trip.group_id } as const)
        : // TODO: 로그인 연동 시 교체
          ({
            ownerType: "PERSONAL",
            userId: data.trip.owner_user_id ?? DEV_USER_ID,
          } as const);

    void getPersonalizedBudget(data.trip.id, scope)
      .then(async (result) => {
        if (result.length === 0) return;
        // 제안값을 personalized_amount 에 저장해 둔다.
        // ⚠️ planned_amount 는 건드리지 않는다. 사용자가 토글을 켜야 반영된다.
        await savePersonalizedAmounts(result).catch(() => undefined);
        setSuggestions(result);
        setBasedOnTripCount(
          (result[0].basis as { basedOnTripCount: number }).basedOnTripCount,
        );
      })
      // 분석은 부가 기능이다. 실패해도 예산 화면은 그대로 보여준다.
      .catch(() => undefined);
  }, [data]);

  /**
   * 분석 시트 열기.
   *
   * personalization_offered 는 **여기서** 쏜다. 화면에 들어온 것만으로는
   * 제안을 본 게 아니다. 노출 모수가 부풀면 반영률이 실제보다 낮게 보인다.
   */
  const handleOpenSheet = useCallback(() => {
    if (!data || suggestions.length === 0) return;
    setSheetOpen(true);

    if (offeredRef.current) return;
    offeredRef.current = true;

    const first = suggestions[0].basis as {
      basedOnTripCount: number;
      deviationBp: number;
    };
    track(EVENTS.PERSONALIZATION_OFFERED, {
      trip_id: data.trip.id,
      source: "budget_detail",
      based_on_trip_count: first.basedOnTripCount,
      top_category:
        CATEGORY_CODE_TO_ANALYTICS[
          suggestions[0].category_code as CategoryCode
        ],
      deviation_rate: first.deviationBp,
    });
  }, [data, suggestions]);

  /**
   * 토글 하나를 켜거나 끈다. **바꾸는 즉시 예산에 반영한다.** (스펙)
   *
   * ⚠️ 토글이 곧 사용자의 확정 행동이다. 그래서 여기서 planned_amount 를 쓴다.
   *    별도의 '반영하기' 버튼을 두지 않는다. (CLAUDE.md 4장)
   *
   * ⚠️ 끄면 recommended_amount 로 되돌린다. 개인화 금액이 recommended 에
   *    편차를 곱해 나온 값이라, 되돌릴 기준도 recommended 다.
   *    BUDGET-02 에서 직접 고쳐 둔 금액이 있었다면 그 값은 사라진다 —
   *    대신 켤 때만 덮어쓰므로, 손대지 않으면 아무 일도 일어나지 않는다.
   */
  const handleToggleInsight = useCallback(
    async (item: InsightItem, next: boolean) => {
      if (!data || busyCategoryId) return;
      setBusyCategoryId(item.categoryId);

      const nextAmount = next
        ? item.personalizedAmount
        : item.recommendedAmount;

      try {
        await updateBudgetCategory(item.categoryId, {
          planned_amount: nextAmount,
          applied_source: next
            ? APPLIED_SOURCE.PERSONALIZED
            : APPLIED_SOURCE.DEFAULT,
        });

        // 카테고리 합이 곧 목표 여행비다. 하나가 바뀌면 총액도 바뀐다.
        const total = data.categories.reduce(
          (sum, category) =>
            sum +
            (category.id === item.categoryId
              ? nextAmount
              : category.planned_amount),
          0,
        );
        await updateTripBudget(data.budget.id, {
          target_amount: total,
          per_person_amount: perPerson(total, data.trip.headcount),
        });

        // 저장에 성공한 뒤에만 쏜다. 가설 4 의 핵심 지표다.
        track(EVENTS.PERSONALIZATION_APPLIED, {
          trip_id: data.trip.id,
          source: "budget_detail",
          applied: next,
          category: CATEGORY_CODE_TO_ANALYTICS[item.categoryCode],
        });

        syncedRef.current = false;
        await load();
      } catch {
        setError(true);
      } finally {
        setBusyCategoryId(null);
      }
    },
    [busyCategoryId, data, load],
  );

  // ── 예산 확정 (미확정 여행) ───────────────────────────────────────────
  //
  // 추천값(recommended_amount)은 이미 있다. 사용자가 확정만 하면 된다.
  // 시드의 오사카가 이 상태다.
  const handleConfirmRecommended = useCallback(async () => {
    if (!data || confirming) return;
    setConfirming(true);

    try {
      const total = data.categories.reduce(
        (sum, c) => sum + c.recommended_amount,
        0,
      );

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

  const insightItems: InsightItem[] = useMemo(() => {
    const byId = new Map((data?.categories ?? []).map((c) => [c.id, c]));
    return suggestions.flatMap((suggestion) => {
      const category = byId.get(suggestion.id);
      if (!category || suggestion.personalized_amount === null) return [];
      const basis = suggestion.basis as { deviationBp: number };
      return [
        {
          categoryId: suggestion.id,
          categoryCode: suggestion.category_code as CategoryCode,
          recommendedAmount: category.recommended_amount,
          personalizedAmount: suggestion.personalized_amount,
          deviationBp: basis.deviationBp,
          // 토글 초기 상태는 DB 가 정한다. 화면이 임의로 켜 두지 않는다.
          applied: category.applied_source === APPLIED_SOURCE.PERSONALIZED,
        },
      ];
    });
  }, [data?.categories, suggestions]);

  // 국가 포인트 컬러. 전체 UI 는 화이트 기반이고 강조에만 쓴다 (스펙)
  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

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
        <Stack.Screen options={{ title: "예산" }} />
        <Loading message="예산을 불러오는 중…" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "예산" }} />
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
        <Stack.Screen options={{ title: "예산" }} />
        <ErrorState
          message="예산을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const confirmed = data.budget.target_amount > 0;


  /**

   * 결산 상태에서는 예산을 고칠 수 없다. (IA v2 §2-6-3)

   * 화면을 새로 만들지 않고 권한만 바꾼다.

   */

  const tripStatus = data.trip.status as TripStatus;

  const closingOrSettled =

    tripStatus === TRIP_STATUS.ENDED || tripStatus === TRIP_STATUS.SETTLED;

  /**
   * 누적 모금액. 지금까지 실제로 모은 총금액이다. (스펙 데이터 정의)
   *
   * ⚠️ 모임통장에서 결제해도 이 값은 줄지 않는다. 결제로 줄어드는 것은
   *    현재 잔액이지 모은 금액이 아니다.
   *    fund_sources.current_amount 는 등록·동기화 시점에만 쓰는 값이라
   *    거래가 쌓여도 변하지 않는다. (TRIP-HOME 과 같은 기준)
   */
  const raisedAmount = (data.fund?.current_amount ?? 0) + data.depositTotal;
  const progress =
    data.budget.target_amount > 0
      ? Math.min(100, (raisedAmount / data.budget.target_amount) * 100)
      : 0;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="px-5 pb-10 pt-4 gap-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Stack.Screen options={{ title: "예산" }} />

        {confirmed ? (
          <BudgetTicketCard
            theme={theme}
            targetAmount={data.budget.target_amount}
            raisedAmount={raisedAmount}
            progress={progress}
            destinationKo={data.trip.destination ?? "여행지"}
          />
        ) : (
          // 아직 확정하지 않은 예산. 추천값은 이미 계산돼 있다.
          <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <View>
              <Text className="text-xs text-gray-500">추천 예산</Text>
              <Text className="mt-0.5 text-3xl font-bold text-gray-900">
                {totals.recommended.toLocaleString("ko-KR")}원
              </Text>
              <Text className="mt-1 text-sm text-gray-500">
                {data.trip.headcount}명 · 1인{" "}
                {perPerson(
                  totals.recommended,
                  data.trip.headcount,
                ).toLocaleString("ko-KR")}
                원
              </Text>
            </View>
            <Text className="text-xs leading-4 text-gray-500">
              아직 목표 여행비를 정하지 않았어요. 추천 금액으로 시작한 뒤
              카테고리별로 바꿀 수 있어요.
            </Text>
            <Button
              label="이 금액으로 확정하기"
              loading={confirming}
              onPress={() => void handleConfirmRecommended()}
            />
          </View>
        )}

        {/*
        지난 여행 지출 분석. 본문에 펼치지 않고 눌러서 바텀시트로 연다. (스펙)
        본문의 주인공은 카테고리별 예산이다.
      */}
        {/* 결산 중·완료에는 예산 조정을 제안하지 않는다. 비교 대상이 움직이면 안 된다 */}
      {closingOrSettled ? null : (
        <BudgetInsightButton items={insightItems} onPress={handleOpenSheet} />
      )}

        <View className="gap-2.5">
          <View className="flex-row items-end justify-between">
            <View>
              <Text
                className="text-[17px] font-extrabold"
                style={{ color: "#141b28" }}
              >
                카테고리별 예산
              </Text>
              <Text className="mt-1 text-[10px] text-gray-400">
                금액과 전체 예산 비중을 함께 확인해요.
              </Text>
            </View>
            <Text className="text-[10px] text-gray-400">
              총 {data.budget.target_amount.toLocaleString("ko-KR")}원
            </Text>
          </View>

          <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {rows.map((row, index) => (
              <View
                key={row.id}
                className={index > 0 ? "border-t border-gray-100" : undefined}
              >
                <BudgetCategoryRow
                  category={row}
                  theme={theme}
                  targetAmount={data.budget.target_amount}
                  onPress={(categoryId) =>
                    router.push(`/trips/${data.trip.id}/budget/${categoryId}`)
                  }
                />
              </View>
            ))}
          </View>

          {confirmed ? (
            <Text className="px-1 text-[10px] leading-4 text-gray-400">
              결제 시점이 빠른 항공·숙소 예산부터 먼저 채워져요.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/*
        ⚠️ 바텀시트는 ScrollView **밖**에 둔다. 안에 두면 스크롤 컨테이너의
           레이아웃에 끌려들어가 화면 밖으로 밀릴 수 있다.
      */}
      <BudgetInsightSheet
        visible={sheetOpen}
        items={insightItems}
        theme={theme}
        busyCategoryId={busyCategoryId}
        onToggle={(item, next) => void handleToggleInsight(item, next)}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
