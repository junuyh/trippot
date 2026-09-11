// ============================================================================
// 여행지 상세(DEST-01) — OO 관련 커뮤니티 (2026-09-11)
//
//   ▎오사카 관련 커뮤니티                    전체보기 ›
//   ┌────┬────────────────────────────────┐
//   │사진│ 오사카 3박 4일 맛집 추천 리스트!   │
//   │    │ 맛집일기 · 2일 전    ♡ 124  💬 18 │
//   └────┴────────────────────────────────┘
//
// ⚠️ **커뮤니티 메인처럼 크게 만들지 않는다.** 이 화면의 주인공은 여행지
//    소개와 예산이고, 여기는 "이 여행지 이야기가 더 있다" 를 알리는 자리다.
//    작은 썸네일 + 제목 + 카테고리·시점 + 좋아요 + 댓글, 두 건만 보여준다.
//    그래서 커뮤니티의 PostCard 를 쓰지 않고 이 줄을 따로 그린다.
//
// ⚠️ 사진이 없는 글은 썸네일 자리를 국가색 옅은 톤으로 비운다. 빈 사각형을
//    회색으로 두면 사진을 못 불러온 것처럼 보인다.
//
// ⚠️ 글이 하나도 없으면 **칸을 통째로 그리지 않는다.** 빈 목록이 자리만
//    차지하는 것보다 낫다. (components/home/DiscoverDestinationSection 과 같은 규칙)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { SectionHeading } from './DestinationSections';
import { INK, LINE, MUTED, RADIUS, SUBTLE } from './tokens';

/** 이 화면이 그리는 글 한 줄. 커뮤니티 PostListItem 을 줄여서 받는다. */
export type DestinationPostItem = {
  postId: string;
  title: string;
  /** '맛집일기' 처럼 글 유형 라벨. */
  categoryLabel: string;
  /** '2일 전'. 이미 만들어진 문구를 받는다. */
  publishedLabel: string;
  likeCount: number;
  commentCount: number;
  /** 글에 붙은 첫 사진. 없으면 null. */
  thumbnailUrl: string | null;
};

type Props = {
  nameKo: string;
  posts: readonly DestinationPostItem[];
  accent: string;
  accentSoft: string;
  onPressPost: (postId: string) => void;
  onPressSeeAll: () => void;
};

const THUMB = 52;

export function DestinationCommunitySection({
  nameKo,
  posts,
  accent,
  accentSoft,
  onPressPost,
  onPressSeeAll,
}: Props) {
  // 글이 없으면 칸을 그리지 않는다. 위 주석 참조.
  if (posts.length === 0) return null;

  return (
    <View>
      <SectionHeading
        title={`${nameKo} 관련 커뮤니티`}
        accent={accent}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${nameKo} 글 전체보기`}
            onPress={onPressSeeAll}
            hitSlop={8}
            className="flex-row items-center active:opacity-60"
          >
            <Text style={{ fontSize: 12.5, color: SUBTLE }}>전체보기</Text>
            <Ionicons name="chevron-forward" size={12} color={SUBTLE} />
          </Pressable>
        }
      />

      <View style={{ gap: 8 }}>
        {posts.map((post) => (
          <Pressable
            key={post.postId}
            accessibilityRole="button"
            accessibilityLabel={post.title}
            onPress={() => onPressPost(post.postId)}
            className="flex-row items-center bg-white active:opacity-80"
            style={{
              borderWidth: 1,
              borderColor: LINE,
              borderRadius: RADIUS.card,
              padding: 10,
            }}
          >
            <View
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: RADIUS.inner,
                overflow: 'hidden',
                backgroundColor: accentSoft,
              }}
            >
              {post.thumbnailUrl ? (
                <Image
                  source={{ uri: post.thumbnailUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Ionicons name="image-outline" size={16} color={accent} />
                </View>
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.3, color: INK }}
              >
                {post.title}
              </Text>

              <View className="mt-1.5 flex-row items-center">
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: SUBTLE, flexShrink: 1 }}>
                  {post.categoryLabel} · {post.publishedLabel}
                </Text>

                <View className="ml-auto flex-row items-center">
                  <Ionicons name="heart-outline" size={11} color={SUBTLE} />
                  <Text style={{ marginLeft: 3, fontSize: 11.5, color: MUTED }}>
                    {post.likeCount}
                  </Text>
                  <Ionicons
                    name="chatbubble-outline"
                    size={10}
                    color={SUBTLE}
                    style={{ marginLeft: 8 }}
                  />
                  <Text style={{ marginLeft: 3, fontSize: 11.5, color: MUTED }}>
                    {post.commentCount}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
