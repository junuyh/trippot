// ============================================================================
// COMM-01 · /community · 커뮤니티 홈
// 기준 문서: docs/09_IA_v1.md §4-1, §4-2, docs/06_이벤트로그정의서_v3.md §7-8
//
// IA 4-2 "여행 팁 목록" 은 별도 화면이 아니라 이 화면의 카테고리다.
//
// 2026-09-03 카테고리를 여행지 중심으로 바꿨다.
//   [전체] [자유]  [여행지 ▾]
//   한 번에 하나만 고른다. 여행지는 수가 계속 늘어나 칩으로 두면 줄이 길어져서
//   셀렉트(바텀시트)로 뺐다.
//
// ⚠️ 여행지 칸은 **글이 실제로 있는 여행지만** 나온다. (getPostDestinations)
//    글을 올리면 그 여행의 목적지 칸이 자동으로 생기거나 숫자가 올라간다.
//    글의 여행지는 연결한 여행(trip_id)에서 나온다 — community_posts 에
//    destination 컬럼이 없다. 그래서 COMM-04 작성 화면에서 여행을 고른다.
//
// ⚠️ 유료 팁(COMM-03)은 2026-08-31 팀 결정으로 뺐다.
// ⚠️ 정렬·서버 검색은 고도화(9/07~)라 넣지 않았다.
// ⚠️ docs/04_화면목록_v3.md 는 COMM 을 '고도화' 로 적고 있어 IA 와 어긋난다.
//    [검토 필요] — 구현은 팀 승인으로 진행했다.
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/community/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  POST_TYPE_DISPLAY_LABEL,
  PostListView,
  type CommunityCategory,
  type PostCardData,
} from '@/components/community';
import { toCoverUrls } from '@/components/community/cover';
import { formatPublished } from '@/components/community/format';
import { ErrorState, Loading } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { POST_TYPE, type PostType } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getPostDestinations,
  getPosts,
  type PostDestinationCount,
  type PostListItem,
} from '@/lib/supabase/queries/community';

/**
 * 카드 윗면 색. 목적지 국가 테마에서 가져온다.
 * 여행이 연결되지 않은 글은 뉴트럴 테마다. (countryTheme 의 기본값)
 */
function toAccent(destination: string | null) {
  const theme = countryTheme(findDestinationByName(destination)?.countryKo);
  return { background: theme.primary, foreground: theme.onPrimary };
}

type LoadState = 'loading' | 'ready' | 'error';

// ── 카테고리 키 ───────────────────────────────────────────────────────────
//
// 카테고리 줄은 하나이고 한 번에 하나만 고른다. 유형 칸과 여행지 칸이 같은 줄에
// 있어서, 무엇으로 걸러야 하는지를 키 앞머리로 가른다.
//
// ⚠️ 이 규칙은 이 파일만 안다. 컴포넌트는 키를 그대로 돌려줄 뿐이다. (CLAUDE.md 9장)
const CATEGORY_ALL = 'all';
const TYPE_PREFIX = 'type:';
const DEST_PREFIX = 'dest:';

/**
 * 유형 칸. 전체 바로 다음에 온다.
 *
 * ⚠️ 2026-09-03 '여행 팁' 칸을 뺐다.
 *    여행 팁은 대부분 여행지 이야기라 여행지 칸과 내용이 겹친다.
 *    같은 글이 두 칸에 걸쳐 있으면 어느 칸을 눌러야 할지 알 수 없다.
 *    여행 팁은 여행지 칸에서 찾고, 유형은 카드 배지로 구분한다.
 *
 * ⚠️ [문서와 어긋남] docs/09_IA_v2.md §4-2 는 '여행 팁 목록' 을 이 화면의
 *    필터로 두라고 적고 있다. 그 칸이 없어졌다. 다만 팁 글이 사라진 것은 아니고
 *    전체·여행지 칸에서 그대로 읽힌다. 문서를 임의로 고치지 않았다. (CLAUDE.md 1-1)
 *
 * ⚠️ 유료 팁과 여행 유형 공유(TYPE_SHARE)도 칸에 없다.
 *    유료는 2026-08-31 팀 결정, TYPE_SHARE 는 아직 쓸 수 있는 글이 없다
 *    (여행 유형 결과 TYPE-01 이 고도화이고 유형 목록도 미확정 — docs/README §5 6번).
 *    다만 전체 목록과 상세에서는 계속 읽힌다. (IA 4-6)
 */
const TYPE_CATEGORIES: { postType: PostType; label: string }[] = [
  { postType: POST_TYPE.POST, label: '자유' },
];

/** 고른 카테고리 키를 조회 조건으로 바꾼다. */
function toQuery(category: string): { postType: PostType | null; destination: string | null } {
  if (category.startsWith(TYPE_PREFIX)) {
    return { postType: category.slice(TYPE_PREFIX.length) as PostType, destination: null };
  }
  if (category.startsWith(DEST_PREFIX)) {
    return { postType: null, destination: category.slice(DEST_PREFIX.length) };
  }
  return { postType: null, destination: null };
}

