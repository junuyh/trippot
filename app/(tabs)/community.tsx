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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  POST_TYPE_DISPLAY_LABEL,
  PostListView,
  type CommunityCategory,
  type PostCardData,
} from '@/components/community';
import { formatPublished } from '@/components/community/format';
import { ErrorState, Loading } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
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
 * ⚠️ 2026-09-21 '여행 팁' 칸을 **다시 넣었다.**
 *    2026-09-03 에 뺐던 이유는 "여행 팁은 대부분 여행지 이야기라 여행지 칸과
 *    겹친다" 였다. 겹치는 것은 맞지만, 그때 놓친 것이 두 가지다.
 *      ① 여행지 칸은 **12개 목적지 중 글이 있는 곳만** 나온다. 목적지를 고르지
 *         않은 팁(여행에 연결하지 않고 쓴 글)은 '전체' 말고 갈 칸이 없었다.
 *      ② 팁만 모아 읽고 싶을 때 여행지를 하나씩 눌러 다녀야 했다. 여행지 칸은
 *         '어디' 로 좁히는 칸이지 '무엇' 으로 좁히는 칸이 아니다.
 *    겹침은 문제가 아니다 — '여행 팁'(무엇)과 '도쿄'(어디)는 좁히는 축이 달라서,
 *    같은 글이 두 칸에 나오는 것이 자연스럽다. '자유' 와 여행지 칸의 관계와 같다.
 *
 * ⚠️ 이 칸은 **목적지와 무관하게 모든 팁**을 보여준다. 여행지 칸은 그 여행지의
 *    팁만 보여준다. (toQuery)
 *
 * ⚠️ [문서와 맞음] docs/09_IA_v2.md §4-2 가 '여행 팁 목록' 을 이 화면의 필터로
 *    두라고 적고 있다. 2026-09-03~09-21 사이에만 어긋나 있었고 이제 문서대로다.
 *
 * ⚠️ 유료 팁과 여행 유형 공유(TYPE_SHARE)도 칸에 없다.
 *    유료는 2026-08-31 팀 결정, TYPE_SHARE 는 아직 쓸 수 있는 글이 없다
 *    (여행 유형 결과 TYPE-01 이 고도화이고 유형 목록도 미확정 — docs/README §5 6번).
 *    다만 전체 목록과 상세에서는 계속 읽힌다. (IA 4-6)
 */
const TYPE_CATEGORIES: { postType: PostType; label: string }[] = [
  { postType: POST_TYPE.POST, label: '자유' },
  { postType: POST_TYPE.FREE_TIP, label: '여행 팁' },
];

/** 고른 카테고리 키를 조회 조건으로 바꾼다. */
function toQuery(category: string): { postType: PostType | null; destination: string | null } {
  if (category.startsWith(TYPE_PREFIX)) {
    return { postType: category.slice(TYPE_PREFIX.length) as PostType, destination: null };
  }
  if (category.startsWith(DEST_PREFIX)) {
    // ⚠️ 2026-09-17 여행지 칸은 **여행 팁만** 보여준다. 자유 글은 '자유' 칸에서 본다.
    //    여행지를 골랐는데 여행과 상관없는 잡담이 섞이면 팁을 찾기 어렵다.
    //    칸의 글 수도 같은 기준으로 센다. (getPostDestinations)
    return { postType: POST_TYPE.FREE_TIP, destination: category.slice(DEST_PREFIX.length) };
  }
  return { postType: null, destination: null };
}

