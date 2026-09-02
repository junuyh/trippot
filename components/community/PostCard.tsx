import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import type { PostCardData } from './types';

type Props = {
  post: PostCardData;
  onPress: (postId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const COVER_HEIGHT = 116;

/**
 * 목록 카드 한 장. (docs/09_IA_v1.md §4-1)
 *
 * 윗면은 색면 + 제목, 아랫줄은 목적지·작성자·좋아요다.
 * ⚠️ 커버 사진은 [임시] 더미다. community_posts 에 이미지 컬럼이 없어
 *    글 id 로 만든 placeholder 를 쓴다. (components/community/cover.ts)
 *    여러 장이면 첫 장을 커버로 쓰고 오른쪽 위에 장수를 표시한다.
 *    사진이 없으면 목적지 국가 색면으로 대체한다.
 *
 * 탭하면 COMM-02 상세로 간다.
 */
export function PostCard({ post, onPress }: Props) {
  const cover = post.imageUrls[0] ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 자세히 보기`}
      onPress={() => onPress(post.postId)}
      className="overflow-hidden rounded-[20px] bg-white active:opacity-80"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      {/* 윗면 — 사진 자리 */}
      <View style={{ height: COVER_HEIGHT, backgroundColor: post.accent.background }}>
        {cover ? (
          <>
            <Image
              source={{ uri: cover }}
              style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
              resizeMode="cover"
            />
            {/* 사진 위 흰 글씨가 묻히지 않게 어둠막을 깐다. */}
            <View
              style={{
                position: 'absolute',
                left: 0, top: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(17,24,39,0.38)',
              }}
            />
          </>
        ) : null}
        <View className="flex-1 justify-between p-3.5">
        <View className="flex-row items-start justify-between">
          {/* 날짜 배지 */}
          {post.publishedLabel ? (
            <View className="flex-row items-center rounded-full bg-black/30 px-2.5 py-1.5">
              <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
              <Text className="ml-1.5 font-bold text-white" style={{ fontSize: 11 }}>
                {post.publishedLabel}
              </Text>
            </View>
          ) : (
            <View />
          )}

          <View className="flex-row items-center">
            {/* 사진이 여러 장이면 장수 */}
            {post.imageUrls.length > 1 ? (
              <View className="mr-1.5 flex-row items-center rounded-full bg-black/30 px-2.5 py-1.5">
                <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                <Text className="ml-1 font-bold text-white" style={{ fontSize: 11 }}>
                  {post.imageUrls.length}
                </Text>
              </View>
            ) : null}
            {/* 유형 */}
            <View className="rounded-full bg-black/30 px-2.5 py-1.5">
              <Text className="font-bold text-white" style={{ fontSize: 11 }}>
                {post.postTypeLabel}
              </Text>
            </View>
          </View>
        </View>

        <Text
          className="font-black text-white"
          style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.4 }}
          numberOfLines={2}
        >
          {post.title}
        </Text>
        </View>
      </View>

      {/* 아랫줄 */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <View className="flex-1 flex-row items-center pr-3">
          {post.destination ? (
            <>
              <Ionicons name="location-outline" size={14} color="#9AA3AE" />
              <Text className="ml-1 text-pot-faint" style={{ fontSize: 11.5 }} numberOfLines={1}>
                {post.destination}
              </Text>
              <Text className="mx-1.5 text-pot-line" style={{ fontSize: 11.5 }}>
                ·
              </Text>
            </>
          ) : null}
          <Text className="text-pot-faint" style={{ fontSize: 11.5 }} numberOfLines={1}>
            {post.authorName ?? '알 수 없음'}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={15}
            color={post.likedByMe ? '#EE3524' : '#9AA3AE'}
          />
          <Text
            className="ml-1 font-bold text-pot-mute"
            style={{ fontSize: 11.5, ...NUM }}
          >
            {post.likeCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
