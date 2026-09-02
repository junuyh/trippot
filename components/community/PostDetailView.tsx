import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, Pressable, ScrollView, Text, View } from 'react-native';

import type { PostDetailData } from './types';

type Props = {
  post: PostDetailData;
  /** 좋아요 토글. 저장 중이면 잠근다. */
  onToggleLike: () => void;
  likeBusy: boolean;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDE = 20;
const PHOTO_HEIGHT = 300;
/** 사진이 여러 장이면 다음 장을 살짝 보여줘서 넘길 수 있다고 알린다. */
const PHOTO_WIDTH_MULTI = Math.round(SCREEN_WIDTH * 0.72);

/**
 * COMM-02 게시글 / 팁 상세. (docs/09_IA_v1.md §4-3, §4-6)
 *
 * 4-6 "여행 결과 공유 게시글" 도 이 화면이 그린다. post_type 으로만 구분한다.
 * 목록 글과 같은 구조를 그대로 크게 편다. 커버 사진을 따로 두지 않는다.
 *
 * ⚠️ 유료·구매·댓글은 2026-08-31 팀 결정으로 뺐다.
 * ⚠️ 찜은 저장할 테이블이 없어 못 만든다. reactions 는 LIKE 만 허용한다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostDetailView({ post, onToggleLike, likeBusy }: Props) {
  const single = post.imageUrls.length === 1;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pb-16">
      {/* 작성자 */}
      <View className="flex-row items-center px-5 pt-4">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: post.accent.background }}
        >
          <Text className="font-bold" style={{ fontSize: 15, color: post.accent.foreground }}>
            {(post.authorName ?? '?').slice(0, 1)}
          </Text>
        </View>

        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text className="font-bold text-pot-ink" style={{ fontSize: 15 }} numberOfLines={1}>
              {post.authorName ?? '알 수 없음'}
            </Text>
            {post.publishedLabel ? (
              <Text className="ml-2 text-pot-faint" style={{ fontSize: 13 }}>
                {post.publishedLabel}
              </Text>
            ) : null}
          </View>

          {post.destination ? (
            <View className="mt-0.5 flex-row items-center">
              <Ionicons name="location-outline" size={12} color="#9AA3AE" />
              <Text className="ml-1 text-pot-faint" style={{ fontSize: 12.5 }}>
                {post.destination}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="rounded-md bg-pot-visual px-2 py-1">
          <Text className="font-bold text-pot-mute" style={{ fontSize: 11 }}>
            {post.postTypeLabel}
          </Text>
        </View>
      </View>

      {/* 제목 */}
      <Text
        className="mt-3 px-5 font-bold text-pot-ink"
        style={{ fontSize: 18, lineHeight: 25, letterSpacing: -0.4 }}
      >
        {post.title}
      </Text>

      {/* 본문 */}
      <Text
        className="mt-1.5 px-5 text-pot-ink"
        style={{ fontSize: 15, lineHeight: 24 }}
      >
        {post.content ?? '내용이 없어요.'}
      </Text>

      {/* 사진 — 본문 아래에 가로로 놓는다. */}
      {post.imageUrls.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
          contentContainerStyle={{ paddingHorizontal: SIDE, gap: 8 }}
        >
          {post.imageUrls.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{
                width: single ? SCREEN_WIDTH - SIDE * 2 : PHOTO_WIDTH_MULTI,
                height: PHOTO_HEIGHT,
                borderRadius: 14,
              }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      {/* 좋아요 */}
      <View className="mt-4 flex-row items-center px-5">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe, busy: likeBusy }}
          accessibilityLabel={post.likedByMe ? '좋아요 취소' : '좋아요'}
          disabled={likeBusy}
          onPress={onToggleLike}
          hitSlop={10}
          className="flex-row items-center active:opacity-60"
          style={{ opacity: likeBusy ? 0.5 : 1 }}
        >
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={22}
            color={post.likedByMe ? '#EE3524' : '#111827'}
          />
          {post.likeCount > 0 ? (
            <Text className="ml-2 text-pot-mute" style={{ fontSize: 14, ...NUM }}>
              {post.likeCount}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {/* 아래 구분선 — 글이 여기서 끝난다는 표시 */}
      <View className="mt-4" style={{ height: 1, backgroundColor: '#EFF1F4' }} />
    </ScrollView>
  );
}
