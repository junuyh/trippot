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

import { MyPostList } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { getMyPosts, type MyPostListItem } from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyPosts() {
  const userId = useCurrentUserId();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<MyPostListItem[]>([]);

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

  return (
    // 바탕은 홈과 같은 pot-visual. Loading·Empty·Error 도 같은 바탕 위에 온다.
    <View className="flex-1 bg-pot-visual">
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
        />
      ) : null}
    </View>
  );
}
