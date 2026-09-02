import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import type { PostDetailData } from './types';

type Props = {
  post: PostDetailData;
  /** 좋아요 토글. 저장 중이면 잠근다. */
  onToggleLike: () => void;
  likeBusy: boolean;
  /** 싫어요 토글. 좋아요와 함께 누를 수 없다 — 화면 파일이 정리한다. */
  onToggleDislike: () => void;
  dislikeBusy: boolean;
  /** 찜 토글. 좋아요·싫어요와 별개다. 같이 눌러도 된다. */
  onToggleBookmark: () => void;
  bookmarkBusy: boolean;
  /**
   * 댓글 영역. 화면 파일이 <CommentSection> 을 만들어 넣는다.
   *
   * 댓글 상태(입력값·저장 중·오류)를 이 컴포넌트까지 끌고 오면
   * props 가 열 개 넘게 늘어난다. 자리만 비워 두고 조립은 화면이 한다.
   */
  commentSection?: React.ReactNode;
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
 * ⚠️ 유료·구매는 2026-08-31 팀 결정으로 뺐다. 댓글은 9/02 에 다시 넣었다.
 *
 * 반응은 좋아요 · 싫어요 · 찜 셋이다. 모두 reactions 한 표에 들어간다.
 * 싫어요는 개수를 공개하고, 찜은 내가 눌렀는지만 보여준다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostDetailView({
  post,
  onToggleLike,
  likeBusy,
  onToggleDislike,
  dislikeBusy,
  onToggleBookmark,
  bookmarkBusy,
  commentSection,
}: Props) {
  const single = post.imageUrls.length === 1;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pb-16">
      {/* 작성자 */}
      <View className="flex-row items-center px-5 pt-4">
        <Avatar imageUrl={post.authorImageUrl} size={40} />

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
          // 좋아요·싫어요를 같은 모양(엄지)으로 맞춘다. 하트와 엄지를 섞으면
          // 두 버튼이 다른 종류의 행동처럼 보인다.
          disabled={likeBusy}
          onPress={onToggleLike}
          hitSlop={10}
          className="flex-row items-center active:opacity-60"
          style={{ opacity: likeBusy ? 0.5 : 1 }}
        >
          <Ionicons
            name={post.likedByMe ? 'thumbs-up' : 'thumbs-up-outline'}
            size={20}
            color={post.likedByMe ? '#111827' : '#747B88'}
          />
          {post.likeCount > 0 ? (
            <Text className="ml-2 text-pot-mute" style={{ fontSize: 14, ...NUM }}>
              {post.likeCount}
            </Text>
          ) : null}
        </Pressable>

        {/* 싫어요 — 좋아요와 같은 방식으로 개수를 보여준다. 색은 회색이다.
            빨강으로 칠하면 오류 표시처럼 읽힌다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.dislikedByMe, busy: dislikeBusy }}
          accessibilityLabel={post.dislikedByMe ? '싫어요 취소' : '싫어요'}
          disabled={dislikeBusy}
          onPress={onToggleDislike}
          hitSlop={10}
          className="ml-5 flex-row items-center active:opacity-60"
          style={{ opacity: dislikeBusy ? 0.5 : 1 }}
        >
          <Ionicons
            name={post.dislikedByMe ? 'thumbs-down' : 'thumbs-down-outline'}
            size={20}
            color={post.dislikedByMe ? '#111827' : '#747B88'}
          />
          {post.dislikeCount > 0 ? (
            <Text className="ml-2 text-pot-mute" style={{ fontSize: 14, ...NUM }}>
              {post.dislikeCount}
            </Text>
          ) : null}
        </Pressable>

        <Ionicons
          name="chatbubble-outline"
          size={21}
          color="#111827"
          style={{ marginLeft: 18 }}
        />
        {post.commentCount > 0 ? (
          <Text className="ml-2 text-pot-mute" style={{ fontSize: 14, ...NUM }}>
            {post.commentCount}
          </Text>
        ) : null}

        <View className="flex-1" />

        {/* 찜 — 오른쪽 끝. 개수를 보여주지 않는다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.bookmarkedByMe, busy: bookmarkBusy }}
          accessibilityLabel={post.bookmarkedByMe ? '찜 해제' : '찜하기'}
          disabled={bookmarkBusy}
          onPress={onToggleBookmark}
          hitSlop={10}
          className="active:opacity-60"
          style={{ opacity: bookmarkBusy ? 0.5 : 1 }}
        >
          <Ionicons
            name={post.bookmarkedByMe ? 'bookmark' : 'bookmark-outline'}
            size={21}
            color="#111827"
          />
        </Pressable>
      </View>

      {commentSection}
    </ScrollView>
  );
}
