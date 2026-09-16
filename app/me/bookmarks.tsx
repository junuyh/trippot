// ============================================================================
// 저장된 게시물 (MY-01 → 내 커뮤니티 활동 → 저장된 게시물) · 2026-09-17
//
// 내가 찜(BOOKMARK)한 글만 **저장한 순서대로** 본다. 누르면 커뮤니티 상세로 간다.
// 좋아요 화면(app/me/likes.tsx)과 같은 구조다. 반응 종류만 다르다.
//
// ⚠️ 좋아요(LIKE) · 싫어요(DISLIKE) 는 여기 섞지 않는다. BOOKMARK 만이다.
// ⚠️ 왼쪽으로 밀면 저장을 해제한다. 확인창을 한 번 거친다.
//    **글은 지우지 않는다.** 내 reaction 만 없앤다.
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ConfirmModal, MyPostList } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { REACTION_TYPE } from '@/lib/constants/status';
import {
  getMyBookmarkedPosts,
  removeReaction,
  type MyPostListItem,
} from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyBookmarks() {
  const userId = useCurrentUserId();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<MyPostListItem[]>([]);
  /** 확인창에 올라온 글. null 이면 창이 닫혀 있다. */
  const [removingPostId, setRemovingPostId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      const rows = await getMyBookmarkedPosts(userId);
      setPosts(rows);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  // 상세에서 저장하거나 해제하고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 저장 해제 확정.
   *
   * ⚠️ 확인 전에는 DB 요청을 보내지 않는다. 낙관적으로 먼저 빼지도 않는다. (좋아요 취소와 같은 순서)
   * ⚠️ removeReaction(BOOKMARK) 은 **내 reaction 하나만** 지운다. 글도, 다른 사람의 저장도 건드리지 않는다.
   */
  async function handleConfirmRemove() {
    if (!removingPostId || !userId || removing) return;

    setRemoving(true);
    setRemoveError(null);
    try {
      await removeReaction(removingPostId, userId, REACTION_TYPE.BOOKMARK);
      setPosts((prev) => prev.filter((row) => row.postId !== removingPostId));
      setRemovingPostId(null);
    } catch {
      // 목록은 그대로 두고 창 안에 이유를 남긴다.
      setRemoveError('저장을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    // 바탕은 홈과 같은 pot-visual. Loading·Empty·Error 도 같은 바탕 위에 온다.
    <View className="flex-1 bg-pot-visual">
      <Stack.Screen options={{ title: '저장된 게시물', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="저장한 게시물을 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' && posts.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="저장한 게시물이 없어요."
          description="커뮤니티에서 다시 보고 싶은 글을 저장해 보세요."
        />
      ) : null}
      {loadState === 'ready' && posts.length > 0 ? (
        <MyPostList
          posts={posts}
          onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
          swipeAction={{
            label: '저장\n해제',
            icon: 'bookmark-outline',
            // ⚠️ 삭제 빨강을 쓰지 않는다. 글이 지워지는 것으로 읽히면 안 된다.
            color: '#8B94A2',
            onPress: (postId) => {
              setRemoveError(null);
              setRemovingPostId(postId);
            },
          }}
        />
      ) : null}

      {/* ⚠️ 되돌릴 수 있는 동작이라 destructive 를 켜지 않는다. */}
      <ConfirmModal
        visible={removingPostId !== null}
        title="저장을 해제하시겠어요?"
        confirmLabel="저장 해제"
        busy={removing}
        error={removeError}
        onCancel={() => setRemovingPostId(null)}
        onConfirm={() => void handleConfirmRemove()}
      />
    </View>
  );
}
