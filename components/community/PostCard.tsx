import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import type { PostCardData } from './types';

type Props = {
  post: PostCardData;
  onPress: (postId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const AVATAR = 36;
const THUMB = 128;

/**
 * 목록 글 하나. (docs/09_IA_v1.md §4-1)
 *
 * 카드가 아니라 구분선으로 나뉜 평평한 글이다.
 * 왼쪽에 아바타, 오른쪽에 작성자 · 제목 · 본문 · 사진 · 좋아요를 세로로 쌓는다.
 *
 * ⚠️ 아바타는 이름 첫 글자다. users.profile_image_url 이 비어 있다.
 *    사진이 채워지면 여기에 <Image> 를 끼운다.
 *
 * 탭하면 COMM-02 상세로 간다.
 */
export function PostCard({ post, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 자세히 보기`}
      onPress={() => onPress(post.postId)}
      className="flex-row px-5 py-4 active:opacity-70"
    >
      {/* 아바타 */}
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: AVATAR,
          height: AVATAR,
          backgroundColor: post.accent.background,
        }}
      >
        <Text className="font-bold" style={{ fontSize: 14, color: post.accent.foreground }}>
          {(post.authorName ?? '?').slice(0, 1)}
        </Text>
      </View>

      <View className="ml-3 flex-1">
        {/* 작성자 · 시간 */}
        <View className="flex-row items-center">
          <Text className="font-bold text-pot-ink" style={{ fontSize: 14 }} numberOfLines={1}>
            {post.authorName ?? '알 수 없음'}
          </Text>
          {post.publishedLabel ? (
            <Text className="ml-2 text-pot-faint" style={{ fontSize: 12.5 }}>
              {post.publishedLabel}
            </Text>
          ) : null}
          <View className="flex-1" />
          <View className="rounded-md bg-pot-visual px-1.5 py-0.5">
            <Text className="font-bold text-pot-mute" style={{ fontSize: 10 }}>
              {post.postTypeLabel}
            </Text>
          </View>
        </View>

        {/* 제목 */}
        <Text
          className="mt-1 font-bold text-pot-ink"
          style={{ fontSize: 15, lineHeight: 21, letterSpacing: -0.2 }}
        >
          {post.title}
        </Text>

        {/* 본문 미리보기 */}
        {post.contentPreview ? (
          <Text
            className="mt-0.5 text-pot-mute"
            style={{ fontSize: 14, lineHeight: 20 }}
            numberOfLines={2}
          >
            {post.contentPreview}
          </Text>
        ) : null}

        {/* 사진 */}
        {post.imageUrls.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2.5"
            contentContainerClassName="gap-1.5"
          >
            {post.imageUrls.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width: THUMB, height: THUMB, borderRadius: 12 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : null}

        {/* 좋아요 · 목적지 */}
        <View className="mt-2.5 flex-row items-center">
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={17}
            color={post.likedByMe ? '#EE3524' : '#747B88'}
          />
          {post.likeCount > 0 ? (
            <Text className="ml-1.5 text-pot-mute" style={{ fontSize: 12.5, ...NUM }}>
              {post.likeCount}
            </Text>
          ) : null}

          {post.destination ? (
            <>
              <View className="flex-1" />
              <Ionicons name="location-outline" size={13} color="#9AA3AE" />
              <Text className="ml-1 text-pot-faint" style={{ fontSize: 12 }} numberOfLines={1}>
                {post.destination}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
