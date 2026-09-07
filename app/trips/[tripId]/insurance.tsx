// ============================================================================
// INSURANCE-01 · 보험 제휴 안내 (BM 1)
//
// 이 화면은 데이터 조회·상태 관리·로그 기록만 한다. 보이는 것은
// components/insurance/InsurancePartnerList.tsx 가 그린다. (CLAUDE.md 9장)
//
// ============================================================================
// 이 화면이 존재하는 이유
// ============================================================================
//
//   BM 1(여행자보험 제휴 수수료)에서 우리가 볼 수 있는 마지막 지점은
//   **제휴사로 넘어가는 클릭**이다. 그 뒤 가입 여부는 제휴사만 안다.
//
//     insurance_cta_clicked  파라미터 estimated_premium, placement
//     (docs/06_이벤트로그정의서_v3.md §7-7)
//
//   "예산 화면 도달자 중 N% 가 보험 견적을 확인했다" 가 이 프로젝트에서
//   제시할 수 있는 유일한 수익화 숫자다. 그래서 placement 를 반드시 싣는다.
//   어느 자리의 배너가 실제로 전환을 만드는지 모르면 BM 을 못 키운다.
//
// ⚠️ **화면 진입이 아니라 제휴사로 넘어갈 때 쏜다.** 진입에서 쏘면
//    "보험료가 궁금해 눌러본 사람" 과 "실제로 견적을 본 사람" 이 한 통에 섞인다.
//
// ⚠️ 제휴사는 전부 가상이고 실제 이동할 곳이 없다. 지금은 안내 시트만 띄운다.
//    **로그는 실제 제휴 때와 같은 자리에서 쏜다.** 그래야 제휴가 붙는 날
//    이동 코드만 갈아 끼우면 되고, 그전까지 쌓인 전환 데이터도 이어진다.
//
// ⚠️ useScreenView 를 부르지 않는다. lib/analytics/events.ts 의 SCREENS 에
//    이 화면 값이 없다. docs/06 §7-0 이 "화면 구현 시점에 다음 버전으로
//    추가한다" 고 정해 뒀다. 이벤트 상수를 임의로 만들지 않는다. (CLAUDE.md 8장)
//    → docs/06 을 v4 로 올릴지 사람에게 확인한 뒤 붙인다.
// ============================================================================
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { InsurancePartnerList } from '@/components/insurance/InsurancePartnerList';
import { TripHomeButton } from '@/components/navigation/TripHomeButton';
import { BottomSheet, EmptyState, ErrorState, Loading } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { EVENTS } from '@/lib/analytics/events';
import { findDestinationByName } from '@/lib/constants/destinations';
import { INSURANCE_PARTNERS } from '@/lib/constants/insurancePartners';
import {
  CATEGORY_CODE,
  INSURANCE_COVERAGE,
  type InsuranceCoverage,
} from '@/lib/constants/status';
import { buildInsuranceQuote, type PartnerQuote } from '@/lib/insurance/quote';
import {
  getBudgetByTripId,
  getBudgetCategories,
} from '@/lib/supabase/queries/budgets';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

/**
 * 어디서 들어왔는가. insurance_cta_clicked.placement 로 그대로 나간다.
 *
 * ⚠️ 정의서가 정한 값은 'trip_home' 과 'budget_detail' 둘뿐이다.
 *    새 진입점을 만들면 값을 임의로 늘리지 말고 정의서부터 고친다.
 */
const PLACEMENT = {
  TRIP_HOME: 'trip_home',
  BUDGET_DETAIL: 'budget_detail',
} as const;
type Placement = (typeof PLACEMENT)[keyof typeof PLACEMENT];

function toPlacement(raw: string | string[] | undefined): Placement {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === PLACEMENT.BUDGET_DETAIL ? PLACEMENT.BUDGET_DETAIL : PLACEMENT.TRIP_HOME;
}

type Loaded = {
  trip: Trip;
  /** 예산에 잡아 둔 여행자보험 금액. 예산이 없으면 null */
  budgetAmount: number | null;
};

