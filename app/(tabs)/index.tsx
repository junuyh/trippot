// ============================================================================
// HOME-01 · / · MVP
// 기준 문서: docs/09_IA_v2.md §1, docs/02_유저플로우_v1.md §1,
//            docs/03_요구사항정의서_v1.md REQ-HOME-001 / REQ-HOME-002 / POL-NAV-001
//
// 2026-09-03 개편 — 대시보드를 걷어내고 IA §1 구조로 되돌렸다.
//   1-1. 진행 중인 여행 (사진 배너)
//   1-2. 지난 여행 (작은 사진 카드 가로 슬라이드)
//   1-4. 새 여행 만들기
//
// 왜 되돌렸는가
//   9/02 대시보드(메인 카드·지금 챙겨야 할 것·여행자금 현황·모임 바로가기·
//   지난 여행 인사이트)는 화면 대부분이 금액·준비율·부족 금액이었다.
//   홈이 "어디 가지?" 가 아니라 "얼마 있지?" 에 답하는 화면이 되어
//   계좌관리 앱·가계부처럼 만들지 않는다는 CLAUDE.md 2장에 어긋났다.
//   금액은 여행 준비 홈(TRIP-HOME-01)에서 본다.
//
//   그리고 개편 전 홈은 종료 여행을 아예 그리지 않아
//   REQ-HOME-001(Must, "홈에서 진행 중 여행과 종료 여행을 구분해 보여준다")을
//   채우지 못했다. 지난 여행을 보려면 마이 탭까지 네 번을 눌러야 했다.
//
// ⚠️ 이 개편으로 사라진 track() 호출은 없다. 이 화면의 로그는
//    useScreenView(SCREENS.HOME) 하나뿐이었다. (CLAUDE.md 13장 로그 보호)
//
// ⚠️ 지운 UI 컴포넌트 파일(NextTripCard·ActionRequiredSection·
//    TravelFundSummary·PastTripInsight·GroupShortcutList)은 남겨 두었다.
//    요청받지 않은 삭제를 하지 않는다. (CLAUDE.md 1장) 지금은 쓰는 곳이 없다.
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/home/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// 여기서 <Stack.Screen options={{ title }} /> 을 쓰면 Tabs 스크린 옵션을 덮어써서
// 하단 탭 라벨까지 바뀐다.
// ============================================================================
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  HomeEmpty,
  HomeError,
  HomeLoading,
  HomeView,
  type EndedTripCardData,
  type HomeEmptyVariant,
  type OngoingTripCardData,
} from '@/components/home';
import { daysUntil } from '@/components/home/format';
import { SCREENS } from '@/lib/analytics/events';
import { countryTheme } from '@/lib/constants/countryTheme';
import { destinationPhoto } from '@/lib/constants/destinationPhoto';
import { findDestinationByName } from '@/lib/constants/destinations';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  ENTRY_POINT,
  TRIP_OWNER_TYPE,
  TRIP_STATUS,
  type EntryPoint,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getMyGroups, type Group } from '@/lib/supabase/queries/groups';
import { getTripsWithSummary, type TripWithSummary } from '@/lib/supabase/queries/trips';
import { getUserProfile, type UserProfile } from '@/lib/supabase/queries/users';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * 홈에 보여줄 지난 여행 개수.
 *
 * 홈은 훑는 자리다. 전체 목록은 MY-02(/me/trips)가 맡는다.
 * 가로 슬라이드에 두 장씩 보이므로 4개면 두 번 넘겨서 다 본다.
 * 여기서 다 보여주면 홈이 여행 목록 페이지가 된다. (CLAUDE.md 2장)
 */
const HOME_PAST_TRIP_LIMIT = 4;

