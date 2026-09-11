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
  type DestinationSuggestion,
  type DiscoverDestination,
  type EndedTripCardData,
  type HomeEmptyVariant,
  type OngoingTripCardData,
} from '@/components/home';
import { daysUntil } from '@/components/home/format';
import { SCREENS } from '@/lib/analytics/events';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { countryTheme } from '@/lib/constants/countryTheme';
import { destinationPhoto } from '@/lib/constants/destinationPhoto';
import { destinationEditorial } from '@/lib/constants/destinationEditorial';
import { DESTINATIONS, findDestinationByName } from '@/lib/constants/destinations';
import {
  ENTRY_POINT,
  TRIP_OWNER_TYPE,
  TRIP_STATUS,
  type EntryPoint,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getPostDestinations,
  type PostDestinationCount,
} from '@/lib/supabase/queries/community';
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

/**
 * 신규 사용자 홈 배너에 돌릴 여행지 수.
 *
 * 이 서비스가 다루는 나라가 8개다. 나라마다 한 곳씩 전부 보여준다.
 * 나라가 늘면 이 값도 함께 올린다. (lib/constants/destinations.ts)
 */
const SUGGESTION_LIMIT = 8;

/**
 * 홈 '여행자들은 이렇게 다녀왔어요' 에 보여줄 여행지 수.
 *
 * 태그가 한 화면에 두 장 보이므로 3번 넘겨서 다 본다.
 * 여기서 다 보여주면 홈이 여행지 목록 페이지가 된다. (CLAUDE.md 2장)
 */
const DISCOVER_LIMIT = 6;

/**
 * 여행이 하나도 없는 사람에게 보여줄 여행지 후보. (2026-09-09 개편)
 *
 * 상수만 읽어 만드는 부분이다. 렌더마다 다시 계산할 이유가 없어 모듈에서
 * 한 번 만든다. 배지는 커뮤니티 글 수에서 나오는 조회 결과라서
 * 아래 컴포넌트에서 붙인다.
 *
 * ⚠️ **나라마다 한 곳씩만 고른다.** 목적지 상수는 나라별로 묶여 있어서 앞에서부터
 *    자르면 일본 도시 세 개가 연달아 나온다. "어디 가지?" 에 답이 되려면 후보가
 *    서로 달라야 한다.
 *
 * ⚠️ **사람이 쓴 소개가 있는 곳만 넣는다.** (lib/constants/destinationEditorial)
 *    소개 없이 도시 이름만 있는 카드는 "여기가 어떤 곳인가" 에 답하지 못한다.
 *    소개를 쓴 목적지가 늘면 후보도 자동으로 늘어난다.
 *
 * ⚠️ 사진(destinationHeroPhoto)을 더 이상 쓰지 않는다. 카드가 사진 배너에서
 *    보딩패스로 바뀌었다. 상수 파일은 지우지 않았다. (CLAUDE.md 1장)
 */
const HOME_SUGGESTION_BASE = (() => {
  const usedCountries = new Set<string>();
  const picked: Omit<DestinationSuggestion, 'badge'>[] = [];

  for (const destination of DESTINATIONS) {
    if (picked.length >= SUGGESTION_LIMIT) break;
    if (usedCountries.has(destination.countryKo)) continue;

    const editorial = destinationEditorial(destination.code);
    if (!editorial) continue;

    usedCountries.add(destination.countryKo);
    picked.push({
      code: destination.code,
      nameKo: destination.nameKo,
      nameEn: destination.nameEn,
      countryKo: destination.countryKo,
      airportCode: destination.airportCode,
      flag: destination.flag,
      blurb: editorial.blurb,
      days: editorial.days,
      theme: countryTheme(destination.countryKo),
    });
  }

  return picked;
})();

