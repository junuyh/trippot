// ============================================================================
// TRIP-03 여행 생성: 예산·자금  ·  /trips/new/budget-fund
//
// 생성 흐름의 마지막 단계다. **여기서 처음으로 DB 에 쓴다.**
//   groups(신규 모임일 때) → trips → trip_members → trip_budgets
//   → budget_categories 8행 → fund_sources
//
// 단계
//   ① 예산 방식 선택 (추천 / 직접 입력)
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
import { ActivityIndicator, LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';

import {
  BudgetCategoryList,
  BudgetMethodSelector,
  BudgetSummary,
  FundSourceSelector,
  StepProgress,
  type EditableCategory,
} from '@/components/trip-create';
import { Button, CurrencyInput, ErrorState } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { perPerson } from '@/lib/budget/recommendation';
import { buildBudgetRecommendation } from '@/lib/budget/recommendation';
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  APPLIED_SOURCE,
  BUDGET_METHOD,
  BUDGET_METHOD_TO_ANALYTICS,
  CATEGORY_CODE_TO_ANALYTICS,
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
  personalizeFromProfile,
} from '@/lib/supabase/queries/personalization';
import { createTripBundle, getMyTripCount } from '@/lib/supabase/queries/trips';

export default function ScreenTRIP03() {
  useScreenView(SCREENS.TRIP_CREATE_BUDGET);

  const { draft, resetDraft } = useTripDraft();

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

  // ── 지난 여행 반영 ────────────────────────────────────────────────────
  //
  // TRIP-01 에서 "지난 여행 데이터를 반영할까요?" 에 '예' 를 고른 사용자에게는
  // **처음부터** 개인화된 추천을 보여준다. 나중에 예산 상세에서 배너로 다시
  // 제안하면, 사용자는 방금 확정한 금액을 또 고쳐야 한다.
  //
  // ⚠️ 개인 여행 데이터는 개인에, 모임 여행 데이터는 해당 모임에만 누적한다.
  //    다른 소유 단위로 승계하지 않는다. (docs/06 §7-6 확정 정책)
  //    새 모임은 과거가 있을 수 없으므로 조회하지 않는다.
  const wantsPastData = draft.applyPastData === true && draft.pastTripCount > 0;
  const [pastLoading, setPastLoading] = useState(wantsPastData);
  const [personalized, setPersonalized] = useState<
    Map<CategoryCode, { amount: number; bp: number }>
  >(new Map());
  const [basedOnTripCount, setBasedOnTripCount] = useState(0);
  const pastLoadedRef = useRef(false);

  useEffect(() => {
    if (!wantsPastData || !recommendation || pastLoadedRef.current) return;
    pastLoadedRef.current = true;

    if (draft.companionType === COMPANION_TYPE.NEW_GROUP) {
      setPastLoading(false);
      return;
    }

    const scope =
      draft.companionType === COMPANION_TYPE.EXISTING_GROUP && draft.groupId
        ? ({ ownerType: 'GROUP', groupId: draft.groupId } as const)
        : // TODO: 로그인 연동 시 교체
          ({ ownerType: 'PERSONAL', userId: DEV_USER_ID } as const);

    void getSpendingProfile(scope)
      .then((profile) => {
        if (!profile) return;

        // 아직 budget_categories 행이 없다. 방금 계산한 추천을 그대로 넣는다.
        const results = personalizeFromProfile(
          profile,
          recommendation.categories.map((category) => ({
            key: category.categoryCode,
            categoryCode: category.categoryCode,
            recommendedAmount: category.recommendedAmount,
          })),
        );
        if (results.length === 0) return;

        setBasedOnTripCount(profile.basedOnTripCount);
        setPersonalized(
          new Map(
            results.map((result) => [
              result.key as CategoryCode,
              {
                amount: result.personalizedAmount,
                bp: (result.basis as { deviationBp: number }).deviationBp,
              },
            ]),
          ),
        );

        // 제안을 실제로 보여준 시점에만 쏜다. 노출 모수다. (docs/06 §7-6)
        // 여행이 아직 없어 trip_id 를 실을 수 없다. source 로 구분한다.
        track(EVENTS.PERSONALIZATION_OFFERED, {
          source: 'trip_create',
          based_on_trip_count: profile.basedOnTripCount,
          top_category: CATEGORY_CODE_TO_ANALYTICS[results[0].categoryCode as CategoryCode],
          deviation_rate: (results[0].basis as { deviationBp: number }).deviationBp,
        });
      })
      // 개인화는 부가 기능이다. 실패해도 기본 추천으로 여행을 만들 수 있다.
      .catch(() => undefined)
      .finally(() => setPastLoading(false));
  }, [draft.companionType, draft.groupId, recommendation, wantsPastData]);

  // ── ① 예산 방식 ───────────────────────────────────────────────────────
  const [method, setMethod] = useState<BudgetMethod | null>(null);
  const [userTotal, setUserTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<EditableCategory[]>([]);
  const [editingCode, setEditingCode] = useState<CategoryCode | null>(null);

  const toEditable = useCallback(
    (source: NonNullable<typeof recommendation>): EditableCategory[] =>
      source.categories.map((c) => {
        const past = personalized.get(c.categoryCode) ?? null;
        return {
          categoryCode: c.categoryCode,
          // ⚠️ 불변 원본. 개인화가 붙어도 덮어쓰지 않는다. (CLAUDE.md 4장)
          recommendedAmount: c.recommendedAmount,
          // 개인화가 있으면 그 값을 사용자에게 제시한다.
          // 확정은 여전히 사용자가 한다 — 여기서 고칠 수 있고, 저장은 버튼을 눌러야 된다.
          plannedAmount: past?.amount ?? c.recommendedAmount,
          basis: c.basis,
          formula: c.formula,
          baseAmount: c.baseAmount,
          multiplier: c.multiplier,
          personalizedAmount: past?.amount ?? null,
          personalizedBp: past?.bp ?? null,
        };
      }),
    [personalized],
  );

  const handleSelectMethod = useCallback(
    (next: BudgetMethod) => {
      if (!recommendation) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMethod(next);

      // 추천값을 planned 초기값으로 깐다. 사용자가 확정 버튼을 누르는 순간까지는
      // applied_source = 'default' 다. 고친 카테고리만 'user' 가 된다.
      const editable = toEditable(recommendation);
      setCategories(editable);
      setUserTotal(
        next === BUDGET_METHOD.USER_DEFINED
          ? null
          : editable.reduce((sum, c) => sum + c.plannedAmount, 0),
      );

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

    const editable = toEditable(recommendation);
    setCategories(editable);
    setEditingCode(null);
    if (method === BUDGET_METHOD.RECOMMENDED) {
      setUserTotal(editable.reduce((sum, c) => sum + c.plannedAmount, 0));
    }
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
      const next: EditableCategory[] = recommendation.categories.map((c) => {
        const past = personalized.get(c.categoryCode) ?? null;
        return {
          categoryCode: c.categoryCode,
          recommendedAmount: c.recommendedAmount,
          plannedAmount: Math.round((c.recommendedAmount * ratio) / 1000) * 1000,
          basis: c.basis,
          formula: c.formula,
          baseAmount: c.baseAmount,
          multiplier: c.multiplier,
          personalizedAmount: past?.amount ?? null,
          personalizedBp: past?.bp ?? null,
        };
      });

      const drift = total - next.reduce((sum, c) => sum + c.plannedAmount, 0);
      if (drift !== 0) {
        const biggest = next.reduce((a, b) => (b.plannedAmount > a.plannedAmount ? b : a));
        biggest.plannedAmount = Math.max(0, biggest.plannedAmount + drift);
      }

      setCategories(next);
    },
    [personalized, recommendation],
  );

  const handleChangeCategoryAmount = useCallback((categoryCode: CategoryCode, amount: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.categoryCode === categoryCode ? { ...c, plannedAmount: amount } : c)),
    );
  }, []);

  const targetTotal = useMemo(
    () => categories.reduce((sum, c) => sum + c.plannedAmount, 0),
    [categories],
  );
  /**
   * 사용자가 **제시받은 값에서 고친** 카테고리 수.
   *
   * 개인화가 붙었으면 비교 기준은 개인화 금액이다. 기본 추천과 비교하면
   * 손대지도 않은 카테고리가 전부 '수정함' 으로 잡혀
   * budget_target_confirmed.edited_category_count 가 못 쓰게 된다.
   */
  const editedCount = useMemo(
    () =>
      categories.filter(
        (c) => c.plannedAmount !== (c.personalizedAmount ?? c.recommendedAmount),
      ).length,
    [categories],
  );

  /**
   * 개인화를 반영한 추천 총액. 제안이 없으면 null.
   * 개인화가 없는 카테고리는 기본 추천 그대로 더한다.
   */
  const personalizedTotal = useMemo(() => {
    if (personalized.size === 0 || categories.length === 0) return null;
    return categories.reduce(
      (sum, c) => sum + (c.personalizedAmount ?? c.recommendedAmount),
      0,
    );
  }, [categories, personalized]);

  /** 개인화 금액을 그대로 확정하는 카테고리 수. 0 이면 개인화가 적용되지 않은 것이다 */
  const personalizedAppliedCount = useMemo(
    () =>
      categories.filter(
        (c) => c.personalizedAmount !== null && c.plannedAmount === c.personalizedAmount,
      ).length,
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

  const canSubmit = Boolean(recommendation) && method !== null && targetTotal > 0 && fundValid;

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
        categories: categories.map((c, index) => ({
          category_code: c.categoryCode,
          // 불변 원본. 사용자가 뭘 고쳤는지는 이 값과의 차이로만 알 수 있다.
          recommended_amount: c.recommendedAmount,
          // 개인화 추천 원본. 제안이 없었으면 null 이다.
          personalized_amount: c.personalizedAmount,
          planned_amount: c.plannedAmount,
          // 세 값이 각각 다른 질문에 답한다. (CLAUDE.md 4장)
          //   default      기본 추천을 그대로 씀
          //   personalized 지난 여행 반영값을 그대로 씀
          //   user         사용자가 직접 고침
          applied_source:
            c.personalizedAmount !== null && c.plannedAmount === c.personalizedAmount
              ? APPLIED_SOURCE.PERSONALIZED
              : c.plannedAmount === c.recommendedAmount
                ? APPLIED_SOURCE.DEFAULT
                : APPLIED_SOURCE.USER,
          // 가상 금고 배분은 BUDGET-01 에서 한다. (docs/README.md §5 #8)
          prepared_amount: 0,
          sort_order: index + 1,
        })),
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
      track(EVENTS.TRAVEL_FUND_REGISTERED, {
        trip_id: trip.id,
        fund_type: FUND_SOURCE_TYPE_TO_ANALYTICS[fundType],
        initial_amount: currentAmount,
      });
      // 개인화를 제안받은 사용자만 쏜다. 노출 대비 반영률의 분자·분모다.
      // 하나도 안 남았으면 전부 고친 것이므로 applied: false 다. (docs/06 §7-6)
      if (personalized.size > 0) {
        track(EVENTS.PERSONALIZATION_APPLIED, {
          trip_id: trip.id,
          source: 'trip_create',
          applied: personalizedAppliedCount > 0,
          applied_category_count: personalizedAppliedCount,
          offered_category_count: personalized.size,
          based_on_trip_count: basedOnTripCount,
        });
      }

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
    basedOnTripCount,
    categories,
    draft,
    editedCount,
    fundType,
    manualAmount,
    method,
    personalized,
    personalizedAppliedCount,
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
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-10 pt-6"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: '여행 만들기' }} />

      <StepProgress current={3} />

      <Text className="mt-6 text-2xl font-bold text-gray-900">예산을 정해요</Text>

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

      {/*
        ── 지난 여행 반영 안내 ──
        개인화된 금액을 보여주기 **전에** 왜 금액이 달라졌는지 먼저 말한다.
        설명 없이 숫자만 바뀌면 사용자는 추천이 틀렸다고 생각한다.

        조회가 끝나기 전에 방식 선택을 열지 않는다. 사용자가 '추천으로 할게요' 를
        누른 뒤 금액이 조용히 바뀌면, 방금 확인한 숫자를 믿을 수 없게 된다.
      */}
      {pastLoading ? (
        <View className="mt-7 flex-row items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3.5">
          <ActivityIndicator size="small" color="#8b5cf6" />
          <Text className="text-sm text-gray-500">지난 여행 소비를 반영하는 중이에요…</Text>
        </View>
      ) : (
        <>
          {personalized.size > 0 ? (
            <View className="mt-7 gap-1.5 rounded-2xl bg-violet-50 px-4 py-3.5">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="sparkles" size={15} color="#7c3aed" />
                <Text className="text-sm font-bold text-violet-900">
                  지난 여행 {basedOnTripCount}번을 반영했어요
                </Text>
              </View>
              <Text className="text-xs leading-5 text-violet-800">
                실제로 더 썼던 카테고리는 올리고, 남겼던 카테고리는 낮춰서 추천했어요.
                {'\n'}항목을 눌러 기본 추천과 비교하고 고칠 수 있어요.
              </Text>
            </View>
          ) : null}

          {/* ── ① 예산 방식 ── */}
          <View className="mt-7">
            <Text className="mb-2.5 text-base font-semibold text-gray-900">
              예산 설정 방식 <Text className="text-red-500">*</Text>
            </Text>
            <BudgetMethodSelector value={method} onChange={handleSelectMethod} disabled={saving} />
          </View>
        </>
      )}

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
      {method !== null && categories.length > 0 ? (
        <>
          <View className="mt-6">
            <BudgetSummary
              recommendedTotal={recommendation.totalAmount}
              personalizedTotal={personalizedTotal}
              targetTotal={targetTotal}
              headcount={draft.headcount}
              perPersonAmount={perPerson(targetTotal, draft.headcount)}
              baselineUpdatedAt={recommendation.updatedAt}
              estimateNotice={recommendation.notice}
            />
          </View>

          {/* ── ③ 카테고리 수정 ── */}
          <View className="mt-6">
            <Text className="mb-1 text-base font-semibold text-gray-900">카테고리별 예산</Text>
            <Text className="mb-2.5 text-xs text-gray-400">
              항목을 눌러 금액을 바꿀 수 있어요.
            </Text>
            <BudgetCategoryList
              categories={categories}
              // recommendation 이 있으면 travelStyle 은 반드시 채워져 있다
              travelStyle={recommendation.basis.style}
              onChangeAmount={handleChangeCategoryAmount}
              editingCode={editingCode}
              onToggleEditing={(code) => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setEditingCode((prev) => (prev === code ? null : code));
              }}
              disabled={saving}
            />
          </View>

          {/* ── ④ 여행자금 ── */}
          <View className="mt-7">
            <Text className="mb-1 text-base font-semibold text-gray-900">
              지금 모은 여행자금 <Text className="text-red-500">*</Text>
            </Text>
            <Text className="mb-2.5 text-xs text-gray-400">
              계좌를 연결하지 않아도 괜찮아요.
            </Text>
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
        </>
      ) : null}

      {saveError ? <Text className="mt-5 text-sm text-red-500">{saveError}</Text> : null}

      {method !== null ? (
        <View className="mt-8">
          <Button
            label="여행 만들기"
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            loading={saving}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
