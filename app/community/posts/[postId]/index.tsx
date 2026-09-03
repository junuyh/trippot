// ============================================================================
// COMM-02 · /community/posts/:postId · 게시글 / 팁 상세
// 기준 문서: docs/09_IA_v1.md §4-3, §4-6
//
// IA 4-6 "여행 결과 공유 게시글" 도 이 화면이 그린다. post_type 으로만 구분한다.
//
// ⚠️ 유료 팁(COMM-03)은 2026-08-31 팀 결정으로 뺐다.
//    댓글은 그때 함께 뺐다가 2026-09-02 에 다시 넣었다.
//
// ⚠️ **찜·싫어요는 아직 못 만든다.** reactions.reaction_type 이
//    check (…in ('LIKE')) 라 다른 값은 DB 가 거부한다.
//    CHECK 를 넓히는 마이그레이션은 DB 담당자만 한다. (CLAUDE.md 1장)
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

import {
  CommentSection,
  POST_TYPE_DISPLAY_LABEL,
  PostDetailView,
  type PostCommentItem,
  type PostDetailData,
} from '@/components/community';
import { toCoverUrls } from '@/components/community/cover';
import { formatPublished } from '@/components/community/format';
import { ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { countryTheme } from '@/lib/constants/countryTheme';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { findDestinationByName } from '@/lib/constants/destinations';
import { REACTION_TYPE } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  addReaction,
  createComment,
  deleteComment,
  getComments,
  getPostById,
  removeReaction,
  type PostComment,
  type PostDetail,
} from '@/lib/supabase/queries/community';

/** 댓글 길이 상한. 본문(2000자)보다 짧게 둔다. */
const COMMENT_MAX = 500;

/**
 * 카드 윗면 색. 목적지 국가 테마에서 가져온다.
 * 여행이 연결되지 않은 글은 뉴트럴 테마다. (countryTheme 의 기본값)
 */
function toAccent(destination: string | null) {
  const theme = countryTheme(findDestinationByName(destination)?.countryKo);
  return { background: theme.primary, foreground: theme.onPrimary };
}

type LoadState = 'loading' | 'ready' | 'error' | 'notFound';

