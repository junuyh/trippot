// ============================================================================
// 작성한 게시글 (MY-01 → 내 커뮤니티 활동 → 작성한 게시글)
//
// 내가 쓴 글만 최신순으로 본다. 누르면 기존 커뮤니티 상세로 간다.
// 별도 상세 화면을 만들지 않는다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PostDeleteConfirmModal } from '@/components/community/PostDeleteConfirmModal';
import { MyPostList, MY_PAGE_BG } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { deletePost, getMyPosts, type MyPostListItem } from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyPosts() {
  const userId = useCurrentUserId();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<MyPostListItem[]>([]);
  /** 삭제 확인창에 올라온 글. null 이면 창이 닫혀 있다. */
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      const rows = await getMyPosts(userId);
      setPosts(rows);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  // 글을 쓰거나 지우고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 삭제 확정.
   *
   * ⚠️ 좋아요 취소와 달리 낙관적으로 지우지 않는다. 되돌릴 수 없는 동작이라
   *    서버가 지웠다고 답한 뒤에 목록에서 뺀다. 실패하면 확인창 안에 그대로
   *    이유를 보여준다. (components/community/PostDeleteConfirmModal)
   *
   * ⚠️ deletePost 는 status 를 DELETED 로 바꾸는 soft delete 다. 행을 지우지
   *    않는다. 커뮤니티가 쓰는 것과 같은 함수·같은 정책이다.
   */
  async function handleConfirmDelete() {
    if (!deletingPostId || !userId || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePost(deletingPostId, userId);
      setPosts((prev) => prev.filter((row) => row.postId !== deletingPostId));
      setDeletingPostId(null);
    } catch {
      setDeleteError('글을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    // 바탕은 홈과 같은 pot-visual. Loading·Empty·Error 도 같은 바탕 위에 온다.
    <View className="flex-1" style={{ backgroundColor: MY_PAGE_BG }}>
      <Stack.Screen options={{ title: '작성한 게시글', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="게시글을 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' && posts.length === 0 ? (
        <EmptyState
          icon="create-outline"
          title="아직 작성한 게시글이 없어요."
          description="커뮤니티에 여행 이야기를 남겨 보세요."
        />
      ) : null}
      {loadState === 'ready' && posts.length > 0 ? (
        <MyPostList
          posts={posts}
          onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
          swipeAction={{
            label: '삭제',
            icon: 'trash-outline',
            color: '#F0424E',
            onPress: (postId) => {
              setDeleteError(null);
              setDeletingPostId(postId);
            },
          }}
        />
      ) : null}

      <PostDeleteConfirmModal
        visible={deletingPostId !== null}
        deleting={deleting}
        error={deleteError}
        onCancel={() => setDeletingPostId(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </View>
  );
}
