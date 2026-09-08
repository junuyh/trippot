// ============================================================================
// 좋아요 (MY-01 → 내 커뮤니티 활동 → 좋아요)
//
// 내가 좋아요를 누른 글만 **누른 순서대로** 본다. 누르면 커뮤니티 상세로 간다.
//
// ⚠️ 찜(BOOKMARK) · 싫어요(DISLIKE) 는 여기 섞지 않는다. LIKE 만이다.
// ⚠️ 왼쪽으로 밀면 좋아요를 취소한다. 확인창을 한 번 거친다.
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
import {
  getMyLikedPosts,
  removeLike,
  type MyPostListItem,
} from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyLikes() {
  const userId = useCurrentUserId();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<MyPostListItem[]>([]);
  /** 확인창에 올라온 글. null 이면 창이 닫혀 있다. */
  const [unlikingPostId, setUnlikingPostId] = useState<string | null>(null);
  const [unliking, setUnliking] = useState(false);
  const [unlikeError, setUnlikeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      const rows = await getMyLikedPosts(userId);
      setPosts(rows);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  // 상세에서 좋아요를 누르거나 취소하고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 좋아요 취소 확정.
   *
   * ⚠️ 확인 전에는 DB 요청을 보내지 않는다. 낙관적으로 먼저 빼지도 않는다.
   *    세 액션(글 삭제 · 댓글 삭제 · 좋아요 취소)이 같은 순서로 동작한다.
   *
   * ⚠️ removeLike 는 reaction_type = LIKE 인 **내 reaction 하나만** 지운다.
   *    글도, 다른 사람의 좋아요도 건드리지 않는다.
   */
  async function handleConfirmUnlike() {
    if (!unlikingPostId || !userId || unliking) return;

    setUnliking(true);
    setUnlikeError(null);
    try {
      await removeLike(unlikingPostId, userId);
      setPosts((prev) => prev.filter((row) => row.postId !== unlikingPostId));
      setUnlikingPostId(null);
    } catch {
      // 목록은 그대로 두고 창 안에 이유를 남긴다.
      setUnlikeError('좋아요를 취소하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUnliking(false);
    }
  }

  return (
    // 바탕은 홈과 같은 pot-visual. Loading·Empty·Error 도 같은 바탕 위에 온다.
    <View className="flex-1 bg-pot-visual">
      <Stack.Screen options={{ title: '좋아요', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="좋아요한 게시글을 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' && posts.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="아직 좋아요한 게시글이 없어요."
          description="커뮤니티에서 마음에 드는 글에 좋아요를 눌러 보세요."
        />
      ) : null}
      {loadState === 'ready' && posts.length > 0 ? (
        <MyPostList
          posts={posts}
          onPressPost={(postId) => router.push(`/community/posts/${postId}`)}
          swipeAction={{
            label: '좋아요\n취소',
            icon: 'heart-dislike-outline',
            // ⚠️ 삭제 빨강을 쓰지 않는다. 글이 지워지는 것으로 읽히면 안 된다.
            color: '#8B94A2',
            onPress: (postId) => {
              setUnlikeError(null);
              setUnlikingPostId(postId);
            },
          }}
        />
      ) : null}

      {/* ⚠️ 되돌릴 수 있는 동작이라 destructive 를 켜지 않는다. 확인 버튼이
          빨강이면 글이 지워지는 것으로 읽힌다. */}
      <ConfirmModal
        visible={unlikingPostId !== null}
        title="좋아요를 취소하시겠어요?"
        confirmLabel="좋아요 취소"
        busy={unliking}
        error={unlikeError}
        onCancel={() => setUnlikingPostId(null)}
        onConfirm={() => void handleConfirmUnlike()}
      />
    </View>
  );
}
