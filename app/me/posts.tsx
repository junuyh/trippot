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

import { MyPostList } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { getMyPosts, type MyPostListItem } from '@/lib/supabase/queries/community';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyPosts() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [posts, setPosts] = useState<MyPostListItem[]>([]);

  const load = useCallback(async () => {
    try {
      // TODO: 로그인 연동 시 교체
      const rows = await getMyPosts(DEV_USER_ID);
      setPosts(rows);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  // 글을 쓰거나 지우고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
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
    </>
  );
}
