import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { POST_TYPE, type PostType } from '@/lib/constants/status';

import type { PostCardData } from './types';

type Props = {
  post: PostCardData;
  onPress: (postId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const AVATAR = 38;
/** 사진 한 칸 비율. 두 장을 나란히 놓아도 카드가 너무 길어지지 않는 값. */
const PHOTO_RATIO = 1.15;

/**
 * 글 유형별 아이콘과 색.
 *
 * ⚠️ users 에 프로필 사진 컬럼이 없어서 아바타 자리에 유형 아이콘을 쓴다.
 *    사진이 생기면 이 자리에 <Image> 를 끼우면 된다.
 *    PAID_TIP 은 목록에 나오지 않지만(유료 기능 제외) 타입을 채우려고 함께 둔다.
 */
const AVATAR_STYLE: Record<PostType, { icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }> = {
  [POST_TYPE.FREE_TIP]: { icon: 'airplane', color: '#6C5CE7', soft: '#EFEDFF' },
  [POST_TYPE.POST]: { icon: 'chatbubble-ellipses', color: '#F0424E', soft: '#FFECEE' },
  [POST_TYPE.TYPE_SHARE]: { icon: 'sparkles', color: '#1F9160', soft: '#E8F5EE' },
  [POST_TYPE.PAID_TIP]: { icon: 'pricetag', color: '#747B88', soft: '#F1F3F6' },
};

/**
 * 목록 글 한 장. (docs/09_IA_v1.md §4-1)
 *
 * 작성자 → 제목 → 본문 두 줄 → 사진 → 반응 순으로 쌓는다.
 * 탭하면 COMM-02 상세로 간다.
 */
export function PostCard({ post, onPress }: Props) {
  const avatar = AVATAR_STYLE[post.postType];
  const photos = post.imageUrls.slice(0, 2);
  const hidden = post.imageUrls.length - photos.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 자세히 보기`}
      onPress={() => onPress(post.postId)}
      className="rounded-2xl bg-white px-4 py-4 active:opacity-90"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* 작성자 */}
      <View className="flex-row items-center">
        <View
          className="items-center justify-center rounded-full"
          style={{ width: AVATAR, height: AVATAR, backgroundColor: avatar.soft }}
        >
          <Ionicons name={avatar.icon} size={17} color={avatar.color} />
        </View>

        <View className="ml-2.5 flex-1">
          <View className="flex-row items-center">
            <Text className="font-bold text-pot-ink" style={{ fontSize: 13.5 }} numberOfLines={1}>
              {post.authorName ?? '알 수 없음'}
            </Text>
            <View
              className="ml-1.5 rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: avatar.soft }}
            >
              <Text className="font-bold" style={{ fontSize: 9.5, color: avatar.color }}>
                {post.postTypeLabel}
              </Text>
            </View>
          </View>

          {post.publishedLabel ? (
            <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 11 }}>
              {post.publishedLabel}
            </Text>
          ) : null}
        </View>

        {post.destination ? (
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={12} color="#B6BCC6" />
            <Text className="ml-0.5 text-pot-faint" style={{ fontSize: 11 }} numberOfLines={1}>
              {post.destination}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 제목 · 본문 */}
      <Text
        className="mt-3 font-bold text-pot-ink"
        style={{ fontSize: 14.5, lineHeight: 20, letterSpacing: -0.3 }}
        numberOfLines={2}
      >
        {post.title}
      </Text>

      {post.contentPreview ? (
        <Text
          className="mt-1 text-pot-mute"
          style={{ fontSize: 12.5, lineHeight: 18 }}
          numberOfLines={2}
        >
          {post.contentPreview}
        </Text>
      ) : null}

      {/* 사진 — 두 장까지 나란히. 더 있으면 두 번째에 남은 수를 얹는다. */}
      {photos.length > 0 ? (
        <View className="mt-3 flex-row" style={{ gap: 6 }}>
          {photos.map((uri, index) => (
            <View
              key={uri}
              className="flex-1 overflow-hidden rounded-xl"
              style={{ aspectRatio: photos.length === 1 ? 1.9 : PHOTO_RATIO }}
            >
              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

              {index === photos.length - 1 && hidden > 0 ? (
                <View
                  pointerEvents="none"
                  className="absolute inset-0 items-center justify-center"
                  style={{ backgroundColor: 'rgba(17,24,39,0.45)' }}
                >
                  <Text className="font-black text-white" style={{ fontSize: 16, ...NUM }}>
                    +{hidden}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* 반응 */}
      <View className="mt-3 flex-row items-center">
        <Ionicons
          name={post.likedByMe ? 'heart' : 'heart-outline'}
          size={17}
          color={post.likedByMe ? '#EE3524' : '#8B94A2'}
        />
        <Text className="ml-1.5 text-pot-mute" style={{ fontSize: 12, ...NUM }}>
          {post.likeCount}
        </Text>

        <Ionicons
          name="chatbubble-outline"
          size={15}
          color="#8B94A2"
          style={{ marginLeft: 16 }}
        />
        <Text className="ml-1.5 text-pot-mute" style={{ fontSize: 12, ...NUM }}>
          {post.commentCount}
        </Text>
      </View>
    </Pressable>
  );
}
