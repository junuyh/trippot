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
import { Ionicons } from "@expo/vector-icons";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  BaggageTagCard,
  CategoryGrid,
  FundManagerCard,
  TripGuideCards,
  type GridCategory,
} from "@/components/trip-home";
import {
  SettlementVaultGrid,
  TravelTypeCard,
  TripReceiptCard,
  TripRecordCard,
  TypeResultOverlay,
  type SettlementVault,
  type TypeEvidenceRow,
} from "@/components/trip-type";
import { Button, EmptyState, ErrorState, Loading } from "@/components/ui";
import { EVENTS, SCREENS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { allocateVault } from "@/lib/budget/vault";
import { resolveTravelType } from "@/lib/budget/travelType";
import {
  TRIP_STAGE,
  TRIP_STAGE_LABEL,
  isAfterTrip,
  tripStage,
} from "@/lib/trip/stage";
import { buildTripRecord } from "@/lib/budget/tripRecord";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  FUND_SOURCE_TYPE,
  SETTLEMENT_TRIGGER,
  TRANSACTION_TYPE,
  TRIP_STATUS,
  type CategoryCode,
  type TripStatus,
} from "@/lib/constants/status";
import { useScreenView } from "@/lib/hooks/useScreenView";
import {
  getBudgetByTripId,
  getBudgetCategories,
  updateBudgetCategoriesPrepared,
  type BudgetCategory,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import { getGroupById } from "@/lib/supabase/queries/groups";
import {
  getFundTotals,
  getTransactions,
  reviewReason,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import {
  closeTripIfEnded,
  getTripById,
  type Trip,
} from "@/lib/supabase/queries/trips";
import {
  ensureTripTypeResult,
  type TripTypeResult,
} from "@/lib/supabase/queries/travelTypes";

/** 화면 배경. 티켓 노치를 이 색으로 칠해야 테두리가 끊겨 보인다 */
const PAGE_COLOR = "#ffffff";

type TripHomeData = {
  trip: Trip;
  budget: TripBudget | null;
  categories: BudgetCategory[];
  fund: FundSource | null;
  transactions: Transaction[];
  /** 입금 거래 합계. 누적 모금액 계산에 쓴다 */
  depositTotal: number;
  groupName: string | null;
};

export default function ScreenTripHome() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [data, setData] = useState<TripHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  /** 결산이 확정된 여행의 유형. 확정 전에는 null */
  const [typeResult, setTypeResult] = useState<TripTypeResult | null>(null);
  /** 이번 진입에서 금고 배분을 이미 저장했는지 */
  const syncedRef = useRef(false);
  /**
   * TYPE-01 오버레이 열림 여부. (시안 v3)
   * ⚠️ 별도 라우트로 밀지 않는다. 유형은 결산 결과를 다르게 읽은 것이라
   *    돌아올 때 뒤로가기를 두 번 누르게 하면 안 된다.
   */
  const [typeOpen, setTypeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    setNotFound(false);

    try {
      const found = await getTripById(tripId);
      if (!found) {
        setNotFound(true);
        return;
      }

      /**
       * 여행 기간이 끝났으면 상태를 올린다. (CLAUDE.md 3장)
       *
       * ⚠️ 사용자가 아무것도 하지 않아도 결산으로 이어져야 한다.
       *    지금까지는 여행이 끝나도 PLANNING 인 채로 남아, 결산 화면 주소를
       *    아는 사람만 결산을 할 수 있었다. 결산은 개인화의 입력이라
       *    여기서 끊기면 다음 여행 추천이 영영 만들어지지 않는다.
       *
       * ⚠️ ENDED 까지만 올린다. 확정은 사용자가 한다.
       */
      const trip = await closeTripIfEnded(found).catch(() => found);

      // 여행을 찾은 뒤에야 나머지를 붙인다. 예산·자금이 없어도 화면은 떠야 한다.
      const budget = await getBudgetByTripId(trip.id);
      const [categories, fund, transactions, totals, group] = await Promise.all(
        [
          budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
          getTravelFund(trip.id),
          getTransactions(trip.id),
          getFundTotals(trip.id),
          trip.group_id ? getGroupById(trip.group_id) : Promise.resolve(null),
        ],
      );

      setData({
        trip,
        budget,
        categories,
        fund,
        transactions,
        depositTotal: totals.depositTotal,
        groupName: group?.name ?? null,
      });
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

    // 금고 채움도 누적 모금액 기준이다. 항공권을 사면 항공 금고가 0% 로
    // 되돌아가는 일이 없어야 한다. (스펙 12장)
    const allocations = allocateVault(
      (data.fund?.current_amount ?? 0) + data.depositTotal,
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

  /**
   * 결산이 확정된 여행의 유형을 준비한다.
   *
   * ⚠️ SETTLED 일 때만 만든다. 결산 중에는 거래 분류가 남아 있어
   *    카테고리별 실제가 계속 바뀌고, 그때 뽑은 유형은 확정 후와 달라진다.
   *    한 번 만든 결과는 덮어쓰지 않는다. (queries/travelTypes.ts)
   */
  useEffect(() => {
    if (!data || data.trip.status !== TRIP_STATUS.SETTLED) return;
    void ensureTripTypeResult(
      data.trip.id,
      data.categories.map((category) => ({
        categoryCode: category.category_code as CategoryCode,
        plannedAmount: category.planned_amount,
        actualAmount: category.actual_amount,
      })),
    )
      .then(setTypeResult)
      // 유형은 부가 정보다. 실패해도 결산 영수증은 그대로 보여준다.
      .catch(() => undefined);
  }, [data]);

  /**
   * 결산 유도 노출 로그.
   *
   * ⚠️ **여기가 자동 유도의 노출 지점이다.** SETTLE-01 에서 쏘는 것은
   *    사용자가 이미 결산 화면까지 간 뒤라 'manual' 이다.
   *    둘을 구분해야 "자동 유도가 결산 도달률을 얼마나 끌어올렸나" 를 잴 수 있다.
   */
  const settlementPromptedRef = useRef(false);
  useEffect(() => {
    if (!data || settlementPromptedRef.current) return;
    if (data.trip.status !== TRIP_STATUS.ENDED) return;
    settlementPromptedRef.current = true;
    track(EVENTS.SETTLEMENT_PROMPTED, {
      trip_id: data.trip.id,
      trigger: SETTLEMENT_TRIGGER.AUTO,
    });
  }, [data]);

  useScreenView(
    SCREENS.TRIP_HOME,
    (data?.trip.status as TripStatus | undefined) ?? null,
  );

  // ── 파생값 ────────────────────────────────────────────────────────────
  const destinationMeta = useMemo(
    () => findDestinationByName(data?.trip.destination),
    [data?.trip.destination],
  );
  const theme = useMemo(
    () => countryTheme(destinationMeta?.countryKo),
    [destinationMeta?.countryKo],
  );

  /**
   * 아직 정리되지 않은 거래 수.
   *
   * ⚠️ SETTLE-01 의 확인 목록과 **같은 판정**을 쓴다. 두 화면이 다른 기준으로
   *    세면 여기서 3건이라고 해놓고 정산 화면에서 5건이 나온다.
   */
  const reviewCount = useMemo(
    () =>
      (data?.transactions ?? []).filter(
        (transaction) => reviewReason(transaction) !== null,
      ).length,
    [data?.transactions],
  );

  /**
   * 정산 확정 전에 **미리 보여주는** 여행 유형.
   *
   * ⚠️ 저장하지 않는다. resolveTravelType() 은 순수 함수라 화면에서 계산만
   *    한다. 확정 전 값을 trip_type_results 에 넣으면 그게 '확정 결과' 가
   *    되어, 이후 분류를 고쳐도 유형이 그대로 남는다. (IA v2 §2-6-3)
   *
   * ⚠️ 그래서 화면에는 **잠정값임을 반드시 적는다.** 확정값과 같은 얼굴로
   *    보여주면 정산 후 유형이 바뀌었을 때 사용자는 앱이 틀렸다고 읽는다.
   */
  const provisionalType = useMemo(() => {
    if (!data || data.trip.status === TRIP_STATUS.SETTLED) return null;
    const inputs = data.categories
      .filter((category) => category.planned_amount > 0)
      .map((category) => ({
        categoryCode: category.category_code as CategoryCode,
        plannedAmount: category.planned_amount,
        actualAmount: category.actual_amount,
      }));
    if (inputs.length === 0) return null;
    return resolveTravelType(inputs);
  }, [data]);

  /**
   * 화면에 실제로 그릴 유형. 확정값이 있으면 그것, 없으면 잠정값이다.
   * 확정값이 생기면 잠정값은 더 이상 쓰이지 않는다.
   */
  const shownType = useMemo(() => {
    if (typeResult) {
      return {
        code: typeResult.code,
        accuracyBp: typeResult.accuracyBp,
        evidence: typeResult.evidence,
        provisional: false,
      };
    }
    if (!provisionalType) return null;
    return {
      code: provisionalType.type,
      accuracyBp: provisionalType.accuracyBp,
      evidence: provisionalType.evidence,
      provisional: true,
    };
  }, [provisionalType, typeResult]);

  /** 카테고리별 결산 그리드. 계획이 있는 카테고리만 그린다 */
  const settlementVaults: SettlementVault[] = useMemo(
    () =>
      (data?.categories ?? [])
        .filter((category) => category.planned_amount > 0)
        .map((category) => ({
          categoryId: category.id,
          categoryCode: category.category_code as CategoryCode,
          plannedAmount: category.planned_amount,
          actualAmount: category.actual_amount,
        })),
    [data?.categories],
  );

  /** 이번 여행의 한 줄 기록. 결산 숫자에서 문장을 만든다 */
  const record = useMemo(
    () =>
      buildTripRecord(
        (data?.categories ?? []).map((category) => ({
          categoryCode: category.category_code as CategoryCode,
          plannedAmount: category.planned_amount,
          actualAmount: category.actual_amount,
        })),
      ),
    [data?.categories],
  );

  const gridCategories: GridCategory[] = useMemo(
    () =>
      (data?.categories ?? []).map((category) => ({
        id: category.id,
        categoryCode: category.category_code as CategoryCode,
      })),
    [data?.categories],
  );

  /**
   * 여행자금 관리 카드에 얹을 요약. (시안 v4)
   * 목록 자체는 FUND-01 이 그린다. 여기서는 "무엇이 얼마나 있는가" 만 말한다.
   */
  const fundLatest = useMemo(() => {
    const latest = data?.transactions?.[0];
    if (!latest) return null;
    return {
      amount: latest.amount,
      isDeposit: latest.transaction_type === TRANSACTION_TYPE.DEPOSIT,
    };
  }, [data?.transactions]);

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 홈" }} />
        <Loading message="여행 정보를 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 홈" }} />
        <EmptyState
          icon="airplane-outline"
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
        <Stack.Screen options={{ title: "여행 홈" }} />
        <ErrorState
          message="여행 정보를 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const { trip, budget, fund } = data;

  /**
   * 가장 크게 초과·절약한 카테고리.
   *
   * ⚠️ **금액 기준**이다. 비율로 고르면 6만원짜리 보험의 +50% 가
   *    120만원짜리 숙소의 +10% 를 이겨, 사용자가 체감한 것과 다른 답이 나온다.
   */
  /**
   * ⚠️ 실제 지출이 0 인 카테고리는 비교에서 뺀다. 계획만 세우고 아직 아무것도
   *    안 적은 카테고리를 '절약' 으로 세면, 실제 여행비가 0원인 여행이
   *    "숙소에서 268만원 절약" 이라고 말하게 된다.
   *    안 쓴 것과 아직 안 적은 것을 구분할 방법이 없으므로 판단하지 않는다.
   */
  const diffs = data.categories
    .filter(
      (category) => category.planned_amount > 0 && category.actual_amount > 0,
    )
    .map((category) => ({
      categoryCode: category.category_code as CategoryCode,
      diff: category.actual_amount - category.planned_amount,
    }));
  const overs = diffs
    .filter((row) => row.diff > 0)
    .sort((a, b) => b.diff - a.diff);
  const saveds = diffs
    .filter((row) => row.diff < 0)
    .sort((a, b) => a.diff - b.diff);
  const topOver = overs[0] ?? null;
  const topSaved = saveds[0] ?? null;
  const status = trip.status as TripStatus;

  const targetAmount = budget?.target_amount ?? 0;

  /**
   * ── 여행 단계 ──
   *
   * ⚠️ 화면 분기의 기준을 status 하나에서 **단계**로 옮겼다.
   *    status 만 보면 "계획도 지출도 없이 끝난 여행" 과 "지출 27건을 다
   *    정리한 여행" 이 똑같이 ENDED 라 같은 화면을 본다. 그래서 실제 지출이
   *    0원인 여행에 정산을 들이밀고 절약했다고 말하는 일이 생겼다.
   *
   * ⚠️ '계획이 있다' 의 기준은 **목표 예산이 잡혔는가** 다. 세부 계획 항목만
   *    세면, 추천 예산을 그대로 확정한 대부분의 여행이 '준비 중' 에 머문다.
   */
  const hasPlan =
    targetAmount > 0 || data.categories.some((c) => c.planned_amount > 0);
  const hasExpense = data.transactions.some(
    (t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL,
  );
  const stage = tripStage({ status, hasPlan, hasExpense });
  const ended = isAfterTrip(stage);

  /**
   * 누적 모금액 — 지금까지 확보한 총 여행자금. (스펙 12장)
   *
   * ⚠️ **현재 잔액과 혼용하지 않는다.**
   *    모임통장에서 항공권을 결제해도 누적 모금액은 줄지 않는다.
   *    줄어들면 여행 준비 진행률이 뒤로 가고, 비행기가 출발지 쪽으로
   *    되돌아간다. 사용자는 준비를 잘 하고 있는데 화면은 후퇴한다.
   *
   *    fund_sources.current_amount 는 등록·동기화 시점에만 쓰는 값이라
   *    거래가 쌓여도 변하지 않는다. 그래서 지금은 이 값이 곧 누적 모금액이다.
   *
   *    ⚠️ FUND-02(계좌 연결/재동기화)를 붙일 때 이 전제가 깨진다.
   *       계좌 잔액으로 덮어쓰면 지출한 만큼 줄어든 값이 들어온다.
   *       그때는 누적 모금액을 따로 보관하거나 입금 합계로 계산해야 한다.
   *       (docs/README.md §5 에 기록)
   */
  const raisedAmount =
    data.depositTotal > 0 ? data.depositTotal : (fund?.current_amount ?? 0);
  const actualTotal = data.categories.reduce(
    (sum, c) => sum + c.actual_amount,
    0,
  );
  // 100 을 넘겨 넘기지 않는다. 비행기가 도착지를 지나치면 안 된다. (스펙 3장)
  const progress =
    targetAmount > 0 ? Math.min(100, (raisedAmount / targetAmount) * 100) : 0;

  /**
   * D-Day 배지.
   *
   * ⚠️ 출발일이 지났다고 사라지게 두지 않는다. 여행이 시작됐는데 배지만
   *    없어지면 화면이 고장난 것처럼 보인다.
   *
   * ⚠️ **여행 기간 안에 있으면 남은 날짜가 아니라 '여행 중' 이다.**
   *    이미 떠나온 사람에게 D+3 은 아무 의미가 없다. 색도 바꿔서
   *    준비 중과 한눈에 구분되게 한다.
   */
  const dDay = (() => {
    if (!trip.start_date) return null;
    const today = new Date();
    const diff = differenceInCalendarDays(parseISO(trip.start_date), today);
    if (diff > 0) return { label: `D–${diff}`, ongoing: false };
    const endsIn = trip.end_date
      ? differenceInCalendarDays(parseISO(trip.end_date), today)
      : 0;
    if (endsIn >= 0) return { label: "여행 중", ongoing: true };
    return { label: `D+${-diff}`, ongoing: false };
  })();

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: PAGE_COLOR }}
      contentContainerStyle={{
        paddingHorizontal: 14,
        paddingTop: 13,
        paddingBottom: 40,
        gap: 24,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Stack.Screen options={{ title: trip.destination ?? "여행 홈" }} />

      {/*
        ── 여행 정보 ──
        ⚠️ 준비 중인 여행에서는 그리지 않는다. 목적지·기간·인원·여행계·수정
           버튼이 전부 수하물 태그 안으로 들어갔다. (시안 v4)

        ⚠️ "도쿄 여행, 어떻게 다녀왔을까요?" 같은 큰 문구를 두지 않는다.
           끝난 여행에서 사용자가 찾는 건 질문이 아니라 결과다. 문구가
           화면 첫 화면의 3분의 1을 먹고 정작 정산 상태는 아래로 밀렸다.

        ⚠️ 국기·국가 코드 자리에 **지금 어느 단계인가**를 놓는다.
           끝난 여행 화면에서 `JP` 는 이미 아는 정보고,
           '정산 전' 인지 '정산 완료' 인지가 다음 행동을 정한다.
      */}
      {ended ? (
        <View className="px-1 pt-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text
                className="text-[22px] font-extrabold"
                style={{ color: theme.neutral }}
              >
                {trip.destination ?? "여행"}
              </Text>
              <Text className="mt-1.5 text-[13px] text-gray-500">
                {[
                  trip.start_date && trip.end_date
                    ? `${format(parseISO(trip.start_date), "M.d")} — ${format(parseISO(trip.end_date), "M.d")}`
                    : null,
                  `${trip.headcount}명`,
                  data.groupName ?? "개인 여행",
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            </View>
            <View
              className="mt-1 flex-row items-center"
              style={{
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor:
                  stage === TRIP_STAGE.DONE ? "#eef8f2" : theme.primarySoft,
              }}
            >
              <Text style={{ fontSize: 11 }}>{destinationMeta?.flag ?? "🌍"}</Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "900",
                  color:
                    stage === TRIP_STAGE.DONE ? "#1c6f4f" : theme.primary,
                }}
              >
                {TRIP_STAGE_LABEL[stage]}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {ended ? (
        // ── TRIP-HOME-02 종료 상태 ──────────────────────────────────────
        <>
          {/*
            여행 유형은 **결산이 확정된 뒤에만** 확정·공개한다. (IA v2 §2-6-3)
            결산 중에는 거래 분류가 남아 있어 카테고리별 실제가 계속 바뀐다.
            그 위에서 뽑은 유형을 확정 결과처럼 보여주면 안 된다.
          */}
          {/*
            ── 정산 유도 ── (CLAUDE.md 3장)
            여행이 끝났는데 정산을 안 했으면 여기서 붙잡는다.
            확정은 사용자가 하되, 할 일이 남았다는 건 먼저 알려준다.

            ⚠️ 큰 설명 문단과 큰 버튼을 걷어내고 한 줄짜리 진입점으로 줄였다.
               이 카드는 "무엇을 해야 하는가" 만 말하면 되고, 설명은 정산
               화면이 다시 한다. 여기서 두 번 설명하면 첫 화면이 글로 찬다.

            ⚠️ '결산' 이라는 말을 앞세우지 않는다. 사용자가 "결산이 뭔데?" 에서
               멈춘다. 남은 할 일(정리되지 않은 지출)을 먼저 말한다.
          */}
          {status === TRIP_STATUS.ENDED ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="여행비 정산하러 가기"
              onPress={() => router.push(`/trips/${trip.id}/settlement`)}
              className="flex-row items-center active:opacity-70"
              style={{
                gap: 13,
                borderWidth: 1,
                borderColor: theme.primary + "33",
                borderRadius: 16,
                backgroundColor: theme.primarySoft,
                paddingHorizontal: 16,
                paddingVertical: 15,
              }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                }}
              >
                <Ionicons
                  name={reviewCount > 0 ? "alert-circle" : "receipt-outline"}
                  size={19}
                  color={theme.primary}
                />
              </View>
              <View className="flex-1">
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: theme.neutral,
                  }}
                >
                  {reviewCount > 0
                    ? `정리되지 않은 지출 ${reviewCount}건이 있어요`
                    : "여행비를 정산할 차례예요"}
                </Text>
                <Text
                  style={{ marginTop: 4, fontSize: 11, color: "#5d6674" }}
                >
                  {reviewCount > 0
                    ? "어디에 쓴 돈인지 정하면 이번 여행 결과가 완성돼요."
                    : "지출 확인이 끝났어요. 확정하면 다음 여행 예산에 반영돼요."}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </Pressable>
          ) : null}

          {/*
            ⚠️ 정산 확정 전에도 **지금 데이터로** 유형을 보여준다.
               확정할 때까지 아무것도 안 보여주면, 정작 정산을 미루게 만드는
               화면에 볼거리가 하나도 없다. 대신 잠정값임을 카드 아래에 적는다.
          */}
          {shownType ? (
            <View style={{ gap: 8 }}>
              <TravelTypeCard
                code={shownType.code}
                accuracyBp={shownType.accuracyBp}
                destinationEn={
                  destinationMeta?.nameEn ??
                  (trip.destination ?? "TRIP").toUpperCase()
                }
                /* 라우트로 밀지 않고 오버레이로 연다 (시안 v3) */
                onPress={() => setTypeOpen(true)}
              />
              {shownType.provisional ? (
                <Text
                  style={{
                    paddingHorizontal: 6,
                    fontSize: 10,
                    lineHeight: 15,
                    color: "#98a1ad",
                  }}
                >
                  정산이 끝나지 않아 지금까지의 지출로 계산한 결과예요. 지출을
                  정리하면 유형이 바뀔 수 있어요.
                </Text>
              ) : null}
            </View>
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#e8eaee",
                borderRadius: 18,
                backgroundColor: "#fff",
                padding: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "900",
                  letterSpacing: 1.2,
                  color: "#a8afb9",
                }}
              >
                TRIPPOT TRAVEL TYPE
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  fontWeight: "800",
                  color: "#141b28",
                }}
              >
                예산을 정하고 지출을 넣으면 여행 유형이 나와요
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  lineHeight: 17,
                  color: "#7c8695",
                }}
              >
                계획한 예산과 실제로 쓴 돈을 비교해 이번 여행이 어떤 여행이었는지
                알려드릴게요.
              </Text>
            </View>
          )}
          <TripReceiptCard
            theme={theme}
            destinationEn={
              destinationMeta?.nameEn ??
              (trip.destination ?? "TRIP").toUpperCase()
            }
            periodLabel={
              trip.start_date && trip.end_date
                ? `${format(parseISO(trip.start_date), "dd MMM").toUpperCase()} — ${format(parseISO(trip.end_date), "dd MMM").toUpperCase()}`
                : "—"
            }
            headcount={trip.headcount}
            targetAmount={targetAmount}
            actualAmount={actualTotal}
            topOver={topOver}
            topSaved={topSaved}
            /*
              ⚠️ 2026-09-03 · 시안 v3 · 링크를 영수증 안으로 되돌렸다.
                 영수증 아래에 같은 곳으로 가는 큰 버튼을 또 두면 종이 한 장이
                 끝나는 자리가 흐려지고, 진입점도 둘이 된다.
            */
            onPressDetail={() => router.push(`/trips/${trip.id}/settlement`)}
          />

          {/*
            ── 이번 여행의 한 줄 기록 ── (시안 v3)
            숫자만 늘어놓으면 "그래서 어땠는데" 에 답이 없다.
          */}
          {settlementVaults.length > 0 ? (
            <View className="gap-2.5">
              <View
                className="flex-row items-end justify-between"
                style={{ marginHorizontal: 4, marginBottom: 11 }}
              >
                <Text
                  className="text-[17px] font-extrabold"
                  style={{ color: theme.neutral }}
                >
                  이번 여행의 한 줄 기록
                </Text>
                <Text className="text-[10px] tracking-wider text-gray-400">
                  TRAVEL RECORD
                </Text>
              </View>
              <TripRecordCard
                theme={theme}
                destinationEn={
                  destinationMeta?.nameEn ??
                  (trip.destination ?? "TRIP").toUpperCase()
                }
                headline={record.headline}
                description={record.description}
                accuracyBp={
                  targetAmount > 0
                    ? Math.round((actualTotal / targetAmount) * 10000)
                    : 0
                }
                topSpentLabel={record.topSpentLabel}
                topSavedLabel={record.topSavedLabel}
                hashtags={record.hashtags}
              />
            </View>
          ) : null}

          {/* ── 카테고리별 결산 ── */}
          {settlementVaults.length > 0 ? (
            <View className="gap-2.5">
              <View
                className="flex-row items-end justify-between"
                style={{ marginHorizontal: 4, marginBottom: 11 }}
              >
                <Text
                  className="text-[17px] font-extrabold"
                  style={{ color: theme.neutral }}
                >
                  {trip.destination ?? "여행"} 여행, 이렇게 다녀왔어요
                </Text>
                <Text className="text-[10px] text-gray-400">
                  카테고리별 정산
                </Text>
              </View>
              <SettlementVaultGrid
                theme={theme}
                categories={settlementVaults}
                /* 카테고리를 누르면 그 카테고리 정산 상세로 간다 */
                onSelect={(categoryId) =>
                  router.push(`/trips/${trip.id}/budget/${categoryId}`)
                }
              />
            </View>
          ) : null}

          <Button
            label="같은 멤버로 다시 여행 만들기"
            variant="secondary"
            onPress={() => router.push("/trips/new/owner?entryPoint=past_trip")}
          />

          {/*
            TYPE-01 오버레이. 결산이 확정된 여행에만 결과가 있다.
            ⚠️ 근거를 반드시 함께 보여준다. 이름만 던지면 다음 여행 추천도 안 믿는다.
          */}
          {shownType ? (
            <TypeResultOverlay
              visible={typeOpen}
              theme={theme}
              code={shownType.code}
              accuracyBp={shownType.accuracyBp}
              evidence={shownType.evidence as TypeEvidenceRow[]}
              provisional={shownType.provisional}
              destinationKo={trip.destination ?? "여행"}
              onClose={() => setTypeOpen(false)}
            />
          ) : null}
        </>
      ) : (
        // ── TRIP-HOME-01 준비 중 ────────────────────────────────────────
        <>
          <BaggageTagCard
            theme={theme}
            flag={destinationMeta?.flag ?? "🌍"}
            countryCode={theme.code}
            destinationEn={
              destinationMeta?.nameEn ??
              (trip.destination ?? "TRIP").toUpperCase()
            }
            airportCode={destinationMeta?.airportCode ?? "—"}
            /* 여행 기간이다. 항공편 시각이 아니다 (CLAUDE.md 3장) */
            dateLabel={
              trip.start_date && trip.end_date
                ? `${format(parseISO(trip.start_date), "MM.dd")}–${format(parseISO(trip.end_date), "MM.dd")}`
                : null
            }
            headcount={trip.headcount}
            groupLabel={data.groupName ?? "개인 여행"}
            dDay={dDay}
            raisedAmount={raisedAmount}
            targetAmount={targetAmount}
            progress={progress}
            /* 금액 영역 전체가 FUND-01 로 가는 하나의 버튼이다 (시안 v4) */
            onPressFund={() => router.push(`/trips/${trip.id}/funds`)}
            onPressEdit={() => router.push(`/trips/${trip.id}/edit`)}
          />

          {/* 예산이 없으면 카테고리도 목표도 없다. 먼저 정하게 한다 */}
          {targetAmount <= 0 ? (
            <View className="gap-3 rounded-[16px] bg-white p-5">
              <Text
                className="text-[15px] font-bold"
                style={{ color: theme.neutral }}
              >
                아직 목표 여행비를 정하지 않았어요
              </Text>
              <Text className="text-[13px] leading-5 text-gray-500">
                목표가 있어야 어디까지 왔는지, 무엇부터 준비할지 보여드릴 수
                있어요.
              </Text>
              <Button
                label="목표 예산 정하기"
                onPress={() => router.push(`/trips/${trip.id}/budget`)}
              />
            </View>
          ) : null}

          {/*
            ── 여행자금 관리 ── FUND-01
            티켓의 금액과 같은 곳으로 가지만, 시안 v4 가 요구한 두 진입점이다.
            티켓은 '얼마나 모였는가', 이 카드는 '무엇을 할 수 있는가' 를 말한다.
          */}
          <View className="gap-2.5">
            <View style={{ marginHorizontal: 4, marginBottom: 11 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  letterSpacing: 1.1,
                  color: theme.primary,
                }}
              >
                TRAVEL FUND
              </Text>
              <Text
                className="mt-1.5 text-[17px] font-extrabold"
                style={{ color: theme.neutral }}
              >
                여행자금 관리
              </Text>
            </View>
            <FundManagerCard
              theme={theme}
              sourceLabel={
                fund?.source_type === FUND_SOURCE_TYPE.MANUAL || !fund
                  ? "직접 입력"
                  : "연결 계좌"
              }
              latest={fundLatest}
              totalCount={data.transactions.length}
              onPress={() => router.push(`/trips/${trip.id}/funds`)}
            />
          </View>

          {/*
            ── 카테고리별 준비 현황 ── BUDGET-02 / BUDGET-01
            준비율은 그리지 않는다. 이유는 CategoryGrid 주석 참고.
          */}
          {gridCategories.length > 0 ? (
            <View className="gap-2.5">
              <View style={{ marginHorizontal: 4, marginBottom: 11 }}>
                <Text
                  className="text-[17px] font-extrabold"
                  style={{ color: theme.neutral }}
                >
                  카테고리별 준비 현황
                </Text>
              </View>
              <CategoryGrid
                categories={gridCategories}
                onSelect={(categoryId) =>
                  router.push(`/trips/${trip.id}/budget/${categoryId}`)
                }
              />
              {/* 전체 예산(BUDGET-01)으로 가는 유일한 입구다 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="전체 예산 관리하기"
                onPress={() => router.push(`/trips/${trip.id}/budget`)}
                className="flex-row items-center justify-between active:opacity-80"
                style={{
                  marginTop: 2,
                  borderWidth: 1,
                  borderColor: theme.primary + "44",
                  borderRadius: 14,
                  backgroundColor: theme.primarySoft,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "900",
                      color: theme.primary,
                    }}
                  >
                    전체 예산 관리하기
                  </Text>
                  <Text
                    style={{ marginTop: 4, fontSize: 10, color: "#687689" }}
                  >
                    목표 예산과 카테고리별 금액을 확인·수정해요.
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: theme.primary,
                  }}
                >
                  ›
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View className="gap-2.5">
            <View
              className="flex-row items-end justify-between"
              style={{ marginHorizontal: 4, marginBottom: 11 }}
            >
              <Text
                className="text-[17px] font-extrabold"
                style={{ color: theme.neutral }}
              >
                여행 준비에 도움되는 정보
              </Text>
              <Text className="text-[10px] tracking-wider text-gray-400">
                TRIP GUIDE
              </Text>
            </View>
            <TripGuideCards
              destination={trip.destination ?? "여행"}
              theme={theme}
              onPressTips={() => router.push("/community")}
              onPressInsurance={() =>
                router.push(`/trips/${trip.id}/insurance`)
              }
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
