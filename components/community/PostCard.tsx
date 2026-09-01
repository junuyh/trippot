import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { PostCardData } from './types';

type Props = {
  post: PostCardData;
  onPress: (postId: string) => void;
};

/**
 * 목록 카드 한 장. (docs/09_IA_v1.md §4-1)
 * 탭하면 COMM-02 상세로 간다.
 */
export function PostCard({ post, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 자세히 보기`}
      onPress={() => onPress(post.postId)}
      className="flex-row items-center rounded-2xl bg-white px-5 py-4 active:opacity-80"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View className="flex-1 pr-3">
        <View className="mb-1.5 flex-row">
          <View className="rounded-md bg-pot-visual px-2 py-0.5">
            <Text className="font-bold text-pot-mute" style={{ fontSize: 10.5 }}>
              {post.postTypeLabel}
            </Text>
          </View>
        </View>

        <Text
          className="font-bold text-pot-ink"
          style={{ fontSize: 16, lineHeight: 22, letterSpacing: -0.3 }}
        >
          {post.title}
        </Text>

        <View className="mt-2 flex-row items-center">
          <Text className="text-pot-faint" style={{ fontSize: 12.5 }} numberOfLines={1}>
            {post.authorName ?? '알 수 없음'}
          </Text>
          {post.destination ? (
            <>
              <Text className="mx-1.5 text-pot-line" style={{ fontSize: 12.5 }}>
                ·
              </Text>
              <Text className="text-pot-faint" style={{ fontSize: 12.5 }} numberOfLines={1}>
                {post.destination}
              </Text>
            </>
          ) : null}
          {post.likeCount > 0 ? (
            <>
              <Text className="mx-1.5 text-pot-line" style={{ fontSize: 12.5 }}>
                ·
              </Text>
              <Ionicons
                name={post.likedByMe ? 'heart' : 'heart-outline'}
                size={13}
                color={post.likedByMe ? '#EE3524' : '#9AA3AE'}
              />
              <Text className="ml-1 text-pot-faint" style={{ fontSize: 12.5 }}>
                {post.likeCount}
              </Text>
            </>
          ) : null}
          {post.publishedLabel ? (
            <>
              <Text className="mx-1.5 text-pot-line" style={{ fontSize: 12.5 }}>
                ·
              </Text>
              <Text className="text-pot-faint" style={{ fontSize: 12.5 }}>
                {post.publishedLabel}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#C3C9D2" />
    </Pressable>
  );
}
