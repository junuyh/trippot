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
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import type ViewShot from "react-native-view-shot";

import {
  BaggageTagCard,
  CategoryGrid,
  FundManagerCard,
  TripGuideCards,
  type GridCategory,
  TodayAllowanceCard,
  TripSettingsButton,
  TripSettingsSheet,
} from "@/components/trip-home";
import { AppHomeButton } from "@/components/navigation/AppHomeButton";
import { dailyAllowance } from "@/lib/budget/dailyAllowance";
import { scheduleSpendReminders } from "@/lib/notifications/spendReminder";
import {
  SettlementVaultGrid,
  TravelTypeCard,
  TripReceiptCard,
  TripRecordCard,
  TypeResultOverlay,
  TypeStorySheet,
  type SettlementVault,
  type TypeEvidenceRow,
} from "@/components/trip-type";
import { TripStorySheet, TripStoryTeaser } from "@/components/trip-record";
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
import { romanizeName } from "@/lib/trip/romanize";
import { CITY_PIN, countryOutline } from "@/lib/constants/countryOutline";
import { countryTheme } from "@/lib/constants/countryTheme";
import { destinationPhoto } from "@/lib/constants/destinationPhoto";
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
import { useTripContext } from "@/lib/hooks/useTripContext";
import {
  getBudgetByTripId,
  getBudgetCategories,
  updateBudgetCategoriesPrepared,
  type BudgetCategory,
  type TripBudget,
  countPlanItems,
} from "@/lib/supabase/queries/budgets";
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import { getGroupById, getGroupMembers } from "@/lib/supabase/queries/groups";
import {
  getFundReadyAt,
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
import {
  castCancelVote,
  getActiveCancelRequest,
  getVoteProgress,
  recheckAfterMemberLeft,
  requestCancel,
  restoreCanceledTrip,
  type CanceledFundSnapshot,
  type CancelRequest,
  type VoteProgress,
} from "@/lib/supabase/queries/tripCancel";
import {
  delegateAndLeave,
  leaveTrip,
  listActiveTripMembers,
  type TripMemberWithName,
} from "@/lib/supabase/queries/tripMembers";
import { canLeaveTrip, isTripLeader, leaveModeOf } from "@/lib/trip/tripLeader";
import {
  cancelFundLabel,
  cancelPerPersonAmount,
  cancelRemainingAmount,
  canRestoreTrip,
  restoreRemainingLabel,
  type FundKind,
} from "@/lib/trip/cancelPolicy";
import {
  CancelConfirmSheet,
  CancelPendingBanner,
  CancelReasonSheet,
  CancelVoteSheet,
  CANCEL_REASON_LABEL,
  RestoreConfirmSheet,
  type CancelReasonCode,
} from "@/components/cancel";
import { DelegateLeaderSheet, LeaveTripSheet } from "@/components/members";
import { useCurrentUserId } from "@/lib/auth/AuthProvider";

/** 화면 배경. 티켓 노치를 이 색으로 칠해야 테두리가 끊겨 보인다 */
const PAGE_COLOR = "#ffffff";

/** 취소·나가기 시트. 한 번에 하나만 열린다 */
type CancelSheet =
  | null
  | "leave"
  | "delegate"
  | "cancelReason"
  | "cancelConfirm"
  | "vote"
  | "restore";

/**
 * 시트가 완전히 닫히기를 기다리는 시간.
 * BottomSheet 의 CLOSE_MS(180) 보다 넉넉히 잡는다.
 */
const SHEET_SWAP_MS = 240;

/**
 * 입금이 목표액(계획 합계)에 닿은 날부터 출발일까지 며칠인지.
 * 못 닿았거나 출발일이 없으면 undefined. 미리미리형 판정에 쓴다.
 */
async function fundReadyDaysBefore(data: TripHomeData): Promise<number | undefined> {
  if (!data.trip.start_date) return undefined;
  const target = data.categories.reduce(
    (sum, category) => sum + category.planned_amount,
    0,
  );
  const readyAt = await getFundReadyAt(data.trip.id, target);
  if (!readyAt) return undefined;
  return differenceInCalendarDays(parseISO(data.trip.start_date), parseISO(readyAt));
}

type TripHomeData = {
  trip: Trip;
  budget: TripBudget | null;
  categories: BudgetCategory[];
  fund: FundSource | null;
  transactions: Transaction[];
  /** 입금 거래 합계. 누적 모금액 계산에 쓴다 */
  depositTotal: number;
  groupName: string | null;
  /** 함께 간 사람 이름. 개인 여행이면 빈 배열. 스토리 이미지에 쓴다 */
  memberNames: string[];

  /**
   * 살아 있는 취소 요청. 없으면 null.
   *
   * ⚠️ getActiveCancelRequest() 가 **조회 시점에 만료를 판정한다.** 여행 홈은
   *    반드시 이 함수를 통과하므로 크론 없이도 만료가 즉시 반영된다.
   *    (POL-CXL-063 · 064)
   */
  cancelRequest: CancelRequest | null;
  /** 동의 현황. 요청이 없으면 null */
  voteProgress: VoteProgress | null;
  /** 참여 중인 여행 멤버. 나가기 판정에 쓴다 */
  members: TripMemberWithName[];
};

export default function ScreenTripHome() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);

  const [data, setData] = useState<TripHomeData | null>(null);
  /**
   * 여행 설정 사이드 시트. 헤더 오른쪽 톱니바퀴로 연다.
   * 나가기·취소의 실제 동작은 다른 팀원이 만든다. 아래 두 핸들러가 그 자리다.
   */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const userId = useCurrentUserId();

  /**
   * 지금 열린 취소·나가기 시트. 한 번에 하나만 연다.
   *
   * ⚠️⚠️ **시트를 바로 갈아끼우지 않는다.** ⚠️⚠️
   *    BottomSheet 는 닫는 애니메이션(180ms) 동안 Modal 을 살려 둔다. 그 사이에
   *    새 Modal 을 띄우면 iOS 가 조용히 실패시키고, 보이지 않는 Modal 이 화면
   *    전체의 터치를 삼킨다. 스크롤도 탭도 안 먹는 상태가 된다.
   *    (2026-09-10 CXL 미리보기에서 확인)
   *    그래서 openSheetAfterClose() 로 **닫고 → 기다렸다 → 연다.**
   */
  const [sheet, setSheet] = useState<CancelSheet>(null);
  /** 나가기 시트의 '모임에서도 나갈지' 선택. null 이면 아직 안 골랐다 */
  const [alsoLeaveGroup, setAlsoLeaveGroup] = useState<boolean | null>(null);
  /** 위임 대상 memberId */
  const [delegateId, setDelegateId] = useState<string | null>(null);
  /** 취소 사유. 선택 입력이라 null 로 시작한다 */
  const [cancelReason, setCancelReason] = useState<CancelReasonCode | null>(null);
  /** 저장·요청 중. 중복 제출을 막는다 (NFR-005) */
  const [busy, setBusy] = useState(false);

  /**
   * 열려 있는 시트를 닫고, 완전히 내려간 뒤 다음 시트를 연다.
   *
   * ⚠️ setSheet(next) 로 바로 갈아끼우면 iOS 에서 화면이 먹통이 된다.
   *    위 sheet 상태 주석 참조.
   */
  const openSheetAfterClose = useCallback((next: CancelSheet) => {
    setSettingsOpen(false);
    setSheet(null);
    setTimeout(() => setSheet(next), SHEET_SWAP_MS);
  }, []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  /** 결산이 확정된 여행의 유형. 확정 전에는 null */
  const [typeResult, setTypeResult] = useState<TripTypeResult | null>(null);
  /** 이번 진입에서 금고 배분을 이미 저장했는지 */
  const syncedRef = useRef(false);
  /**
   * 여행 기록 스토리 이미지 시트. (2026-09-08 시안)
   * ⚠️ 사용자에게 받는 건 배경 사진 하나뿐이다. 나머지는 여행 데이터로 채운다.
   */
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyPhoto, setStoryPhoto] = useState<string | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  /**
   * 함께 간 사람. 자유 입력이라 줄바꿈까지 그대로 카드에 들어간다.
   * null 은 "아직 손대지 않음" 이고, 그때는 영문 시작값을 보여준다.
   */
  const [storyMembersText, setStoryMembersText] = useState<string | null>(null);
  const storyRef = useRef<ViewShot>(null);
  /** 여행 유형 공유 시트. 확정된 유형에서만 연다 */
  const [typeStoryOpen, setTypeStoryOpen] = useState(false);
  const [typeStoryBusy, setTypeStoryBusy] = useState(false);
  const typeStoryRef = useRef<ViewShot>(null);
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
      const [categories, fund, transactions, totals, group, members] =
        await Promise.all([
          budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
          getTravelFund(trip.id),
          getTransactions(trip.id),
          getFundTotals(trip.id),
          trip.group_id ? getGroupById(trip.group_id) : Promise.resolve(null),
          // 이름은 스토리 이미지에만 쓴다. 못 가져와도 화면은 떠야 해서 빈 배열로 떨어뜨린다.
          trip.group_id
            ? getGroupMembers(trip.group_id).catch(() => [])
            : Promise.resolve([]),
        ]);

      /**
       * 취소 요청과 여행 멤버.
       *
       * ⚠️ getActiveCancelRequest() 안에서 **만료를 판정하고 상태를 되돌린다.**
       *    여행 홈이 이 함수를 통과하는 것이 만료 처리의 전부다. 크론이 없다.
       *
       * ⚠️ 실패해도 화면은 떠야 한다. 취소 배너가 없을 뿐이지 여행 준비는
       *    그대로 할 수 있다. (POL-CXL-006)
       */
      const cancelRequest = await getActiveCancelRequest(trip.id, trip.start_date).catch(
        () => null,
      );
      const [voteProgress, tripMembers] = await Promise.all([
        cancelRequest ? getVoteProgress(cancelRequest).catch(() => null) : Promise.resolve(null),
        listActiveTripMembers(trip.id).catch(() => []),
      ]);

      setData({
        trip,
        budget,
        categories,
        fund,
        transactions,
        depositTotal: totals.depositTotal,
        groupName: group?.name ?? null,
        memberNames: members.map((member) => member.user.name),
        cancelRequest,
        voteProgress,
        members: tripMembers,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  /**
   * 지출 입력 리마인드(매일 21:00 로컬 알림)를 잡는다. 여행이 임박했거나
   * 진행 중일 때만 권한을 묻고, 같은 여행 것은 지우고 다시 잡아 중복되지 않는다.
   * 실패해도 화면은 멀쩡해야 한다 (Android Expo Go 는 알림 모듈이 없다).
   */
  const remindedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data || remindedRef.current === data.trip.id) return;
    remindedRef.current = data.trip.id;
    scheduleSpendReminders(data.trip).catch(() => undefined);
  }, [data]);

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
    const inputs = data.categories.map((category) => ({
      categoryCode: category.category_code as CategoryCode,
      plannedAmount: category.planned_amount,
      actualAmount: category.actual_amount,
    }));

    /*
      세부 계획 개수를 함께 넘긴다. '즉흥형' 은 지출이 아니라 준비 행동을 보는
      유일한 유형이라 이 값이 없으면 절대 나오지 않는다.

      ⚠️ 개수를 못 세면 넘기지 않는다. 세어 보지도 않고 '계획을 안 세웠다' 고
         단정하면 안 된다. 그 경우 나머지 여덟 유형으로만 판정된다.
    */
    void Promise.all([
      countPlanItems(data.categories.map((category) => category.id)).catch(
        () => undefined,
      ),
      /*
        여행자금을 언제 다 모았는지도 함께 넘긴다. '미리미리형' 은 지출이 아니라
        준비 행동을 보는 유형이라 이 값이 없으면 절대 나오지 않는다.
        ⚠️ 못 구하면 넘기지 않는다. 즉흥형과 같은 원칙이다.
      */
      fundReadyDaysBefore(data).catch(() => undefined),
    ])
      .then(([planItemCount, readyDays]) =>
        ensureTripTypeResult(data.trip.id, inputs, planItemCount, readyDays),
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
    /*
      ⚠️ 지출이 하나도 없으면 유형을 만들지 않는다.
         계획만 있고 실제가 0 이면 계산상 '절약형' 이 나온다. 아무것도 안 쓴
         여행이 "적게 쓰고 많이 봤다" 로 불리는 셈이라, 기록을 안 한 사람이
         가장 알뜰한 여행자가 된다. 영수증·한 줄 기록에 넣은 것과 같은 기준이다.
    */
    const spent = data.transactions.some(
      (t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL,
    );
    if (!spent) return null;
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

  /**
   * 함께 간 사람 시작값. 영문(로마자)은 제목이 영문이라 톤이 맞고, 한글은 그대로.
   * 사용자가 고쳐 쓰기 전까지 영문을 보여준다.
   */
  const storyMemberPresets = useMemo(() => {
    const names = data?.memberNames ?? [];
    if (names.length === 0) return [];
    return [
      { label: "영문", text: names.map((name) => romanizeName(name).toUpperCase()).join(" · ") },
      { label: "한글", text: names.join(" · ") },
    ];
  }, [data?.memberNames]);
  const storyMembers = storyMembersText ?? storyMemberPresets[0]?.text ?? "";

  /** 유형 신분증에 적는 기간. "2026.05.14 – 05.17" */
  const tripPeriodLabel = useMemo(() => {
    const trip = data?.trip;
    if (!trip?.start_date || !trip?.end_date) return null;
    return `${format(parseISO(trip.start_date), "yyyy.MM.dd")} – ${format(parseISO(trip.end_date), "MM.dd")}`;
  }, [data?.trip]);

  /** 스토리 카드에 넘길 데이터. 티저(작은 미리보기)와 시트가 같은 값을 쓴다 */
  const storyCardBase = useMemo(() => {
    const trip = data?.trip;
    return {
      theme,
      flag: destinationMeta?.flag ?? "🌍",
      destinationEn:
        destinationMeta?.nameEn ?? (trip?.destination ?? "TRIP").toUpperCase(),
      photoUri: storyPhoto,
      fallbackPhotoUrl: destinationPhoto(destinationMeta?.code)?.url ?? null,
      outline: countryOutline(destinationMeta?.countryKo),
      pin: destinationMeta ? CITY_PIN[destinationMeta.code] : null,
      startDate: trip?.start_date ?? null,
      endDate: trip?.end_date ?? null,
      membersText: storyMembers,
    };
  }, [data?.trip, theme, destinationMeta, storyPhoto, storyMembers]);

  /** 스토리 이미지의 배경 사진 고르기. 사진 하나만 받는다. */
  const handlePickStoryPhoto = useCallback(async () => {
    if (storyBusy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("사진 접근 권한이 필요해요", "설정에서 사진 접근을 허용해 주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // 미리보기에 바로 띄우는 용도라 HEIC 도 상관없다. 캡처 결과는 PNG 로 나간다.
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setStoryPhoto(result.assets[0].uri);
  }, [storyBusy]);

  /**
   * 미리보기 카드를 그대로 캡처해서 공유 시트로 넘긴다.
   * ⚠️ [검토 필요] 공유 완료 이벤트. events.ts 에 없어서 아직 track() 하지 않는다.
   *    TRIP_RECORD_SHARED 같은 이름으로 승인되면 여기서 기록한다. (CLAUDE.md 8장)
   */
  const handleShareStory = useCallback(async () => {
    if (storyBusy) return;
    setStoryBusy(true);
    try {
      const uri = await storyRef.current?.capture?.();
      if (!uri) throw new Error("capture failed");
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("공유할 수 없어요", "이 기기에서는 공유 기능을 쓸 수 없어요.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "여행 기록 이미지 공유",
      });
    } catch {
      Alert.alert("만들지 못했어요", "잠시 뒤 다시 시도해 주세요.");
    } finally {
      setStoryBusy(false);
    }
  }, [storyBusy]);

  /**
   * 유형 결과지를 캡처해서 공유 시트로 넘긴다.
   * ⚠️ [검토 필요] 공유 완료 이벤트. events.ts 에 없어서 아직 track() 하지 않는다.
   */
  const handleShareTypeStory = useCallback(async () => {
    if (typeStoryBusy) return;
    setTypeStoryBusy(true);
    try {
      const uri = await typeStoryRef.current?.capture?.();
      if (!uri) throw new Error("capture failed");
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("공유할 수 없어요", "이 기기에서는 공유 기능을 쓸 수 없어요.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "내 여행 유형 공유",
      });
    } catch {
      Alert.alert("만들지 못했어요", "잠시 뒤 다시 시도해 주세요.");
    } finally {
      setTypeStoryBusy(false);
    }
  }, [typeStoryBusy]);

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
        <Stack.Screen options={{ title: "여행 홈", headerLeft: () => <AppHomeButton /> }} />
        <Loading message="여행 정보를 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 홈", headerLeft: () => <AppHomeButton /> }} />
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
        <Stack.Screen options={{ title: "여행 홈", headerLeft: () => <AppHomeButton /> }} />
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

  // ── 취소 · 나가기 판정 ──────────────────────────────────────────────────
  const isCancelPending = status === TRIP_STATUS.CANCEL_PENDING;
  const isCanceled = status === TRIP_STATUS.CANCELED;

  /** 나를 포함한 참여 인원. 나가기 판정의 분모다 */
  const activeMemberCount = data.members.length;
  const isActiveMember = data.members.some((m) => m.user_id === userId);
  const leaveDecision = canLeaveTrip({
    trip,
    userId,
    isActiveMember,
    activeMemberCount,
  });
  const leaveMode = leaveModeOf(leaveDecision);

  /** 위임 대상 — 나를 뺀 가입 멤버. 미가입 동행자는 여행장이 될 수 없다 */
  const delegateCandidates = data.members
    .filter((m) => m.user_id !== null && m.user_id !== userId)
    .map((m) => ({
      memberId: m.id,
      userId: m.user_id,
      name: m.name,
      isTripLeader: false,
    }));

  /** 동의 대상 수 = 참여 인원 − 요청자. 개인 여행이면 0이라 즉시 확정된다 */
  const voteTargetCount = Math.max(0, activeMemberCount - 1);
  const isCancelRequester = data.cancelRequest?.requested_by === userId;
  const hasVoted = Boolean(
    data.voteProgress?.votes.some((v) => v.user_id === userId),
  );

  const canRestore = canRestoreTrip({
    status,
    canceledAt: trip.canceled_at,
    now: new Date(),
  });

  // ── 취소 · 나가기 동작 ──────────────────────────────────────────────────
  //
  // ⚠️ **useCallback 을 쓰지 않는다.** 이 자리는 loading / notFound / error
  //    early return 보다 아래다. 여기에 훅을 두면 렌더마다 훅 개수가 달라져
  //    "Rendered more hooks than during the previous render" 로 화면이 죽는다.
  //    (2026-09-10 확인) 매 렌더 새로 만들어지지만 이 화면은 이미 그 아래에서
  //    파생값을 매번 계산하고 있어 비용 차이가 없다.

  /**
   * 취소 확정 시 저장할 금액 스냅샷. (POL-CXL-011 · 015)
   *
   * ⚠️ ACCOUNT 는 **현재 잔액을 그대로** 쓴다. 이미 지출이 빠진 값이라
   *    또 빼면 이중 차감이다.
   */
  const buildFundSnapshot = (): CanceledFundSnapshot => {
    // 실제 지출 합계. 아래 actualTotal 과 같은 값이지만 그건 이 아래에서
    // 만들어져 여기서 못 쓴다. 같은 식을 쓴다.
    const spentTotal = data.categories.reduce((sum, c) => sum + c.actual_amount, 0);
    const fundKind: FundKind =
      fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT
        ? "ACCOUNT"
        : (fund?.current_amount ?? 0) > 0 || data.depositTotal > 0
          ? "MANUAL"
          : "ZERO";
    const remaining = cancelRemainingAmount({
      fundKind,
      currentBalance: fund?.current_amount ?? 0,
      totalSaved: data.depositTotal,
      actualSpent: spentTotal,
    });
    return {
      fund_type: fundKind,
      // ⚠️ fund_sources 에는 마스킹 계좌번호가 없다. financial_accounts 에 있고
      //    이 화면은 그걸 읽지 않는다. 스냅샷에는 null 로 남기고, 화면은
      //    "연결한 계좌" 로 대신 부른다. 필요해지면 조회를 추가한다.
      masked_account: null,
      total_saved: data.depositTotal,
      actual_spent: spentTotal,
      remaining,
      goal_amount: targetAmount,
      headcount: trip.headcount,
      captured_at: new Date().toISOString(),
    };
  };

  /** 취소 요청. 개인 여행이면 requestCancel 안에서 바로 확정된다 */
  const handleRequestCancel = async () => {
    if (busy || !userId) return;
    setBusy(true);
    try {
      const result = await requestCancel({
        tripId: trip.id,
        requestedBy: userId,
        reason: cancelReason,
        voteTargetCount,
        fundSnapshot: buildFundSnapshot(),
      });
      setSheet(null);
      await load();
      Alert.alert(
        result.outcome === "CANCELED" ? "여행을 취소했어요" : "취소 요청을 보냈어요",
        result.outcome === "CANCELED"
          ? "3일 안에는 되돌릴 수 있어요."
          : `멤버 ${voteTargetCount}명이 모두 동의하면 여행이 취소돼요.`,
      );
    } catch {
      Alert.alert("요청하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  /** 동의 · 반대. 반대는 그 자리에서 요청을 폐기한다 (POL-CXL-062) */
  const handleVote = async (vote: "AGREE" | "DISAGREE") => {
      if (busy || !userId || !data.cancelRequest) return;
      setBusy(true);
      try {
        const result = await castCancelVote({
          request: data.cancelRequest,
          userId,
          vote,
          fundSnapshot: buildFundSnapshot(),
        });
        setSheet(null);
        await load();
        Alert.alert(
          vote === "DISAGREE" ? "취소에 반대했어요" : "취소에 동의했어요",
          vote === "DISAGREE"
            ? "요청이 폐기되고 여행은 그대로 유지돼요."
            : result.outcome === "APPROVED"
              ? "모두 동의해서 여행이 취소됐어요. 3일 안에는 되돌릴 수 있어요."
              : "다른 멤버의 동의를 기다리고 있어요.",
        );
      } catch {
        Alert.alert("전달하지 못했어요", "이미 투표했거나 요청이 끝났을 수 있어요.");
      } finally {
        setBusy(false);
      }
  };

  /** 되돌리기. 동의를 받지 않는다 (POL-CXL-038) */
  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await restoreCanceledTrip(trip.id);
      setSheet(null);
      await load();
      Alert.alert("다시 준비해요", "취소하기 전 상태로 돌아왔어요.");
    } catch {
      Alert.alert("되돌리지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * 여행에서 나간다.
   *
   * ⚠️ 나간 뒤 **취소 동의를 다시 판정한다.** (POL-CXL-068) 남은 인원이 이미
   *    전원 동의 상태였다면 그 순간 취소가 확정돼야 한다. 이걸 빼면 요청이
   *    영영 대기로 남는다.
   */
  const handleLeave = async () => {
    if (busy || !userId || alsoLeaveGroup === null) return;
    setBusy(true);
    try {
      await leaveTrip({
        tripId: trip.id,
        userId,
        alsoLeaveGroup,
        groupId: trip.group_id,
      });
      await recheckAfterMemberLeft({
        tripId: trip.id,
        tripStartDate: trip.start_date,
        fundSnapshot: buildFundSnapshot(),
      }).catch(() => undefined);
      setSheet(null);
      router.replace("/");
    } catch {
      Alert.alert("나가지 못했어요", "잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  /** 여행장을 넘기고 나간다. 위임 먼저, 나가기 나중 */
  const handleDelegateAndLeave = async () => {
    if (busy || !userId || !delegateId) return;
    const target = delegateCandidates.find((c) => c.memberId === delegateId);
    if (!target?.userId) return;
    setBusy(true);
    try {
      await delegateAndLeave({
        tripId: trip.id,
        fromUserId: userId,
        toUserId: target.userId,
        alsoLeaveGroup: false,
        groupId: trip.group_id,
      });
      await recheckAfterMemberLeft({
        tripId: trip.id,
        tripStartDate: trip.start_date,
        fundSnapshot: buildFundSnapshot(),
      }).catch(() => undefined);
      setSheet(null);
      router.replace("/");
    } catch {
      Alert.alert("넘기지 못했어요", "잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  // ── 취소 화면 표시값 ────────────────────────────────────────────────────
  /**
   * 화면에 쓸 금액. 확정 시 저장하는 스냅샷과 같은 식으로 만든다.
   *
   * ⚠️ 이미 취소된 여행은 **저장된 스냅샷을 그대로 읽는다.** 다시 계산하지
   *    않는다. 취소 후에도 계좌 거래는 들어오는데, 그때 값이 바뀌면
   *    "취소 시점 기록" 이 아니게 된다. (POL-CXL-011 · 012)
   */
  const cancelSnapshot: CanceledFundSnapshot =
    (isCanceled && (trip.canceled_fund_snapshot_json as CanceledFundSnapshot | null)) ||
    buildFundSnapshot();

  const cancelPerPerson = cancelPerPersonAmount(cancelSnapshot.remaining, trip.headcount);

  const cancelExpiresLabel = data.cancelRequest
    ? format(parseISO(data.cancelRequest.expires_at), "M월 d일")
    : "";

  const cancelRequesterName =
    data.members.find((m) => m.user_id === data.cancelRequest?.requested_by)?.name ??
    "요청자";


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

  /**
   * 오늘 쓸 수 있는 돈. 여행 기간 안에서만 값이 있다.
   * 예산 = 카테고리 계획 합. 모금액이 아니다. (lib/budget/dailyAllowance)
   */
  const todayAllowance = dailyAllowance({
    startDate: trip.start_date,
    endDate: trip.end_date,
    budgetTotal: data.categories.reduce((sum, c) => sum + c.planned_amount, 0),
    transactions: data.transactions,
    today: new Date(),
  });
  const totalDays =
    trip.start_date && trip.end_date
      ? differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1
      : 0;

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
      <Stack.Screen
        options={{
          title: trip.destination ?? "여행 홈",
          /* 왼쪽은 앱 홈(집), 오른쪽은 여행 설정(톱니). '<' 는 어디로 가는지 알 수 없었다 */
          headerLeft: () => <AppHomeButton />,
          /* 끝난 여행은 고칠 것도 나갈 것도 취소할 것도 없다. 톱니를 아예 안 그린다 */
          headerRight: ended
            ? undefined
            : () => <TripSettingsButton onPress={() => setSettingsOpen(true)} />,
        }}
      />

      {/*
        ── 여행 설정 사이드 시트 ──
        ⚠️ 시트를 먼저 닫고 다음 시트를 연다. 바로 갈아끼우면 iOS 가 앞 Modal
           이 닫히는 중에 새 Modal 을 띄우지 못하고, **보이지 않는 Modal 이
           터치를 삼켜** 화면이 통째로 먹통이 된다. (2026-09-10 확인)
           BottomSheet 는 닫는 애니메이션 동안 Modal 을 살려 둔다.
      */}
      <TripSettingsSheet
        visible={settingsOpen && !ended}
        onClose={() => setSettingsOpen(false)}
        destination={trip.destination ?? "여행"}
        groupName={data.groupName}
        onEdit={() => router.push(`/trips/${trip.id}/edit`)}
        onLeave={() => openSheetAfterClose("leave")}
        onCancel={() => openSheetAfterClose("cancelReason")}
      />

      {/*
        ── 취소 · 나가기 시트 ──
        ⚠️ 시트끼리 이어질 때는 반드시 openSheetAfterClose() 를 쓴다.
           setSheet 로 바로 갈아끼우면 iOS 에서 화면이 먹통이 된다.
      */}
      <LeaveTripSheet
        visible={sheet === "leave"}
        onClose={() => setSheet(null)}
        mode={leaveMode}
        destination={trip.destination ?? "여행"}
        groupName={data.groupName ?? "모임"}
        alsoLeaveGroup={alsoLeaveGroup}
        onChangeAlsoLeaveGroup={setAlsoLeaveGroup}
        fundBalanceLabel={
          fund && fund.current_amount > 0 ? `${fund.current_amount.toLocaleString("ko-KR")}원` : null
        }
        onLeave={() => void handleLeave()}
        onOpenDelegate={() => openSheetAfterClose("delegate")}
        onInvite={() => router.push(`/trips/${trip.id}/edit`)}
        onCancelTrip={() => openSheetAfterClose("cancelReason")}
        leaving={busy}
      />

      <DelegateLeaderSheet
        visible={sheet === "delegate"}
        onClose={() => setSheet(null)}
        candidates={delegateCandidates}
        selectedMemberId={delegateId}
        onSelect={setDelegateId}
        fundBalanceLabel={
          fund && fund.current_amount > 0 ? `${fund.current_amount.toLocaleString("ko-KR")}원` : null
        }
        onSubmit={() => void handleDelegateAndLeave()}
        submitting={busy}
      />

      <CancelReasonSheet
        visible={sheet === "cancelReason"}
        onClose={() => setSheet(null)}
        destination={trip.destination ?? "여행"}
        isEnded={status === TRIP_STATUS.ENDED}
        needsAgreement={voteTargetCount > 0}
        voteTargetCount={voteTargetCount}
        reason={cancelReason}
        onToggleReason={(code) => setCancelReason((prev) => (prev === code ? null : code))}
        onEditDates={() => router.push(`/trips/${trip.id}/edit`)}
        onEditHeadcount={() => router.push(`/trips/${trip.id}/edit`)}
        onSubmit={() => openSheetAfterClose("cancelConfirm")}
        submitting={busy}
      />

      <CancelConfirmSheet
        visible={sheet === "cancelConfirm"}
        onClose={() => setSheet(null)}
        isEnded={status === TRIP_STATUS.ENDED}
        needsAgreement={voteTargetCount > 0}
        voteTargetCount={voteTargetCount}
        hasLinkedAccount={fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT}
        spentLabel={cancelSnapshot.actual_spent > 0 ? `${cancelSnapshot.actual_spent.toLocaleString("ko-KR")}원` : null}
        expiresAtLabel={cancelExpiresLabel}
        fund={{
          fundType: cancelSnapshot.fund_type,
          remainingLabel: `${cancelSnapshot.remaining.toLocaleString("ko-KR")}원`,
          label: cancelFundLabel({
            fundKind: cancelSnapshot.fund_type,
            maskedAccount: null,
            actualSpent: cancelSnapshot.actual_spent,
          }),
          perPersonLabel:
            cancelPerPerson === null ? null : `${cancelPerPerson.toLocaleString("ko-KR")}원`,
          headcount: trip.headcount,
        }}
        onBack={() => openSheetAfterClose("cancelReason")}
        onConfirm={() => void handleRequestCancel()}
        submitting={busy}
      />

      <CancelVoteSheet
        visible={sheet === "vote"}
        onClose={() => setSheet(null)}
        requesterName={cancelRequesterName}
        destination={trip.destination ?? "여행"}
        expiresAtLabel={cancelExpiresLabel}
        reasonLabel={
          data.cancelRequest?.reason
            ? CANCEL_REASON_LABEL[data.cancelRequest.reason as CancelReasonCode] ?? null
            : null
        }
        fundBalanceLabel={
          fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT && fund.current_amount > 0
            ? `${fund.current_amount.toLocaleString("ko-KR")}원`
            : null
        }
        onAgree={() => void handleVote("AGREE")}
        onDisagree={() => void handleVote("DISAGREE")}
        deciding={busy}
      />

      <RestoreConfirmSheet
        visible={sheet === "restore"}
        onClose={() => setSheet(null)}
        destination={trip.destination ?? "여행"}
        isGroupTrip={Boolean(trip.group_id)}
        changes={[]}
        afterLabel={`${cancelSnapshot.remaining.toLocaleString("ko-KR")}원`}
        fundType={cancelSnapshot.fund_type}
        onRestore={() => void handleRestore()}
        restoring={busy}
      />


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
      {/*
        ── TRIP-HOME-04 취소 요청 중 배너 ──
        ⚠️ **여행 홈 전체 기능은 그대로 돈다.** CANCEL_PENDING 은 읽기 전용이
           아니다. 예산·계획·지출을 계속 고칠 수 있다. (POL-CXL-006)
           잠그면 한 명이 요청만 걸어두고 여행을 마비시킬 수 있다.
        ⚠️ 새 라우트를 만들지 않는다. 배너만 얹는다. (스펙 §7)
      */}
      {isCancelPending ? (
        <View className="px-1 pb-3 pt-1">
          <CancelPendingBanner
            agreedCount={data.voteProgress?.agreedCount ?? 0}
            voteTargetCount={data.voteProgress?.targetCount ?? voteTargetCount}
            isRequester={isCancelRequester}
            hasVoted={hasVoted}
            requesterName={cancelRequesterName}
            onOpenProgress={() => openSheetAfterClose("vote")}
            onOpenVote={() => openSheetAfterClose("vote")}
          />
        </View>
      ) : null}

      {/*
        ── TRIP-HOME-03 되돌리기 배너 ──
        72시간 안에만 뜬다. 지나면 되돌리기 수단이 없다. (POL-CXL-030 · 031)
      */}
      {isCanceled && canRestore && trip.canceled_at ? (
        <View className="px-1 pb-3 pt-1">
          <View
            className="flex-row items-center rounded-2xl px-4 py-3.5"
            style={{ gap: 11, backgroundColor: "#EBF1FF" }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#0043D1" }}>
                예산과 계획은 그대로 있어요
              </Text>
              <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: "#3C6FD8" }}>
                {restoreRemainingLabel(trip.canceled_at, new Date()) ?? "곧"} 안에 되돌리면 전부 살아나요
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="취소 되돌리기"
              onPress={() => openSheetAfterClose("restore")}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 active:opacity-80"
            >
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff" }}>되돌리기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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
                periodLabel={tripPeriodLabel}
                topSpentLabel={record.topSpentLabel}
                topSavedLabel={record.topSavedLabel}
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
              {/*
                스토리 이미지 티저. (2026-09-08)
                제목 줄의 작은 알약 버튼은 눈에 안 띄어 기능이 없는 것처럼 보였다.
                결과물을 작게 미리 보여주면 "이게 만들어진다" 가 먼저 보인다.
              */}
              <TripStoryTeaser
                card={storyCardBase}
                onPress={() => setStoryOpen(true)}
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
              destinationEn={destinationMeta?.nameEn ?? ""}
              periodLabel={tripPeriodLabel}
              topSpentLabel={record.topSpentLabel}
              topSavedLabel={record.topSavedLabel}
              onClose={() => setTypeOpen(false)}
              /*
                확정 결과만 이미지로 만든다. 오버레이(pageSheet)를 닫고 시트를 연다.
                모달 위에 모달을 쌓으면 닫는 순서가 꼬인다.
              */
              onSaveImage={
                shownType.provisional
                  ? undefined
                  : () => {
                      setTypeOpen(false);
                      setTypeStoryOpen(true);
                    }
              }
            />
          ) : null}

          {/* 여행 유형 공유 시트 */}
          {shownType && !shownType.provisional ? (
            <TypeStorySheet
              ref={typeStoryRef}
              visible={typeStoryOpen}
              onClose={() => setTypeStoryOpen(false)}
              busy={typeStoryBusy}
              onShare={handleShareTypeStory}
              card={{
                code: shownType.code,
                accuracyBp: shownType.accuracyBp,
                destinationEn: destinationMeta?.nameEn ?? "",
                periodLabel: tripPeriodLabel,
                topSpentLabel: record.topSpentLabel,
                topSavedLabel: record.topSavedLabel,
              }}
            />
          ) : null}

          {/* 여행 기록 스토리 이미지 시트 */}
          <TripStorySheet
            ref={storyRef}
            visible={storyOpen}
            onClose={() => setStoryOpen(false)}
            busy={storyBusy}
            onPickPhoto={handlePickStoryPhoto}
            onShare={handleShareStory}
            onChangeMembersText={setStoryMembersText}
            memberPresets={storyMemberPresets}
            card={storyCardBase}
          />
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

          {/*
            ── TODAY · 오늘 쓸 수 있는 돈 ── 여행 중에만
            태그는 "얼마 모였나", 이 카드는 "오늘 얼마 써도 되나". 수기 입력이
            바로 되돌아오는 자리라 태그 바로 아래에 둔다. (2026-09-09)
          */}
          {todayAllowance ? (
            <TodayAllowanceCard
              theme={theme}
              allowance={todayAllowance}
              totalDays={totalDays}
              onPressRecord={() => router.push(`/trips/${trip.id}/funds`)}
              /* 여행자금 화면이 ?scan=receipt 를 보고 바로 사진을 받는다 */
              onPressReceipt={() => router.push(`/trips/${trip.id}/funds?scan=receipt`)}
            />
          ) : null}

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
              /*
                ⚠️ placement 를 반드시 실어 보낸다. insurance_cta_clicked 는
                   이 값으로 "어느 자리의 배너가 전환을 만드는가" 를 가른다.
                   빠지면 BM 1 의 전환을 자리별로 못 나눈다. (docs/06 §7-7)
              */
              onPressInsurance={() =>
                router.push(`/trips/${trip.id}/insurance?placement=trip_home`)
              }
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