export default function ScreenHOME01() {
  // 로그인한 사용자. 가드가 미로그인 상태를 막고 있어 여기서는 항상 값이 있다.
  // 미리보기 모드(__DEV__)에서는 시드 사용자다. (lib/auth/AuthProvider)
  const userId = useCurrentUserId();
  useScreenView(SCREENS.HOME);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [trips, setTrips] = useState<TripWithSummary[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  /**
   * 커뮤니티에 글이 있는 여행지와 글 수.
   *
   * ⚠️ 여행이 하나도 없는 사람에게만 필요한 값이라 **그때만 조회한다.**
   *    기존 사용자 홈은 이 값을 쓰지 않는데 매번 조회하면 홈이 그만큼 늦어진다.
   */
  const [postCounts, setPostCounts] = useState<PostDestinationCount[]>([]);

  const load = useCallback(async () => {
    // ⚠️ 여기서 setLoadState('loading') 을 하지 않는다. (2026-09-03)
    //    아래 useFocusEffect 때문에 탭에 들어올 때마다 load 가 도는데,
    //    그때마다 loading 으로 바꾸면 여행 카드가 사라졌다 스피너가 번쩍이고
    //    다시 나타난다. 이미 보고 있던 화면이 매번 깜빡이는 셈이라 더 나쁘다.
    //    첫 진입은 useState 초기값 'loading' 이 처리한다.
    //    (모임·마이페이지·커뮤니티 탭도 같은 방식이다)
    try {
      // 가드가 미로그인 상태를 막고 있어 여기서는 값이 있다. 그래도 만약을 대비해
      // 없으면 아무것도 조회하지 않는다. (app/_layout.tsx 로그인 가드)
      if (!userId) return;

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

      // 여행이 하나도 없는 사람에게만 '여행자들은 이렇게 다녀왔어요' 칸이 나온다.
      // 그 칸에 쓸 값이라 여기서만 조회한다. 실패해도 홈 전체를 오류로 만들지
      // 않는다 — 그 칸만 사라지고 추천 여행지와 여행 만들기는 그대로 쓴다.
      if (nextTrips.length === 0) {
        try {
          setPostCounts(await getPostDestinations());
        } catch {
          setPostCounts([]);
        }
      }

      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

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

  /**
   * '여행자들은 이렇게 다녀왔어요' 태그를 눌렀을 때. 커뮤니티의 그 여행지 글로 보낸다.
   *
   * ⚠️ 넘기는 값은 **한글 도시명**이다. 커뮤니티 여행지 필터가 글에 연결된
   *    여행의 trips.destination 으로 거르는데 그 칼럼이 한글 도시명이다.
   *    (lib/supabase/queries/community.ts getPostDestinations)
   *
   * ⚠️ 이벤트를 찍지 않는다. events.ts 에 이 이동에 맞는 이벤트가 없고,
   *    새 이벤트를 임의로 만들지 않는다. (CLAUDE.md 8장)
   *    도착 화면(COMM-01)이 tip_list_viewed 에 destination 을 담아 이미 기록한다.
   */
  function handlePressDiscovery(nameKo: string) {
    router.push(`/community?destination=${encodeURIComponent(nameKo)}`);
  }

  /**
   * 추천 여행지 카드를 눌렀을 때. 그 여행지 상세로 보낸다. (2026-09-11)
   *
   * ⚠️ 전에는 여행 만들기로 보냈다. 카드가 '○○ 둘러보기' 라고 말하는데 갈
   *    화면이 없어서였다. 이제 DEST-01 이 생겨 말과 동작이 맞는다.
   */
  function handlePressDestination(code: string) {
    router.push(`/destinations/${code}`);
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
      /*
        ⚠️ CANCEL_PENDING 이 여기서 빠진다. (2026-09-10)
           취소 동의 절차가 도는 여행은 홈 목록에서 사라지는데, 동의할 사람이
           그 여행에 들어갈 길이 이 목록뿐이다. 취소 기능(CXL)을 붙일 때
           이 조건에 CANCEL_PENDING 을 넣고 카드에 표시를 더한다.
           지금은 이 값을 쓰는 코드가 없어 실제로 빠지는 여행이 없다.
      */
      if (status !== TRIP_STATUS.PLANNING && status !== TRIP_STATUS.TRAVELING) return [];
      return [
        {
          ...toBase(trip, status),
          headcount: trip.headcount,
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

  // 여행이 하나도 없으면 신규 사용자 홈을 보여준다.
  // 기존 홈의 두 칸(보딩패스 슬라이드 · 러기지 태그 목록)을 그대로 쓰고
  // 내용만 '추천 여행지' 와 '여행자들은 이렇게 다녀왔어요' 로 바꾼 화면이다.
  if (trips.length === 0) {
    // 여행지 한글명 → 커뮤니티 글 수.
    const countByName = new Map(postCounts.map((row) => [row.destination, row.count]));

    /**
     * '인기' 배지를 달 여행지.
     *
     * ⚠️ 근거 없이 '인기' 를 붙이지 않는다. 커뮤니티 글이 가장 많은 여행지
     *    한 곳만 단다. 글이 하나도 없으면 아무 카드에도 배지가 없다.
     *    postCounts 는 쿼리가 이미 글 수 내림차순으로 정렬해 돌려준다.
     */
    const topByPosts = postCounts.length > 0 ? postCounts[0].destination : null;

    const suggestions: DestinationSuggestion[] = HOME_SUGGESTION_BASE.map((base) => ({
      ...base,

      badge: base.nameKo === topByPosts ? '인기' : null,
    }));

    /**
     * '여행자들은 이렇게 다녀왔어요' 목록.
     *
     * ⚠️ **글이 있는 여행지에서만 만든다.** 눌렀을 때 빈 목록이 나오지 않는다.
     * ⚠️ 목적지 상수에 없는 이름(직접 입력한 여행지)은 건너뛴다.
     *    공항 코드·나라 그림·국가색이 없어서 태그를 그릴 수 없다.
     */
    const discoveries: DiscoverDestination[] = postCounts
      .flatMap((row) => {
        const meta = findDestinationByName(row.destination);
        if (!meta) return [];
        return [
          {
            code: meta.code,
            nameKo: meta.nameKo,
            nameEn: meta.nameEn,
            countryKo: meta.countryKo,
            airportCode: meta.airportCode,
            // 소개를 쓰지 않은 목적지는 추천 기간도 없다. 지어내지 않고 '—' 를 쓴다.
            nights: destinationEditorial(meta.code)?.nights ?? '—',
            postCount: row.count,
            theme: countryTheme(meta.countryKo),
          },
        ];
      })
      .slice(0, DISCOVER_LIMIT);

    return (
      <HomeEmpty
        userName={profile?.name ?? null}
        suggestions={suggestions}
        discoveries={discoveries}
        onCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.EMPTY_STATE)}
        // 목적지 코드를 받지만 아직 넘기지 않는다. TRIP-01 이 destination param 을
        // 받게 되면 그때 붙인다. (components/home/DestinationSuggestCard 주석)
        onPressSuggestion={handlePressDestination}
        onPressDiscovery={handlePressDiscovery}
      />
    );
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
