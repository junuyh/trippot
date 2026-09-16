// ============================================================================
// 작성한 댓글 (MY-01 → 내 커뮤니티 활동 → 작성한 댓글)
//
// 내가 쓴 댓글만 최신순으로 본다. 누르면 그 댓글이 달린 커뮤니티 글로 간다.
// 댓글 상세 화면은 만들지 않는다.
//
// ⚠️ 왼쪽으로 밀면 삭제한다. 확인창을 한 번 거친다. deleteComment 는 status 를
//    DELETED 로 바꾸는 soft delete 다. 커뮤니티 상세가 쓰는 것과 같은 함수·같은
//    정책이다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ConfirmModal, MyCommentList } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import {
  deleteComment,
  getMyComments,
  type MyCommentListItem,
} from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyComments() {
  const userId = useCurrentUserId();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [comments, setComments] = useState<MyCommentListItem[]>([]);
  /** 확인창에 올라온 댓글. null 이면 창이 닫혀 있다. */
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      const rows = await getMyComments(userId);
      setComments(rows);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  // 글 상세에서 댓글을 쓰거나 지우고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 삭제 확정.
   *
   * ⚠️ 확인 전에는 DB 요청을 보내지 않는다. 낙관적으로 먼저 지우지도 않는다.
   *    되돌릴 수 없는 동작이라 서버가 지웠다고 답한 뒤에 목록에서 뺀다.
   *    작성한 게시글 삭제와 같은 방식이다. (app/me/posts.tsx)
   *
   * ⚠️ deleteComment 는 author_user_id 로 좁혀 **내 댓글만** 지운다.
   */
  async function handleConfirmDelete() {
    if (!deletingCommentId || !userId || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteComment(deletingCommentId, userId);
      setComments((prev) => prev.filter((row) => row.commentId !== deletingCommentId));
      setDeletingCommentId(null);
    } catch {
      // 목록은 그대로 두고 창 안에 이유를 남긴다. 창을 닫고 알리면 무엇이
      // 실패했는지 흐려진다.
      setDeleteError('댓글을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    // 바탕은 작성한 게시글·좋아요와 같은 pot-visual 이다.
    <View className="flex-1 bg-brand-soft">
      <Stack.Screen options={{ title: '작성한 댓글', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="댓글을 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' && comments.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title="아직 작성한 댓글이 없어요."
          description="커뮤니티 글에 생각을 남겨 보세요."
        />
      ) : null}
      {loadState === 'ready' && comments.length > 0 ? (
        <MyCommentList
          comments={comments}
          onPressComment={(postId) => router.push(`/community/posts/${postId}`)}
          onDeleteComment={(commentId) => {
            setDeleteError(null);
            setDeletingCommentId(commentId);
          }}
        />
      ) : null}

      <ConfirmModal
        visible={deletingCommentId !== null}
        title="댓글을 삭제하시겠어요?"
        description="삭제한 댓글은 되돌릴 수 없어요."
        confirmLabel="삭제"
        destructive
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeletingCommentId(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </View>
  );
}
