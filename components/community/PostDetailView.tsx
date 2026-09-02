import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { PostDetailData } from './types';

type Props = {
  post: PostDetailData;
  /** 좋아요 토글. 저장 중이면 잠근다. */
  onToggleLike: () => void;
  likeBusy: boolean;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const COVER_HEIGHT = 220;
/** 가로 스와이프 한 장의 폭. 화면 폭에 맞춘다. */
const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * COMM-02 게시글 / 팁 상세. (docs/09_IA_v1.md §4-3, §4-6)
 *
 * 4-6 "여행 결과 공유 게시글" 도 이 화면이 그린다. post_type 으로만 구분한다.
 * 목록 카드와 같은 색면 구조를 크게 쓴다.
 *
 * ⚠️ 유료·구매·댓글은 2026-08-31 팀 결정으로 뺐다.
 * ⚠️ 찜은 저장할 테이블이 없어 못 만든다. reactions 는 LIKE 만 허용한다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostDetailView({ post, onToggleLike, likeBusy }: Props) {
  const [page, setPage] = useState(0);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPage((prev) => (prev === next ? prev : next));
  }

  return (
    <ScrollView className="flex-1 bg-pot-visual" contentContainerClassName="pb-12">
      {/* 윗면 — 사진 자리 */}
      <View style={{ height: COVER_HEIGHT, backgroundColor: post.accent.background }}>
        {post.imageUrls.length > 0 ? (
          <>
            {/* 사진이 여러 장이면 가로로 넘겨 본다. */}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
            >
              {post.imageUrls.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={{ width: SCREEN_WIDTH, height: COVER_HEIGHT }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {/* 사진 위 흰 글씨가 묻히지 않게 어둠막을 깐다. */}
            {/* ⚠️ pointerEvents="none" 이 없으면 이 막이 스와이프를 가로채
                사진을 넘길 수 없다. 배지·제목 영역도 마찬가지다. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0, top: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(17,24,39,0.38)',
              }}
            />
          </>
        ) : null}
        <View pointerEvents="none" className="flex-1 justify-between p-5">
        <View className="flex-row items-start justify-between">
          {post.publishedLabel ? (
            <View className="flex-row items-center rounded-full bg-black/30 px-3 py-1.5">
              <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
              <Text className="ml-1.5 font-bold text-white" style={{ fontSize: 11 }}>
                {post.publishedLabel}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View className="flex-row items-center">
            {post.imageUrls.length > 1 ? (
              <View className="mr-1.5 flex-row items-center rounded-full bg-black/30 px-3 py-1.5">
                <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                <Text className="ml-1 font-bold text-white" style={{ fontSize: 11 }}>
                  {post.imageUrls.length}
                </Text>
              </View>
            ) : null}
            <View className="rounded-full bg-black/30 px-3 py-1.5">
              <Text className="font-bold text-white" style={{ fontSize: 11 }}>
                {post.postTypeLabel}
              </Text>
            </View>
          </View>
        </View>

        <Text
          className="font-black text-white"
          style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.6 }}
        >
          {post.title}
        </Text>

          {/* 사진이 여러 장일 때만 페이지 점을 보여준다. */}
          {post.imageUrls.length > 1 ? (
            <View className="mt-3 flex-row justify-center">
              {post.imageUrls.map((uri, index) => (
                <View
                  key={uri}
                  className="mx-0.5 h-1.5 rounded-full"
                  style={{
                    width: index === page ? 16 : 6,
                    backgroundColor: index === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View className="px-5">
        {/* 작성자 · 목적지 */}
        <View className="mt-4 flex-row items-center">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
            <Text className="font-bold text-pot-mute" style={{ fontSize: 13 }}>
              {(post.authorName ?? '?').slice(0, 1)}
            </Text>
          </View>
          <View className="ml-2.5 flex-1">
            <Text className="font-bold text-pot-ink" style={{ fontSize: 14 }}>
              {post.authorName ?? '알 수 없음'}
            </Text>
            {post.destination ? (
              <View className="mt-0.5 flex-row items-center">
                <Ionicons name="location-outline" size={12} color="#9AA3AE" />
                <Text className="ml-1 text-pot-faint" style={{ fontSize: 12 }}>
                  {post.destination}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 본문 */}
        <View className="mt-5 rounded-2xl bg-white px-5 py-5">
          <Text className="text-pot-ink" style={{ fontSize: 15, lineHeight: 24 }}>
            {post.content ?? '내용이 없어요.'}
          </Text>
        </View>

        {/* 좋아요 */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe, busy: likeBusy }}
          accessibilityLabel={post.likedByMe ? '좋아요 취소' : '좋아요'}
          disabled={likeBusy}
          onPress={onToggleLike}
          className="mt-6 flex-row items-center justify-center rounded-full bg-white py-4 active:opacity-70"
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
              ...NUM,
            }}
          >
            {post.likeCount > 0 ? `좋아요 ${post.likeCount}` : '좋아요'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