export default function ScreenCOMM02() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  useScreenView(SCREENS.TIP_DETAIL);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [post, setPost] = useState<PostDetail | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [dislikeBusy, setDislikeBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) {
      setLoadState('notFound');
      return;
    }

    setLoadState('loading');
    try {
      // TODO: 로그인 연동 시 교체
      // 글과 댓글을 함께 부른다. 댓글만 늦게 뜨면 화면이 두 번 움직인다.
      const [detail, nextComments] = await Promise.all([
        getPostById(postId, DEV_USER_ID),
        getComments(postId, DEV_USER_ID),
      ]);
      if (!detail) {
        setLoadState('notFound');
        return;
      }
      setPost(detail);
      setComments(nextComments);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 좋아요 / 싫어요 토글.
   *
   * 둘은 함께 켜지지 않는다. 싫어요를 누르면 눌려 있던 좋아요를 거둔다.
   * 같은 글에 찬성과 반대를 동시에 남기는 건 말이 되지 않는다.
   * (DB 는 둘 다 허용한다 — 복합 PK 라 종류가 다르면 다른 행이다. 정책은 여기서 정한다)
   *
   * 먼저 화면을 바꾸고 저장한다. 실패하면 원래대로 되돌린다.
   */
  async function handleToggleOpinion(kind: 'like' | 'dislike') {
    // 중복 요청 방지. 연타하면 개수가 어긋난다.
    if (!post || likeBusy || dislikeBusy) return;

    const liking = kind === 'like';
    const next = liking ? !post.likedByMe : !post.dislikedByMe;
    // 켜는 경우에만 반대쪽을 거둔다. 끄는 중이라면 건드릴 게 없다.
    const dropOther = next && (liking ? post.dislikedByMe : post.likedByMe);

    const before = post;
    if (liking) setLikeBusy(true);
    else setDislikeBusy(true);

    setPost({
      ...post,
      likedByMe: liking ? next : dropOther ? false : post.likedByMe,
      likeCount:
        post.likeCount + (liking ? (next ? 1 : -1) : dropOther ? -1 : 0),
      dislikedByMe: liking ? (dropOther ? false : post.dislikedByMe) : next,
      dislikeCount:
        post.dislikeCount + (liking ? (dropOther ? -1 : 0) : next ? 1 : -1),
    });

    try {
      // TODO: 로그인 연동 시 교체
      const mine = liking ? REACTION_TYPE.LIKE : REACTION_TYPE.DISLIKE;
      const other = liking ? REACTION_TYPE.DISLIKE : REACTION_TYPE.LIKE;

      if (next) await addReaction(post.postId, DEV_USER_ID, mine);
      else await removeReaction(post.postId, DEV_USER_ID, mine);
      if (dropOther) await removeReaction(post.postId, DEV_USER_ID, other);
      // ⚠️ TIP_REACTED 는 고도화 블록 + ADVANCED_EVENT_NAMES 라 부르지 않는다.
      //    TODO: 고도화 착수 시 붙인다. (docs/06 §7-8)
    } catch {
      setPost(before);
    } finally {
      if (liking) setLikeBusy(false);
      else setDislikeBusy(false);
    }
  }

  /** 찜 토글. 좋아요·싫어요와 별개라 서로 건드리지 않는다. */
  async function handleToggleBookmark() {
    if (!post || bookmarkBusy) return;

    const next = !post.bookmarkedByMe;
    const before = post;
    setBookmarkBusy(true);
    setPost({ ...post, bookmarkedByMe: next });

    try {
      // TODO: 로그인 연동 시 교체
      if (next) await addReaction(post.postId, DEV_USER_ID, REACTION_TYPE.BOOKMARK);
      else await removeReaction(post.postId, DEV_USER_ID, REACTION_TYPE.BOOKMARK);
    } catch {
      setPost(before);
    } finally {
      setBookmarkBusy(false);
    }
  }

  async function handleSubmitComment() {
    const content = draft.trim();
    // 저장 중 중복 제출 방지. (CLAUDE.md 9장)
    if (!post || commentBusy || content.length === 0) return;

    setCommentBusy(true);
    setCommentError(null);
    try {
      // TODO: 로그인 연동 시 교체
      const created = await createComment({
        postId: post.postId,
        authorUserId: DEV_USER_ID,
        content,
      });
      // 다시 조회하지 않고 방금 쓴 댓글만 붙인다. 목록이 깜빡이지 않는다.
      setComments((prev) => [...prev, created]);
      setPost({ ...post, commentCount: post.commentCount + 1 });
      setDraft('');
    } catch {
      // 예외 객체를 그대로 노출하지 않는다.
      setCommentError('댓글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!post || deletingId !== null) return;

    setDeletingId(commentId);
    setCommentError(null);
    try {
      // TODO: 로그인 연동 시 교체
      await deleteComment(commentId, DEV_USER_ID);
      setComments((prev) => prev.filter((comment) => comment.commentId !== commentId));
      setPost({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
    } catch {
      setCommentError('댓글을 지우지 못했어요.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loadState === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: '글', headerTitleAlign: 'center' }} />
        <Loading message="글을 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'notFound') {
    return (
      <>
        <Stack.Screen options={{ title: '글', headerTitleAlign: 'center' }} />
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
        <Stack.Screen options={{ title: '글', headerTitleAlign: 'center' }} />
        <ErrorState message="글을 불러오지 못했어요." onRetry={() => void load()} />
      </>
    );
  }

  const data: PostDetailData = {
    postId: post.postId,
    title: post.title,
    postType: post.postType,
    postTypeLabel: POST_TYPE_DISPLAY_LABEL[post.postType],
    authorName: post.authorName,
    authorImageUrl: post.authorImageUrl,
    destination: post.destination,
    publishedLabel: formatPublished(post.publishedAt),
    contentPreview: post.content,
    content: post.content,
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
  };

  const commentItems: PostCommentItem[] = comments.map((comment) => ({
    commentId: comment.commentId,
    authorName: comment.authorName,
    authorImageUrl: comment.authorImageUrl,
    content: comment.content,
    // 컴포넌트가 날짜를 계산하지 않는다. 여기서 문자열로 바꿔 넘긴다.
    createdLabel: formatPublished(comment.createdAt) ?? '',
    mine: comment.mine,
  }));

  return (
    <>
      <Stack.Screen
        options={{
          title: POST_TYPE_DISPLAY_LABEL[post.postType],
          headerTitleAlign: 'center',
        }}
      />
      <PostDetailView
        post={data}
        likeBusy={likeBusy}
        onToggleLike={() => void handleToggleOpinion('like')}
        dislikeBusy={dislikeBusy}
        onToggleDislike={() => void handleToggleOpinion('dislike')}
        bookmarkBusy={bookmarkBusy}
        onToggleBookmark={() => void handleToggleBookmark()}
        commentSection={
          <CommentSection
            comments={commentItems}
            draft={draft}
            onChangeDraft={setDraft}
            onSubmit={() => void handleSubmitComment()}
            submitting={commentBusy}
            error={commentError}
            onDelete={(commentId) => void handleDeleteComment(commentId)}
            deletingId={deletingId}
            maxLength={COMMENT_MAX}
          />
        }
      />
    </>
  );
}
