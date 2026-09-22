import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Header } from '@/components/ui';
import { BRAND } from '@/lib/constants/brandColor';

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
  /**
   * 아래로 당겨 새로고침. 화면 파일이 목록을 다시 조회한다. (2026-09-22 · 홈과 같은 방식)
   * 넘기지 않으면 새로고침을 그리지 않는다.
   */
  refreshing?: boolean;
  onRefresh?: () => void;
};

const ACCENT = BRAND.primary;
const ACCENT_SOFT = BRAND.primarySoft;

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
  refreshing,
  onRefresh,
}: Props) {
  // 커뮤니티 탭은 헤더를 끈 상태다. 상태바·노치 밑으로 내용이 들어가지 않게 띄운다.
  const insets = useSafeAreaInsets();

  // 여행지 셀렉트 열림 여부. 고른 뒤 바로 닫는다.
  const [pickerOpen, setPickerOpen] = useState(false);

  // 빈 목록 문구에 쓴다. 목록에서 사라진 카테고리를 고른 상태여도 문구는 나와야 한다.
  const activeLabel = categories.find((item) => item.key === activeCategory)?.label ?? '이 분류의';

  // 칩으로 그릴 칸과 셀렉트로 그릴 칸을 가른다.
  // 컴포넌트는 key 규칙을 모르고 kind 만 본다. (CLAUDE.md 9장)
  const chips = categories.filter((item) => item.kind !== 'destination');
  const places = categories.filter((item) => item.kind === 'destination');
  const allKey = categories.find((item) => item.kind === 'all')?.key ?? '';
  const activePlace = places.find((item) => item.key === activeCategory) ?? null;

  function pickPlace(key: string) {
    setPickerOpen(false);
    onChangeCategory(key);
  }

  return (
    <View className="flex-1 bg-pot-visual">
      {/* 상단바 — 다른 화면과 같은 공통 Header 를 쓴다. 제목은 가운데다.
          탭 헤더를 끈 상태라 상태바 높이만큼은 여기서 띄운다.
          ⚠️ 2026-09-18 뒤로가기를 켰다. 홈 '여행자들은 이렇게 다녀왔어요' 태그 · 전체 보기로
             들어온 사람이 하단 탭을 찾지 않고 바로 돌아갈 수 있게 한다.
             공통 Header 는 돌아갈 곳이 있을 때만(router.canGoBack) 화살표를 그리고
             router.back() 으로 직전 화면에 간다. components/ui 는 [공유] 라 고치지 않았다. */}
      <View className="bg-white" style={{ paddingTop: insets.top }}>
        <Header title="커뮤니티" />
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
            className="flex-row items-center rounded-full bg-brand px-3.5 py-2.5 active:bg-brand-pressed"
          >
            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
            <Text className="ml-1.5 font-bold text-white" style={{ fontSize: 12.5 }}>
              글쓰기
            </Text>
          </Pressable>
        </View>

        {/* 카테고리 (2026-09-03)
            전체·자유는 칩, 여행지는 셀렉트다. 한 번에 하나만 고른다.
            여행지는 글이 쌓일수록 계속 늘어나서 칩으로 두면 줄이 한없이 길어진다.

            검색창과의 간격은 style 로 준다. className(mt-*) 이 ScrollView 에서
            먹지 않는 경우가 있어 눈에 보이는 값으로 직접 잡는다. */}
        <View className="flex-row items-center" style={{ marginTop: 16, gap: 8 }}>
          {chips.map((item) => {
            const active = item.key === activeCategory;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChangeCategory(item.key)}
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: active ? ACCENT_SOFT : '#F1F3F6' }}
              >
                <Text
                  className="font-bold"
                  style={{ fontSize: 12.5, color: active ? ACCENT : '#747B88' }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}

          {/* 여행지 셀렉트. 고를 여행지가 하나도 없으면 그리지 않는다. */}
          {places.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="여행지 고르기"
              accessibilityState={{ expanded: pickerOpen }}
              onPress={() => setPickerOpen(true)}
              className="flex-row items-center rounded-full px-3.5 py-2"
              style={{ backgroundColor: activePlace ? ACCENT_SOFT : '#F1F3F6' }}
            >
              {activePlace?.flag ? (
                // 장식이다. 옆 글자가 여행지 이름을 그대로 말한다.
                <Text style={{ fontSize: 11, marginRight: 4 }} accessible={false}>
                  {activePlace.flag}
                </Text>
              ) : null}
              <Text
                className="font-bold"
                style={{ fontSize: 12.5, color: activePlace ? ACCENT : '#747B88' }}
              >
                {activePlace?.label ?? '여행지'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={13}
                color={activePlace ? ACCENT : '#9AA3AE'}
                style={{ marginLeft: 3 }}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 여행지 셀렉트 — 공통 바텀시트를 쓴다. (components/ui/BottomSheet) */}
      <BottomSheet
        visible={pickerOpen}
        title="여행지"
        description="글이 있는 여행지만 보여요."
        onClose={() => setPickerOpen(false)}
      >
        <PlaceRow
          label="전체 여행지"
          flag={null}
          count={null}
          selected={activePlace === null}
          onPress={() => pickPlace(allKey)}
        />
        {places.map((item) => (
          <PlaceRow
            key={item.key}
            label={item.label}
            flag={item.flag}
            count={item.count}
            selected={item.key === activeCategory}
            onPress={() => pickPlace(item.key)}
          />
        ))}
      </BottomSheet>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-28 pt-4"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
        }
      >
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

/** 여행지 셀렉트 한 줄. */
function PlaceRow({
  label,
  flag,
  count,
  selected,
  onPress,
}: {
  label: string;
  flag: string | null;
  count: number | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center border-b border-pot-line py-3.5 active:opacity-60"
    >
      {flag ? (
        <Text style={{ fontSize: 15, marginRight: 8 }} accessible={false}>
          {flag}
        </Text>
      ) : null}
      <Text
        className="flex-1"
        style={{ fontSize: 14.5, fontWeight: selected ? '800' : '500', color: '#111827' }}
      >
        {label}
      </Text>
      {count === null ? null : (
        <Text
          style={{ fontSize: 12.5, color: '#9AA3AE', marginRight: 8, fontVariant: ['tabular-nums'] }}
        >
          {count}
        </Text>
      )}
      {selected ? <Ionicons name="checkmark" size={17} color={ACCENT} /> : null}
    </Pressable>
  );
}