export default function ScreenCOMM01() {
  // 로그인한 사용자. 좋아요·북마크 여부가 이 값으로 갈린다.
  // 가드가 미로그인 상태를 막고 있어 여기서는 항상 값이 있다.
  const userId = useCurrentUserId();
  useScreenView(SCREENS.TIP_LIST);

  const router = useRouter();

  /**
   * 홈에서 넘어온 여행지. (2026-09-09)
   *
   * 신규 사용자 홈의 '여행자들은 이렇게 다녀왔어요' 태그를 누르면 그 여행지 글만 보이는
   * 상태로 이 화면이 열린다. (app/(tabs)/index.tsx handlePressDiscovery)
   *
   * ⚠️ 값은 **한글 도시명**이다. 여행지 필터가 글에 연결된 여행의
   *    trips.destination 으로 거르는데 그 칼럼이 한글 도시명이라서다.
   */
  const params = useLocalSearchParams<{ destination?: string; openedAt?: string }>();
  // 빈 문자열은 '여행지 없음(전체)' 이다. 홈 '전체 보기' 가 이전 여행지 값을 지우려고 보낸다.
  const destinationParam =
    typeof params.destination === 'string' && params.destination !== '' ? params.destination : null;
  /**
   * 홈에서 이 화면을 연 시각. 누를 때마다 값이 달라진다. (2026-09-17)
   *
   * ⚠️ 여행지 값만 보면 **같은 버튼을 두 번 눌렀을 때** 값이 그대로라 아래 effect 가 돌지 않는다.
   *    '전체 보기' → 안에서 도쿄 칸 선택 → 홈 → 다시 '전체 보기' 면 도쿄가 그대로 남는다.
   *    홈에서 들어올 때마다 새 값을 붙여 매번 다시 맞춘다.
   */
  const openedAt = typeof params.openedAt === 'string' ? params.openedAt : null;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  /** 아래로 당겨 새로고침 중인가. 스피너 표시에만 쓴다. */
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [category, setCategory] = useState<string>(
    destinationParam ? `${DEST_PREFIX}${destinationParam}` : CATEGORY_ALL,
  );

  // 여행지 칸 목록. 글 목록과 따로 조회한다. 여행지를 고르면 글 목록만 좁아지는데,
  // 칸 목록까지 같이 좁히면 다른 여행지로 넘어갈 방법이 없어진다.
  const [destinations, setDestinations] = useState<PostDestinationCount[]>([]);

  // 검색어. 서버에 다시 묻지 않고 이미 불러온 글 안에서 거른다.
  // 서버 검색·정렬은 문서상 고도화(9/07~)라 이번에 만들지 않았다.
  const [query, setQuery] = useState('');

  /**
   * 홈에서 여행지를 지정해 들어온 경우 그 칸을 고른다. (2026-09-09)
   *
   * ⚠️ useState 초기값만으로는 모자란다. 탭은 화면을 살려 두기 때문에
   *    (unmountOnBlur 없음) 커뮤니티에 한 번 들어왔다 나간 사람이 홈에서 태그를
   *    누르면 이 화면이 이미 만들어져 있어 초기값이 다시 쓰이지 않는다.
   *
   * ⚠️ 홈에서 들어올 때(destinationParam · openedAt 이 바뀔 때)만 돈다. 사용자가 화면 안에서
   *    다른 칸을 직접 고른 뒤에는 다시 덮어쓰지 않는다. 하단 탭으로 들어오면 그대로다.
   *
   * ⚠️ 2026-09-17 여행지 없이 들어오면(홈 '전체 보기') **전체 칸으로 되돌린다.**
   *    전에는 여행지가 없으면 그냥 return 해서, 도쿄 태그로 들어왔다가 홈에서 '전체 보기' 를
   *    눌러도 도쿄 글만 보였다.
   */
  useEffect(() => {
    if (destinationParam) {
      setCategory(`${DEST_PREFIX}${destinationParam}`);
      return;
    }
    if (openedAt) setCategory(CATEGORY_ALL);
  }, [destinationParam, openedAt]);

  const load = useCallback(async (selected: string) => {
    if (!userId) return;

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
      const [rows, destinationRows] = await Promise.all([
        getPosts(userId, postType ?? undefined, destination),
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
  }, [userId]);

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

  /**
   * 아래로 당겨 새로고침. (2026-09-22 · 홈과 같은 방식)
   *
   * 탭에 들어올 때마다 다시 조회하지만(위 useFocusEffect), 탭에 머문 채로 다른 사람이
   * 쓴 새 글을 보려면 직접 다시 부를 길이 필요하다. 지금 고른 카테고리 그대로 다시 읽는다.
   *
   * ⚠️ [로그 알림 — CLAUDE.md 13장] load 안의 TIP_LIST_VIEWED 가 당길 때마다 한 번 더 찍힌다.
   *    호출은 지우거나 바꾸지 않았다. 이 이벤트는 이미 '탭에 들어올 때마다' 찍히는 목록 노출
   *    기준이라(위 load 주석 2026-09-03), 목록을 다시 받아 보는 새로고침도 같은 노출로 센다.
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(category);
    } finally {
      setRefreshing(false);
    }
  }, [load, category]);

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
    // ⚠️ 글쓴이가 올린 사진만 그린다. 사진이 없는 글은 사진 없이 보인다.
    //    전에는 제목·목적지로 loremflickr 에서 아무 사진이나 끌어와 채웠는데,
    //    글과 상관없는 사진이 그 글의 사진인 것처럼 보였다. (2026-09-07)
    imageUrls: post.imageUrls,
  }));

  // 제목·본문·목적지 어디에 있어도 찾는다.
  // ⚠️ 작성자는 찾지 않는다. 커뮤니티는 익명이라 모든 글의 작성자가 같은 말이다.
  //    남겨 두면 "익명" 한 번에 전체 글이 걸린다. (2026-09-21)
  const keyword = query.trim().toLowerCase();
  const shown =
    keyword.length === 0
      ? cards
      : cards.filter((card) =>
          [card.title, card.contentPreview, card.destination]
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

  /**
   * 고른 칸이 목록에 없으면 만들어 넣는다. (2026-09-09)
   *
   * 홈에서 넘어오는 사이에 그 여행지의 마지막 글이 지워지면 칸이 사라진다.
   * 그러면 글 목록은 그 여행지로 걸러져 비어 있는데 어느 칸이 골라졌는지는
   * 화면에 안 보인다. 사용자는 글이 왜 없는지 알 수 없다.
   */
  if (category.startsWith(DEST_PREFIX) && !categories.some((item) => item.key === category)) {
    const name = category.slice(DEST_PREFIX.length);
    categories.push({
      key: category,
      kind: 'destination',
      label: name,
      flag: findDestinationByName(name)?.flag ?? null,
      count: 0,
    });
  }

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
      refreshing={refreshing}
      onRefresh={() => void handleRefresh()}
    />
  );
}
