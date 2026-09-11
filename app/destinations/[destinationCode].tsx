// ============================================================================
// DEST-01 · /destinations/:destinationCode · 여행지 상세 (2026-09-11)
//
// 홈의 '추천 여행지' 카드를 누르면 오는 화면이다. 그 카드가 "타이베이 둘러보기"
// 라고 말하는데 갈 곳이 없어서 여행 만들기로 보내고 있었다. 말과 동작이
// 어긋난 상태를 푸는 화면이다.
//
//   여행지 소개 (홈 카드를 펼친 머리)
//   이 여행지 여행기 목록          ← 커뮤니티 글을 여행지로 걸러서
//   [ ○○로 여행 만들기 ]          ← 화면 아래 고정
//
// ⚠️ **[검토 필요] 이 화면은 docs/04_화면목록_v3.md 에 없다.** (2026-09-11)
//    홈의 추천 여행지에서만 들어오므로 홈 담당이 만들었다. 여행지 상세를
//    홈으로 볼지 여행으로 볼지는 팀에서 정할 일이다. 화면 번호(DEST-01)도
//    임의로 붙인 것이라 문서에 올릴 때 바뀔 수 있다.
//
// ⚠️ **[검토 필요] 라우트 파라미터 이름.** CLAUDE.md 6장이 정한 식별자 목록
//    (userId·groupId·tripId·categoryId…)에 여행지용 이름이 없다. 목적지 코드를
//    쓰는 첫 라우트라 `destinationCode` 로 두었다. 팀이 다른 이름을 정하면
//    이 파일 이름과 홈의 router.push 를 함께 고쳐야 한다.
//
// 🔴 **이 화면은 screen_viewed 를 남기지 않는다.**
//    lib/analytics/events.ts 의 SCREENS 에 이 화면 값이 없다. 그 파일은 [공유]
//    이고 새 이벤트를 임의로 늘리지 않는다. (CLAUDE.md 8장)
//    → 사람에게 `SCREENS.DESTINATION_DETAIL` 추가를 요청해야 한다. 받으면
//      useScreenView 한 줄만 넣으면 된다.
//
// 이 파일은 데이터 조회·상태 관리만 한다.
// 실제로 보이는 UI 는 components/destination/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { POST_TYPE_DISPLAY_LABEL, type PostCardData } from '@/components/community';
import { formatPublished } from '@/components/community/format';
import { DestinationDetailView, type DestinationDetailData } from '@/components/destination';
import { ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { countryTheme } from '@/lib/constants/countryTheme';
import { destinationEditorial } from '@/lib/constants/destinationEditorial';
import { DESTINATION_BY_CODE, REGION_LABEL, type DestinationCode } from '@/lib/constants/destinations';
import { ENTRY_POINT } from '@/lib/constants/status';
import { getPosts, type PostListItem } from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

export default function ScreenDEST01() {
  const { destinationCode } = useLocalSearchParams<{ destinationCode: string }>();
  // 로그인한 사용자. 글 카드의 좋아요·찜 표시가 이 값으로 갈린다.
  const userId = useCurrentUserId();

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<PostListItem[]>([]);

  /**
   * 목적지 상수에서 찾는다.
   *
   * ⚠️ 모르는 코드로 들어오면 **화면을 그리지 않는다.** 주소창에 아무 값이나
   *    넣어도 Crash 하지 않아야 한다. (CLAUDE.md 9장)
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

  if (loadState === 'notFound') {
    return (
      <>
        <Stack.Screen options={{ title: '여행지', headerTitleAlign: 'center' }} />
        <ErrorState message="여행지를 찾을 수 없어요." onRetry={() => router.back()} />
      </>
    );
  }

  if (loadState === 'loading') {
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

  const theme = countryTheme(meta.countryKo);

  const destination: DestinationDetailData = {
    code: meta.code,
    nameKo: meta.nameKo,
    nameEn: meta.nameEn,
    countryKo: meta.countryKo,
    regionKo: REGION_LABEL[meta.region],
    airportCode: meta.airportCode,
    blurb: editorial.blurb,
    days: editorial.days,
    theme,
  };

  // 커뮤니티 목록과 같은 모양으로 바꾼다. 같은 글이 두 화면에서 다르게 보이면 안 된다.
  const cards: PostCardData[] = posts.map((post) => ({
    postId: post.postId,
    title: post.title,
    postType: post.postType,
    postTypeLabel: POST_TYPE_DISPLAY_LABEL[post.postType],
    authorName: post.authorName,
    authorImageUrl: post.authorImageUrl,
    destination: post.destination,
    publishedLabel: formatPublished(post.publishedAt),
    contentPreview: post.content,
    likeCount: post.likeCount,
    likedByMe: post.likedByMe,
    dislikeCount: post.dislikeCount,
    dislikedByMe: post.dislikedByMe,
    bookmarkedByMe: post.bookmarkedByMe,
    commentCount: post.commentCount,
    accent: { background: theme.primary, foreground: theme.onPrimary },
    imageUrls: post.imageUrls,
  }));

  return (
    <>
      <Stack.Screen options={{ title: meta.nameKo, headerTitleAlign: 'center' }} />
      <DestinationDetailView
        destination={destination}
        posts={cards}
        onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
        // ⚠️ 목적지가 따라가지 않는다. TRIP-01(/trips/new/owner)이 destination
        //    param 을 받지 않는다. 받게 하려면 그 화면을 고쳐야 하는데 담당이
        //    달라 손대지 않았다. (CLAUDE.md 13장)
        //    TODO: TRIP-01 이 목적지를 받으면 meta.code 를 함께 넘긴다.
        onPressCreateTrip={() =>
          router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)
        }
      />
    </>
  );
}
