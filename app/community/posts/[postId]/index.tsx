// ============================================================================
// COMM-02 · /community/posts/:postId · 게시글 / 팁 상세
// 기준 문서: docs/09_IA_v1.md §4-3, §4-6
//
// IA 4-6 "여행 결과 공유 게시글" 도 이 화면이 그린다. post_type 으로만 구분한다.
//
// ⚠️ 유료 팁(COMM-03)과 댓글은 2026-08-31 팀 결정으로 뺐다.
//    평가 · 찜은 고도화(9/07~)라 넣지 않았다.
//
// ⚠️ 진입 이벤트 TIP_DETAIL_VIEWED 는 lib/analytics/events.ts 의 고도화 블록에 있고
//    ADVANCED_EVENT_NAMES 에 등록돼 있어 호출하면 track() 이 경고한다. 부르지 않는다.
//    screen_viewed(tip_detail) 만 남긴다 — SCREENS.TIP_DETAIL 은 MVP 17개 목록에 있다.
//    TODO: 고도화 착수 시 TIP_DETAIL_VIEWED 를 붙인다. (docs/06 §7-8)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/community/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { PostDetailView, type PostDetailData } from '@/components/community';
import { formatPublished } from '@/components/community/format';
import { ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { POST_TYPE_LABEL } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  addLike,
  getPostById,
  removeLike,
  type PostDetail,
} from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

export default function ScreenCOMM02() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  useScreenView(SCREENS.TIP_DETAIL);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [post, setPost] = useState<PostDetail | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);

  const load = useCallback(async () => {
    if (!postId) {
      setLoadState('notFound');
      return;
    }

    setLoadState('loading');
    try {
      // TODO: 로그인 연동 시 교체
      const detail = await getPostById(postId, DEV_USER_ID);
      if (!detail) {
        setLoadState('notFound');
        return;
      }
      setPost(detail);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleLike() {
    // 중복 요청 방지. 연타하면 좋아요 수가 어긋난다.
    if (!post || likeBusy) return;

    const next = !post.likedByMe;
    setLikeBusy(true);
    // 먼저 화면을 바꾸고 저장한다. 실패하면 되돌린다.
    setPost({
      ...post,
      likedByMe: next,
      likeCount: post.likeCount + (next ? 1 : -1),
    });

    try {
      // TODO: 로그인 연동 시 교체
      if (next) await addLike(post.postId, DEV_USER_ID);
      else await removeLike(post.postId, DEV_USER_ID);
      // ⚠️ TIP_REACTED 는 고도화 블록 + ADVANCED_EVENT_NAMES 라 부르지 않는다.
      //    TODO: 고도화 착수 시 붙인다. (docs/06 §7-8)
    } catch {
      setPost(post);
    } finally {
      setLikeBusy(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: '글' }} />
        <Loading message="글을 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'notFound') {
    return (
      <>
        <Stack.Screen options={{ title: '글' }} />
        <ErrorState
          message="찾을 수 없는 글이에요."
          retryLabel="뒤로"
          onRetry={() => router.back()}
        />
      </>
    );
  }

  if (loadState === 'error' || !post) {
    return (
      <>
        <Stack.Screen options={{ title: '글' }} />
        <ErrorState message="글을 불러오지 못했어요." onRetry={() => void load()} />
      </>
    );
  }

  const data: PostDetailData = {
    postId: post.postId,
    title: post.title,
    postType: post.postType,
    postTypeLabel: POST_TYPE_LABEL[post.postType],
    authorName: post.authorName,
    destination: post.destination,
    publishedLabel: formatPublished(post.publishedAt),
    content: post.content,
    likeCount: post.likeCount,
    likedByMe: post.likedByMe,
  };

  return (
    <>
      <Stack.Screen options={{ title: POST_TYPE_LABEL[post.postType] }} />
      <PostDetailView
        post={data}
        likeBusy={likeBusy}
        onToggleLike={() => void handleToggleLike()}
      />
    </>
  );
}
