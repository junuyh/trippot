// ============================================================================
// 개인 여행 상세  ·  /groups/personal
//
// GROUP-01 의 '개인 여행' 카드를 누르면 온다. 내 개인 여행 **전부**를 상태별로 본다.
// (docs/11_모임정책_v1.md §2-3 · 2026-09-12)
//
// ⚠️ 이 화면은 모임 상세(GROUP-02)가 아니다. 개인 여행에는 groups 행이 없다.
//    (owner_type = PERSONAL · group_id = null) 그래서 여기에는
//      모임 이름 수정 · 멤버 · 모임원 관리 · 연결 계좌 묶음 · 모임 생성일
//    이 없다. 가짜로 만들어 보여주지 않는다.
//
// ⚠️ 정적 라우트라 [groupId] 보다 우선한다. (app/groups/new.tsx 와 같은 선례)
//    'personal' 이 모임 id 로 잘못 잡히지 않는다.
//
// 탭은 4개다 — 준비 중 · 여행 중 · 지난 여행 · 취소됨. '나간 여행' 은 없다.
//   개인 여행은 내가 주인인 독립 여행이라 "그 여행에서 내가 나간다" 는 구조가
//   아니다. 외부인이 승인되어 모임으로 바뀐 뒤에 나가면 그때는 실제 모임의
//   '나간 여행' 에서 다룬다. (docs/11 §4)
//
// ⚠️ '취소됨' 은 **표시만** 한다. 72시간 되돌리기·만료는 다른 담당의 기능이다.
//    여기서 canceled_at 을 읽거나 경과 시간을 계산하지 않는다. 카드를 누르면
//    MY-02 와 같이 여행 홈으로 간다 — 그 화면이 취소 상태를 어떻게 다룰지는
//    그쪽 담당이다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 추가하지 않는다. (CLAUDE.md 8장)
//
// 데이터 조회·상태 관리만 한다. UI 는 components/my 의 MyTripListView 를 그대로 쓴다.
// GROUP-02 를 복사하지 않는다.
// ============================================================================
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import {
  MyTripListView,
  MY_TRIP_FILTER_TABS,
  type MyTripFilter,
  type MyTripItem,
} from '@/components/my';
import { ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  ENTRY_POINT,
  TRIP_OWNER_TYPE,
  TRIP_OWNER_TYPE_LABEL,
  TRIP_STATUS,
  type TripStatus,
} from '@/lib/constants/status';
import { getTripAmountSummaries } from '@/lib/supabase/queries/groups';
import {
  getCanceledTrips,
  getMyPersonalTrips,
  type Trip,
} from '@/lib/supabase/queries/trips';

type LoadState = 'loading' | 'ready' | 'error';

/** 개인 여행 상세의 탭. MY-02 의 5탭에서 '나간 여행' 만 뺀다. */
const PERSONAL_TABS = MY_TRIP_FILTER_TABS.filter((tab) => tab.value !== 'left');

export default function ScreenPersonalTrips() {
  const router = useRouter();
  const userId = useCurrentUserId();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<MyTripFilter>('planning');
  const [byFilter, setByFilter] = useState<Record<MyTripFilter, MyTripItem[]>>({
    planning: [],
    traveling: [],
    past: [],
    canceled: [],
    left: [],
  });

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // 살아 있는 개인 여행과 취소된 개인 여행을 따로 읽는다.
      // getMyPersonalTrips 는 CANCELED 를 빼므로(getTrips 와 같은 필터)
      // 취소됨 탭은 MY 가 쓰는 getCanceledTrips 에서 개인 것만 남긴다.
      const [personal, canceledAll] = await Promise.all([
        getMyPersonalTrips(userId),
        getCanceledTrips(userId),
      ]);
      const canceled = canceledAll.filter(
        (trip) => trip.owner_type === TRIP_OWNER_TYPE.PERSONAL,
      );

      // 카드에 금액·진행률을 그리려면 세 테이블이 더 필요하다. GROUP-02 와 같다.
      const summaries = await getTripAmountSummaries(personal.map((trip) => trip.id));

      /**
       * DB 행을 MY 여행 카드가 받는 모양으로 바꾼다. app/me/trips.tsx 와 같은 규칙.
       * ownerLabel 은 '개인' — 시스템 표시명이지 groups.name 이 아니다.
       */
      const toItem = (trip: Trip): MyTripItem => {
        const meta = findDestinationByName(trip.destination);
        const theme = countryTheme(meta?.countryKo);
        const amount = summaries.get(trip.id);
        return {
          tripId: trip.id,
          destination: trip.destination,
          flag: meta?.flag ?? '🌍',
          startDate: trip.start_date,
          endDate: trip.end_date,
          status: trip.status as TripStatus,
          ownerLabel: TRIP_OWNER_TYPE_LABEL.PERSONAL,
          currentAmount: amount?.currentAmount ?? null,
          targetAmount: amount?.targetAmount ?? null,
          finalAmount: amount?.finalAmount ?? null,
          color: theme.primary,
          colorSoft: theme.primarySoft,
        };
      };

      // 취소된 여행은 금액을 넣지 않는다. 확정된 값이 아니다. (MY-02 와 같다)
      const toCanceled = (trip: Trip): MyTripItem => ({
        ...toItem(trip),
        currentAmount: null,
        targetAmount: null,
        finalAmount: null,
      });

      const items = personal.map(toItem);
      const byStart = (a: MyTripItem, b: MyTripItem) =>
        (b.startDate ?? '').localeCompare(a.startDate ?? '');

      setByFilter({
        planning: items.filter((item) => item.status === TRIP_STATUS.PLANNING),
        traveling: items.filter((item) => item.status === TRIP_STATUS.TRAVELING),
        past: items.filter(
          (item) => item.status === TRIP_STATUS.ENDED || item.status === TRIP_STATUS.SETTLED,
        ),
        canceled: canceled.map(toCanceled).sort(byStart),
        // 개인 여행에는 '나간 여행' 이 없다. 탭도 없다. 타입을 채우기 위한 빈 값이다.
        left: [],
      });
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [userId]);

  // 여행을 만들거나 고치고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loadState === 'loading') {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '개인 여행' }} />
        <Loading message="개인 여행을 불러오는 중…" />
      </View>
    );
  }
  if (loadState === 'error') {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '개인 여행' }} />
        <ErrorState message="개인 여행을 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '개인 여행' }} />
      <MyTripListView
        trips={byFilter[filter]}
        filter={filter}
        onChangeFilter={setFilter}
        tabs={PERSONAL_TABS}
        onPressTrip={(tripId) => router.push(`/trips/${tripId}`)}
        onPressCreateTrip={() =>
          router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.GROUP_DETAIL}`)
        }
      />
    </>
  );
}
