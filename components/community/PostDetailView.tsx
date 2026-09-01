import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { PostDetailData } from './types';

type Props = {
  post: PostDetailData;
  /** 좋아요 토글. 저장 중이면 잠근다. */
  onToggleLike: () => void;
  likeBusy: boolean;
};

/**
 * COMM-02 게시글 / 팁 상세. (docs/09_IA_v1.md §4-3, §4-6)
 *
 * 4-6 "여행 결과 공유 게시글" 도 이 화면이 그린다. post_type 으로만 구분한다.
 *
 * ⚠️ 유료·구매·댓글은 2026-08-31 팀 결정으로 뺐다.
 * ⚠️ 찜은 저장할 테이블이 없어 못 만든다. reactions 는 LIKE 만 허용한다.
 *    DB 담당자에게 마이그레이션을 요청해 둔 상태다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostDetailView({ post, onToggleLike, likeBusy }: Props) {
  return (
    <ScrollView className="flex-1 bg-pot-visual" contentContainerClassName="px-5 pb-12 pt-5">
      <View className="flex-row">
        <View className="rounded-md bg-white px-2 py-1">
          <Text className="font-bold text-pot-mute" style={{ fontSize: 11 }}>
            {post.postTypeLabel}
          </Text>
        </View>
      </View>

      <Text
        className="mt-3 font-black text-pot-ink"
        style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.6 }}
      >
        {post.title}
      </Text>

      <View className="mt-3 flex-row flex-wrap items-center">
        <Text className="text-pot-faint" style={{ fontSize: 13 }}>
          {post.authorName ?? '알 수 없음'}
        </Text>
        {post.destination ? (
          <>
            <Text className="mx-1.5 text-pot-line" style={{ fontSize: 13 }}>
              ·
            </Text>
            <Text className="text-pot-faint" style={{ fontSize: 13 }}>
              {post.destination}
            </Text>
          </>
        ) : null}
        {post.publishedLabel ? (
          <>
            <Text className="mx-1.5 text-pot-line" style={{ fontSize: 13 }}>
              ·
            </Text>
            <Text className="text-pot-faint" style={{ fontSize: 13 }}>
              {post.publishedLabel}
            </Text>
          </>
        ) : null}
      </View>

      <View className="mt-5 rounded-2xl bg-white px-5 py-5">
        <Text className="text-pot-ink" style={{ fontSize: 15, lineHeight: 24 }}>
          {post.content ?? '내용이 없어요.'}
        </Text>
      </View>

      {/* 좋아요 */}
      <View className="mt-6 items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe, busy: likeBusy }}
          accessibilityLabel={post.likedByMe ? '좋아요 취소' : '좋아요'}
          disabled={likeBusy}
          onPress={onToggleLike}
          className={`flex-row items-center rounded-full px-5 py-3 active:opacity-70 ${
            post.likedByMe ? 'bg-white' : 'bg-white'
          }`}
          style={{
            borderWidth: 1,
            borderColor: post.likedByMe ? '#EE3524' : '#E5E8EC',
            opacity: likeBusy ? 0.5 : 1,
          }}
        >
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={18}
            color={post.likedByMe ? '#EE3524' : '#747B88'}
          />
          <Text
            className="ml-2 font-bold"
            style={{
              fontSize: 14,
              color: post.likedByMe ? '#EE3524' : '#747B88',
              fontVariant: ['tabular-nums'],
            }}
          >
            {post.likeCount > 0 ? post.likeCount : '좋아요'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
