// ============================================================================
// 개인 여행 상세  ·  /groups/personal
//
// GROUP-01 의 '개인 여행' 카드를 누르면 온다. 내 개인 여행 **전부**를
// 모임 상세와 같은 구조(소개 · 연결 계좌 · 여행 탭)로 본다.
// (docs/11_모임정책_v1.md §2-3 · 2026-09-13)
//
// ⚠️ 이 화면은 모임 상세(GROUP-02)가 아니다. 개인 여행에는 groups 행이 없다.
//    (owner_type = PERSONAL · group_id = null) 그래서 여기에는
//      모임 이름 수정 · 멤버 · 모임원 관리 · 모임 생성일
//    이 없다. 가짜로 만들어 보여주지 않는다.
//
// ⚠️ 정적 라우트라 [groupId] 보다 우선한다. (app/groups/new.tsx 와 같은 선례)
//
// ⚠️ 연결 계좌는 **여행 단위** 소유 그대로다. 개인 여행 묶음이 계좌를 갖지 않는다.
//    fund_sources 기준으로 읽어(getPersonalTripAccounts) 모임 상세와 같은 방식으로
//    accountId 별로 묶는다. 직접 입력 여행은 계좌가 없어 목록에 안 나온다.
//
// ⚠️ 탭은 4개 — 준비 중 · 여행 중 · 지난 여행 · 취소됨. '나간 여행' 은 없다.
//    개인 여행은 내가 주인인 독립 여행이라 "그 여행에서 내가 나간다" 는 구조가
//    아니다. (docs/11 §4)
//
// ⚠️ '취소됨' 은 **표시만** 한다. 72시간 되돌리기·만료는 다른 담당의 기능이다.
//    canceled_at 을 읽거나 경과 시간을 계산하지 않는다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 추가하지 않는다. (CLAUDE.md 8장)
//
// 데이터 조회·상태 관리만 한다. UI 는 components/groups/PersonalDetailView.
// ============================================================================
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  AccountTripPickerSheet,
  AllAccountsSheet,
  PersonalDetailView,
  isActiveTripStatus,
  toGroupTripStatusLabel,
  type GroupAccountItem,
  type PersonalDetailData,
} from '@/components/groups';
import type { MyTripItem } from '@/components/my';
import { ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { countryTheme } from '@/lib/constants/countryTheme';
import { COMPANION_TYPE, ENTRY_POINT } from '@/lib/constants/status';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  TRIP_OWNER_TYPE,
  TRIP_OWNER_TYPE_LABEL,
  TRIP_STATUS,
  type TripStatus,
} from '@/lib/constants/status';
import { getPersonalTripAccounts } from '@/lib/supabase/queries/funds';
import { getTripAmountSummaries } from '@/lib/supabase/queries/groups';
import {
  getCanceledTrips,
  getMyPersonalTrips,
  type Trip,
} from '@/lib/supabase/queries/trips';
import { isTripBeforeDeparture } from '@/lib/trip/tripStatus';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenPersonalTrips() {
  const router = useRouter();
  const userId = useCurrentUserId();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [data, setData] = useState<PersonalDetailData | null>(null);
  const [pickingAccount, setPickingAccount] = useState<GroupAccountItem | null>(null);
  const [allAccountsOpen, setAllAccountsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // 살아 있는 개인 여행 · 취소된 개인 여행 · 연결 계좌를 한 번에 읽는다.
      // getMyPersonalTrips 는 CANCELED 를 빼므로(getTrips 와 같은 필터)
      // 취소됨 탭은 MY 가 쓰는 getCanceledTrips 에서 개인 것만 남긴다.
      const [personal, canceledAll, accountRows] = await Promise.all([
        getMyPersonalTrips(userId),
        getCanceledTrips(userId),
        getPersonalTripAccounts(userId),
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

      /**
       * 연결 계좌 — **계좌 기준으로 묶는다.** 모임 상세와 같은 규칙이다.
       * 같은 계좌를 두 여행이 쓰면 한 줄이고 trips 에 둘 다 들어간다.
       * activeTripCount 는 준비 중·여행 중만 센다 — "N개 여행에서 사용 중".
       * ⚠️ 계좌 소유는 여행 단위 그대로다. 여기서 묶는 것은 화면 표시뿐이다.
       */
      const byAccount = new Map<string, GroupAccountItem>();
      for (const row of accountRows) {
        const target =
          byAccount.get(row.accountId) ??
          (() => {
            const created: GroupAccountItem = {
              accountId: row.accountId,
              institutionCode: row.institutionCode,
              maskedAccountNumber: row.maskedAccountNumber,
              trips: [],
              activeTripCount: 0,
            };
            byAccount.set(row.accountId, created);
            return created;
          })();
        target.trips.push({
          tripId: row.tripId,
          destination: row.destination,
          statusLabel: toGroupTripStatusLabel(row.status),
          // 개인 여행은 전부 내 것이다.
          isParticipant: true,
        });
        if (isActiveTripStatus(row.status)) target.activeTripCount += 1;
      }

      const items = personal.map(toItem);
      const byStart = (a: MyTripItem, b: MyTripItem) =>
        (b.startDate ?? '').localeCompare(a.startDate ?? '');

      setData({
        accounts: [...byAccount.values()],
        // ⚠️ 취소 요청 중도 준비 중 탭이다. (app/groups/[groupId] 와 같은 규칙)
        planningTrips: items.filter((item) => isTripBeforeDeparture(item.status)),
        travelingTrips: items.filter((item) => item.status === TRIP_STATUS.TRAVELING),
        pastTrips: items.filter(
          (item) => item.status === TRIP_STATUS.ENDED || item.status === TRIP_STATUS.SETTLED,
        ),
        canceledTrips: canceled.map(toCanceled).sort(byStart),
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

  if (loadState === 'loading' || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: '개인 여행' }} />
        {loadState === 'error' ? (
          <ErrorState message="개인 여행을 불러오지 못했어요." onRetry={() => void load()} />
        ) : (
          <Loading message="개인 여행을 불러오는 중…" />
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '개인 여행' }} />
      <PersonalDetailView
        data={data}
        onPressTrip={(tripId) => router.push(`/trips/${tripId}`)}
        // 계좌를 누르면 어느 여행의 계좌 화면으로 갈지 고른다. 모임 상세와 같다.
        onPressAccount={(account) => setPickingAccount(account)}
        onPressAllAccounts={() => setAllAccountsOpen(true)}
        /*
          준비 중 여행 카드 스와이프 '여행 나가기' — **UI/제스처만 연결한다.** (2026-09-18)
          ⚠️ 실제 나가기·취소 mutation(useLeaveTrip · leave_trip RPC · CXL 흐름)은 다른 담당 범위라
             여기서 부르지 않는다. 제품 의도는 "개인 여행 나가기 = 그 여행 취소 → 취소됨 탭" 이며,
             후속 작업에서 여행 홈·모임 상세와 같은 useLeaveTrip 을 연결한다. [검토 필요]
        */
        onPressLeaveTrip={(trip) =>
          Alert.alert(
            '여행 나가기',
            `${trip.destination ?? '이 여행'} 나가기는 아직 연결 전이에요. 여행 홈의 설정에서 취소할 수 있어요.`,
          )
        }
        // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint 를 읽어 기록한다. (모임 상세와 같다)
        // ⚠️ entryPoint 는 기존 값(group_detail · 모임 탭의 상세 화면군)을 쓴다 — ENTRY_POINT 는 분석 축이라 임의로 늘리지 않는다.
        onPressCreateTrip={() =>
          router.push(
            `/trips/new/owner?entryPoint=${ENTRY_POINT.GROUP_DETAIL}&preselectedCompanion=${COMPANION_TYPE.PERSONAL}`,
          )
        }
      />

      <AccountTripPickerSheet
        account={pickingAccount}
        onClose={() => setPickingAccount(null)}
        onSelectTrip={(tripId) => {
          setPickingAccount(null);
          // ⚠️ fromGroupId 를 넘기지 않는다. 모임이 없다. 뒤로가기는 여행 자금 화면으로.
          router.push(`/trips/${tripId}/funds/connect`);
        }}
      />

      <AllAccountsSheet
        visible={allAccountsOpen}
        accounts={data.accounts}
        onClose={() => setAllAccountsOpen(false)}
        onSelectTrip={(tripId) => {
          setAllAccountsOpen(false);
          router.push(`/trips/${tripId}/funds/connect`);
        }}
      />
    </>
  );
}
