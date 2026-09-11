// ============================================================================
// DEST-01 · /destinations/:destinationCode · 여행지 상세 (2026-09-11)
//
// 홈의 '추천 여행지' 카드를 누르면 오는 화면이다.
//
//   여행지 티켓 카드 → OO는 이런 여행지예요! → 값 세 칸 →
//   이런 분들께 추천해요 → 여행비 가이드 → 항목별 평균 예산 →
//   함께 가면 이런 예산이에요 → OO 관련 커뮤니티 → [OO로 여행 만들기]
//
// ⚠️⚠️ **예산 금액은 여행 만들기가 쓰는 계산 그대로다.**
//    lib/destination/budgetGuide 가 buildBudgetRecommendation(TRIP-03 이 부르는
//    바로 그 함수)을 스타일만 바꿔 세 번 부른다. 그래서 사용자가 실제로 여행을
//    만들 때 어떤 스타일을 골라도 결과가 이 화면의 범위 안에 들어온다.
//    여기서 금액을 따로 계산하지 않는다.
//
// ⚠️ **[검토 필요] 이 화면은 docs/04_화면목록_v3.md 에 없다.**
//    홈의 추천 여행지에서만 들어오므로 홈 담당이 만들었다. 여행지 상세를
//    홈으로 볼지 여행으로 볼지, 화면 번호(임의로 DEST-01)를 무엇으로 할지는
//    팀에서 정할 일이다.
//
// ⚠️ **[검토 필요] 라우트 파라미터 이름.** CLAUDE.md 6장 식별자 목록에
//    여행지용 이름이 없어 `destinationCode` 로 두었다.
//
// 🔴 **이 화면은 screen_viewed 를 남기지 않는다.**
//    SCREENS 에 이 화면 값이 없고 lib/analytics/events.ts 는 [공유] 라 새
//    값을 임의로 늘리지 않는다. (CLAUDE.md 8장)
//    → `SCREENS.DESTINATION_DETAIL` 추가를 사람에게 요청해야 한다.
//
// 이 파일은 데이터 조회·상태 관리만 한다.
// 실제로 보이는 UI 는 components/destination/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { POST_TYPE_DISPLAY_LABEL } from '@/components/community';
import { formatPublished } from '@/components/community/format';
import { DestinationDetailView, type DestinationPostItem } from '@/components/destination';
import type { DestinationDetailData } from '@/components/destination';
import { ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { countryTheme } from '@/lib/constants/countryTheme';
import { destinationEditorial } from '@/lib/constants/destinationEditorial';
import { destinationHeroPhoto } from '@/lib/constants/destinationHeroPhoto';
import {
  DESTINATION_BY_CODE,
  REGION_LABEL,
  type DestinationCode,
} from '@/lib/constants/destinations';
import { ENTRY_POINT } from '@/lib/constants/status';
import { destinationBudgetGuide } from '@/lib/destination/budgetGuide';
import { getPosts, type PostListItem } from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

/**
 * 커뮤니티 칸에 보여줄 글 수.
 *
 * 이 화면의 주인공은 여행지 소개와 예산이다. 여기는 "이 여행지 이야기가 더
 * 있다" 를 알리는 자리라 두 건만 둔다. 전체는 커뮤니티 탭이 맡는다.
 */
const POST_LIMIT = 2;

/** 인원 기본값. 혼자 보는 화면이 아니라 '같이 가면 얼마' 를 묻는 자리다. */
const DEFAULT_HEADCOUNT = 2;

export default function ScreenDEST01() {
  const { destinationCode } = useLocalSearchParams<{ destinationCode: string }>();
  // 로그인한 사용자. 글 조회에 필요하다.
  const userId = useCurrentUserId();

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [headcount, setHeadcount] = useState(DEFAULT_HEADCOUNT);

  /**
   * 목적지 상수에서 찾는다.
   *
   * ⚠️ 모르는 코드로 들어오면 화면을 그리지 않는다. 주소창에 아무 값이나 넣어도
   *    Crash 하지 않아야 한다. (CLAUDE.md 9장)
   */
  const meta = destinationCode
    ? DESTINATION_BY_CODE[destinationCode as DestinationCode]
    : undefined;
  const editorial = destinationEditorial(destinationCode);

  const load = useCallback(async () => {
    if (!meta || !editorial) {
      setLoadState('notFound');
      return;
    }
    if (!userId) return;

    setLoadState('loading');
    try {
      // 이 여행지 글만 부른다. 커뮤니티 목록이 여행지 칸에서 쓰는 것과 같은 조회다.
      // 글의 여행지는 연결한 여행(trips.destination)에서 나온다.
      setPosts(await getPosts(userId, undefined, meta.nameKo));
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [meta, editorial, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 여행비 가이드. 인원이 바뀔 때마다 다시 계산한다.
   *
   * ⚠️ 계산은 화면 파일이 한다. 컴포넌트는 금액을 만들지 않는다. (CLAUDE.md 9장)
   */
  const guide = useMemo(() => {
    if (!meta || !editorial) return null;
    return destinationBudgetGuide(meta.code, editorial.stayNights, headcount);
  }, [meta, editorial, headcount]);

  if (loadState === 'notFound') {
    return (
      <>
        <Stack.Screen options={{ title: '여행지', headerTitleAlign: 'center' }} />
        <ErrorState message="여행지를 찾을 수 없어요." onRetry={() => router.back()} />
      </>
    );
  }

  if (loadState === 'loading' || !guide) {
    return (
      <>
        <Stack.Screen options={{ title: '여행지', headerTitleAlign: 'center' }} />
        <Loading message="여행지를 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: '여행지', headerTitleAlign: 'center' }} />
        <ErrorState message="여행지를 불러오지 못했어요." onRetry={() => void load()} />
      </>
    );
  }

  // notFound 를 위에서 걸렀으므로 여기서는 값이 있다.
  if (!meta || !editorial) return null;

  const destination: DestinationDetailData = {
    code: meta.code,
    nameKo: meta.nameKo,
    nameEn: meta.nameEn,
    countryKo: meta.countryKo,
    regionKo: REGION_LABEL[meta.region],
    airportCode: meta.airportCode,
    flag: meta.flag,
    nights: editorial.nights,
    season: editorial.season,
    styles: editorial.styles,
    intro: editorial.intro,
    recommendedFor: editorial.recommendedFor,
    // 앱에 넣은 파일이다. 확보하지 못한 목적지는 null 이고 카드가 사진 칸을 비운다.
    photo: destinationHeroPhoto(meta.code)?.url ?? null,
    theme: countryTheme(meta.countryKo),
  };

  const postItems: DestinationPostItem[] = posts.slice(0, POST_LIMIT).map((post) => ({
    postId: post.postId,
    title: post.title,
    categoryLabel: POST_TYPE_DISPLAY_LABEL[post.postType],
    publishedLabel: formatPublished(post.publishedAt) ?? '',
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    thumbnailUrl: post.imageUrls?.[0] ?? null,
  }));

  return (
    <>
      <Stack.Screen options={{ title: meta.nameKo, headerTitleAlign: 'center' }} />
      <DestinationDetailView
        destination={destination}
        guide={guide}
        posts={postItems}
        onChangeHeadcount={setHeadcount}
        onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
        // 커뮤니티 탭의 이 여행지 칸으로 보낸다. 홈의 태그가 쓰는 것과 같은 경로다.
        onPressSeeAllPosts={() =>
          router.push(`/community?destination=${encodeURIComponent(meta.nameKo)}`)
        }
        // ⚠️ 목적지가 따라가지 않는다. TRIP-01(/trips/new/owner)이 destination
        //    param 을 받지 않는다. 담당이 달라 손대지 않았다. (CLAUDE.md 13장)
        //    TODO: TRIP-01 이 목적지를 받으면 meta.code 를 함께 넘긴다.
        onPressCreateTrip={() =>
          router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)
        }
      />
    </>
  );
}
