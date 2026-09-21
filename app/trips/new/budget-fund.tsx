// ============================================================================
// TRIP-03 여행 생성: 예산·자금  ·  /trips/new/budget-fund
//
// 생성 흐름의 마지막 단계다. **여기서 처음으로 DB 에 쓴다.**
//   groups(신규 모임일 때) → trips → trip_members → trip_budgets
//   → budget_categories 8행 → fund_sources
//
// ⚠️ 2026-09-01 · 여행 스타일 선택이 TRIP-02 에서 여기로 옮겨왔다. (HTML 디자인 반영)
//    스타일을 바꾸면 아래 추천 금액이 바로 다시 계산된다. 같은 화면에서 보여야
//    무엇 때문에 금액이 움직였는지 알 수 있다.
//
//    ⚠️ 스타일은 **예산 방식보다 아래**, 추천을 고른 경우에만 묻는다.
//       총액을 이미 정해 온 사람에게 "아낄지 말지" 를 먼저 묻는 건 순서가 맞지 않는다.
//       직접 입력 경로에서도 스타일이 아주 무관하지는 않다. 입력한 총액을 카테고리로
//       나눌 때 추천 비율을 쓰고 그 비율이 스타일마다 다르다. 다만 그 배분은 아래
//       카테고리에서 직접 고칠 수 있어서, 묻지 않고 draft 값(기본 '보통')으로 나눈다.
//
// ⚠️ 2026-09-02 · 화면을 '추천 결과 먼저' 로 바꿨다. (HTML 시안 반영)
//    예산 방식을 먼저 고르게 하지 않는다. 들어오면 추천 총액이 이미 나와 있고,
//    직접 정하고 싶은 사람만 히어로의 액션으로 입력칸을 연다.
//
// ⚠️ 2026-09-03 · 예산 구성의 '수정' 버튼을 없앴다. 고치겠다는 의사표시를 한 번 더
//    받는 단계였는데, 여기까지 온 사람은 이미 예산을 보러 온 것이다. 들어오면
//    카테고리 목록이 곧바로 편집 가능한 상태로 놓여 있다. 다만 전부 펼치면
//    마지막 단계에서 스크롤이 지나치게 길어져서, **맨 위 한 줄(항공)만** 펼쳐 두고
//    나머지는 닫아 둔다. 그 한 줄이 "눌러서 고칠 수 있다" 를 대신 말해 준다.
//
// 단계
//   ① 추천 결과 (BudgetResultHero) — 직접 입력 전환도 여기서 한다
//      └ 추천 상태에서만 여행 스타일을 묻는다
//   ② 예산 구성 (BudgetCategoryList) — 처음부터 편집 가능. 맨 위 행만 펼쳐 둔다
//      └ 지난 여행 소비 패턴 카드로 전체 반영을 켜고 끈다
//   ③ 현재 준비한 여행자금 (선택)
//   ④ 저장 → 준비 홈으로 이동
//
// 이 파일은 데이터 조회 · 상태 관리 · 로그 기록만 한다. UI 는 components/trip-create/.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';