export default function ScreenCOMM01() {
  useScreenView(SCREENS.TIP_LIST);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [category, setCategory] = useState<string>(CATEGORY_ALL);

  // 여행지 칸 목록. 글 목록과 따로 조회한다. 여행지를 고르면 글 목록만 좁아지는데,
  // 칸 목록까지 같이 좁히면 다른 여행지로 넘어갈 방법이 없어진다.
  const [destinations, setDestinations] = useState<PostDestinationCount[]>([]);

  // 검색어. 서버에 다시 묻지 않고 이미 불러온 글 안에서 거른다.
  // 서버 검색·정렬은 문서상 고도화(9/07~)라 이번에 만들지 않았다.
  const [query, setQuery] = useState('');

  const load = useCallback(async (selected: string) => {
    const { postType, destination } = toQuery(selected);

    // ⚠️ 여기서 setLoadState('loading') 을 하지 않는다. (2026-09-03)
    //    아래 useFocusEffect 때문에 탭에 들어올 때마다 load 가 도는데,
    //    그때마다 loading 으로 바꾸면 목록이 사라졌다 스피너가 번쩍이고
    //    다시 나타난다. 이미 보고 있던 화면이 매번 깜빡이는 셈이라 더 나쁘다.
    //
    //    첫 진입은 useState 초기값 'loading' 이 처리한다.
    //    카테고리를 바꿀 때는 이전 목록이 잠깐 남았다가 새 목록으로 바뀐다.
    //    (모임·마이페이지 탭도 같은 방식이다)
    try {
      // TODO: 로그인 연동 시 교체
      const [rows, destinationRows] = await Promise.all([
        getPosts(DEV_USER_ID, postType ?? undefined, destination),
        getPostDestinations(),
      ]);
      setPosts(rows);
      setDestinations(destinationRows);
      setLoadState('ready');

      // 목록이 실제로 그려진 뒤에 기록한다. 조회 실패까지 진입으로 세면
      // 팁 노출 지표가 부풀려진다. (docs/06 §7-8)
      //
      // 문서가 정한 파라미터는 destination / category / sort 다.
      // 여행지 카테고리가 생기면서 destination 을 드디어 채울 수 있게 됐다.
      //
      // ⚠️ 여행지를 고르지 않았으면 파라미터를 **아예 넣지 않는다.**
      //    'all' 같은 값을 임의로 만들면 문서에 없는 값이 로그에 쌓인다.
      //    (CLAUDE.md 8장, docs/06 §11)
      // ⚠️ category / sort 는 검색·정렬에서 나오는 값이고 그건 고도화라 아직 없다.
      //
      // ⚠️ [로그 변경 알림 — CLAUDE.md 13장] 2026-09-03
      //    조회 시점을 useEffect → useFocusEffect 로 바꾸면서 이 이벤트가
      //    **탭에 들어올 때마다** 발생한다. 전에는 마운트 1회 + 필터 변경 때만이었다.
      //    호출을 지우거나 이름을 바꾸지는 않았다.
      //    '목록 노출' 지표로는 재진입마다 세는 쪽이 맞고,
      //    같은 화면의 useScreenView(SCREENS.TIP_LIST) 도 이미 focus 기준이라
      //    screen_viewed 와 기준이 맞는다.
      //    다만 9/03 이전 데이터와는 기준이 달라진다. 팀에 공유했다.
      track(EVENTS.TIP_LIST_VIEWED, destination ? { destination } : undefined);
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  // ⚠️ useEffect 가 아니라 useFocusEffect 다. (2026-09-03)
  //    글을 쓰면 작성 화면 → 방금 쓴 글 상세로 가고, 거기서 뒤로 나오면
  //    이 화면은 이미 만들어져 있어서 useEffect 가 다시 돌지 않는다.
  //    그래서 새 글도, 그 글이 만든 새 여행지 칸도 나타나지 않았다.
  //    탭으로 돌아올 때마다 다시 조회해야 방금 쓴 글이 바로 보인다.
  useFocusEffect(
    useCallback(() => {
      void load(category);
    }, [load, category]),
  );

  if (loadState === 'loading') {
    return <Loading message="글을 불러오고 있어요" />;
  }

  if (loadState === 'error') {
    return <ErrorState message="글을 불러오지 못했어요." onRetry={() => void load(category)} />;
  }

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
    accent: toAccent(post.destination),
    // TODO: 사진 스키마가 생기면 post.imageUrls 로 바꾼다. [임시]
    imageUrls: toCoverUrls({
      postId: post.postId,
      title: post.title,
      content: post.content,
      destination: post.destination,
    }),
  }));

  // 제목·본문·목적지·작성자 어디에 있어도 찾는다.
  const keyword = query.trim().toLowerCase();
  const shown =
    keyword.length === 0
      ? cards
      : cards.filter((card) =>
          [card.title, card.contentPreview, card.destination, card.authorName]
            .filter(Boolean)
            .some((text) => (text as string).toLowerCase().includes(keyword)),
        );

  // 카테고리 한 줄. 전체 → 자유 → 여행 팁 → 여행지 순이다.
  // 국기는 목적지 상수에서 온다. 컴포넌트가 상수를 뒤지지 않는다. (CLAUDE.md 9장)
  const categories: CommunityCategory[] = [
    { key: CATEGORY_ALL, kind: 'all', label: '전체', flag: null, count: null },
    ...TYPE_CATEGORIES.map((item) => ({
      key: `${TYPE_PREFIX}${item.postType}`,
      kind: 'type' as const,
      label: item.label,
      flag: null,
      // 유형별 글 수는 세지 않는다. 세려면 조회가 한 번 더 는다.
      count: null,
    })),
    ...destinations.map((item) => ({
      key: `${DEST_PREFIX}${item.destination}`,
      kind: 'destination' as const,
      label: item.destination,
      flag: findDestinationByName(item.destination)?.flag ?? null,
      count: item.count,
    })),
  ];

  return (
    <PostListView
      posts={shown}
      categories={categories}
      activeCategory={category}
      onChangeCategory={setCategory}
      query={query}
      onChangeQuery={setQuery}
      onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
      onPressWrite={() => router.push('/community/write')}
    />
  );
}
