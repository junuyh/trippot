import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PostType } from '@/lib/constants/status';

import { PostCard } from './PostCard';
import type { PostCardData, PostFilter } from './types';

type Props = {
  posts: PostCardData[];
  filters: PostFilter[];
  /** null 이면 전체 */
  activeFilter: PostType | null;
  onChangeFilter: (value: PostType | null) => void;
  onPressPost: (postId: string) => void;
  onPressWrite: () => void;
};

/**
 * COMM-01 커뮤니티 홈. (docs/09_IA_v1.md §4-1, §4-2)
 *
 * 4-2 "여행 팁 목록" 은 별도 화면이 아니라 이 화면의 필터다. IA 주석 그대로다.
 * ⚠️ 정렬·검색은 고도화(9/07~)라 넣지 않았다. 댓글·유료도 없다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostListView({
  posts,
  filters,
  activeFilter,
  onChangeFilter,
  onPressPost,
  onPressWrite,
}: Props) {
  // 커뮤니티 탭은 헤더를 끈 상태다. 상태바·노치 밑으로 내용이 들어가지 않게 띄운다.
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-pot-visual">
      <View className="px-5 pb-6" style={{ paddingTop: insets.top + 36 }}>
        {/* 제목 */}
        <Text
          className="font-black text-pot-ink"
          style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.6 }}
        >
          커뮤니티
        </Text>

        {/* 글쓰기 — 제목 아래 오른쪽 */}
        <View className="mt-4 flex-row justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="글 쓰기"
            onPress={onPressWrite}
            className="flex-row items-center rounded-full bg-pot-ink px-3.5 py-2 active:opacity-80"
          >
            <Ionicons name="create-outline" size={15} color="#FFFFFF" />
            <Text className="ml-1.5 font-bold text-white" style={{ fontSize: 13 }}>
              글쓰기
            </Text>
          </Pressable>
        </View>

        {/* 유형 필터 (IA 4-2) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
          contentContainerClassName="gap-2 pr-5"
        >
          {filters.map((filter) => {
            const active = filter.value === activeFilter;
            return (
              <Pressable
                key={filter.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChangeFilter(filter.value)}
                className={`rounded-full px-3.5 py-2 ${active ? 'bg-pot-ink' : 'bg-white'}`}
              >
                <Text
                  className={`font-bold ${active ? 'text-white' : 'text-pot-mute'}`}
                  style={{ fontSize: 13 }}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-24 pt-1">
        {posts.length === 0 ? (
          <Text className="mt-8 text-center text-pot-faint" style={{ fontSize: 14 }}>
            이 유형의 글이 아직 없어요.
          </Text>
        ) : (
          <View className="gap-2.5">
            {posts.map((post) => (
              <PostCard key={post.postId} post={post} onPress={onPressPost} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
