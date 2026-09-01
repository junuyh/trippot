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
// 단계
//   ① 예산 방식 선택 (추천 / 직접 입력)
//      └ 추천을 고르면 여기서 여행 스타일을 묻는다
//   ② 예상 여행비 비교 — 두 경로 모두 여기로 수렴한다 (AC-01)
//   ③ 카테고리 수정 → 목표 여행비 확정
//   ④ 현재 여행자금 등록
//   ⑤ 저장 → 준비 홈으로 이동
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
  BudgetMethodSelector,
  BudgetSummary,
  FundSourceSelector,
  StepProgress,
  TravelStyleSelector,
  type EditableCategory,
} from '@/components/trip-create';
import { CurrencyInput, ErrorState } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { buildPastAdjustments, bpToPercent, applyBp, type PastAdjustment } from '@/lib/budget/pastAdjustment';
import { perPerson } from '@/lib/budget/recommendation';
import {
  getDefaultProductIds,
  getProductCategory,
  sumSelectedRatio,
} from '@/lib/constants/budgetProducts';
import { buildBudgetRecommendation } from '@/lib/budget/recommendation';
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  APPLIED_SOURCE,
  BUDGET_METHOD,
  CATEGORY_CODE,
  BUDGET_METHOD_TO_ANALYTICS,
  COMPANION_TYPE,
  FUND_SOURCE_TYPE,
  FUND_SOURCE_TYPE_TO_ANALYTICS,
  OWNER_TYPE_TO_ANALYTICS,
  TRIP_OWNER_TYPE,
  type BudgetMethod,
  type CategoryCode,
  type FundSourceType,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { useTripDraft } from '@/lib/hooks/useTripDraft';
import { createGroup } from '@/lib/supabase/queries/groups';
import { getGroupAccounts, type FinancialAccount } from '@/lib/supabase/queries/funds';
import {
  getSpendingProfile,
  type SpendingProfile,
} from '@/lib/supabase/queries/personalization';
import { createTripBundle, getMyTripCount } from '@/lib/supabase/queries/trips';

