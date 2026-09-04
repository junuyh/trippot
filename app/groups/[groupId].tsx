// ============================================================================
// GROUP-02 모임 상세 · /groups/:groupId · MVP
// 기준: docs/09_IA_v1.md §3-2, docs/03_요구사항정의서_v1.md REQ-GROUP-001,
//       docs/04_화면목록_v3.md GROUP-02
//
// 담는 것: 모임 기본정보 · 멤버 · 연결 계좌 · 진행 중인 여행 · 지난 여행
//          · [이 모임으로 새 여행 만들기]
// 빼는 것: 누적 여행 유형 / 소비 특성 (IA 가 [고도화] 로 표시)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/groups/ 에 있다. (CLAUDE.md 9장)
//
// TODO: [이 모임으로 새 여행 만들기] 는 지금 entryPoint 만 넘긴다.
//       현재 모임을 TRIP-01 에서 기본 선택하려면 groupId 도 넘겨야 하는데,
//       app/trips/new/owner.tsx 가 groupId param 을 받지 않는다.
//       그 파일은 L 담당이라 여기서 고치지 않는다. 담당자 요청 후 &groupId= 를 붙인다.
// ============================================================================
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { GroupDetailView, type GroupDetailData } from '@/components/groups';
import type { MyTripItem } from '@/components/my';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import {
  ENTRY_POINT,
  GROUP_MEMBER_ROLE,
  TRIP_STATUS,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import { getGroupAccounts } from '@/lib/supabase/queries/funds';
import {
  getGroupById,
  getGroupMemberCount,
  getGroupMembers,
  getGroupTrips,
  getTripAmountSummaries,
} from '@/lib/supabase/queries/groups';

type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

export default function ScreenGROUP02() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  useScreenView(SCREENS.GROUP_DETAIL);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [group, setGroup] = useState<GroupDetailData | null>(null);

  const load = useCallback(async () => {
    if (!groupId) {
      setLoadState('notFound');
      return;
    }

    setLoadState('loading');
    try {
      // 모임을 먼저 확인한다. 없는 모임이면 나머지를 조회할 이유가 없다.
      // getGroupById 는 maybeSingle 이라 잘못된 groupId 에도 던지지 않고 null 을 준다.
      const found = await getGroupById(groupId);
      if (!found) {
        setLoadState('notFound');
        return;
      }

      const [memberCount, members, accounts, trips] = await Promise.all([
        // 인원 수는 GROUP-01 카드와 같은 기준을 쓴다.
        // ⚠️ getGroupMembers() 는 탈퇴 회원까지 추가로 걸러서 members.length 와
        //    숫자가 다를 수 있다. 이번 화면에서 임의로 맞추지 않는다. (후속 확인)
        getGroupMemberCount(groupId),
        getGroupMembers(groupId),
        getGroupAccounts(groupId),
        // 진행 중(PLANNING·TRAVELING) / 지난(ENDED·SETTLED) 분류는 쿼리가 한다.
        // HOME-01 과 같은 기준이다.
        getGroupTrips(groupId),
      ]);

      // 카드에 금액·진행률을 그리려면 세 테이블이 더 필요하다.
      // getTripsWithSummary() 와 같은 칼럼을 읽어 MY 목록과 값이 어긋나지 않는다.
      const all = [...trips.ongoing, ...trips.past];
      const summaries = await getTripAmountSummaries(all.map((trip) => trip.id));

      /**
       * DB 행을 MY 여행 카드가 받는 모양으로 바꾼다.
       *
       * ⚠️ 변환 규칙을 새로 만들지 않는다. app/me/trips.tsx 가 하는 것과 같다.
       *    국기·색은 findDestinationByName → countryTheme 경로 그대로다.
       *
       * ⚠️ ownerLabel 은 이 모임 이름이다. 모임 상세라 전부 이 모임의 여행이다.
       */
      const toItem = (trip: (typeof all)[number]): MyTripItem => {
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
          ownerLabel: found.name,
          currentAmount: amount?.currentAmount ?? null,
          targetAmount: amount?.targetAmount ?? null,
          finalAmount: amount?.finalAmount ?? null,
          color: theme.primary,
          colorSoft: theme.primarySoft,
        };
      };

      const items = all.map(toItem);

      setGroup({
        groupId: found.id,
        name: found.name,
        createdAt: found.created_at,
        memberCount,
        members: members.map((member) => ({
          memberId: member.id,
          name: member.user.name,
          isOwner: member.role === GROUP_MEMBER_ROLE.OWNER,
        })),
        accounts: accounts.map((account) => ({
          accountId: account.id,
          maskedAccountNumber: account.masked_account_number,
        })),
        // ⚠️ trips.status 로 가른다. /me/trips 목록이 쓰는 기준과 같다.
        //    (app/me/trips.tsx) 날짜로 다시 판정하면 같은 여행이 두 화면에서
        //    다른 칸에 들어갈 수 있다.
        planningTrips: items.filter((item) => item.status === TRIP_STATUS.PLANNING),
        travelingTrips: items.filter((item) => item.status === TRIP_STATUS.TRAVELING),
        pastTrips: items.filter(
          (item) => item.status === TRIP_STATUS.ENDED || item.status === TRIP_STATUS.SETTLED,
        ),
      });
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [groupId]);

  // 여행을 만들고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // 진행 중이든 지난 여행이든 같은 곳으로 간다.
  // 도착 화면이 trip.status 로 TRIP-HOME-01 / TRIP-HOME-02 를 가른다. (docs/04_v3 §5)
  function handlePressTrip(tripId: string) {
    router.push(`/trips/${tripId}`);
  }

  function handlePressCreateTrip() {
    // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
    // 두 곳에서 track 하면 trip_create_started 가 두 번 쌓여 퍼널이 부풀려진다.
    router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.GROUP_DETAIL}`);
  }

  if (loadState === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <Loading message="모임을 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'notFound') {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <EmptyState
          icon="people-outline"
          title="모임을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 모임이에요."
          actionLabel="모임 목록으로"
          onAction={() => router.replace('/groups')}
        />
      </>
    );
  }

  if (loadState === 'error' || !group) {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <ErrorState message="모임 정보를 불러오지 못했어요." onRetry={() => void load()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
      <GroupDetailView
        group={group}
        onPressTrip={handlePressTrip}
        onPressCreateTrip={handlePressCreateTrip}
      />
    </>
  );
}
