import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  /** 검색어. 화면 파일이 들고 있고 여기서는 보여주기만 한다. */
  query: string;
  onChangeQuery: (value: string) => void;
  onPressPost: (postId: string) => void;
  onPressWrite: () => void;
};

const ACCENT = '#6C5CE7';
const ACCENT_SOFT = '#EFEDFF';

/**
 * COMM-01 커뮤니티 홈. (docs/09_IA_v1.md §4-1, §4-2)
 *
 * 4-2 "여행 팁 목록" 은 별도 화면이 아니라 이 화면의 필터다. IA 주석 그대로다.
 *
 * ⚠️ 검색은 문서상 고도화(9/07~)다. 서버 검색이 아니라 **이미 불러온 글 안에서**
 *    찾는다. 그래서 정렬·페이지네이션은 건드리지 않았다.
 *    거르는 일은 화면 파일이 하고 여기서는 입력만 받는다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostListView({
  posts,
  filters,
  activeFilter,
  onChangeFilter,
  query,
  onChangeQuery,
  onPressPost,
  onPressWrite,
}: Props) {
  // 커뮤니티 탭은 헤더를 끈 상태다. 상태바·노치 밑으로 내용이 들어가지 않게 띄운다.
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-pot-visual">
      {/* 상단바 — 검색 + 글쓰기 */}
      <View className="bg-white px-4 pb-3" style={{ paddingTop: insets.top + 10 }}>
        <View className="flex-row items-center">
          <View className="mr-2 flex-1 flex-row items-center rounded-full bg-pot-visual px-3.5 py-2.5">
            <Ionicons name="search" size={16} color="#9AA3AE" />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="여행 정보나 후기를 검색해 보세요"
              placeholderTextColor="#9AA3AE"
              returnKeyType="search"
              className="ml-2 flex-1 text-pot-ink"
              style={{ fontSize: 13, padding: 0 }}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
                onPress={() => onChangeQuery('')}
                hitSlop={8}
                className="active:opacity-60"
              >
                <Ionicons name="close-circle" size={16} color="#C3C9D2" />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="글 쓰기"
            onPress={onPressWrite}
            className="flex-row items-center rounded-full bg-pot-ink px-3.5 py-2.5 active:opacity-80"
          >
            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
            <Text className="ml-1.5 font-bold text-white" style={{ fontSize: 12.5 }}>
              글쓰기
            </Text>
          </Pressable>
        </View>

        {/* 유형 필터 (IA 4-2) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerClassName="gap-2 pr-4"
        >
          {filters.map((filter) => {
            const active = filter.value === activeFilter;
            return (
              <Pressable
                key={filter.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChangeFilter(filter.value)}
                className="items-center"
              >
                <View
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: active ? ACCENT_SOFT : '#F1F3F6' }}
                >
                  <Text
                    className="font-bold"
                    style={{ fontSize: 12.5, color: active ? ACCENT : '#747B88' }}
                  >
                    {filter.label}
                  </Text>
                </View>

                {/* 고른 칩 아래 짧은 밑줄. 칩 색만으로는 구분이 약하다. */}
                <View
                  className="mt-1.5 h-[3px] rounded-full"
                  style={{
                    width: 22,
                    backgroundColor: active ? ACCENT : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-28 pt-4">
        {posts.length === 0 ? (
          <Text className="mt-8 text-center text-pot-faint" style={{ fontSize: 13.5 }}>
            {query.trim().length > 0
              ? `'${query.trim()}' 와 맞는 글이 없어요.`
              : '이 유형의 글이 아직 없어요.'}
          </Text>
        ) : (
          <View className="gap-3">
            {posts.map((post) => (
              <PostCard key={post.postId} post={post} onPress={onPressPost} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
