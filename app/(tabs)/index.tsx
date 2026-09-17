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
// 2026-09-15 답하지 않은 여행 초대를 맨 위에 띄운다. (모달 한 번 + 상시 배너)
//   **초대 화면(INV-02 · 한나 담당)에서 답하지 않고 나간 사람에게만 뜬다.**
//   카톡 링크로 들어가면 초대 화면이 먼저 뜬다. 거기서 참여 요청도 거절도 누르지 않고
//   창을 닫으면 그 건이 처리되지 않은 채 남는데, 그때 홈이 대신 알린다.
//   답(참여 요청 · 거절)할 때까지 배너가 상시로 남는다.
//   초대 링크에는 받는 사람이 없어서 서버는 누구에게 온 초대인지 모른다.
//   링크를 연 기기가 token 을 저장해 두고(lib/invite/pendingInvites),
//   홈이 열릴 때마다 resolve_trip_invite 로 다시 확인한다.
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// 여기서 <Stack.Screen options={{ title }} /> 을 쓰면 Tabs 스크린 옵션을 덮어써서
// 하단 탭 라벨까지 바뀐다.
// ============================================================================
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  HomeEmpty,
  HomeError,
  HomeLoading,
  HomeView,
  type DestinationSuggestion,
  type DiscoverDestination,
  type EndedTripCardData,
  type HomeEmptyVariant,
  type HomeInvite,
  type InvitePromptProps,
  type OngoingTripCardData,
} from '@/components/home';
import { daysUntil, formatTripDates } from '@/components/home/format';
import { SCREENS } from '@/lib/analytics/events';
import { canDecideJoinRequest } from '@/lib/trip/tripLeader';
import {
  buildCancelPendingAction,
  buildJoinRequestAction,
  type TripAction,
} from '@/lib/trip/tripActions';
import { getActiveCancelRequest, getVoteProgress } from '@/lib/supabase/queries/tripCancel';
import { getTripJoinRequests } from '@/lib/supabase/queries/tripJoinRequests';
import { listActiveTripMembers } from '@/lib/supabase/queries/tripMembers';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import {
  getPendingInvites,
  markInviteModalShown,
  removePendingInvite,
} from '@/lib/invite/pendingInvites';
import { previewInviteState } from '@/lib/invite/previewInvite';
import {
  TRIP_JOIN_ERROR,
  requestTripJoin,
  resolveTripInvite,
  tripJoinErrorCode,
} from '@/lib/supabase/queries/tripJoinRequests';
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
import {
  getMyParticipatingTripsWithSummary,
  type TripWithSummary,
} from '@/lib/supabase/queries/trips';
import { getUserProfile, type UserProfile } from '@/lib/supabase/queries/users';
import { isTripOngoing } from '@/lib/trip/tripStatus';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * 홈에 보여줄 지난 여행 개수.
 *
 * 홈은 훑는 자리다. 전체 목록은 MY-02(/me/trips)가 맡는다.
 * 가로 슬라이드에 두 장씩 보이므로 4개면 두 번 넘겨서 다 본다.
 * 여기서 다 보여주면 홈이 여행 목록 페이지가 된다. (CLAUDE.md 2장)
 */
const HOME_PAST_TRIP_LIMIT = 4;
/** 첫 조회가 실패했을 때 다시 시도하기까지 기다리는 시간. (load 의 재시도 주석 참고) */
const RETRY_DELAY_MS = 600;

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

/** 서버 my_state 중 아직 참여 요청을 보낼 수 있는 상태. 초대 화면(INV-02)과 같은 기준이다. */
function isAnswerable(myState: string): boolean {
  return myState === 'NONE' || myState === 'LEFT';
}

