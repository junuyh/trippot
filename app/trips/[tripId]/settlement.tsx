// ============================================================================
// SETTLE-01 여행 결산  ·  /trips/:tripId/settlement
//
// 핵심 루프의 마지막 칸이다.
//   계획 → 준비 → 소비 → **결산** → 개인화 → 다음 여행
//
// 두 상태로 갈린다.
//   확정 전 (ENDED)   목표 vs 실제를 보여주고 확정을 유도한다
//   확정 후 (SETTLED) 확정 시점의 스냅샷을 보여준다
//
// ⚠️ 결산 확정은 되돌릴 수 없다. 확정 전에 사용자 확인을 받는다. (NFR-003)
// ⚠️ 확정 시점의 카테고리별 값을 category_snapshot_json 에 보존한다.
//    확정 뒤 예산을 고쳐도 결산 결과는 그때 그대로여야 한다. (docs/09 §2-6)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/settlement/.
// ============================================================================
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  CategoryComparisonList,
  SettlementSummaryCard,
  type CategoryComparison,
} from "@/components/settlement";
import { Button, EmptyState, ErrorState, Loading } from "@/components/ui";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import {
  SETTLEMENT_TRIGGER,
  TRIP_STATUS,
  type CategoryCode,
  type TripStatus,
} from "@/lib/constants/status";
import {
  getBudgetByTripId,
  getBudgetCategories,
  type BudgetCategory,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import {
  createSettlement,
  differenceRateBp,
  getSettlement,
  type Settlement,
} from "@/lib/supabase/queries/settlements";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";
import {
  getSettlementChecklist,
  type SettlementChecklist,
} from "@/lib/supabase/queries/transactions";

type SettlementData = {
  trip: Trip;
  budget: TripBudget | null;
  categories: BudgetCategory[];
  settlement: Settlement | null;
  /** 결산 전에 정리해야 할 것들 (IA v2 §2-6-1) */
  checklist: SettlementChecklist;
};

/** category_snapshot_json 에 저장하는 모양. 확정 시점의 값이다. */
type CategorySnapshot = {
  category_code: string;
  planned_amount: number;
  actual_amount: number;
};

export default function ScreenSETTLE01() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** 결산 유도 로그를 이 화면 진입당 1회만 쏜다 */
  const [prompted, setPrompted] = useState(false);

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
      const [categories, settlement, checklist] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getSettlement(trip.id),
        getSettlementChecklist(trip.id, budget?.id ?? null),
      ]);

      setData({ trip, budget, categories, settlement, checklist });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // ── 확정 전/후 값 ─────────────────────────────────────────────────────
  //
  // 확정 후에는 **스냅샷**을 쓴다. 지금 예산을 다시 읽으면 확정 뒤에 예산을
  // 고쳤을 때 결산 결과가 따라 바뀐다. 결산은 그 시점의 기록이어야 한다.
  const settled = data?.settlement != null;
  const checklist = data?.checklist ?? { reviewCount: 0, unlinkedPlans: [] };

  const comparisons: CategoryComparison[] = useMemo(() => {
    if (!data) return [];

    if (data.settlement) {
      const snapshot = data.settlement.category_snapshot_json as {
        categories?: CategorySnapshot[];
      } | null;
      const rows = snapshot?.categories ?? [];
      if (rows.length > 0) {
        return rows.map((row) => ({
          categoryCode: row.category_code as CategoryCode,
          plannedAmount: row.planned_amount,
          actualAmount: row.actual_amount,
        }));
      }
      // 스냅샷이 비어 있으면(구버전 데이터) 현재 예산으로 대신 보여준다
    }

    return data.categories.map((category) => ({
      categoryCode: category.category_code as CategoryCode,
      plannedAmount: category.planned_amount,
      actualAmount: category.actual_amount,
    }));
  }, [data]);

  const targetAmount =
    data?.settlement?.target_amount ?? data?.budget?.target_amount ?? 0;
  const actualAmount =
    data?.settlement?.actual_amount ??
    (data?.categories ?? []).reduce((sum, c) => sum + c.actual_amount, 0);
  const rateBp =
    data?.settlement?.difference_rate_bp ??
    differenceRateBp(targetAmount, actualAmount);

  // ── 결산 유도 로그 ────────────────────────────────────────────────────
  //
  // 아직 확정하지 않은 여행에서 이 화면을 본 순간이 '유도 노출' 이다.
  // trigger 는 manual — 사용자가 준비 홈에서 눌러 들어왔다.
  // 여행 기간 종료 시 자동 유도(auto)는 알림/홈에서 띄울 때 쓴다. [Future]
  if (data && !settled && !prompted) {
    setPrompted(true);
    track(EVENTS.SETTLEMENT_PROMPTED, {
      trip_id: data.trip.id,
      trigger: SETTLEMENT_TRIGGER.MANUAL,
    });
  }

  // ── 결산 확정 ─────────────────────────────────────────────────────────
  const confirmSettlement = useCallback(async () => {
    if (!data || confirming) return;
    setConfirming(true);

    try {
      const snapshot: CategorySnapshot[] = data.categories.map((category) => ({
        category_code: category.category_code,
        planned_amount: category.planned_amount,
        actual_amount: category.actual_amount,
      }));

      await createSettlement({
        trip_id: data.trip.id,
        target_amount: targetAmount,
        actual_amount: actualAmount,
        difference_amount: actualAmount - targetAmount,
        difference_rate_bp: differenceRateBp(targetAmount, actualAmount),
        // 확정 시점의 값을 보존한다. 이후 예산을 고쳐도 결산은 그대로다
        category_snapshot_json: { categories: snapshot },
        confirmed_at: new Date().toISOString(),
      });

      // 저장에 성공한 뒤에만 쏜다. (docs/06 §11)
      track(EVENTS.SETTLEMENT_CONFIRMED, {
        trip_id: data.trip.id,
        target_budget: targetAmount,
        actual_total: actualAmount,
        difference_rate: differenceRateBp(targetAmount, actualAmount),
      });

      await load();
    } catch {
      setError(true);
    } finally {
      setConfirming(false);
    }
  }, [actualAmount, confirming, data, load, targetAmount]);

  // NFR-003 — 결산 확정은 사전 확인한다. 되돌릴 수 없다.
  const handleConfirmPress = useCallback(() => {
    Alert.alert(
      "결산을 확정할까요?",
      "확정하면 지금의 예산과 지출이 그대로 기록돼요. 나중에 예산을 고쳐도 결산 결과는 바뀌지 않아요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "확정하기",
          style: "default",
          onPress: () => void confirmSettlement(),
        },
      ],
    );
  }, [confirmSettlement]);

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "결산" }} />
        <Loading message="결산을 불러오는 중…" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "결산" }} />
        <EmptyState
          icon="receipt-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace("/")}
        />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "결산" }} />
        <ErrorState
          message="결산을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const status = data.trip.status as TripStatus;
  // 아직 여행이 끝나지 않았으면 결산할 게 없다
  const tooEarly =
    !settled && status !== TRIP_STATUS.ENDED && status !== TRIP_STATUS.SETTLED;

  if (tooEarly) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "결산" }} />
        <EmptyState
          icon="hourglass-outline"
          title="아직 결산할 때가 아니에요"
          description="여행이 끝나면 계획과 실제를 비교해 드릴게요."
          actionLabel="여행 홈으로"
          onAction={() => router.replace(`/trips/${data.trip.id}`)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-5 pb-10 pt-4 gap-6"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Stack.Screen
        options={{ title: `${data.trip.destination ?? "여행"} 결산` }}
      />

      <SettlementSummaryCard
        targetAmount={targetAmount}
        actualAmount={actualAmount}
        differenceRateBp={rateBp}
        headcount={data.trip.headcount}
      />

      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-base font-semibold text-gray-900">
            카테고리별 비교
          </Text>
          <Text className="text-xs text-gray-400">차이가 큰 순서</Text>
        </View>
        {comparisons.length > 0 ? (
          <CategoryComparisonList categories={comparisons} />
        ) : (
          <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-8">
            <Text className="text-sm text-gray-500">비교할 예산이 없어요.</Text>
          </View>
        )}
      </View>

      {/*
        ── 결산 중 확인 목록 ── (IA v2 §2-6-1)

        ⚠️ 확인할 거래와 지출 미연결 계획을 **따로** 센다. 가는 곳이 다르다.
           미분류 거래는 카테고리가 없어 '어느 BUDGET-02 인가' 에 답할 수 없다.
           반대로 미연결 계획은 이미 카테고리가 정해져 있다.
      */}
      {!settled &&
      (checklist.reviewCount > 0 || checklist.unlinkedPlans.length > 0) ? (
        <View className="gap-2.5">
          <Text className="text-base font-semibold text-gray-900">
            확정 전에 확인해요
          </Text>

          {checklist.reviewCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`확인할 거래 ${checklist.reviewCount}건 보기`}
              onPress={() =>
                router.push(
                  `/trips/${data.trip.id}/funds/transactions?filter=review`,
                )
              }
              className="flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 active:bg-gray-50"
            >
              <Text style={{ fontSize: 20 }}>🔎</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  확인할 거래 {checklist.reviewCount}건
                </Text>
                <Text className="mt-1 text-xs text-gray-500">
                  카테고리를 정하거나 자동 분류가 맞는지 확인해 주세요.
                </Text>
              </View>
              <Text className="text-base text-gray-300">›</Text>
            </Pressable>
          ) : null}

          {checklist.unlinkedPlans.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`지출이 연결되지 않은 계획 ${checklist.unlinkedPlans.length}건 보기`}
              onPress={() =>
                router.push(
                  `/trips/${data.trip.id}/budget/${checklist.unlinkedPlans[0].categoryId}`,
                )
              }
              className="flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 active:bg-gray-50"
            >
              <Text style={{ fontSize: 20 }}>📄</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  지출이 연결되지 않은 계획 {checklist.unlinkedPlans.length}건
                </Text>
                {/*
                  ⚠️ '지출이 누락됐다' 고 단정하지 않는다. 계좌가 연결돼 있지 않으면
                     시스템은 실제 결제가 있었는지 알 수 없다. (스펙 6장)
                */}
                <Text className="mt-1 text-xs text-gray-500">
                  {checklist.unlinkedPlans[0].name}
                  {checklist.unlinkedPlans.length > 1
                    ? ` 외 ${checklist.unlinkedPlans.length - 1}건`
                    : ""}
                  {" · 결제하지 않았다면 그대로 두어도 괜찮아요."}
                </Text>
              </View>
              <Text className="text-base text-gray-300">›</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {settled ? (
        <View className="gap-2.5">
          <View className="flex-row items-start gap-1.5 rounded-xl bg-blue-50 px-3 py-2.5">
            <Text className="flex-1 text-xs leading-4 text-blue-700">
              결산이 확정됐어요. 이 기록은 다음 여행 예산을 추천할 때 쓰여요.
            </Text>
          </View>
          <Button
            label="여행 홈으로"
            variant="secondary"
            onPress={() => router.replace(`/trips/${data.trip.id}`)}
          />
        </View>
      ) : (
        <View className="gap-2.5">
          <Text className="px-1 text-xs leading-4 text-gray-500">
            확정하면 지금의 예산과 지출이 그대로 기록돼요. 이 기록이 다음 여행
            예산 추천의 근거가 됩니다.
          </Text>
          {/*
            ⚠️ 분류가 안 끝난 거래가 있으면 확정을 막는다.
               미분류 거래는 어느 카테고리에도 잡히지 않아 결산 스냅샷에서 빠지고,
               그 스냅샷이 다음 여행 개인화의 입력이라 한 번 틀리면 계속 틀린다.

               반대로 '지출 미연결 계획' 으로는 막지 않는다. 계좌가 연결돼 있지 않으면
               결제가 실제로 있었는지 알 수 없어, 사용자가 안 썼을 수도 있다.
          */}
          {checklist.reviewCount > 0 ? (
            <View className="rounded-xl bg-amber-50 px-3 py-2.5">
              <Text className="text-xs leading-4 text-amber-800">
                확인할 거래 {checklist.reviewCount}건을 먼저 정리해 주세요.
                분류되지 않은 지출은 결산에 잡히지 않아요.
              </Text>
            </View>
          ) : null}
          <Button
            label="결산 확정하기"
            onPress={handleConfirmPress}
            loading={confirming}
            disabled={checklist.reviewCount > 0}
          />
        </View>
      )}
    </ScrollView>
  );
}