export default function ScreenINSURANCE01() {
  const { tripId, placement: placementParam } = useLocalSearchParams<{
    tripId: string;
    placement?: string;
  }>();
  const placement = toPlacement(placementParam);

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const [coverage, setCoverage] = useState<InsuranceCoverage>(INSURANCE_COVERAGE.STANDARD);
  const [leaving, setLeaving] = useState<PartnerQuote | null>(null);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const trip = await getTripById(tripId);
      if (!trip) {
        setNotFound(true);
        return;
      }

      /*
        예산은 없을 수 있다. 여행을 만들 때 예산을 안 짠 경우다.
        그렇다고 이 화면이 못 뜰 이유는 없다. 견적은 여행 정보만으로 낸다.
        비교 줄만 빠진다.
      */
      let budgetAmount: number | null = null;
      try {
        const budget = await getBudgetByTripId(tripId);
        if (budget) {
          const categories = await getBudgetCategories(budget.id);
          budgetAmount =
            categories.find((c) => c.category_code === CATEGORY_CODE.INSURANCE)
              ?.planned_amount ?? null;
        }
      } catch {
        // 예산 조회 실패로 화면을 막지 않는다. 비교 줄만 없는 채로 간다.
        budgetAmount = null;
      }

      setData({ trip, budgetAmount });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const quote = useMemo(() => {
    if (!data?.trip.start_date || !data.trip.end_date) return null;
    const meta = findDestinationByName(data.trip.destination);
    return buildInsuranceQuote(
      {
        destinationCode: meta?.code ?? null,
        region: meta?.region ?? null,
        startDate: data.trip.start_date,
        endDate: data.trip.end_date,
        headcount: data.trip.headcount,
        coverage,
      },
      INSURANCE_PARTNERS,
    );
  }, [coverage, data]);

  /**
   * 제휴사로 넘어간다. **BM 1 의 유일한 전환 지점이다.**
   *
   * ⚠️ 로그를 먼저 남기고 이동한다. 이동 뒤에 남기면 이탈한 사용자가 빠진다.
   */
  const handlePressPartner = useCallback(
    (row: PartnerQuote) => {
      track(EVENTS.INSURANCE_CTA_CLICKED, {
        estimated_premium: row.totalPremium,
        placement,
        /*
          ⚠️ trip_id 를 명시로 넘긴다. track.ts 의 setTripContext 가 앱 어디에서도
             불리지 않아 공통 파라미터의 trip_id 가 항상 null 이다.
             전환이 어느 여행에서 났는지 모르면 "목적지·일정별 보험 전환율" 을
             못 낸다. BM 1 에서 가장 먼저 보고 싶은 쪼개기가 그것이다.
             (setTripContext 미호출 자체는 이 화면 밖의 일이라 손대지 않았다)
        */
        trip_id: data?.trip.id ?? null,
      });
      setLeaving(row);
    },
    [data?.trip.id, placement],
  );

  // ── 4상태 ─────────────────────────────────────────────────────────────
  const header = (
    <Stack.Screen
      options={{
        title: '여행자보험',
        headerRight: () => <TripHomeButton tripId={tripId as string} />,
      }}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        {header}
        <Loading message="불러오는 중…" />
      </View>
    );
  }
  if (notFound || !data) {
    return (
      <View className="flex-1 bg-white">
        {header}
        <EmptyState
          icon="shield-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
        />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 bg-white">
        {header}
        <ErrorState message="불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }
  /*
    일정이 없으면 견적을 낼 수 없다. 보험료는 일수로 정해지기 때문이다.
    빈 화면 대신 무엇이 없어서 못 하는지 말하고 일정을 채우게 보낸다.
  */
  if (!quote) {
    return (
      <View className="flex-1 bg-white">
        {header}
        <EmptyState
          icon="calendar-outline"
          title="일정을 먼저 정해 주세요"
          description="보험료는 여행 일수로 계산해요. 출발일과 도착일이 있어야 견적을 낼 수 있어요."
        />
      </View>
    );
  }

  const destination = data.trip.destination ?? '여행';

  return (
    <View className="flex-1 bg-white">
      {header}

      <ScrollView contentContainerClassName="px-5 pb-12 pt-5">
        <Text className="text-[22px] font-bold leading-7 text-gray-900">
          {destination} {quote.days}일,{'\n'}
          {quote.headcount}명의 보험료예요
        </Text>
        <Text className="mt-1.5 text-xs text-gray-500">{quote.formula} 기준</Text>

        <View className="mt-5">
          <InsurancePartnerList
            quote={quote}
            coverage={coverage}
            onChangeCoverage={setCoverage}
            onPressPartner={handlePressPartner}
            budgetAmount={data.budgetAmount}
          />
        </View>
      </ScrollView>

      {/*
        ⚠️ 실제 제휴가 붙으면 이 시트 대신 제휴사 링크로 보낸다.
           로그는 이미 handlePressPartner 에서 남겼으므로 여기는 안 건드린다.
      */}
      <BottomSheet
        visible={leaving !== null}
        onClose={() => setLeaving(null)}
        title={leaving ? `${leaving.partner.emoji} ${leaving.partner.name}` : ''}
      >
        <View className="gap-3 px-5 pb-6 pt-2">
          <Text className="text-sm leading-5 text-gray-600">
            아직 실제 제휴사와 연결되지 않았어요. 서비스가 열리면 여기서 바로
            가입 화면으로 이동해요.
          </Text>
          <View className="gap-1 rounded-xl bg-gray-50 p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-500">예상 보험료</Text>
              <Text className="text-sm font-bold text-gray-900">
                {leaving ? `${leaving.totalPremium.toLocaleString('ko-KR')}원` : ''}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-gray-500">보장 범위</Text>
              <Text className="text-xs font-semibold text-gray-700">
                {coverage === INSURANCE_COVERAGE.BASIC
                  ? '기본 보장'
                  : coverage === INSURANCE_COVERAGE.PLUS
                    ? '고액 보장'
                    : '표준 보장'}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
