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
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useRef } from "react";
import ViewShot from "react-native-view-shot";
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
  MajorExpenseList,
  RemainingFundCard,
  type MajorExpense,
  SettlementSummaryCard,
  type CategoryComparison,
} from "@/components/settlement";
import { TripHomeButton } from "@/components/navigation/TripHomeButton";
import { Button, EmptyState, ErrorState, Loading, HeaderBackButton } from "@/components/ui";
import { EVENTS } from "@/lib/analytics/events";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import { track } from "@/lib/analytics/track";
import {
  SETTLEMENT_TRIGGER,
  FUND_SOURCE_TYPE,
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
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import { ShareReportSheet } from "@/components/settlement/ShareReportSheet";
import {
  buildSettlementReport,
  toReportCategories,
} from "@/lib/settlement/report";
import { buildSettlementReportHtml } from "@/lib/settlement/reportHtml";
import { useTripContext } from '@/lib/hooks/useTripContext';
import {
  getFundTotals,
  getSettlementChecklist,
  getSettlementFunds,
  type SettlementFunds,
  type SettlementChecklist,
} from "@/lib/supabase/queries/transactions";

type SettlementData = {
  trip: Trip;
  budget: TripBudget | null;
  categories: BudgetCategory[];
  settlement: Settlement | null;
  /** 결산 전에 정리해야 할 것들 (IA v2 §2-6-1) */
  checklist: SettlementChecklist;
  fund: FundSource | null;
  /** 입금 거래 합계. 누적 모금액 계산에 쓴다 */
  depositTotal: number;
  funds: SettlementFunds;
};

/** category_snapshot_json 에 저장하는 모양. 확정 시점의 값이다. */
type CategorySnapshot = {
  category_code: string;
  planned_amount: number;
  actual_amount: number;
};

export default function ScreenSETTLE01() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);

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
      const [categories, settlement, checklist, fund, totals, funds] =
        await Promise.all([
          budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
          getSettlement(trip.id),
          getSettlementChecklist(trip.id, budget?.id ?? null),
          getTravelFund(trip.id),
          getFundTotals(trip.id),
          getSettlementFunds(trip.id),
        ]);

      setData({
        trip,
        budget,
        categories,
        settlement,
        checklist,
        fund,
        depositTotal: totals.depositTotal,
        funds,
      });
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

  // 국가 포인트 컬러. 초과·절약을 가르는 데만 쓴다
  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  const comparisons: CategoryComparison[] = useMemo(() => {
    if (!data) return [];

    if (data.settlement) {
      const snapshot = data.settlement.category_snapshot_json as {
        categories?: CategorySnapshot[];
      } | null;
      const rows = snapshot?.categories ?? [];
      if (rows.length > 0) {
        return rows.map((row) => ({
          // ⚠️ 스냅샷에는 카테고리 id 가 없다. 그래서 확정 후에는 눌리지 않는다.
          //    지금 예산으로 이어 주면 확정 시점의 기록과 다른 화면이 열린다.
          categoryId: null,
          categoryCode: row.category_code as CategoryCode,
          plannedAmount: row.planned_amount,
          actualAmount: row.actual_amount,
        }));
      }
      // 스냅샷이 비어 있으면(구버전 데이터) 현재 예산으로 대신 보여준다
    }

    return data.categories.map((category) => ({
      categoryId: category.id,
      categoryCode: category.category_code as CategoryCode,
      plannedAmount: category.planned_amount,
      actualAmount: category.actual_amount,
    }));
  }, [data]);

  /**
   * 주요 지출. 카테고리 코드를 붙여서 넘긴다.
   *
   * ⚠️ 거래에는 카테고리 id 만 있어서 화면이 코드로 바꿔 준다.
   *    컴포넌트가 예산 테이블을 다시 읽게 하지 않는다. (CLAUDE.md 9장)
   */
  const majorExpenses: MajorExpense[] = useMemo(() => {
    const byId = new Map(
      (data?.categories ?? []).map((category) => [
        category.id,
        category.category_code as CategoryCode,
      ]),
    );
    return (data?.funds.major ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? "이름 없는 지출",
      amount: row.amount,
      occurredAt: row.occurred_at,
      categoryCode: row.budget_category_id
        ? (byId.get(row.budget_category_id) ?? null)
        : null,
      linked: row.budget_plan_item_id !== null,
    }));
  }, [data?.categories, data?.funds.major]);

  /**
   * 누적 모금액 = 등록 금액 + 입금 합계. (IA v2 §2-4-1)
   * ⚠️ 결제로 줄지 않는다. 잔액과 혼용하지 않는다.
   */
  const raisedAmount =
    (data?.fund?.current_amount ?? 0) + (data?.depositTotal ?? 0);
  const fundSourceLabel =
    data?.fund?.source_type === FUND_SOURCE_TYPE.MANUAL || !data?.fund
      ? "직접 입력"
      : "모임통장";

  const targetAmount =
    data?.settlement?.target_amount ?? data?.budget?.target_amount ?? 0;
  const actualAmount =
    data?.settlement?.actual_amount ??
    (data?.categories ?? []).reduce((sum, c) => sum + c.actual_amount, 0);
  /** 현재 남은 금액 = 누적 모금액 − 실제 사용액. 음수로 내려가지 않게 둔다 */
  const remainingAmount = Math.max(0, raisedAmount - actualAmount);
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

  // ── 정산 리포트 ───────────────────────────────────────────────────────
  //
  // 한 버튼에서 둘 중 하나를 고른다. 카드(이미지) / 명세서(PDF).
  // 쓰임이 달라서 한 버튼에 묶지 않는다.
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState<"card" | "pdf" | null>(null);
  const cardRef = useRef<ViewShot>(null);

  /** 카테고리 id → 코드. 거래에는 id 만 있어서 리포트가 코드로 바꿔 쓴다 */
  const categoryCodeById = useMemo(
    () =>
      new Map(
        (data?.categories ?? []).map((category) => [
          category.id,
          category.category_code as CategoryCode,
        ]),
      ),
    [data?.categories],
  );

  /**
   * 리포트에 담을 값.
   *
   * ⚠️ 확정 스냅샷을 **우선**한다. 확정 뒤에 예산을 고쳐도 이미 공유한 문서와
   *    값이 달라지면 그 문서는 증빙 구실을 못 한다.
   */
  const report = useMemo(() => {
    if (!data) return null;

    const snapshot = (
      data.settlement?.category_snapshot_json as
        | { categories?: CategorySnapshot[] }
        | null
        | undefined
    )?.categories;

    return buildSettlementReport({
      destination: data.trip.destination ?? "여행",
      startDate: data.trip.start_date,
      endDate: data.trip.end_date,
      headcount: data.trip.headcount,
      groupName: null,
      confirmedAt: data.settlement?.confirmed_at ?? null,
      raisedAmount,
      targetAmount,
      actualAmount,
      categories: toReportCategories(snapshot ?? data.categories),
      /*
        확정 지출 전체. 명세서의 거래 내역(날짜별 묶음)에 쓴다.
        환불 완료·취소·확인 필요는 getSettlementFunds 가 이미 뺐다.
      */
      transactions: data.funds.spent.map((row) => {
        const code = row.budget_category_id
          ? categoryCodeById.get(row.budget_category_id)
          : undefined;
        return {
          name: row.name ?? "이름 없는 지출",
          amount: row.amount,
          occurredAt: row.occurred_at,
          categoryCode: code ?? null,
        };
      }),
      typeLabel: null,
      typeSummary: null,
    });
  }, [actualAmount, categoryCodeById, data, raisedAmount, targetAmount]);

  const reportTheme = useMemo(
    () => countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );
  const destinationMeta = findDestinationByName(data?.trip.destination);

  /** 결산 카드를 PNG 로 캡처해 공유한다 */
  const handleShareCard = useCallback(async () => {
    if (shareBusy) return;
    setShareBusy("card");
    try {
      const uri = await cardRef.current?.capture?.();
      if (!uri) throw new Error("capture failed");

      /*
        ⚠️ 공유 시트를 못 여는 기기가 있다. 그때 조용히 끝내면 사용자는
           버튼이 고장 났다고 읽는다. 무엇이 안 되는지 말한다.
      */
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("공유할 수 없어요", "이 기기에서는 공유 기능을 쓸 수 없어요.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "정산 카드 공유",
      });
    } catch {
      Alert.alert("만들지 못했어요", "잠시 뒤 다시 시도해 주세요.");
    } finally {
      setShareBusy(null);
    }
  }, [shareBusy]);

  /** 정산 명세서를 PDF 로 만들어 공유한다 */
  const handleSharePdf = useCallback(async () => {
    if (!report || shareBusy) return;
    setShareBusy("pdf");
    try {
      const html = buildSettlementReportHtml(report, {
        accent: reportTheme.primary,
        flag: destinationMeta?.flag ?? "🌏",
        nameEn: destinationMeta?.nameEn ?? "",
      });

      const { uri } = await Print.printToFileAsync({ html });

      /*
        ⚠️ 파일 이름을 바꿔 준다. printToFileAsync 는 임의의 이름을 주는데,
           그대로 공유하면 상대가 받는 파일이 '5f3a-....pdf' 다. 무슨 문서인지
           알 수 없고, 여러 여행을 받으면 구분도 안 된다.
      */
      const safeName = `TripPot_${report.destination}_정산명세서.pdf`.replace(
        /[/\\?%*:|"<>]/g,
        "_",
      );
      const printed = new File(uri);
      const target = new File(Paths.cache, safeName);
      // 같은 이름이 남아 있으면 move 가 실패한다. 먼저 치운다.
      try {
        if (target.exists) target.delete();
        printed.move(target);
      } catch {
        // 이름을 못 바꿔도 공유 자체는 되어야 한다. 원본으로 간다.
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("공유할 수 없어요", "이 기기에서는 공유 기능을 쓸 수 없어요.");
        return;
      }
      await Sharing.shareAsync(target.exists ? target.uri : uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "정산 명세서 공유",
      });
    } catch {
      Alert.alert("만들지 못했어요", "잠시 뒤 다시 시도해 주세요.");
    } finally {
      setShareBusy(null);
    }
  }, [destinationMeta?.flag, destinationMeta?.nameEn, report, reportTheme.primary, shareBusy]);

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
      "정산을 확정할까요?",
      "확정하면 지금의 예산과 지출이 그대로 기록돼요. 나중에 예산을 고쳐도 정산 결과는 바뀌지 않아요.",
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
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "정산" }} />
        <Loading message="정산 내역을 불러오는 중…" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "정산" }} />
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
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "정산" }} />
        <ErrorState
          message="정산 내역을 불러오지 못했어요."
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
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: "정산" }} />
        <EmptyState
          icon="hourglass-outline"
          title="아직 정산할 때가 아니에요"
          description="여행이 끝나면 계획과 실제를 비교해 드릴게요."
          actionLabel="여행 홈으로"
          onAction={() => router.replace(`/trips/${data.trip.id}`)}
        />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-5 pb-10 pt-4 gap-6"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} />, title: `${data.trip.destination ?? "여행"} 정산` }}
      />

      <SettlementSummaryCard
        targetAmount={targetAmount}
        actualAmount={actualAmount}
        headcount={data.trip.headcount}
        confirmedCount={data.funds.confirmedCount}
        /* 확인할 거래가 남아 있으면 '완료' 라고 말하지 않는다 */
        allConfirmed={checklist.reviewCount === 0}
      />

      {/*
        ── 남은 여행자금 ── (시안 v2)
        결산에서 마지막으로 확인하는 건 "그래서 얼마 남았나" 다.
      */}
      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-base font-semibold text-gray-900">
            남은 여행자금
          </Text>
          <Text className="text-xs text-gray-400">{fundSourceLabel} 기준</Text>
        </View>
        <RemainingFundCard
          theme={theme}
          remainingAmount={remainingAmount}
          raisedAmount={raisedAmount}
          actualAmount={actualAmount}
          pendingAmount={data.funds.pendingAmount}
          refundPendingAmount={data.funds.refundPendingAmount}
          closing={!settled}
          sourceLabel={fundSourceLabel}
        />
      </View>

      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-base font-semibold text-gray-900">
            카테고리별 정산
          </Text>
          <Text
            accessibilityRole="button"
            onPress={() =>
              router.push(`/trips/${data.trip.id}/funds/transactions`)
            }
            className="text-xs font-semibold"
            style={{ color: theme.primary }}
          >
            전체 지출 {data.funds.confirmedCount}건 ›
          </Text>
        </View>
        {comparisons.length > 0 ? (
          <CategoryComparisonList
            theme={theme}
            categories={comparisons}
            /* 확정 후 스냅샷에는 카테고리 id 가 없어 눌리지 않는다 */
            onSelect={(categoryId) =>
              router.push(`/trips/${data.trip.id}/budget/${categoryId}`)
            }
          />
        ) : (
          <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-8">
            <Text className="text-sm text-gray-500">비교할 예산이 없어요.</Text>
          </View>
        )}
      </View>

      {/*
        ── 주요 지출 ── (시안 v2)
        "어디에 제일 많이 썼나" 는 카테고리 합계가 아니라 거래 한 건으로 기억된다.
      */}
      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-base font-semibold text-gray-900">
            주요 지출
          </Text>
          <Text
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/trips/${data.trip.id}/funds/transactions?filter=spend`,
              )
            }
            className="text-xs font-semibold"
            style={{ color: theme.primary }}
          >
            지출 전체 보기 ›
          </Text>
        </View>
        <MajorExpenseList
          expenses={majorExpenses}
          onSelect={(transactionId) =>
            router.push(
              `/trips/${data.trip.id}/funds/transactions/${transactionId}`,
            )
          }
        />
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

      {/*
        ── 정산 리포트 공유 ──

        ⚠️ 확정 전에는 그리지 않는다. 아직 바뀔 숫자를 문서로 내보내면
           공유받은 사람이 보는 값과 앱의 값이 달라진다.

        ⚠️ 실제 사용액이 0이면 그리지 않는다. 지출을 하나도 안 적은 여행의
           리포트는 "예산만큼 다 아꼈다" 는 거짓말이 된다.
           안 쓴 것과 아직 안 적은 것은 다르다.

        [Future] 카카오톡 직접 공유는 네이티브 SDK 라 개발 빌드가 필요하다.
                 지금은 OS 공유 시트로 보낸다 — 카톡·메일·저장 모두 된다.
      */}
      {settled && report && actualAmount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="정산 리포트 공유하기"
          onPress={() => setShareOpen(true)}
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 46,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e2e6eb",
            backgroundColor: "#fff",
          }}
          className="active:bg-gray-50"
        >
          <Ionicons name="share-outline" size={16} color="#3d4654" />
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#3d4654" }}>
            정산 리포트 공유하기
          </Text>
        </Pressable>
      ) : null}

      {settled ? (
        <View className="gap-2.5">
          <View className="flex-row items-start gap-1.5 rounded-xl bg-blue-50 px-3 py-2.5">
            <Text className="flex-1 text-xs leading-4 text-blue-700">
              정산이 확정됐어요. 이 기록은 다음 여행 예산을 추천할 때 쓰여요.
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
                분류되지 않은 지출은 정산에 잡히지 않아요.
              </Text>
            </View>
          ) : null}
          <Button
            label="정산 확정하기"
            onPress={handleConfirmPress}
            loading={confirming}
            disabled={checklist.reviewCount > 0}
          />
        </View>
      )}
    </ScrollView>

      {report ? (
        <ShareReportSheet
          ref={cardRef}
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          report={report}
          theme={reportTheme}
          flag={destinationMeta?.flag ?? "🌍"}
          nameEn={destinationMeta?.nameEn ?? report.destination}
          onShareCard={handleShareCard}
          onSharePdf={handleSharePdf}
          busy={shareBusy}
        />
      ) : null}
    </>
  );
}
