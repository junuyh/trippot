import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/ui';

import { NO_FOCUS_RING } from './inputStyle';
import { PostCard } from './PostCard';
import type { CommunityCategory, PostCardData } from './types';

type Props = {
  posts: PostCardData[];
  /**
   * 카테고리 한 줄. 전체 · 글 유형 · 여행지가 한 줄에 섞여 있고
   * 순서는 화면 파일이 정한다.
   */
  categories: CommunityCategory[];
  /** 지금 고른 카테고리의 key. */
  activeCategory: string;
  onChangeCategory: (key: string) => void;
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
  categories,
  activeCategory,
  onChangeCategory,
  query,
  onChangeQuery,
  onPressPost,
  onPressWrite,
}: Props) {
  // 커뮤니티 탭은 헤더를 끈 상태다. 상태바·노치 밑으로 내용이 들어가지 않게 띄운다.
  const insets = useSafeAreaInsets();

  // 빈 목록 문구에 쓴다. 목록에서 사라진 카테고리를 고른 상태여도 문구는 나와야 한다.
  const activeLabel = categories.find((item) => item.key === activeCategory)?.label ?? '이 분류의';

  return (
    <View className="flex-1 bg-pot-visual">
      {/* 상단바 — 다른 화면과 같은 공통 Header 를 쓴다. 제목은 가운데다.
          커뮤니티는 탭 첫 화면이라 뒤로가기가 없다.
          탭 헤더를 끈 상태라 상태바 높이만큼은 여기서 띄운다. */}
      <View className="bg-white" style={{ paddingTop: insets.top }}>
        <Header title="커뮤니티" showBack={false} />
      </View>

      <View className="bg-white px-4 pb-3 pt-3">
        {/* 검색 + 글쓰기 */}
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
              style={{ fontSize: 13, padding: 0, ...NO_FOCUS_RING }}
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

        {/* 카테고리 — 한 줄 (2026-09-03)
            글 유형(자유·여행 팁)과 여행지를 한 줄에 두고 하나만 고른다.
            처음에는 유형 줄과 여행지 줄을 따로 뒀는데, 줄이 둘이면 지금 무엇으로
            걸러진 목록인지 한눈에 안 읽혔다.

            검색창과의 간격은 style 로 준다. className(mt-*) 이 ScrollView 에서
            먹지 않는 경우가 있어 눈에 보이는 값으로 직접 잡는다. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16 }}
          contentContainerClassName="gap-2 pr-4"
        >
          {categories.map((item) => {
            const active = item.key === activeCategory;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChangeCategory(item.key)}
                className="items-center"
              >
                <View
                  className="flex-row items-center rounded-full px-3.5 py-2"
                  style={{ backgroundColor: active ? ACCENT_SOFT : '#F1F3F6' }}
                >
                  {item.flag ? (
                    // 장식이다. 옆 글자가 여행지 이름을 그대로 말한다.
                    <Text style={{ fontSize: 11, marginRight: 4 }} accessible={false}>
                      {item.flag}
                    </Text>
                  ) : null}
                  <Text
                    className="font-bold"
                    style={{ fontSize: 12.5, color: active ? ACCENT : '#747B88' }}
                  >
                    {item.label}
                  </Text>
                  {item.count === null ? null : (
                    <Text
                      style={{
                        fontSize: 11,
                        marginLeft: 4,
                        color: active ? ACCENT : '#9AA3AE',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {item.count}
                    </Text>
                  )}
                </View>

                {/* 고른 칩 아래 짧은 밑줄. 칩 색만으로는 구분이 약하다. */}
                <View
                  className="mt-1.5 h-[3px] rounded-full"
                  style={{ width: 22, backgroundColor: active ? ACCENT : 'transparent' }}
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
              : `${activeLabel} 글이 아직 없어요.`}
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