import {
  BottomCta,
  BudgetCategoryList,
  BudgetResultHero,
  FundSourceSelector,
  PastPatternCard,
  PastTripSheet,
  StepProgress,
  TravelStyleSelector,
  type EditableCategory,
  type PastTripRow,
} from '@/components/trip-create';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { ErrorState } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { buildPastAdjustments, bpToPercent, applyBp, type PastAdjustment } from '@/lib/budget/pastAdjustment';
import { CATEGORY_ORDER, perPerson } from '@/lib/budget/recommendation';
import {
  getDefaultProductIds,
} from '@/lib/constants/budgetProducts';
import {
  resolveProductCategory,
  sumResolvedRatio,
  type CategoryBase,
  type ProductOverrides,
} from '@/lib/budget/productLocalization';
import { buildBudgetRecommendation } from '@/lib/budget/recommendation';
import {
  APPLIED_SOURCE,
  BUDGET_METHOD,
  BUDGET_METHOD_TO_ANALYTICS,
  CATEGORY_CODE,
  CATEGORY_CODE_LABEL,
  CATEGORY_CODE_TO_ANALYTICS,
  COMPANION_TYPE,
  FUND_SOURCE_TYPE,
  TRANSACTION_SOURCE_TYPE,
  FUND_SOURCE_TYPE_TO_ANALYTICS,
  OWNER_TYPE_TO_ANALYTICS,
  TRAVEL_STYLE_LABEL,
  TRIP_OWNER_TYPE,
  type BudgetMethod,
  type CategoryCode,
  type FundSourceType,
  type TravelStyle,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { useTripDraft } from '@/lib/hooks/useTripDraft';
import { createGroup } from '@/lib/supabase/queries/groups';
import {
  createInitialFundDeposit,
  getGroupAccounts,
  type FinancialAccount,
} from '@/lib/supabase/queries/funds';
import {
  deviationBp,
  getSpendingProfile,
  type SpendingProfile,
} from '@/lib/supabase/queries/personalization';
import { createTripBundle, getMyTripCount } from '@/lib/supabase/queries/trips';
import { getLocalizedBudgetProducts } from '@/lib/supabase/queries/budgetProducts';

export default function ScreenTRIP03() {
  // 로그인한 사용자. 여행·모임의 소유자이자 첫 멤버가 된다.
  const userId = useCurrentUserId();
  useScreenView(SCREENS.TRIP_CREATE_BUDGET);

  const { draft, patchDraft, resetDraft } = useTripDraft();

  // ── 추천 계산 ─────────────────────────────────────────────────────────
  // 순수 계산이라 DB 를 타지 않는다. 앞 단계 입력이 다 있어야 성립한다.
  const recommendation = useMemo(() => {
    if (!draft.startDate || !draft.endDate || !draft.travelStyle || !draft.destinationName) {
      return null;
    }
    return buildBudgetRecommendation({
      destinationCode: draft.destinationCode,
      region: draft.region,
      destinationName: draft.destinationName,
      startDate: draft.startDate,
      endDate: draft.endDate,
      headcount: draft.headcount,
      travelStyle: draft.travelStyle,
    });
  }, [
    draft.destinationCode,
    draft.destinationName,
    draft.endDate,
    draft.headcount,
    draft.region,
    draft.startDate,
    draft.travelStyle,
  ]);

  // 과거 결산 집계를 불러온다. TRIP-01 에서 토글을 끄고 왔으면 부르지 않는다.
  useEffect(() => {
    if (draft.applyPastData === false || draft.pastTripCount === 0) {
      setPastProfile(null);
      setPastProfileTripCount(0);
      setPastLoading(false);
      return;
    }

    if (draft.companionType !== COMPANION_TYPE.EXISTING_GROUP && !userId) return;
    const scope =
      draft.companionType === COMPANION_TYPE.EXISTING_GROUP && draft.groupId
        ? ({ ownerType: 'GROUP', groupId: draft.groupId } as const)
        : ({ ownerType: 'PERSONAL', userId: userId as string } as const);

    getSpendingProfile(scope)
      .then((profile) => {
        setPastProfile(profile);
        setPastProfileTripCount(profile?.basedOnTripCount ?? 0);
      })
      .catch(() => {
        // 과거 데이터 조회 실패로 여행 생성을 막지 않는다. 기본 추천으로 간다.
        setPastProfile(null);
        setPastProfileTripCount(0);
      })
      .finally(() => setPastLoading(false));
  }, [draft.applyPastData, draft.companionType, draft.groupId, draft.pastTripCount, userId]);

  // ── ① 예산 방식 ───────────────────────────────────────────────────────
  //
  // ⚠️ 추천이 기본값이다. 고르는 화면이 아니라 결과를 보여주는 화면이 됐다.
  const [method, setMethod] = useState<BudgetMethod>(BUDGET_METHOD.RECOMMENDED);
  /** 사용자가 '이 금액으로 적용' 으로 확정한 총액 */
  const [userTotal, setUserTotal] = useState<number | null>(null);
  /**
   * 입력 중인 총액.
   *
   * ⚠️ 입력 중에는 총액도 카테고리도 바꾸지 않는다. 한 글자 지울 때마다 아래
   *    예산 구성이 통째로 다시 계산되면 무엇을 고치는 중인지 알 수 없다.
   *    '이 금액으로 적용' 을 눌렀을 때만 userTotal 로 옮긴다.
   */
  const [userTotalDraft, setUserTotalDraft] = useState<number | null>(null);
  /**
   * 총액 입력칸을 열어 둔 상태인가.
   *
   * ⚠️ 값으로 유추하지 않는다. 적용 직후에는 draft 와 적용값이 같아서,
   *    '금액 변경' 으로 다시 열어도 곧바로 닫힌 것으로 판정된다.
   *    여는 지점과 닫는 지점을 명시적으로 적는다.
   */
  const [totalEditing, setTotalEditing] = useState(false);
  const [categories, setCategories] = useState<EditableCategory[]>([]);
  /**
   * 지금 펼쳐 둔 카테고리. 맨 위 한 줄로 시작한다.
   *
   * 목록이 전부 닫힌 채로 시작하면 금액만 늘어서서 눌러 볼 곳이 있다는 걸 모른다.
   * 그렇다고 다 펼치면 생성 마지막 단계에서 스크롤이 지나치게 길어진다.
   * 순서 상수의 첫 항목이라 카테고리 순서가 바뀌어도 '맨 위' 가 유지된다.
   */
  const [editingCode, setEditingCode] = useState<CategoryCode | null>(CATEGORY_ORDER[0]);

  // ── 근거 상품 선택 ────────────────────────────────────────────────────
  //
  // 스타일의 기본 조합으로 시작한다. 이 조합의 합은 추천 금액과 정확히 같다.
  // (lib/constants/budgetProducts.ts 의 불변식)
  // 사용자가 상품을 빼거나 더하면 그때부터 planned_amount 가 추천과 갈라진다.
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() =>
    getDefaultProductIds(draft.travelStyle ?? 'standard'),
  );

  // 예비비는 상품이 아니라 비율로 정한다. null 이면 기준 금액(추천) 그대로다.
  const [contingencyChoice, setContingencyChoice] = useState<number | null>(null);

  /**
   * 금액을 직접 정하는 중인 카테고리.
   *
   * AI 추천과 직접 입력은 둘 중 하나다. 직접 입력으로 가면 상품 선택도 지난 여행
   * 반영도 그 카테고리 금액에 관여하지 않는다.
   *
   * ⚠️ 상품 선택 자체는 지우지 않는다. 잠깐 다른 길을 봤을 뿐인데 골라둔 것을
   *    날릴 이유가 없다. '추천으로 돌아가기' 를 누르면 그대로 살아난다.
   */
  const [manualCategories, setManualCategories] = useState<Set<CategoryCode>>(new Set());

  // ── 지난 여행 반영 ────────────────────────────────────────────────────
  //
  // TRIP-01 에서 토글을 켠 채로 넘어왔고 과거 결산이 있으면 편차를 얹는다.
  // getSpendingProfile 은 tripId 가 필요 없어서 여행을 만들기 전에도 부를 수 있다.
  const [pastProfile, setPastProfile] = useState<SpendingProfile | null>(null);
  const [pastProfileTripCount, setPastProfileTripCount] = useState(0);
  /*
    ⚠️ 조회가 끝나기 전에는 추천 금액을 보여주지 않는다.
       추천이 기본값이 되면서 사용자는 들어오자마자 큰 숫자를 본다. 그 숫자가
       과거 집계가 도착한 뒤 조용히 달라지면 안 된다. 로딩 자리를 대신 보여준다.
  */
  const [pastLoading, setPastLoading] = useState(
    draft.applyPastData === true && draft.pastTripCount > 0,
  );

  // 사용자가 개별로 뺀 카테고리. '빼기' 를 누른 것만 들어간다.
  const [droppedCategories, setDroppedCategories] = useState<Set<CategoryCode>>(new Set());

  // ── 근거 상품 여행지 맞춤 ─────────────────────────────────────────────
  //
  // 카탈로그의 '4성급 호텔' 을 '파리 시내 3성 호텔' 로, 금액까지 함께 받아온다.
  // 응답이 없으면 빈 Map 이고, 그러면 화면은 카탈로그 그대로 돈다.
  // (lib/budget/productLocalization.ts)
  const [aiProducts, setAiProducts] = useState<ProductOverrides>(() => new Map());
  /*
    ⚠️ pastLoading 과 같은 이유로 로딩 중에는 금액을 보여주지 않는다.
       AI 응답이 도착하면 상품 이름도 금액도 바뀐다. 사용자가 이미 큰 숫자를
       본 뒤에 그게 조용히 달라지면, 무엇이 진짜 추천인지 알 수 없다.
  */
  const [aiLoading, setAiLoading] = useState(false);

  /**
   * 카테고리별 기준 금액. 가드레일의 분모이자 AI 에게 주는 자릿수 기준점이다.
   * 예비비는 상품이 없어 요청에서 알아서 빠진다.
   */
  const productBases = useMemo<CategoryBase[]>(
    () =>
      (recommendation?.categories ?? []).map((c) => ({
        categoryCode: c.categoryCode,
        baseAmount: c.baseAmount,
        formula: c.formula,
      })),
    [recommendation],
  );

  useEffect(() => {
    if (!recommendation || !draft.destinationName || !draft.travelStyle) {
      setAiProducts(new Map());
      setAiLoading(false);
      return;
    }

    // ⚠️ 늦게 도착한 응답이 새 조건의 결과를 덮지 않게 한다. 스타일을 바꾸면
    //    이 효과가 다시 도는데, 먼저 건 요청이 나중에 올 수 있다.
    let alive = true;
    setAiLoading(true);

    getLocalizedBudgetProducts(
      {
        destination: draft.destinationName,
        // 목록에서 고른 목적지면 그 코드, 직접 입력이면 지역이 캐시 열쇠다.
        destinationKey: draft.destinationCode ?? `region:${draft.region ?? 'asia'}`,
        days: recommendation.days,
        nights: recommendation.nights,
        headcount: draft.headcount,
        travelStyle: draft.travelStyle,
      },
      productBases,
    )
      .then((result) => {
        if (!alive) return;
        setAiProducts(result.overrides);
      })
      .catch(() => {
        // 실패로 여행 생성을 막지 않는다. 카탈로그로 간다.
        if (!alive) return;
        setAiProducts(new Map());
      })
      .finally(() => {
        if (alive) setAiLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    draft.destinationCode,
    draft.destinationName,
    draft.headcount,
    draft.region,
    draft.travelStyle,
    productBases,
    recommendation,
  ]);

  /**
   * 추천 결과를 편집 가능한 형태로 옮긴다.
   *
   * ⚠️ AI 가 상품 금액을 다시 매겼으면 **추천 원본도 그 조합으로 다시 낸다.**
   *    buildBudgetRecommendation 의 값은 카탈로그 배수로 계산된 것이라,
   *    그대로 두면 화면에 '추천 158만원' 이라고 적혀 있는데 아래 상품 카드
   *    합계는 172만원인 상태가 된다. 두 숫자가 서로 다른 말을 한다.
   *
   *    이렇게 해도 recommended_amount 규칙은 그대로다. 이 값은 사용자가
   *    금액을 보기 전에 정해지고, 저장된 뒤에는 바뀌지 않는다. (CLAUDE.md 4장)
   *    사용자가 화면에서 본 추천이 곧 저장되는 추천 원본이다.
   */
  const toEditable = useCallback(
    (
      source: NonNullable<typeof recommendation>,
      overrides: ProductOverrides,
    ): EditableCategory[] => {
      const defaults = getDefaultProductIds(source.basis.style);

      return source.categories.map((c) => {
        // 상품이 없는 카테고리(예비비)와 AI 응답이 없을 때는 원래 값 그대로다.
        const ratio =
          overrides.size > 0 ? sumResolvedRatio(c.categoryCode, defaults, overrides) : 0;
        const recommendedAmount =
          ratio > 0 ? Math.round((c.baseAmount * ratio) / 1000) * 1000 : c.recommendedAmount;

        return {
          categoryCode: c.categoryCode,
          recommendedAmount,
          plannedAmount: recommendedAmount,
          basis: c.basis,
          formula: c.formula,
          baseAmount: c.baseAmount,
          multiplier: c.multiplier,
        };
      });
    },
    [],
  );

  /**
   * 직접 입력 총액을 카테고리에 비례 배분한다.
   *
   * 사용자는 총액만 안다. 카테고리별로 나눠 넣으라고 하면 그 자체가 일이다.
   * 추천 비율을 유지해 배분하고, 그 뒤 사용자가 카테고리를 고치게 한다.
   * 반올림 잔액은 가장 큰 카테고리에 몰아 총액을 정확히 맞춘다.
   */
  const applyUserTotal = useCallback(
    (total: number) => {
      if (!recommendation || recommendation.totalAmount === 0) return;

      /*
        ⚠️ recommendation.categories 를 직접 쓰지 않는다. AI 가 상품 금액을
           다시 매겼으면 추천 원본도 달라져 있다. 옛 비율로 나누면 배분 결과가
           화면의 추천 금액과 어긋난다.
      */
      const base = toEditable(recommendation, aiProducts);
      const baseTotal = base.reduce((sum, c) => sum + c.recommendedAmount, 0);
      if (baseTotal === 0) return;

      const ratio = total / baseTotal;
      const next = base.map((c) => ({
        ...c,
        plannedAmount: Math.round((c.recommendedAmount * ratio) / 1000) * 1000,
      }));

      const drift = total - next.reduce((sum, c) => sum + c.plannedAmount, 0);
      if (drift !== 0) {
        const biggest = next.reduce((a, b) => (b.plannedAmount > a.plannedAmount ? b : a));
        biggest.plannedAmount = Math.max(0, biggest.plannedAmount + drift);
      }

      setCategories(next);
    },
    [aiProducts, recommendation, toEditable],
  );

  /**
   * 추천 ↔ 직접 입력 전환. 히어로의 한 줄 액션이 이걸 부른다.
   *
   * 직접 입력으로 갈 때는 지금 보고 있는 총액을 그대로 출발점으로 둔다.
   * 0 에서 시작하게 하면 방금 본 숫자가 사라져 무엇을 고치는지 알 수 없다.
   * 추천으로 돌아올 때는 스타일 기본 조합으로 다시 계산한다.
   *
   * ⚠️ 전환할 때마다 BUDGET_METHOD_SELECTED 를 쏜다. 진입 시 1회(recommended)와
   *    합쳐 **흐름당 마지막 이벤트가 최종 방식**이 된다. 아래 진입 로그 주석 참조.
   */
  const handleToggleMethod = useCallback(() => {
    if (!recommendation) return;
    const next =
      method === BUDGET_METHOD.USER_DEFINED
        ? BUDGET_METHOD.RECOMMENDED
        : BUDGET_METHOD.USER_DEFINED;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMethod(next);
    // 펼침 상태도 처음 들어왔을 때로 되돌린다. 맨 위 한 줄만 열려 있다.
    setEditingCode(CATEGORY_ORDER[0]);
    setSelectedProductIds(getDefaultProductIds(recommendation.basis.style));
    setContingencyChoice(null);
    setManualCategories(new Set());

    if (next === BUDGET_METHOD.USER_DEFINED) {
      // 지금 화면의 총액을 그대로 이어받는다. 입력칸도 그 값으로 채워 둔다.
      // 총액을 직접 정하겠다고 막 말한 참이므로 입력칸을 열어 둔다.
      const current = categories.reduce((sum, c) => sum + c.plannedAmount, 0);
      setUserTotal(current);
      setUserTotalDraft(current);
      setTotalEditing(true);
      applyUserTotal(current);
    } else {
      const back = toEditable(recommendation, aiProducts);
      setUserTotal(back.reduce((sum, c) => sum + c.recommendedAmount, 0));
      setUserTotalDraft(null);
      setTotalEditing(false);
      setCategories(back);
    }

    track(EVENTS.BUDGET_METHOD_SELECTED, {
      method: BUDGET_METHOD_TO_ANALYTICS[next],
    });
  }, [aiProducts, applyUserTotal, categories, method, recommendation, toEditable]);

  /**
   * '이 금액으로 적용'. **여기서만** 입력값이 예산에 반영된다.
   *
   * 직접 고쳐둔 카테고리 금액은 이 시점에 함께 정리한다. 총액을 새로 정한
   * 이상 옛 총액에 맞춰 고쳐둔 금액만 남겨 두면 합이 맞지 않는다.
   */
  const handleApplyUserTotal = useCallback(() => {
    if (userTotalDraft === null || userTotalDraft <= 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUserTotal(userTotalDraft);
    setManualCategories(new Set());
    // 적용된 금액은 위 큰 글씨가 말한다. 입력칸은 할 일을 마쳤으므로 물러난다.
    setTotalEditing(false);
    applyUserTotal(userTotalDraft);
  }, [applyUserTotal, userTotalDraft]);

  /** '금액 변경' — 닫아 둔 총액 입력칸을 다시 연다. 값은 적용된 금액 그대로다. */
  const handleStartEditAmount = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTotalEditing(true);
  }, []);

  /**
   * 앞 단계 조건이 바뀌면 카테고리를 새 추천으로 다시 깐다.
   *
   * 상단의 '홍콩 · 3박 4일 · 4명' 을 눌러 일정이나 스타일을 고치고 돌아오면
   * recommendation 은 다시 계산되지만 categories 는 예전 그대로다. 그대로 두면
   * '아낌없이' 로 바꿨는데 화면에는 '보통' 금액이 남고, 근거(계산식·배수)와
   * 금액이 서로 다른 말을 하게 된다.
   *
   * ⚠️ ref 초깃값이 null 이라 **첫 렌더에서도 한 번 돈다.** 추천이 기본값이
   *    되면서 카테고리를 깔아 줄 사람이 사라졌기 때문이다. 예전에는 예산 방식을
   *    고르는 순간 handleSelectMethod 가 깔았다.
   */
  /*
    ⚠️ 추천뿐 아니라 **AI 상품 응답이 도착했을 때도** 다시 깔아야 한다.
       응답은 추천이 만들어진 뒤에 온다. recommendation 만 보고 있으면
       상품 카드 이름은 '파리 시내 3성 호텔' 로 바뀌었는데 카테고리 금액은
       카탈로그 배수로 계산된 옛 숫자가 그대로 남는다.
  */
  const syncedRef = useRef<unknown>(null);
  useEffect(() => {
    const key = { recommendation, aiProducts };
    const previous = syncedRef.current as typeof key | null;
    if (
      previous &&
      previous.recommendation === recommendation &&
      previous.aiProducts === aiProducts
    ) {
      return;
    }
    syncedRef.current = key;
    if (!recommendation) return;

    const next = toEditable(recommendation, aiProducts);
    setCategories(next);
    setEditingCode(CATEGORY_ORDER[0]);

    // 상품 선택과 예비비 비율도 함께 되돌린다.
    // 스타일을 '보통' → '아낌없이' 로 바꿨는데 상품이 보통 조합 그대로면,
    // 금액은 새 추천인데 아래 카드에는 옛 조합이 체크돼 있어 서로 다른 말을 한다.
    setSelectedProductIds(getDefaultProductIds(recommendation.basis.style));
    setContingencyChoice(null);
    setManualCategories(new Set());

    if (method === BUDGET_METHOD.USER_DEFINED && userTotal !== null) {
      // 사용자가 정한 총액은 조건이 바뀌어도 그대로다. 새 추천 비율로 다시 나눈다.
      applyUserTotal(userTotal);
    } else {
      // ⚠️ recommendation.totalAmount 가 아니라 방금 깐 카테고리의 합이다.
      //    AI 가 상품 금액을 다시 매겼으면 둘이 다르다.
      setUserTotal(next.reduce((sum, c) => sum + c.recommendedAmount, 0));
    }
  }, [aiProducts, applyUserTotal, method, recommendation, toEditable, userTotal]);

  const handleChangeCategoryAmount = useCallback((categoryCode: CategoryCode, amount: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.categoryCode === categoryCode ? { ...c, plannedAmount: amount } : c)),
    );
  }, []);

  /**
   * 카테고리별 지난 여행 편차. 프로필이 없거나 토글을 껐으면 빈 배열이다.
   * 계산 규칙은 lib/budget/pastAdjustment.ts 가 갖는다.
   */
  const pastAdjustments = useMemo<PastAdjustment[]>(() => {
    if (!recommendation || !pastProfile || draft.applyPastData === false) return [];
    // ⚠️ 추천 경로에서만 얹는다.
    //    "정해둔 예산이 있어요" 는 사용자가 총액을 이미 정했다는 뜻이다. 그 위에
    //    과거 편차를 얹으면 넣은 숫자가 이유 없이 달라지고, 총액 배분도 덮인다.
    if (method !== BUDGET_METHOD.RECOMMENDED) return [];
    return buildPastAdjustments(
      recommendation.categories.map((c) => ({
        categoryCode: c.categoryCode,
        recommendedAmount: c.recommendedAmount,
      })),
      pastProfile,
    );
  }, [draft.applyPastData, method, pastProfile, recommendation]);

  const adjustmentByCode = useMemo(
    () => new Map(pastAdjustments.map((a) => [a.categoryCode, a])),
    [pastAdjustments],
  );

  /**
   * 한 카테고리의 금액을 다시 계산한다.
   *
   *   선택 상품 합계 → 지난 여행 편차 적용 → 최종 금액
   *
   * 편차는 상품 합계에 얹는다. 사용자가 상품을 바꾸지 않았다면 상품 합계는
   * 추천 원본과 같으므로(budgetProducts.ts 의 불변식) 결과도
   * personalizedAmount 와 일치한다. 상품을 바꿨다면 바꾼 기준 위에 얹는 게 맞다.
   */
  const computeAmount = useCallback(
    (
      category: EditableCategory,
      ids: Set<string>,
      dropped: Set<CategoryCode>,
      adjustments: Map<CategoryCode, PastAdjustment>,
    ): number => {
      const adjustment = adjustments.get(category.categoryCode);
      const catalog = resolveProductCategory(category.categoryCode, aiProducts);

      // 예비비는 상품이 없다. 기준 금액에 바로 편차를 얹는다.
      //
      // 사용자가 비율을 직접 골랐으면(contingencyChoice !== null) 그게 사용자 의도이므로
      // 그 위에 편차를 또 얹지 않는다. 고른 값을 그대로 둔다.
      if (!catalog) {
        if (contingencyChoice !== null) return category.plannedAmount;
        if (!adjustment || dropped.has(category.categoryCode)) return category.recommendedAmount;
        return applyBp(category.recommendedAmount, adjustment.appliedBp);
      }

      const fromProducts =
        Math.round(
          (category.baseAmount * sumResolvedRatio(category.categoryCode, ids, aiProducts)) / 1000,
        ) * 1000;

      if (!adjustment || dropped.has(category.categoryCode)) return fromProducts;
      return applyBp(fromProducts, adjustment.appliedBp);
    },
    [aiProducts, contingencyChoice],
  );

  /**
   * 반영 대상이 바뀌면 금액을 다시 깐다.
   * 과거 프로필을 늦게 받아오거나 사용자가 개별로 빼면 여기서 반영된다.
   */
  const adjustSyncRef = useRef('');
  useEffect(() => {
    /*
      ⚠️ 직접 입력 경로에서는 돌지 않는다. 여기서 상품 기준으로 다시 계산하면
         '이 금액으로 적용' 으로 나눈 배분이 통째로 덮인다. 그 경로의 상품·예비비
         변경은 각 핸들러가 해당 카테고리만 직접 고친다.
    */
    if (method === BUDGET_METHOD.USER_DEFINED) {
      // ⚠️ 기억해 둔 키를 비운다. 비우지 않으면 추천으로 돌아왔을 때 키가 예전과
      //    같아서 이 효과가 그냥 넘어가고, 지난 여행 반영이 다시 얹히지 않는다.
      //    (히어로에는 '지난 여행 반영' 배지가 뜨는데 금액은 기본 추천인 상태)
      adjustSyncRef.current = '';
      return;
    }
    const key = `${method}|${pastAdjustments.map((a) => `${a.categoryCode}:${a.appliedBp}`).join(',')}|${[...droppedCategories].sort().join(',')}|${contingencyChoice}`;
    if (adjustSyncRef.current === key) return;
    adjustSyncRef.current = key;

    setCategories((cats) =>
      cats.map((c) =>
        // 직접 정한 금액은 덮어쓰지 않는다. 사용자가 쓴 숫자가 최종이다.
        manualCategories.has(c.categoryCode)
          ? c
          : {
              ...c,
              plannedAmount: computeAmount(
                c,
                selectedProductIds,
                droppedCategories,
                adjustmentByCode,
              ),
            },
      ),
    );
  }, [
    adjustmentByCode,
    computeAmount,
    contingencyChoice,
    droppedCategories,
    manualCategories,
    method,
    pastAdjustments,
    selectedProductIds,
  ]);

  /**
   * 예산 방식 노출. 흐름당 1회다.
   *
   * ⚠️ 2026-09-02 · 예산 방식 선택 카드가 사라지고 **추천이 기본값**이 되면서,
   *    누르는 시점에만 기록하면 그냥 추천을 받아들인 사람이 통째로 빠진다.
   *    분모가 '방식을 바꿔 본 사람' 으로 좁아져 가설 1 을 잴 수 없다.
   *
   *    docs/06 §7 이 `past_data_apply_selected` 에서 똑같은 문제(기본 ON 토글)를
   *    "선택이 아니라 최종값으로 1회" 로 풀었다. 여기도 같은 규칙을 따른다.
   *      진입 시 1회(recommended) + 전환할 때마다 1회
   *      → 분석은 **흐름당 마지막 이벤트**를 본다.
   *
   *    ⚠️ 지난 여행 조회가 끝나 추천 금액을 실제로 보여준 뒤에 쏜다. 로딩 중에
   *       쏘면 아무 금액도 못 본 사람이 '추천을 받았다' 로 잡힌다.
   *
   *    ⚠️ 이벤트도 파라미터도 새로 만들지 않았다. 기록 시점만 옮겼다.
   *       정의서 갱신은 L 에게 요청해 뒀다. (.handoff/L-전달사항.md)
   */
  const methodLoggedRef = useRef(false);
  useEffect(() => {
    if (methodLoggedRef.current) return;
    if (!recommendation || pastLoading || aiLoading) return;
    methodLoggedRef.current = true;

    track(EVENTS.BUDGET_METHOD_SELECTED, {
      method: BUDGET_METHOD_TO_ANALYTICS[method],
    });
    // method 는 진입 시점 값(기본 recommended)만 필요하다. 이후 변경은
    // handleToggleMethod 가 따로 쏜다. 여기서 다시 돌면 중복이라 deps 에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiLoading, pastLoading, recommendation]);

  /**
   * 개인화 제안 노출. 흐름당 1회다.
   *
   * 카테고리를 펼칠 때마다 쏘면 노출 모수가 사람 수가 아니라 조회 횟수가 된다.
   * 대표 항목은 금액 영향이 가장 큰 것이다. (pastAdjustments 가 그 순서로 정렬돼 있다)
   */
  const offeredRef = useRef(false);
  useEffect(() => {
    if (offeredRef.current || pastAdjustments.length === 0) return;
    offeredRef.current = true;

    const top = pastAdjustments[0];
    // 여행이 아직 없어 trip_id 를 실을 수 없다. source 로 구분한다. (develop 과 동일)
    track(EVENTS.PERSONALIZATION_OFFERED, {
      source: 'trip_create',
      based_on_trip_count: pastProfileTripCount,
      top_category: CATEGORY_CODE_TO_ANALYTICS[top.categoryCode],
      deviation_rate: top.rawBp,
    });
  }, [pastAdjustments, pastProfileTripCount]);

  /**
   * 여행 스타일 변경.
   *
   * 같은 값을 다시 눌러도 쏘지 않는다. 세그먼트는 눌린 것을 또 누를 수 있어서
   * 그대로 두면 '바꾼 횟수' 가 '누른 횟수' 가 된다.
   */
  const handleChangeTravelStyle = useCallback(
    (next: TravelStyle) => {
      const from = draft.travelStyle;
      if (from === next) return;

      patchDraft({ travelStyle: next });
      track(EVENTS.TRAVEL_STYLE_CHANGED, { from_style: from, to_style: next });
    },
    [draft.travelStyle, patchDraft],
  );

  const [pastSheetOpen, setPastSheetOpen] = useState(false);

  /**
   * 시트에 보여줄 항목별 예상·실제.
   *
   * pastAdjustments 는 편차가 작은 항목을 아예 버린다. 시트는 그것까지 보여줘야
   * 한다. 표에 없는 항목이 있으면 사용자는 집계가 빠졌다고 본다.
   * 그래서 pastProfile(집계 원본)을 기준으로 만들고, 반영 여부만 표시한다.
   */
  const pastTripRows = useMemo<PastTripRow[]>(() => {
    if (!pastProfile) return [];

    return CATEGORY_ORDER.flatMap((categoryCode) => {
      const past = pastProfile.categories.find((c) => c.category_code === categoryCode);
      if (!past || past.planned_amount <= 0) return [];

      const adjustment = adjustmentByCode.get(categoryCode);
      const rawBp = deviationBp(past.planned_amount, past.actual_amount);

      return [
        {
          categoryCode,
          plannedAmount: past.planned_amount,
          actualAmount: past.actual_amount,
          diffPercent: (rawBp >= 0 ? 1 : -1) * bpToPercent(rawBp),
          clamped: adjustment?.clamped ?? false,
          // 편차가 작아 반영 대상에서 빠진 항목
          ignored: !adjustment,
        },
      ];
    });
  }, [adjustmentByCode, pastProfile]);

  /** 하나라도 반영 중인가. 전부 빼면 꺼진 상태다. */
  const pastOn = useMemo(
    () => pastAdjustments.some((a) => !droppedCategories.has(a.categoryCode)),
    [droppedCategories, pastAdjustments],
  );

  /**
   * 카드 문구에 쓸 '더 쓴 항목' · '덜 쓴 항목'.
   * 사용자가 뺀 카테고리는 빼고 센다. 안 그러면 껐는데도 반영됐다고 읽힌다.
   */
  const pastIncreasedLabels = useMemo(
    () =>
      pastAdjustments
        .filter((a) => a.appliedBp > 0 && !droppedCategories.has(a.categoryCode))
        .map((a) => CATEGORY_CODE_LABEL[a.categoryCode]),
    [droppedCategories, pastAdjustments],
  );

  const pastDecreasedLabels = useMemo(
    () =>
      pastAdjustments
        .filter((a) => a.appliedBp < 0 && !droppedCategories.has(a.categoryCode))
        .map((a) => CATEGORY_CODE_LABEL[a.categoryCode]),
    [droppedCategories, pastAdjustments],
  );

  /**
   * 지난 여행 반영을 전부 빼거나 전부 되돌린다.
   * 하나라도 반영 중이면 '모두 해제', 전부 빠져 있으면 '다시 반영' 이다.
   */
  const handleToggleAllPast = useCallback(() => {
    setDroppedCategories((prev) => {
      const allDropped = pastAdjustments.every((a) => prev.has(a.categoryCode));
      return allDropped ? new Set() : new Set(pastAdjustments.map((a) => a.categoryCode));
    });
  }, [pastAdjustments]);

  /**
   * 'AI 추천' 과 '직접 입력' 을 오간다.
   *
   * 직접 입력으로 들어갈 때는 지금 금액을 그대로 출발점으로 둔다. 0 에서 시작하게
   * 하면 방금 보던 숫자가 사라져 무엇을 고치는지 알 수 없다.
   * 돌아올 때는 살아 있는 상품 선택과 편차로 다시 계산한다.
   */
  const handleToggleManual = useCallback(
    (categoryCode: CategoryCode) => {
      setManualCategories((prev) => {
        const next = new Set(prev);
        const goingBackToRecommended = next.has(categoryCode);

        if (goingBackToRecommended) next.delete(categoryCode);
        else next.add(categoryCode);

        if (goingBackToRecommended) {
          setCategories((cats) =>
            cats.map((c) =>
              c.categoryCode === categoryCode
                ? {
                    ...c,
                    plannedAmount: computeAmount(
                      c,
                      selectedProductIds,
                      droppedCategories,
                      adjustmentByCode,
                    ),
                  }
                : c,
            ),
          );
        }

        return next;
      });
    },
    [adjustmentByCode, computeAmount, droppedCategories, selectedProductIds],
  );

  /** 카테고리 하나의 지난 여행 반영을 빼거나 되돌린다. */
  const handleToggleDrop = useCallback((categoryCode: CategoryCode) => {
    setDroppedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryCode)) next.delete(categoryCode);
      else next.add(categoryCode);
      return next;
    });
  }, []);

  /**
   * 상품을 켜고 끈다. 그 카테고리 금액을 새 조합으로 다시 계산한다.
   *
   * 상품별로 반올림한 뒤 더하지 않는다. baseAmount 에 ratio 합을 곱해 **한 번만**
   * 반올림한다. 상품마다 반올림하면 오차가 상품 수만큼 쌓여, 기본 조합인데도
   * 추천 금액과 어긋나게 된다. (budgetProducts.ts 의 불변식)
   */
  const handleToggleProduct = useCallback(
    (categoryCode: CategoryCode, productId: string) => {
      const catalog = resolveProductCategory(categoryCode, aiProducts);
      if (!catalog) return;

      // ⚠️ setState 업데이터 안에서 계산하지 않는다. 로그를 남겨야 하는데
      //    업데이터는 순수해야 하고, StrictMode 에서 두 번 불릴 수 있다.
      //    두 번 불리면 같은 클릭이 이벤트 두 건으로 잡힌다.
      const next = new Set(selectedProductIds);
      const wasSelected = next.has(productId);

      if (catalog.single) {
        // 왕복 항공권을 두 개 사지는 않는다. 같은 것을 다시 누르면 해제한다.
        for (const product of catalog.products) next.delete(product.id);
        if (!wasSelected) next.add(productId);
      } else {
        if (wasSelected) next.delete(productId);
        else next.add(productId);
      }

      const target = categories.find((c) => c.categoryCode === categoryCode);
      const fromAmount = target?.plannedAmount ?? 0;
      const toAmount = target
        ? computeAmount(target, next, droppedCategories, adjustmentByCode)
        : fromAmount;

      setSelectedProductIds(next);
      setCategories((cats) =>
        cats.map((c) =>
          c.categoryCode === categoryCode ? { ...c, plannedAmount: toAmount } : c,
        ),
      );

      // 근거를 보여줬을 때 사용자가 실제로 예산을 조정하는지. (docs/06 §7-1)
      track(EVENTS.BUDGET_PRODUCT_CHANGED, {
        category: CATEGORY_CODE_TO_ANALYTICS[categoryCode],
        product_id: productId,
        selected: !wasSelected,
        from_amount: fromAmount,
        to_amount: toAmount,
      });
    },
    [adjustmentByCode, aiProducts, categories, computeAmount, droppedCategories, selectedProductIds],
  );

  /**
   * 예비비 비율을 바꾼다. null 은 '추천'(기준 금액 그대로)이다.
   *
   * 기본값을 비율이 아니라 '추천' 으로 둔 이유: 기준 금액은 목적지마다
   * 나머지 합계의 5% 안팎이지 정확히 5% 가 아니다. 5% 를 기본으로 깔면
   * recommended_amount 와 다른 값이 처음부터 들어가 추천 원본의 의미가 흐려진다.
   * (CLAUDE.md 4장)
   */
  const handleChangeContingency = useCallback(
    (choice: number | null) => {
      setContingencyChoice(choice);
      setCategories((cats) => {
        const others = cats
          .filter((c) => c.categoryCode !== CATEGORY_CODE.CONTINGENCY)
          .reduce((sum, c) => sum + c.plannedAmount, 0);

        return cats.map((c) =>
          c.categoryCode === CATEGORY_CODE.CONTINGENCY
            ? {
                ...c,
                plannedAmount:
                  choice === null
                    ? c.recommendedAmount
                    : Math.round((others * choice) / 100 / 1000) * 1000,
              }
            : c,
        );
      });
    },
    [],
  );

  /** 예비비 비율 계산의 분모이자 화면 표시값. */
  const otherCategoriesTotal = useMemo(
    () =>
      categories
        .filter((c) => c.categoryCode !== CATEGORY_CODE.CONTINGENCY)
        .reduce((sum, c) => sum + c.plannedAmount, 0),
    [categories],
  );

  /** 화면에 넘길 카테고리. 근거 상품을 붙여서 준다. */
  const categoriesWithProducts = useMemo<EditableCategory[]>(
    () =>
      categories.map((category) => {
        const adjustment = adjustmentByCode.get(category.categoryCode);
        const dropped = droppedCategories.has(category.categoryCode);
        const catalog = resolveProductCategory(category.categoryCode, aiProducts);

        // 편차를 얹기 전 금액. 화면의 '선택한 상품 합계' 와 같은 값이다.
        // 예비비는 상품이 없으므로 기준 금액이 곧 추천 금액이다.
        const adjustmentBase = catalog
          ? Math.round(
              (category.baseAmount *
                sumResolvedRatio(category.categoryCode, selectedProductIds, aiProducts)) /
                1000,
            ) * 1000
          : category.recommendedAmount;

        /*
          ⚠️ 반영액은 **화면에 보이는 기준(adjustmentBase)** 에 대해 계산한다.
             personalizedAmount − recommendedAmount 로 두면 상품을 바꾼 순간
             계산부의 줄들이 서로 더해지지 않는다.
               선택한 상품 합계 132,000 + 반영 48,000 ≠ 숙소 예산 158,000

             DB 에 저장하는 personalized_amount 는 계속 recommended_amount 기준이다.
             그건 "개인화 추천이 얼마였나" 를 재는 값이라 사용자 수정과 무관해야 한다.
             (CLAUDE.md 4장) 화면에 보여주는 값과 저장하는 값의 기준이 다르다.
        */
        const adjustmentFields = adjustment
          ? {
              adjustmentPercent:
                (adjustment.appliedBp > 0 ? 1 : -1) * bpToPercent(adjustment.appliedBp),
              adjustmentAmount: applyBp(adjustmentBase, adjustment.appliedBp) - adjustmentBase,
              adjustmentDropped: dropped,
              // 뺐으면 비교 기준은 다시 기본 추천이다
              personalizedAmount: dropped ? null : adjustment.personalizedAmount,
            }
          : {};

        if (!catalog) {
          return {
            ...category,
            ...adjustmentFields,
            isManual: manualCategories.has(category.categoryCode),
          };
        }

        return {
          ...category,
          ...adjustmentFields,
          productHint: catalog.hint,
          singleSelect: catalog.single,
          isManual: manualCategories.has(category.categoryCode),
          // 지난 여행 반영을 얹기 전, 고른 상품만의 합계다.
          productSubtotal: adjustmentBase,
          /*
            ⚠️ 화면 단위가 아니라 **카테고리 단위**로 판정한다.
               쿼터나 시간 초과로 일부 카테고리만 오는 일이 흔한데,
               화면 단위로 켜면 카탈로그 이름이 그대로인 교통 카드에도
               '이 여행지에 맞춰 만들었다' 가 붙는다. 거짓말이 된다.
          */
          productsFromAi: catalog.products.some((product) => aiProducts.has(product.id)),
          products: catalog.products.map((product) => ({
            id: product.id,
            name: product.name,
            emoji: product.emoji,
            note: aiProducts.get(product.id)?.note || undefined,
            amount: Math.round((category.baseAmount * product.ratio) / 1000) * 1000,
            selected: selectedProductIds.has(product.id),
          })),
        };
      }),
    [
      adjustmentByCode,
      aiProducts,
      categories,
      droppedCategories,
      manualCategories,
      selectedProductIds,
    ],
  );

  const targetTotal = useMemo(
    () => categories.reduce((sum, c) => sum + c.plannedAmount, 0),
    [categories],
  );
  const editedCount = useMemo(
    () => categories.filter((c) => c.plannedAmount !== c.recommendedAmount).length,
    [categories],
  );

  // ── ④ 여행자금 ────────────────────────────────────────────────────────
  // ⚠️ 여행자금은 선택사항이다. 이것 때문에 CTA 가 막히지 않는다.
  //
  // ⚠️ 2026-09-03 · 연결된 계좌가 있으면 그 계좌를 **자동으로 고른다.**
  //    붙여 둔 모임통장이 있는데 여행자금을 0원이라고 우기는 것보다 정확하다.
  //
  //    ⚠️ 이건 화면 정리가 아니라 **기본 동작 변경**이다. 이 섹션을 지나친
  //       사용자도 fund_sources 에 mock + 계좌 잔액으로 저장되고, 준비율이
  //       0% 가 아닌 값으로 시작한다. trip_created 의 fund_type 분포도 바뀐다 —
  //       'zero' 가 "사용자가 0원을 골랐다" 에서 "고를 계좌가 없었다" 로,
  //       'mock' 이 "사용자가 계좌를 골랐다" 에서 "계좌가 있었다" 로 옮겨간다.
  //       (.handoff/L-전달사항.md 에 기록)
  //
  //    계좌가 로딩되기 전까지는 0원이다. 계좌 조회가 실패해도 0원으로 남는다.
  const [fundType, setFundType] = useState<FundSourceType>(FUND_SOURCE_TYPE.ZERO);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState<number | null>(null);

  // 계좌는 모임 자산이다. 개인 여행과 신규 모임에는 붙을 계좌가 없다.
  useEffect(() => {
    if (draft.companionType !== COMPANION_TYPE.EXISTING_GROUP || !draft.groupId) return;
    setAccountsLoading(true);
    getGroupAccounts(draft.groupId)
      .then((rows) => {
        setAccounts(rows);
        // 계좌가 있으면 첫 계좌를 골라 둔다. 조회 직후 한 번만 한다 —
        // 사용자가 '0원으로 시작' 을 고른 뒤 덮어쓰면 고른 것이 사라진다.
        if (rows.length > 0) {
          setAccountId(rows[0].id);
          setFundType(FUND_SOURCE_TYPE.MOCK);
        }
      })
      .catch(() => setAccounts([])) // 계좌 조회 실패로 여행 생성을 막지 않는다
      .finally(() => setAccountsLoading(false));
  }, [draft.companionType, draft.groupId]);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  /**
   * 여행자금 소스를 고른다. 셋 중 하나만 켜진다. (CLAUDE.md 3장 · 단일 소스)
   *
   * ⚠️ 여기서 신규 계좌 연결을 열지 않는다. 이미 연결된 모임통장만 후보다.
   *    새 연결은 여행을 만든 뒤 여행 홈에서 한다.
   */
  const handleChangeFundType = useCallback(
    (next: FundSourceType) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFundType(next);
      // 계좌를 골랐는데 어느 계좌인지 없으면 첫 계좌로 채운다.
      if (next === FUND_SOURCE_TYPE.MOCK && accountId === null && accounts.length > 0) {
        setAccountId(accounts[0].id);
      }
    },
    [accountId, accounts],
  );

  /** 여러 계좌 중 하나를 고른다. 소스는 이미 '연결된 계좌' 다. */
  const handleSelectAccount = useCallback((id: string) => {
    setAccountId(id);
  }, []);

  // ── ⑤ 저장 ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedRef = useRef(false);

  /**
   * 예산 블록(히어로 · 예산 구성)을 열지.
   *
   * 과거 집계를 기다리는 동안에는 열지 않는다. 금액이 조용히 달라지면 안 된다.
   */
  const showBudgetDetail = !pastLoading && !aiLoading && categories.length > 0;

  /*
    ⚠️ 여행자금 때문에 CTA 를 막지 않는다.
       여행자금은 선택사항이고 기본값이 0원이라 언제나 유효하다.
       유효한 예산만 있으면 여행을 만들 수 있다.
  */
  const canSubmit = Boolean(recommendation) && showBudgetDetail && targetTotal > 0;

  const handleSubmit = useCallback(async () => {
    if (!recommendation || !draft.travelStyle) return;
    // 로그인 없이 여기까지 올 수 없지만, 세션이 끊긴 채 저장되면 소유자가 비어 버린다.
    if (!userId) {
      setSaveError('로그인 정보가 없어요. 다시 로그인한 뒤 시도해 주세요.');
      return;
    }
    // 중복 제출 방지. 두 번 눌러 여행이 두 개 생기면 되돌릴 방법이 없다. (NFR-005)
    if (saving || savedRef.current) return;

    setSaving(true);
    setSaveError(null);

    const currentAmount =
      fundType === FUND_SOURCE_TYPE.MOCK
        ? (selectedAccount?.current_balance ?? 0)
        : fundType === FUND_SOURCE_TYPE.MANUAL
          ? (manualAmount ?? 0)
          : 0;

    try {
      // 신규 모임은 여행보다 먼저 만든다. 여행 저장이 실패해도 모임은 남는다.
      // 사용자가 다시 시도할 때 그대로 쓴다.
      let groupId = draft.groupId;
      if (draft.companionType === COMPANION_TYPE.NEW_GROUP && !groupId) {
        const group = await createGroup({
          name: (draft.newGroupName ?? '').trim(),
          owner_user_id: userId,
        });
        groupId = group.id;
      }

      const isGroupTrip = draft.companionType !== COMPANION_TYPE.PERSONAL;
      const perPersonAmount = perPerson(targetTotal, draft.headcount);

      const trip = await createTripBundle({
        trip: {
          owner_type: isGroupTrip ? TRIP_OWNER_TYPE.GROUP : TRIP_OWNER_TYPE.PERSONAL,
          // trips_owner_shape CHECK — GROUP 이면 owner_user_id 를 비운다
          owner_user_id: isGroupTrip ? null : userId,
          /**
           * 여행장. 이 여행을 만든 사람이다.
           *
           * ⚠️ owner_user_id 와 **다른 칸이다.** 그쪽은 '개인 여행의 주인' 이라
           *    모임 여행이면 비어 있어야 하고, 여행장은 여행 종류와 무관하게 있다.
           *    이 값이 없으면 초대 수락·나가기 판정이 서지 않는다.
           *    (마이그레이션 20260910000001 · 2026-09-10 L 회신)
           */
          leader_user_id: userId,
          group_id: isGroupTrip ? groupId : null,
          destination: draft.destinationName,
          start_date: draft.startDate,
          end_date: draft.endDate,
          headcount: draft.headcount,
          travel_style_json: { style: draft.travelStyle },
        },
        /**
         * 만든 사람만 넣는다.
         *
         * ⚠️ 2026-09-15 · 예전에는 TRIP-01 에서 받은 동행자 이름을
         *    display_name 행으로 함께 넣었다. 그 행과 초대를 수락하고 들어온
         *    사람을 잇는 장치가 없어 같은 사람이 두 번 보였다.
         *    이제 멤버는 초대 수락으로만 늘어난다. (NewGroupForm 주석)
         */
        members: [{ user_id: userId }],
        budget: {
          method,
          target_amount: targetTotal,
          recommended_amount: recommendation.totalAmount,
          per_person_amount: perPersonAmount,
          recommendation_basis_json: recommendation.basis,
          confirmed_at: new Date().toISOString(),
        },
        categories: categories.map((c, index) => {
          const adjustment = adjustmentByCode.get(c.categoryCode);
          const dropped = droppedCategories.has(c.categoryCode);

          // ⚠️ 뺀 카테고리도 personalized_amount 는 남긴다.
          //    "개인화 추천이 얼마였는데 사용자가 안 썼다" 를 재려면 제안값이 있어야 한다.
          //    쓴 것과 안 쓴 것의 구분은 applied_source 가 한다. (CLAUDE.md 4장)
          const personalizedAmount = adjustment?.personalizedAmount ?? null;

          // default      추천 그대로
          // personalized 개인화 추천을 그대로 받아들임
          // user         둘 중 어느 것도 아닌 값 (상품을 바꿨거나 금액을 직접 고침)
          const appliedSource =
            c.plannedAmount === c.recommendedAmount
              ? APPLIED_SOURCE.DEFAULT
              : !dropped && personalizedAmount !== null && c.plannedAmount === personalizedAmount
                ? APPLIED_SOURCE.PERSONALIZED
                : APPLIED_SOURCE.USER;

          return {
            category_code: c.categoryCode,
            // 불변 원본. 사용자가 뭘 고쳤는지는 이 값과의 차이로만 알 수 있다.
            recommended_amount: c.recommendedAmount,
            personalized_amount: personalizedAmount,
            planned_amount: c.plannedAmount,
            applied_source: appliedSource,
            // 가상 금고 배분은 BUDGET-01 에서 한다. (docs/README.md §5 #8)
            prepared_amount: 0,
            sort_order: index + 1,
          };
        }),
        /*
          ⚠️ 예산 구성에서 고른 상품을 세부 계획으로도 남긴다.
             지금까지는 상품이 금액 계산에만 쓰이고 사라져서, 항공 예산을
             240만원으로 잡아 놓고도 카테고리 상세에는 세부 계획이 0건이었다.
             계획과 실제를 비교하는 게 이 서비스의 핵심인데 비교할 '계획' 이
             저장되지 않고 있었다.

          ⚠️ 뺀 카테고리의 상품은 넣지 않는다. 안 쓰기로 한 카테고리에
             계획만 남으면 그 계획이 영영 지출과 연결되지 않는다.
        */
        planItems: categoriesWithProducts.flatMap((category) =>
          droppedCategories.has(category.categoryCode)
            ? []
            : (category.products ?? [])
                .filter((product) => product.selected)
                .map((product, index) => ({
                  categoryCode: category.categoryCode,
                  name: product.name,
                  expectedAmount: product.amount,
                  sortOrder: index + 1,
                })),
        ),
        fund: {
          source_type: fundType,
          /*
            ⚠️ **0 으로 둔다.** 모은 금액은 바로 아래에서 입금 거래 한 건으로
               남긴다. (2026-09-21 3차) 둘 다 채우면 같은 돈이 두 번 잡힌다 —
               누적 모금액 = current_amount + 입금 합계 이기 때문이다.
               거래로 남겨야 입출금 내역에 보이고, 고치거나 지울 수도 있다.
          */
          current_amount: 0,
          financial_account_id: fundType === FUND_SOURCE_TYPE.MOCK ? accountId : null,
          last_synced_at: fundType === FUND_SOURCE_TYPE.MOCK ? new Date().toISOString() : null,
        },
      });

      /*
        여행을 시작할 때 확보한 돈을 '초기 자본' 입금으로 남긴다.
        ⚠️ 실패해도 여행 생성을 되돌리지 않는다. 자금은 나중에 손으로 넣을 수
           있는데 이것 때문에 여행이 통째로 안 만들어지면 손해가 더 크다.
      */
      await createInitialFundDeposit({
        tripId: trip.id,
        amount: currentAmount,
        sourceType:
          fundType === FUND_SOURCE_TYPE.MOCK
            ? TRANSACTION_SOURCE_TYPE.MOCK
            : TRANSACTION_SOURCE_TYPE.MANUAL,
        financialAccountId: fundType === FUND_SOURCE_TYPE.MOCK ? accountId : null,
        createdByUserId: userId,
      }).catch(() => undefined);

      savedRef.current = true;

      // 저장에 성공한 뒤에만 쏜다. (docs/06 §11)
      track(EVENTS.BUDGET_TARGET_CONFIRMED, {
        trip_id: trip.id,
        target_amount: targetTotal,
        member_count: draft.headcount,
        per_person_amount: perPersonAmount,
        edited_category_count: editedCount,
      });
      // 지난 여행 반영을 실제로 썼는지. 가설 4 의 핵심 지표다. (docs/06 §7-6)
      // 제안이 뜬 경우에만 쏜다. 뜨지도 않은 사람이 '미반영' 으로 잡히면
      // 반영 비율의 분모가 부풀어 오른다.
      if (pastAdjustments.length > 0) {
        const appliedCount = pastAdjustments.filter(
          (adjustment) => !droppedCategories.has(adjustment.categoryCode),
        ).length;
        track(EVENTS.PERSONALIZATION_APPLIED, {
          trip_id: trip.id,
          applied: appliedCount > 0,
        });
      }

      track(EVENTS.TRAVEL_FUND_REGISTERED, {
        trip_id: trip.id,
        fund_type: FUND_SOURCE_TYPE_TO_ANALYTICS[fundType],
        initial_amount: currentAmount,
      });
      track(EVENTS.TRIP_CREATED, {
        trip_id: trip.id,
        owner_type:
          OWNER_TYPE_TO_ANALYTICS[isGroupTrip ? TRIP_OWNER_TYPE.GROUP : TRIP_OWNER_TYPE.PERSONAL],
        user_trip_count: await getMyTripCount(userId),
      });

      resetDraft();

      // 생성 흐름을 스택에서 통째로 걷어낸 뒤 준비 홈으로 보낸다.
      //
      // /trips/new 는 중첩 Stack 이라 replace() 만으로는 그 안쪽 히스토리
      // (누구와 → 기본정보 → 예산·자금)가 남는다. 준비 홈에서 뒤로가기를 누르면
      // 방금 만든 여행의 입력 화면이 다시 나오고, 거기서 또 만들면 같은 여행이
      // 두 개 생긴다.
      //
      // dismissAll() 로 중첩 스택을 닫고 나서 이동한다.
      // 닫을 게 없으면 던지므로 감싼다.
      try {
        router.dismissAll();
      } catch {
        // 스택이 이미 비어 있으면 무시한다
      }
      router.replace(`/trips/${trip.id}`);
    } catch {
      // 반쪽 여행은 createTripBundle 이 되돌린다. 사용자는 다시 시도하면 된다.
      setSaveError('여행을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  }, [
    accountId,
    adjustmentByCode,
    categories,
    draft,
    droppedCategories,
    editedCount,
    fundType,
    manualAmount,
    method,
    pastAdjustments,
    recommendation,
    resetDraft,
    saving,
    selectedAccount,
    targetTotal,
    userId,
  ]);

  // ── 앞 단계 입력이 없으면 계산 자체가 불가능하다 ──────────────────────
  if (!recommendation) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '여행 만들기' }} />
        <ErrorState
          message="여행 정보가 없어요. 처음부터 다시 만들어 주세요."
          retryLabel="처음으로"
          onRetry={() => router.replace('/trips/new/owner')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: '여행 만들기' }} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
      >
      <StepProgress current={3} />

      <Text className="mt-[22px] text-[25px] font-bold leading-8 text-gray-900">
        예상 여행비를{'\n'}준비했어요
      </Text>

      {/*
        여행 조건을 눌러 앞 단계로 돌아간다.
        예산이 마음에 안 들 때 사용자가 바꾸고 싶은 건 대개 금액이 아니라
        일정이나 인원이다. 뒤로가기 버튼을 찾게 두지 않는다.
        TRIP-02 가 스택에 남아 있으므로 back() 이면 입력이 그대로 유지된다.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="여행 조건 수정"
        disabled={saving}
        onPress={() => router.back()}
        className="mt-1.5 flex-row items-center gap-1 self-start rounded-lg py-1 pr-2 active:bg-gray-100"
      >
        <Text className="text-sm text-gray-500">
          {draft.destinationName} · {recommendation.nights}박 {recommendation.days}일 ·{' '}
          {draft.headcount}명
        </Text>
        <Ionicons name="pencil" size={13} color="#9ca3af" />
      </Pressable>

      {/* ── ① 추천 결과 ── 고르기 전에 답을 먼저 준다 ── */}
      {pastLoading || aiLoading ? (
        <View className="mt-5 items-center rounded-2xl border border-gray-200 py-8">
          {/*
            무엇을 기다리는지 그대로 말한다. 둘 다 도는 동안 '지난 여행' 만
            보여주면 여행 기록이 없는 사용자는 왜 기다리는지 알 수 없다.
          */}
          <Text className="text-sm text-gray-400">
            {pastLoading ? '지난 여행 기록을 확인하는 중…' : '여행지에 맞는 예산을 짜는 중…'}
          </Text>
        </View>
      ) : (
        <BudgetResultHero
          method={method}
          totalAmount={targetTotal}
          headcount={draft.headcount}
          perPersonAmount={perPerson(targetTotal, draft.headcount)}
          styleLabel={TRAVEL_STYLE_LABEL[recommendation.basis.style]}
          pastApplied={pastOn}
          onToggleMethod={handleToggleMethod}
          amountEditing={totalEditing}
          onStartEditAmount={handleStartEditAmount}
          userTotalDraft={userTotalDraft}
          onChangeUserTotalDraft={setUserTotalDraft}
          onApplyUserTotal={handleApplyUserTotal}
          disabled={saving}
        />
      )}

      {/*
        ── 여행 스타일 ── 추천 상태에서만 묻는다 ──
        총액을 이미 정한 사람에게 "아낄지 말지" 를 묻는 건 순서가 맞지 않는다.
        직접 입력 경로에서는 draft 의 값으로 카테고리를 배분하고, 그 배분은
        아래 예산 구성에서 직접 고칠 수 있다.
      */}
      {showBudgetDetail && method === BUDGET_METHOD.RECOMMENDED ? (
        <View className="mt-6">
          <Text className="mb-2.5 text-base font-semibold text-gray-900">
            어떤 여행을 원하세요?
          </Text>
          <View className="rounded-2xl border border-gray-200 bg-white p-3.5">
            <TravelStyleSelector
              value={draft.travelStyle}
              onChange={handleChangeTravelStyle}
              disabled={saving}
            />
          </View>
        </View>
      ) : null}

      {/* ── ② 예산 구성 ── 처음부터 고칠 수 있다 ── */}
      {showBudgetDetail ? (
        <View className="mt-6">
          <Text className="mb-2 text-base font-semibold text-gray-900">예산 구성</Text>

          <Text className="mx-0.5 mb-2 text-[11px] text-gray-400">
            항목을 눌러 추천 근거와 금액을 조정할 수 있어요.
          </Text>
          <BudgetCategoryList
            categories={categoriesWithProducts}
            onChangeAmount={handleChangeCategoryAmount}
            onToggleProduct={handleToggleProduct}
            onToggleDrop={handleToggleDrop}
            onToggleManual={handleToggleManual}
            otherCategoriesTotal={otherCategoriesTotal}
            contingencyChoice={contingencyChoice}
            onChangeContingency={handleChangeContingency}
            editingCode={editingCode}
            onToggleEditing={(code) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setEditingCode((prev) => (prev === code ? null : code));
            }}
            disabled={saving}
          />

          {/* 전체 반영은 이 카드가, 카테고리별 제외는 위 목록이 담당한다 */}
          {pastAdjustments.length > 0 ? (
            <PastPatternCard
              applied={pastOn}
              increasedLabels={pastIncreasedLabels}
              decreasedLabels={pastDecreasedLabels}
              onToggleAll={handleToggleAllPast}
              onPressDetail={() => setPastSheetOpen(true)}
              disabled={saving}
            />
          ) : null}
        </View>
      ) : null}

      {/*
        ── ③ 현재 준비한 여행자금 ── 선택사항이다 ──
        고르지 않아도 여행을 만들 수 있고, 그때 0원으로 저장된다.
      */}
      <View className="mt-7">
        <View className="flex-row items-baseline">
          <Text className="text-base font-semibold text-gray-900">현재 준비한 여행자금</Text>
          <Text className="ml-auto text-[11px] font-medium text-gray-400">선택</Text>
        </View>
        {/*
          선택지 자체가 무엇을 고르는지 말해 주므로, 여기서는 안 골라도 된다는
          것만 남긴다. 계좌 유무에 따라 문구를 나누지 않는다 — 이제 아래 UI 가
          한 벌이다.
        */}
        <Text className="mb-2.5 mt-1 text-xs text-gray-400">
          지금 정하지 않아도 괜찮아요. 여행을 만든 뒤에 바꿀 수 있어요.
        </Text>
        <FundSourceSelector
          value={fundType}
          onChange={handleChangeFundType}
          accounts={accounts}
          accountsLoading={accountsLoading}
          selectedAccountId={accountId}
          onSelectAccount={handleSelectAccount}
          manualAmount={manualAmount}
          onChangeManualAmount={setManualAmount}
          disabled={saving}
        />
      </View>
      {saveError ? <Text className="mt-5 text-sm text-red-500">{saveError}</Text> : null}
      </ScrollView>

      {/*
        아직 못 고른 게 있어도 버튼은 그린다. 여행자금까지 처음부터 보이므로
        마지막에 무엇을 누르게 되는지 알려주는 편이 낫다. 빠진 값은 disabled 로 막는다.
      */}
      <PastTripSheet
        visible={pastSheetOpen}
        onClose={() => setPastSheetOpen(false)}
        tripCount={pastProfileTripCount}
        rows={pastTripRows}
      />

      <BottomCta
        label="이 예산으로 여행 만들기"
        onPress={() => void handleSubmit()}
        disabled={!canSubmit}
        loading={saving}
        note="지금 다 정하지 않아도 돼요. 여행을 만든 뒤에도 예산은 언제든 수정할 수 있어요."
      />
    </View>
  );
}