/** 초대 미리보기 → 홈 배너 · 모달 한 줄. 승인 전 공개 범위만 옮긴다. (docs/10_v2 §11) */
function toHomeInvite(
  token: string,
  preview: {
    inviterName: string | null;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  },
): HomeInvite {
  const dates = formatTripDates(preview.startDate, preview.endDate);
  return {
    token,
    inviterName: preview.inviterName,
    destination: preview.destination,
    periodLabel: preview.startDate && preview.endDate ? `${dates.start} – ${dates.end}` : null,
  };
}

export default function ScreenHOME01() {
  // 로그인한 사용자. 가드가 미로그인 상태를 막고 있어 여기서는 항상 값이 있다.
  // 미리보기 모드(__DEV__)에서는 시드 사용자다. (lib/auth/AuthProvider)
  const userId = useCurrentUserId();
  useScreenView(SCREENS.HOME);

  const router = useRouter();

  /**
   * [개발용] 신규 사용자 홈 미리보기. `/?preview=empty` 로 연다. (2026-09-16)
   *
   * 여행이 하나도 없는 사람의 홈은 seed 사용자 넷 모두 여행이 있어서 볼 수 없었다.
   * 이 값이 있으면 **조회 결과를 그대로 두고 화면만** 신규 사용자 홈으로 그린다.
   * DB 에는 아무것도 쓰지 않는다.
   *
   * ⚠️ __DEV__ 에서만 동작한다. 배포 번들에서는 이 분기가 없다.
   * ⚠️ 확인이 끝나면 이 상수와 아래 한 줄(emptyPreview 조건)을 지운다.
   */
  const params = useLocalSearchParams<{ preview?: string }>();
  const emptyPreview = __DEV__ && params.preview === 'empty';

  /**
   * [개발용] 로고를 길게 누르면 신규 사용자 홈 미리보기를 켜고 끈다. (2026-09-17)
   *
   * 실제 계정(카카오 로그인)으로 들어와도 새 유저 홈을 볼 수 있게 한다. 주소창이 없는
   * 휴대폰에서도 켤 수 있도록 ?preview=empty 를 코드로 바꾼다. 조회 결과는 건드리지 않는다.
   * ⚠️ 배포 빌드(__DEV__ false)에서는 undefined 라 로고가 눌리지 않는다.
   */
  const handleToggleEmptyPreview = __DEV__
    ? () => router.setParams({ preview: emptyPreview ? '' : 'empty' })
    : undefined;
  const { isPreview } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  /** 답하지 않은 초대. 서버 확인을 통과한 것만 들어온다. */
  const [invites, setInvites] = useState<HomeInvite[]>([]);
  /** 지금 모달로 띄운 초대의 token. 닫으면 null. */
  const [modalToken, setModalToken] = useState<string | null>(null);
  /** 참여 요청을 보내는 중인 초대의 token. 중복 제출 방지. */
  const [requestingToken, setRequestingToken] = useState<string | null>(null);
  /**
   * 지금 답해야 할 일 — 참여 요청 대기 · 취소 요청 중.
   * 홈 조회(load)와 **따로 돈다.** 실패해도 홈이 오류가 되면 안 된다.
   */
  const [actions, setActions] = useState<TripAction[]>([]);
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

  const load = useCallback(async (attempt = 0) => {
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
        /**
         * ⚠️ **참여 중인 여행만** 가져온다. getTripsWithSummary 는 모임 소속만
         *    보고 여행 참여 여부를 안 봐서, 내가 나간 여행까지 홈에 떴다.
         *    모임 상세는 '나간 여행' 배지로 구분해 주는데 홈에는 그 장치가
         *    없어서 그냥 준비 중인 내 여행처럼 보였다. (2026-09-15)
         * ⚠️ 개인 여행도 안전하다 — 여행을 만들 때 본인이 trip_members 에
         *    ACTIVE 로 들어간다. (app/trips/new/budget-fund.tsx · seed 다낭)
         */
        getMyParticipatingTripsWithSummary(userId),
        getMyGroups(userId),
        getUserProfile(userId),
      ]);
      setTrips(nextTrips);
      setGroups(nextGroups);
      setProfile(nextProfile);

      // 준비 중이거나 여행 중인 여행이 하나라도 있는가.
      const hasOngoing = nextTrips.some(
        (trip) =>
          // ⚠️ 취소 요청 중도 진행 중이다. 빼면 요청받은 사람 홈에서 사라진다
          isTripOngoing(trip.status),
      );

      /*
        커뮤니티 글 수. '여행자들은 이렇게 다녀왔어요' 목록과 '인기' 배지에 쓴다.

        ⚠️ **준비 중인 여행이 없을 때만 조회한다.** 그때만 추천 여행지가 화면에
           나오기 때문이다. 준비 중인 여행이 있는 사람의 홈은 이 값을 쓰지 않는데
           매번 조회하면 홈이 그만큼 늦어진다. (2026-09-11 — 전에는 여행이
           하나도 없을 때만 조회했는데, 추천 여행지가 기존 홈에도 나오게 되면서
           범위를 넓혔다)
        ⚠️ 실패해도 홈 전체를 오류로 만들지 않는다 — 배지와 그 칸만 빠진다.
      */
      // ⚠️ [개발용] 신규 사용자 홈 미리보기에서도 '여행자들은 이렇게 다녀왔어요' 를
      //    보려면 글 수가 필요하다. (emptyPreview 주석 참조)
      if (!hasOngoing || emptyPreview) {
        try {
          setPostCounts(await getPostDestinations());
        } catch {
          setPostCounts([]);
        }
      }

      setLoadState('ready');
    } catch (error) {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      // ⚠️ 개발 중에는 이유를 남긴다. 배포 빌드(__DEV__ = false)에서는 찍지 않는다.
      if (__DEV__) console.warn('[home] load failed', error, 'attempt', attempt);

      /*
        ⚠️ **한 번 실패했다고 바로 오류 화면을 보여주지 않는다.** (2026-09-16)

        구글로 처음 가입할 때(아이디 → 비밀번호 → 동의 → 2단계 인증) 앱이 한동안
        브라우저 뒤에 있다가 돌아오는데, 돌아오자마자 도는 첫 조회가 한 번
        실패하면서 새 사용자가 가입 직후에 오류 화면을 봤다. 곧바로 '다시 시도' 를
        누르면 정상이었다.

        그래서 짧게 기다렸다가 한 번 더 시도하고, 그래도 안 되면 그때 오류로 둔다.
        무한 재시도는 하지 않는다 — 진짜 실패가 조용히 숨으면 안 된다.
      */
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        await load(1);
        return;
      }
      setLoadState('error');
    }
  }, [userId, emptyPreview]);

  // ⚠️ useEffect 가 아니라 useFocusEffect 다. (2026-09-03)
  //    탭은 화면을 살려 두기 때문에(unmountOnBlur 없음) 한 번 만들어지면
  //    useEffect 가 다시 돌지 않는다. 그래서 여행을 만들고 홈으로 돌아와도
  //    새 여행이 목록에 없고, 결산을 끝내고 와도 지난 여행 금액이 그대로였다.
  //    모임·마이페이지·커뮤니티 탭과 같은 방식으로 맞춘다.
  /**
   * 기기에 남은 초대를 서버에 다시 확인한다.
   *
   * ⚠️ 홈 조회(load)와 따로 돈다. 초대 확인이 실패해도 홈이 오류가 되면 안 된다.
   * ⚠️ 서버가 "이제 답할 수 없다" 고 한 초대만 지운다(만료 · 이미 참여 · 요청함 · 거절됨).
   *    확인 자체가 실패하면(네트워크 등) 이번엔 안 보여주고 저장은 남긴다.
   * ⚠️ 모달은 **한 초대에 한 번만** 띄운다. 그 뒤로는 배너로만 남는다.
   */
  const loadInvites = useCallback(async () => {
    if (!userId) return;
    try {
      const stored = await getPendingInvites(userId);
      const checked = await Promise.all(
        stored.map(async (row): Promise<HomeInvite | null> => {
          // 개발용 미리보기에는 세션이 없어 RPC 가 막힌다. preview-* 토큰만 그린다.
          // production 에는 __DEV__ 가 false 라 이 분기가 없다. (lib/invite/previewInvite)
          if (__DEV__ && isPreview) {
            const preview = previewInviteState(row.token);
            if (preview?.kind !== 'VALID' || !isAnswerable(preview.myState)) return null;
            return toHomeInvite(row.token, {
              inviterName: preview.preview.ownerDisplayName,
              destination: preview.preview.destination,
              startDate: preview.preview.startDate,
              endDate: preview.preview.endDate,
            });
          }

          try {
            const result = await resolveTripInvite(row.token);
            if (result.invite_state !== 'VALID' || !isAnswerable(result.my_state)) {
              await removePendingInvite(userId, row.token);
              return null;
            }
            return toHomeInvite(row.token, {
              inviterName: result.inviter_name,
              destination: result.destination,
              startDate: result.start_date,
              endDate: result.end_date,
            });
          } catch {
            return null;
          }
        }),
      );

      const next = checked.filter((invite): invite is HomeInvite => invite !== null);
      setInvites(next);

      // 모달은 한 초대에 한 번만 띄운다. 그 뒤로는 배너로만 남는다.
      const firstUnseen = stored.find(
        (row) => row.modalShownAt === null && next.some((invite) => invite.token === row.token),
      );
      if (firstUnseen) {
        setModalToken((current) => current ?? firstUnseen.token);
        await markInviteModalShown(userId, firstUnseen.token);
      }
    } catch {
      // 기기 저장소를 못 읽었다. 초대 칸만 비우고 홈은 그대로 둔다.
      setInvites([]);
    }
  }, [userId, isPreview]);

  /**
   * 지금 답해야 할 일을 모은다 — 참여 요청 대기 · 취소 요청 중.
   *
   * ⚠️ 홈 조회(load)와 **따로 돈다.** 실패해도 홈이 오류가 되면 안 된다.
   *    배너가 없을 뿐이지 내 여행은 그대로 보여야 한다. (loadInvites 와 같은 원칙)
   *
   * ⚠️ 여행을 전부 돌지 않는다. 볼 필요가 있는 것만 고른다 —
   *      참여 요청  내가 여행장이고 아직 열려 있는 여행
   *      취소 동의  status 가 CANCEL_PENDING 인 여행
   *    여행장인 여행은 보통 한둘이고 취소 요청 중인 여행은 대개 0개라,
   *    실제로 늘어나는 조회는 0~2번이다. 여행 수만큼 도는 구조가 아니다.
   *
   * ⚠️⚠️ getActiveCancelRequest 는 **읽으면서 쓴다.** 7일이 지났거나 출발일이
   *    됐으면 그 자리에서 요청을 닫는다(lazy expiration · 크론 없음). 전에는
   *    여행 홈에 들어가야만 일어났는데, 이제 **홈만 열어도 만료가 정리된다.**
   *    의도한 변화다. (2026-09-17)
   *
   * ⚠️ 여행장 판정을 여기서 새로 만들지 않는다. trips 가 이미 leader_user_id 를
   *    물고 온다 (TripWithSummary = Trip & {...}).
   */
  const loadActions = useCallback(
    async (rows: TripWithSummary[]) => {
      if (!userId || isPreview) {
        setActions([]);
        return;
      }

      /*
        ⚠️⚠️ **여행 홈과 같은 기준이어야 한다.** ⚠️⚠️
           여행 홈은 canDecideJoinRequest(= 여행장인가)만 보고 **status 를 보지
           않는다.** 여기에만 PLANNING·TRAVELING 조건을 걸었더니, 취소 요청이
           들어온 순간 홈에서 참여 요청 배너가 사라지는데 여행 홈에는 그대로
           남았다. 같은 일을 두 화면이 다르게 판정한 것이다. (2026-09-17 확인)

           취소 요청 중에도 참여 요청은 살아 있고 수락할 수 있다 — 여행 준비가
           그대로 도는 것과 같은 이유다. (POL-CXL-006) 서버도 CANCELED ·
           DELETED 일 때만 수락을 거부한다. (accept_trip_join_request ·
           TRIP_NOT_OPEN) 그 둘만 뺀다.
      */
      const leading = rows.filter(
        (trip) =>
          canDecideJoinRequest(trip, userId) &&
          trip.status !== TRIP_STATUS.CANCELED &&
          trip.status !== TRIP_STATUS.DELETED,
      );
      const canceling = rows.filter((trip) => trip.status === TRIP_STATUS.CANCEL_PENDING);

      const [joinActions, cancelActions] = await Promise.all([
        Promise.all(
          leading.map(async (trip) => {
            try {
              const requests = await getTripJoinRequests(trip.id);
              return buildJoinRequestAction({
                tripId: trip.id,
                destination: trip.destination,
                waitingNames: requests.map((r) => r.requester_name),
              });
            } catch {
              // 여행장이 아니게 됐거나 일시적인 실패. 이 여행 것만 뺀다.
              return null;
            }
          }),
        ),
        Promise.all(
          canceling.map(async (trip) => {
            try {
              const request = await getActiveCancelRequest(trip.id, trip.start_date);
              if (!request) return null;
              const [progress, members] = await Promise.all([
                getVoteProgress(request),
                listActiveTripMembers(trip.id).catch(() => []),
              ]);
              return buildCancelPendingAction({
                tripId: trip.id,
                destination: trip.destination,
                agreedCount: progress.agreedCount,
                voteTargetCount: progress.targetCount,
                isRequester: request.requested_by === userId,
                hasVoted: progress.votes.some((v) => v.user_id === userId),
                requesterName:
                  members.find((m) => m.user_id === request.requested_by)?.name ?? '요청자',
              });
            } catch {
              return null;
            }
          }),
        ),
      ]);

      /*
        ⚠️ 참여 요청이 취소보다 **위**다. 취소는 여행 전체가 걸린 일이라 더
           무겁지만, 참여 요청은 상대가 기다리고 있어 시간이 걸린다.
           여행 홈 배너 순서와 같게 맞춘다.
      */
      setActions(
        [...joinActions, ...cancelActions].filter((a): a is TripAction => a !== null),
      );
    },
    [userId, isPreview],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadInvites();
    }, [load, loadInvites]),
  );

  /**
   * 여행 목록이 바뀌면 배너를 다시 계산한다.
   *
   * ⚠️ load() 안에서 부르지 않는다. 실패가 홈 조회의 실패로 번지면 안 된다.
   */
  useEffect(() => {
    void loadActions(trips);
  }, [loadActions, trips]);

  /**
   * 배너를 눌렀을 때. **여기서 수락·동의를 하지 않는다.**
   *
   * ⚠️ 그 화면으로 보낸다. 수락·거절은 여행 정보 수정에, 동의·현황은 여행 홈
   *    시트에 이미 다 있다. 홈에 또 만들면 같은 흐름이 두 벌이 된다.
   *    (2026-09-17 다빈 · leaveTrip 이 둘로 갈렸던 것과 같은 일)
   *
   * ⚠️ 취소 쪽은 시트라 라우트가 없다. 여행 홈이 파라미터를 보고 연다.
   *    모임 상세가 ?cancel=1 로 취소 사유 시트를 여는 것과 같은 방식이다.
   */
  function handlePressAction(action: TripAction) {
    switch (action.intent) {
      case 'OPEN_JOIN_REQUESTS':
        // ⚠️ focus=requests — 그냥 보내면 캘린더만 보이고 할 일이 안 보인다
        router.push(`/trips/${action.tripId}/edit?focus=requests`);
        return;
      case 'OPEN_CANCEL_VOTE':
        router.push(`/trips/${action.tripId}?cxl=vote`);
        return;
      case 'OPEN_CANCEL_PROGRESS':
        router.push(`/trips/${action.tripId}?cxl=progress`);
        return;
    }
  }

  /** 답이 끝난 초대를 화면과 기기에서 뺀다. */
  function dismissInvite(token: string) {
    setInvites((prev) => prev.filter((invite) => invite.token !== token));
    setModalToken((current) => (current === token ? null : current));
    if (userId) removePendingInvite(userId, token).catch(() => undefined);
  }

  /**
   * 참여 요청하기. request_trip_join → PENDING. 여행장이 수락해야 참여가 확정된다.
   *
   * ⚠️ 이벤트를 찍지 않는다. events.ts 의 JOIN_REQUESTED 는 hours_since_invite 를 요구하는데
   *    홈은 초대가 만들어진 시각을 모른다. 초대 화면(INV-02)도 아직 찍지 않아서
   *    홈에서만 찍으면 요청 수가 절반만 잡힌다. (CLAUDE.md 8장)
   */
  async function handleRequestJoin(token: string) {
    if (!userId || requestingToken) return;

    // 미리보기 — 서버에 아무것도 쓰지 않고 결과만 흉내 낸다.
    if (__DEV__ && isPreview) {
      dismissInvite(token);
      Alert.alert('초대를 수락했어요', '여행장이 승인하면 여행에 함께할 수 있어요.');
      return;
    }

    setRequestingToken(token);
    try {
      await requestTripJoin(token);
      dismissInvite(token);
      Alert.alert('초대를 수락했어요', '여행장이 승인하면 여행에 함께할 수 있어요.');
    } catch (error) {
      const code = tripJoinErrorCode(error);
      if (code === TRIP_JOIN_ERROR.ALREADY_MEMBER) {
        dismissInvite(token);
        Alert.alert('이미 함께하고 있는 여행이에요');
        void load();
      } else if (code === TRIP_JOIN_ERROR.REJECTED_FOR_INVITE) {
        // ⚠️ 거절 사유를 말하지 않는다. (POL-INV-051)
        dismissInvite(token);
        Alert.alert('이 초대에는 응답할 수 없어요');
      } else if (code === TRIP_JOIN_ERROR.INVITE_NOT_VALID || code === TRIP_JOIN_ERROR.NOT_FOUND) {
        dismissInvite(token);
        Alert.alert('초대 링크가 만료됐어요', '초대한 사람에게 새 링크를 받아 주세요.');
      } else {
        // 일시적인 실패일 수 있다. 초대는 남겨 두고 다시 누를 수 있게 한다.
        Alert.alert('초대 수락을 보내지 못했어요', '잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setRequestingToken(null);
    }
  }

  /**
   * 거절하기. **이 기기에서 초대를 지우는 것뿐이다.** 서버에 보내지 않는다.
   * 받는 사람이 초대를 거절하는 서버 기능은 정책에 없다. 여행장에게도 알리지 않는다.
   * 같은 링크를 다시 열면 다시 뜬다.
   */
  function handleDeclineInvite(token: string) {
    if (requestingToken) return;
    dismissInvite(token);
  }

  const invitePrompt: InvitePromptProps = {
    invites,
    modalInvite: invites.find((invite) => invite.token === modalToken) ?? null,
    requestingToken,
    onRequestJoin: (token) => void handleRequestJoin(token),
    onDecline: handleDeclineInvite,
    onCloseModal: () => setModalToken(null),
  };

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

  /**
   * 상단바 알림 버튼. 받은 알림 목록으로 보낸다. (2026-09-15)
   *
   * ⚠️ 마이페이지 헤더 🔔 와 같은 화면이다. 알림 설정(/me/settings/notifications)이 아니다.
   * ⚠️ 이벤트를 찍지 않는다. events.ts 에 알림함 진입 이벤트가 없고,
   *    새 이벤트를 임의로 만들지 않는다. (CLAUDE.md 8장)
   */
  function handlePressNotifications() {
    router.push('/me/notifications');
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
        ⚠️ CANCEL_PENDING 을 **반드시 포함한다.** (2026-09-10 예고 → 09-14 반영)
           취소 동의 절차가 도는 여행이 이 목록에서 빠지면, 동의할 사람이 그
           여행에 들어갈 길이 없어진다. 실제로 그렇게 됐다 — 서연이 요청하자
           민지의 홈에서 오사카가 사라졌고, 동의 시트에 도달할 방법이 아무
           데도 없었다. 취소 동의 기능 전체가 막혔다.
           판정은 lib/trip/tripStatus.ts 한 곳에 모아 뒀다.
      */
      if (!status || !isTripOngoing(status)) return [];
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

  /**
   * '인기' 배지를 달 여행지.
   *
   * ⚠️ 근거 없이 '인기' 를 붙이지 않는다. 커뮤니티 글이 가장 많은 여행지
   *    한 곳만 단다. 글이 하나도 없으면 아무 카드에도 배지가 없다.
   *    postCounts 는 쿼리가 이미 글 수 내림차순으로 정렬해 돌려준다.
   */
  const topByPosts = postCounts.length > 0 ? postCounts[0].destination : null;

  /**
   * 추천 여행지.
   *
   * ⚠️ **두 홈이 함께 쓴다.** (2026-09-11) 신규 사용자 홈은 화면 전체에,
   *    기존 홈은 준비 중인 여행이 하나도 없을 때 그 자리에 놓는다.
   *    그래서 분기 안이 아니라 여기서 만든다.
   */
  const suggestions: DestinationSuggestion[] = HOME_SUGGESTION_BASE.map((base) => ({
    ...base,
    badge: base.nameKo === topByPosts ? '인기' : null,
  }));

  // 여행이 하나도 없으면 신규 사용자 홈을 보여준다.
  // 기존 홈의 두 칸(보딩패스 슬라이드 · 러기지 태그 목록)을 그대로 쓰고
  // 내용만 '추천 여행지' 와 '여행자들은 이렇게 다녀왔어요' 로 바꾼 화면이다.
  if (trips.length === 0 || emptyPreview) {
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
        onPressNotifications={handlePressNotifications}
        onLongPressLogo={handleToggleEmptyPreview}
        invitePrompt={invitePrompt}
        actions={actions}
        onPressAction={handlePressAction}
      />
    );
  }

  // ⚠️ 2026-09-16 기존 사용자 홈의 여행지 추천 두 칸을 뺐다. 이유는 HomeView 주석 참조.
  //    추천은 신규 사용자 홈(HomeEmpty)과 여행지 추천 화면(/destinations)이 맡는다.

  return (
    <HomeView
      userName={profile?.name ?? null}
      daysToNextTrip={daysUntil(nearest?.startDate ?? null)}
      ongoingTrips={ongoingTrips}
      emptyVariant={emptyVariant}
      pastTrips={pastTrips.slice(0, HOME_PAST_TRIP_LIMIT)}
      onPressTrip={handlePressTrip}
      onPressSettle={handlePressSettle}
      onPressCreateTrip={() => handlePressCreateTrip(ENTRY_POINT.HOME)}
      // 지난 여행의 '전체 보기' 라 지난 여행 탭으로 연다. 기본 탭(준비 중)으로 열면
      // 방금 누른 목록과 다른 목록이 보인다. (2026-09-15)
      onPressAllPastTrips={() => router.push('/me/trips?filter=past')}
      onPressNotifications={handlePressNotifications}
      invitePrompt={invitePrompt}
      actions={actions}
      onPressAction={handlePressAction}
      onLongPressLogo={handleToggleEmptyPreview}
    />
  );
}