export default function ScreenHOME01() {
  useScreenView(SCREENS.HOME);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [trips, setTrips] = useState<TripWithSummary[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    // ⚠️ 여기서 setLoadState('loading') 을 하지 않는다. (2026-09-03)
    //    아래 useFocusEffect 때문에 탭에 들어올 때마다 load 가 도는데,
    //    그때마다 loading 으로 바꾸면 여행 카드가 사라졌다 스피너가 번쩍이고
    //    다시 나타난다. 이미 보고 있던 화면이 매번 깜빡이는 셈이라 더 나쁘다.
    //    첫 진입은 useState 초기값 'loading' 이 처리한다.
    //    (모임·마이페이지·커뮤니티 탭도 같은 방식이다)
    try {
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      // 모임은 카드에 '개인 / 모임명' 을 쓰기 위해 조회한다. (docs/09_IA_v2.md §1-1, §1-2)
      // 모임 바로가기 섹션은 이번 개편에서 뺐다.
      const [nextTrips, nextGroups, nextProfile] = await Promise.all([
        getTripsWithSummary(userId),
        getMyGroups(userId),
        getUserProfile(userId),
      ]);
      setTrips(nextTrips);
      setGroups(nextGroups);
      setProfile(nextProfile);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  // ⚠️ useEffect 가 아니라 useFocusEffect 다. (2026-09-03)
  //    탭은 화면을 살려 두기 때문에(unmountOnBlur 없음) 한 번 만들어지면
  //    useEffect 가 다시 돌지 않는다. 그래서 여행을 만들고 홈으로 돌아와도
  //    새 여행이 목록에 없고, 결산을 끝내고 와도 지난 여행 금액이 그대로였다.
  //    모임·마이페이지·커뮤니티 탭과 같은 방식으로 맞춘다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function handlePressTrip(tripId: string) {
    // 진행/종료 모두 같은 라우트다. 도착 화면이 trip.status 로 분기한다. (docs/04_v3 §5)
    router.push(`/trips/${tripId}`);
  }

  function handlePressSettle(tripId: string) {
    // 결산 전 지난 여행 카드의 '결산하기'. 종료 여행 홈을 거치지 않고 바로 보낸다.
    // 여행 기간이 끝나면 결산을 유도한다는 정책이 홈에서 여기 하나로 남았다. (CLAUDE.md 3장)
    router.push(`/trips/${tripId}/settlement`);
  }

  function handlePressCreateTrip(entryPoint: EntryPoint) {
    // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
    // 홈에서도 track() 하면 trip_create_started 가 두 번 쌓여 퍼널이 부풀려진다.
    // (docs/README.md §5 17번 — HOME-01 담당자가 param 을 붙여달라는 요청)
    router.push(`/trips/new/owner?entryPoint=${entryPoint}`);
  }

  if (loadState === 'loading') {
    return <HomeLoading />;
  }

  if (loadState === 'error') {
    return <HomeError message="홈 정보를 불러오지 못했어요." onRetry={() => void load()} />;
  }

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  // trips.status / owner_type 은 DB 가 text + CHECK 라 생성 타입이 string 이다.
  // 화면에서 쓰기 전에 상수 집합으로 좁힌다. 모르는 값이면 그 행을 그리지 않는다. (Crash 금지)
  function toTripStatus(value: string): TripStatus | null {
    const known = Object.values(TRIP_STATUS) as string[];
    return known.includes(value) ? (value as TripStatus) : null;
  }

  function toBase(trip: TripWithSummary, status: TripStatus) {
    // 국기·영문명·공항코드·랜드마크 사진은 목적지 상수에서 온다.
    // 모르는 목적지면 대체값을 쓴다. 사진은 대체값 없이 null 이다.
    const meta = findDestinationByName(trip.destination);
    return {
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status,
      ownerType:
        trip.owner_type === TRIP_OWNER_TYPE.GROUP
          ? TRIP_OWNER_TYPE.GROUP
          : TRIP_OWNER_TYPE.PERSONAL,
      groupName: trip.group_id ? (groupNameById.get(trip.group_id) ?? null) : null,
      destinationEn: meta?.nameEn ?? (trip.destination ?? 'TRIP').toUpperCase(),
      flag: meta?.flag ?? '🌍',
      airportCode: meta?.airportCode ?? '—',
      photoUrl: destinationPhoto(meta?.code)?.url ?? null,
      countryKo: meta?.countryKo ?? null,
      theme: countryTheme(meta?.countryKo),
    };
  }

  // ── 1-1. 진행 중인 여행 ───────────────────────────────────────────────────
  // 출발이 가까운 순서로 둔다. 날짜가 없는 여행은 뒤로 보낸다.
  const ongoingTrips: OngoingTripCardData[] = trips
    .flatMap((trip) => {
      const status = toTripStatus(trip.status);
      if (status !== TRIP_STATUS.PLANNING && status !== TRIP_STATUS.TRAVELING) return [];
      return [
        {
          ...toBase(trip, status),
          targetAmount: trip.targetAmount,
          currentAmount: trip.currentAmount,
        },
      ];
    })
    .sort((a, b) => {
      // 지금 여행 중인 여행이 가장 급하다. 그다음이 출발일 순이다.
      const travelingFirst =
        Number(b.status === TRIP_STATUS.TRAVELING) - Number(a.status === TRIP_STATUS.TRAVELING);
      if (travelingFirst !== 0) return travelingFirst;
      // 날짜 없는 여행을 뒤로 보내려고 빈 값을 가장 큰 문자열로 취급한다.
      return (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999');
    });

  // ── 1-2. 지난 여행 ────────────────────────────────────────────────────────
  // 최근에 끝난 여행이 위다. 종료일이 없으면 맨 뒤로 보낸다.
  const pastTrips: EndedTripCardData[] = trips
    .flatMap((trip) => {
      const status = toTripStatus(trip.status);
      if (status !== TRIP_STATUS.ENDED && status !== TRIP_STATUS.SETTLED) return [];
      return [{ ...toBase(trip, status), finalAmount: trip.finalAmount }];
    })
    .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));

  // 가장 가까운 여행까지 남은 일수. 인사 문구에 쓴다.
  const nearest = ongoingTrips.find((trip) => trip.startDate !== null) ?? null;

  // 진행 중 여행이 없을 때 무슨 문구를 쓸지 고른다. (docs/03 REQ-HOME-002)
  // 여행을 한 번도 만들지 않았으면 first, 기록이 있으면 return 이다.
  const emptyVariant: HomeEmptyVariant = trips.length === 0 ? 'first' : 'return';

  // 여행이 하나도 없을 때만 전체 빈 상태를 보여준다.
  if (trips.length === 0) {
    return <HomeEmpty onCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.EMPTY_STATE)} />;
  }

  return (
    <HomeView
      userName={profile?.name ?? null}
      daysToNextTrip={daysUntil(nearest?.startDate ?? null)}
      ongoingTrips={ongoingTrips}
      emptyVariant={emptyVariant}
      pastTrips={pastTrips.slice(0, HOME_PAST_TRIP_LIMIT)}
      hasMorePastTrips={pastTrips.length > HOME_PAST_TRIP_LIMIT}
      onPressTrip={handlePressTrip}
      onPressSettle={handlePressSettle}
      onPressCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.HOME)}
      onPressAllPastTrips={() => router.push('/me/trips')}
    />
  );
}