export default function ScreenTRIP03() {
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
      return;
    }

    const scope =
      draft.companionType === COMPANION_TYPE.EXISTING_GROUP && draft.groupId
        ? ({ ownerType: 'GROUP', groupId: draft.groupId } as const)
        : // TODO: 로그인 연동 시 교체
          ({ ownerType: 'PERSONAL', userId: DEV_USER_ID } as const);

    getSpendingProfile(scope)
      .then((profile) => {
        setPastProfile(profile);
        setPastProfileTripCount(profile?.basedOnTripCount ?? 0);
      })
      .catch(() => {
        // 과거 데이터 조회 실패로 여행 생성을 막지 않는다. 기본 추천으로 간다.
        setPastProfile(null);
        setPastProfileTripCount(0);
      });
  }, [draft.applyPastData, draft.companionType, draft.groupId, draft.pastTripCount]);

  // ── ① 예산 방식 ───────────────────────────────────────────────────────
  const [method, setMethod] = useState<BudgetMethod | null>(null);
  const [userTotal, setUserTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<EditableCategory[]>([]);
  const [editingCode, setEditingCode] = useState<CategoryCode | null>(null);

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

  // ── 지난 여행 반영 ────────────────────────────────────────────────────
  //
  // TRIP-01 에서 토글을 켠 채로 넘어왔고 과거 결산이 있으면 편차를 얹는다.
  // getSpendingProfile 은 tripId 가 필요 없어서 여행을 만들기 전에도 부를 수 있다.
  const [pastProfile, setPastProfile] = useState<SpendingProfile | null>(null);
  const [pastProfileTripCount, setPastProfileTripCount] = useState(0);

  // 사용자가 개별로 뺀 카테고리. '빼기' 를 누른 것만 들어간다.
  const [droppedCategories, setDroppedCategories] = useState<Set<CategoryCode>>(new Set());

  const toEditable = useCallback(
    (source: NonNullable<typeof recommendation>): EditableCategory[] =>
      source.categories.map((c) => ({
        categoryCode: c.categoryCode,
        recommendedAmount: c.recommendedAmount,
        plannedAmount: c.recommendedAmount,
        basis: c.basis,
        formula: c.formula,
        baseAmount: c.baseAmount,
        multiplier: c.multiplier,
      })),
    [],
  );

  const handleSelectMethod = useCallback(
    (next: BudgetMethod) => {
      if (!recommendation) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMethod(next);

      // 추천값을 planned 초기값으로 깐다. 사용자가 확정 버튼을 누르는 순간까지는
      // applied_source = 'default' 다. 고친 카테고리만 'user' 가 된다.
      setCategories(toEditable(recommendation));
      setSelectedProductIds(getDefaultProductIds(recommendation.basis.style));
      setContingencyChoice(null);
      setUserTotal(next === BUDGET_METHOD.USER_DEFINED ? null : recommendation.totalAmount);

      track(EVENTS.BUDGET_METHOD_SELECTED, {
        method: BUDGET_METHOD_TO_ANALYTICS[next],
      });
    },
    [recommendation, toEditable],
  );

  /**
   * 앞 단계 조건이 바뀌면 카테고리를 새 추천으로 다시 깐다.
   *
   * 상단의 '홍콩 · 3박 4일 · 4명' 을 눌러 일정이나 스타일을 고치고 돌아오면
   * recommendation 은 다시 계산되지만 categories 는 예산 방식을 고른 시점에
   * 만들어진 그대로다. 그대로 두면 '아낌없이' 로 바꿨는데 화면에는 '보통'
   * 금액이 남고, 근거(계산식·배수)와 금액이 서로 다른 말을 하게 된다.
   *
   * 사용자가 고쳐둔 금액도 함께 사라지지만, 조건이 바뀌면 그 금액의 근거도
   * 사라진 것이라 남겨두는 편이 더 위험하다.
   */
  const syncedRef = useRef(recommendation);
  useEffect(() => {
    if (syncedRef.current === recommendation) return;
    syncedRef.current = recommendation;
    if (!recommendation || method === null) return;

    setCategories(toEditable(recommendation));
    setEditingCode(null);

    // 상품 선택과 예비비 비율도 함께 되돌린다.
    // 스타일을 '보통' → '아낌없이' 로 바꿨는데 상품이 보통 조합 그대로면,
    // 금액은 새 추천인데 아래 카드에는 옛 조합이 체크돼 있어 서로 다른 말을 한다.
    setSelectedProductIds(getDefaultProductIds(recommendation.basis.style));
    setContingencyChoice(null);

    if (method === BUDGET_METHOD.RECOMMENDED) setUserTotal(recommendation.totalAmount);
  }, [method, recommendation, toEditable]);

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

      const ratio = total / recommendation.totalAmount;
      const next = recommendation.categories.map((c) => ({
        categoryCode: c.categoryCode,
        recommendedAmount: c.recommendedAmount,
        plannedAmount: Math.round((c.recommendedAmount * ratio) / 1000) * 1000,
        basis: c.basis,
        formula: c.formula,
        baseAmount: c.baseAmount,
        multiplier: c.multiplier,
      }));

      const drift = total - next.reduce((sum, c) => sum + c.plannedAmount, 0);
      if (drift !== 0) {
        const biggest = next.reduce((a, b) => (b.plannedAmount > a.plannedAmount ? b : a));
        biggest.plannedAmount = Math.max(0, biggest.plannedAmount + drift);
      }

      setCategories(next);
    },
    [recommendation],
  );

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
      const catalog = getProductCategory(category.categoryCode);

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
        Math.round((category.baseAmount * sumSelectedRatio(category.categoryCode, ids)) / 1000) *
        1000;

      if (!adjustment || dropped.has(category.categoryCode)) return fromProducts;
      return applyBp(fromProducts, adjustment.appliedBp);
    },
    [contingencyChoice],
  );

  /**
   * 반영 대상이 바뀌면 금액을 다시 깐다.
   * 과거 프로필을 늦게 받아오거나 사용자가 개별로 빼면 여기서 반영된다.
   */
  const adjustSyncRef = useRef('');
  useEffect(() => {
    if (method === null) return;
    const key = `${pastAdjustments.map((a) => `${a.categoryCode}:${a.appliedBp}`).join(',')}|${[...droppedCategories].sort().join(',')}|${contingencyChoice}`;
    if (adjustSyncRef.current === key) return;
    adjustSyncRef.current = key;

    setCategories((cats) =>
      cats.map((c) => ({
        ...c,
        plannedAmount: computeAmount(c, selectedProductIds, droppedCategories, adjustmentByCode),
      })),
    );
  }, [
    adjustmentByCode,
    computeAmount,
    contingencyChoice,
    droppedCategories,
    method,
    pastAdjustments,
    selectedProductIds,
  ]);

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
    track(EVENTS.PERSONALIZATION_OFFERED, {
      based_on_trip_count: pastProfileTripCount,
      top_category: top.categoryCode,
      deviation_rate: top.rawBp,
    });
  }, [pastAdjustments, pastProfileTripCount]);

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
      const catalog = getProductCategory(categoryCode);
      if (!catalog) return;

      setSelectedProductIds((prev) => {
        const next = new Set(prev);

        if (catalog.single) {
          // 왕복 항공권을 두 개 사지는 않는다. 같은 것을 다시 누르면 해제한다.
          const wasSelected = next.has(productId);
          for (const product of catalog.products) next.delete(product.id);
          if (!wasSelected) next.add(productId);
        } else {
          if (next.has(productId)) next.delete(productId);
          else next.add(productId);
        }

        setCategories((cats) =>
          cats.map((c) =>
            c.categoryCode === categoryCode
              ? { ...c, plannedAmount: computeAmount(c, next, droppedCategories, adjustmentByCode) }
              : c,
          ),
        );

        return next;
      });
    },
    [adjustmentByCode, computeAmount, droppedCategories],
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

        // 반영으로 늘거나 줄어든 금액. 뺀 상태면 0 이 아니라 '제외됨' 으로 표시되므로
        // 여기서는 부호만 맞춰 두고 화면이 판단한다.
        const adjustmentFields = adjustment
          ? {
              adjustmentPercent:
                (adjustment.appliedBp > 0 ? 1 : -1) * bpToPercent(adjustment.appliedBp),
              adjustmentAmount: adjustment.personalizedAmount - adjustment.recommendedAmount,
              adjustmentDropped: dropped,
            }
          : {};

        const catalog = getProductCategory(category.categoryCode);
        if (!catalog) return { ...category, ...adjustmentFields };

        return {
          ...category,
          ...adjustmentFields,
          productHint: catalog.hint,
          singleSelect: catalog.single,
          products: catalog.products.map((product) => ({
            id: product.id,
            name: product.name,
            emoji: product.emoji,
            amount: Math.round((category.baseAmount * product.ratio) / 1000) * 1000,
            selected: selectedProductIds.has(product.id),
          })),
        };
      }),
    [adjustmentByCode, categories, droppedCategories, selectedProductIds],
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
  const [fundType, setFundType] = useState<FundSourceType | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState<number | null>(null);

  // 계좌는 모임 자산이다. 개인 여행과 신규 모임에는 붙을 계좌가 없다.
  useEffect(() => {
    if (draft.companionType !== COMPANION_TYPE.EXISTING_GROUP || !draft.groupId) return;
    setAccountsLoading(true);
    getGroupAccounts(draft.groupId)
      .then(setAccounts)
      .catch(() => setAccounts([])) // 계좌 조회 실패로 여행 생성을 막지 않는다
      .finally(() => setAccountsLoading(false));
  }, [draft.companionType, draft.groupId]);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  // ── ⑤ 저장 ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedRef = useRef(false);

  const fundValid =
    fundType === FUND_SOURCE_TYPE.ZERO ||
    (fundType === FUND_SOURCE_TYPE.MANUAL && manualAmount !== null && manualAmount >= 0) ||
    (fundType === FUND_SOURCE_TYPE.MOCK && Boolean(selectedAccount));

  /**
   * 예산 상세(요약 · 카테고리)를 열지.
   *
   * 직접 입력은 금액을 넣기 전까지 열지 않는다. 안 그러면 아무것도 입력하지
   * 않았는데 목표 여행비가 추천값으로 채워져 보인다. "정해둔 예산이 있어요" 를
   * 고른 사람에게 시스템이 먼저 답을 내놓는 꼴이다.
   */
  const showBudgetDetail =
    categories.length > 0 &&
    (method === BUDGET_METHOD.RECOMMENDED ||
      (method === BUDGET_METHOD.USER_DEFINED && userTotal !== null && userTotal > 0));

  const canSubmit = Boolean(recommendation) && showBudgetDetail && targetTotal > 0 && fundValid;

  const handleSubmit = useCallback(async () => {
    if (!recommendation || !method || !draft.travelStyle || !fundType) return;
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
          // TODO: 로그인 연동 시 교체
          owner_user_id: DEV_USER_ID,
        });
        groupId = group.id;
      }

      const isGroupTrip = draft.companionType !== COMPANION_TYPE.PERSONAL;
      const perPersonAmount = perPerson(targetTotal, draft.headcount);

      const trip = await createTripBundle({
        trip: {
          owner_type: isGroupTrip ? TRIP_OWNER_TYPE.GROUP : TRIP_OWNER_TYPE.PERSONAL,
          // trips_owner_shape CHECK — GROUP 이면 owner_user_id 를 비운다
          owner_user_id: isGroupTrip ? null : DEV_USER_ID,
          group_id: isGroupTrip ? groupId : null,
          destination: draft.destinationName,
          start_date: draft.startDate,
          end_date: draft.endDate,
          headcount: draft.headcount,
          travel_style_json: { style: draft.travelStyle },
        },
        members: [
          // 본인
          // TODO: 로그인 연동 시 교체
          { user_id: DEV_USER_ID },
          // 아직 가입하지 않은 동행자는 이름만 저장한다. (docs/README.md §5 #15)
          ...draft.companionNames.map((name) => ({ display_name: name })),
        ],
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
        fund: {
          source_type: fundType,
          current_amount: currentAmount,
          financial_account_id: fundType === FUND_SOURCE_TYPE.MOCK ? accountId : null,
          last_synced_at: fundType === FUND_SOURCE_TYPE.MOCK ? new Date().toISOString() : null,
        },
      });

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
        // TODO: 로그인 연동 시 교체
        user_trip_count: await getMyTripCount(DEV_USER_ID),
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

      <Text className="mt-6 text-[26px] font-bold leading-8 text-gray-900">
        근거를 보고{'\n'}예산을 정해요
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

      {/* ── ① 예산 방식 ── 무엇부터 정할지가 여기서 갈린다 ── */}
      <View className="mt-7">
        <Text className="mb-2.5 text-base font-semibold text-gray-900">
          예산 설정 방식 <Text className="text-red-500">*</Text>
        </Text>
        <BudgetMethodSelector value={method} onChange={handleSelectMethod} disabled={saving} />
      </View>

      {/*
        ── 여행 스타일 ── 추천을 고른 경우에만 묻는다 ──
        총액을 이미 정한 사람에게 "아낄지 말지" 를 묻는 건 순서가 맞지 않는다.
        직접 입력 경로에서는 draft 의 값(기본 '보통')으로 카테고리를 배분한다.
        배분 비율은 아래 카테고리에서 직접 고칠 수 있다.
      */}
      {method === BUDGET_METHOD.RECOMMENDED ? (
        <View className="mt-6">
          <Text className="mb-2.5 text-base font-semibold text-gray-900">여행 스타일</Text>
          <TravelStyleSelector
            value={draft.travelStyle}
            onChange={(value) => patchDraft({ travelStyle: value })}
            disabled={saving}
          />
        </View>
      ) : null}

      {/* ── 직접 입력 총액 ── */}
      {method === BUDGET_METHOD.USER_DEFINED ? (
        <View className="mt-5">
          <CurrencyInput
            label="생각한 총 예산"
            required
            value={userTotal}
            onChangeValue={(value) => {
              setUserTotal(value);
              if (value !== null) applyUserTotal(value);
            }}
            editable={!saving}
            hint="추천 비율에 맞춰 카테고리로 나눠 드려요. 아래에서 고칠 수 있어요."
          />
        </View>
      ) : null}

      {/* ── ② 예상 여행비 비교 ── 두 경로 모두 여기로 수렴한다 (AC-01) ── */}
      {showBudgetDetail ? (
        <>
          <View className="mt-6">
            <BudgetSummary
              recommendedTotal={recommendation.totalAmount}
              targetTotal={targetTotal}
              headcount={draft.headcount}
              perPersonAmount={perPerson(targetTotal, draft.headcount)}
              baselineUpdatedAt={recommendation.updatedAt}
              estimateNotice={recommendation.notice}
              productCount={selectedProductIds.size}
              pastApplied={
                pastAdjustments.length > 0
                  ? {
                      tripCount: pastProfileTripCount,
                      appliedCount: pastAdjustments.filter(
                        (a) => !droppedCategories.has(a.categoryCode),
                      ).length,
                      droppedCount: pastAdjustments.filter((a) =>
                        droppedCategories.has(a.categoryCode),
                      ).length,
                    }
                  : null
              }
              onToggleAllPast={handleToggleAllPast}
              // 총액을 이미 정해 온 사람에게 자기가 넣은 숫자를 크게 되돌려
              // 보여줄 이유가 없다. 비교만 한 줄로 남긴다.
              variant={method === BUDGET_METHOD.USER_DEFINED ? 'compact' : 'full'}
            />
          </View>

          {/* ── ③ 카테고리 수정 ── */}
          <View className="mt-6">
            <Text className="mb-1 text-base font-semibold text-gray-900">카테고리별 예산</Text>
            <Text className="mb-2.5 text-xs text-gray-400">
              항목을 눌러 근거 상품을 바꿀 수 있어요.
            </Text>
            <BudgetCategoryList
              categories={categoriesWithProducts}
              onChangeAmount={handleChangeCategoryAmount}
              onToggleProduct={handleToggleProduct}
              onToggleDrop={handleToggleDrop}
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
          </View>
        </>
      ) : null}

      {/*
        ── ④ 여행자금 ──
        예산 방식을 고르기 전에도 보여준다.
        정할 게 둘(예산 · 자금)이라는 걸 처음부터 알려야 한다. 예산 블록이 열리고
        카테고리를 펼치기 시작하면 화면이 길어져서, 아래에 이런 항목이 남아 있다는
        걸 알아채기 어렵다.
      */}
      <View className="mt-7">
        <Text className="mb-1 text-base font-semibold text-gray-900">
          지금 모은 여행자금 <Text className="text-red-500">*</Text>
        </Text>
        <Text className="mb-2.5 text-xs text-gray-400">계좌를 연결하지 않아도 괜찮아요.</Text>
        <FundSourceSelector
          value={fundType}
          onChange={setFundType}
          accounts={accounts}
          accountsLoading={accountsLoading}
          selectedAccountId={accountId}
          onSelectAccount={setAccountId}
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
