// ============================================================================
// COMM-01 · /community · 커뮤니티 홈
// 기준 문서: docs/09_IA_v1.md §4-1, §4-2, docs/06_이벤트로그정의서_v2.md §7-8
//
// IA 4-2 "여행 팁 목록" 은 별도 화면이 아니라 이 화면의 유형 필터다.
//
// ⚠️ 유료 팁(COMM-03)과 댓글은 2026-08-31 팀 결정으로 뺐다.
// ⚠️ 정렬·검색은 고도화(9/07~)라 넣지 않았다.
// ⚠️ docs/04_화면목록_v3.md 는 COMM 을 '고도화' 로 적고 있어 IA 와 어긋난다.
//    [검토 필요] — 구현은 팀 승인으로 진행했다.
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/community/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { PostListView, type PostCardData, type PostFilter } from '@/components/community';
import { toCoverUrls } from '@/components/community/cover';
import { formatPublished } from '@/components/community/format';
import { ErrorState, Loading } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { countryTheme } from '@/lib/constants/countryTheme';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { findDestinationByName } from '@/lib/constants/destinations';
import { POST_TYPE, POST_TYPE_LABEL, type PostType } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getPosts, type PostListItem } from '@/lib/supabase/queries/community';

/**
 * 카드 윗면 색. 목적지 국가 테마에서 가져온다.
 * 여행이 연결되지 않은 글은 뉴트럴 테마다. (countryTheme 의 기본값)
 */
function toAccent(destination: string | null) {
  const theme = countryTheme(findDestinationByName(destination)?.countryKo);
  return { background: theme.primary, foreground: theme.onPrimary };
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * 유형 필터.
 *
 * ⚠️ 유료 팁과 여행 유형 공유(TYPE_SHARE)는 칩에서 뺐다.
 *    유료는 2026-08-31 팀 결정, TYPE_SHARE 는 아직 쓸 수 있는 글이 없다
 *    (여행 유형 결과 TYPE-01 이 고도화이고 유형 목록도 미확정 — docs/README §5 6번).
 *    다만 전체 목록과 상세에서는 계속 읽힌다. (IA 4-6)
 */
const FILTERS: PostFilter[] = [
  { value: null, label: '전체' },
  { value: POST_TYPE.FREE_TIP, label: '여행 팁' },
  { value: POST_TYPE.POST, label: '자유' },
];

export default function ScreenCOMM01() {
  useScreenView(SCREENS.TIP_LIST);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [filter, setFilter] = useState<PostType | null>(null);

  // 검색어. 서버에 다시 묻지 않고 이미 불러온 글 안에서 거른다.
  // 서버 검색·정렬은 문서상 고도화(9/07~)라 이번에 만들지 않았다.
  const [query, setQuery] = useState('');

  const load = useCallback(async (postType: PostType | null) => {
    setLoadState('loading');
    try {
      // TODO: 로그인 연동 시 교체
      const rows = await getPosts(DEV_USER_ID, postType ?? undefined);
      setPosts(rows);
      setLoadState('ready');

      // 목록이 실제로 그려진 뒤에 기록한다. 조회 실패까지 진입으로 세면
      // 팁 노출 지표가 부풀려진다. (docs/06 §7-8)
      //
      // ⚠️ 문서가 정한 파라미터는 destination / category / sort 뿐이다.
      //    셋 다 검색·정렬에서 나오는 값인데 그건 고도화라 이 화면에 없다.
      //    문서에 없는 파라미터를 임의로 만들지 않는다. (CLAUDE.md 8장, docs/06 §11)
      track(EVENTS.TIP_LIST_VIEWED);
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  if (loadState === 'loading') {
    return <Loading message="글을 불러오고 있어요" />;
  }

  if (loadState === 'error') {
    return <ErrorState message="글을 불러오지 못했어요." onRetry={() => void load(filter)} />;
  }

  const cards: PostCardData[] = posts.map((post) => ({
    postId: post.postId,
    title: post.title,
    postType: post.postType,
    postTypeLabel: POST_TYPE_LABEL[post.postType],
    authorName: post.authorName,
    destination: post.destination,
    publishedLabel: formatPublished(post.publishedAt),
    contentPreview: post.content,
    likeCount: post.likeCount,
    likedByMe: post.likedByMe,
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

  return (
    <PostListView
      posts={shown}
      filters={FILTERS}
      activeFilter={filter}
      onChangeFilter={setFilter}
      query={query}
      onChangeQuery={setQuery}
      onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
      onPressWrite={() => router.push('/community/write')}
    />
  );
}
