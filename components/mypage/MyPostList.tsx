import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, Text, View } from 'react-native';

import { POST_TYPE_DISPLAY_LABEL } from '@/components/community/label';
import type { MyPostListItem } from '@/lib/supabase/queries/community';

import { SwipeToAction } from './SwipeToAction';
import { formatNotifiedAt } from './format';

/**
 * 왼쪽으로 밀었을 때 나올 액션. 없으면 스와이프 자체가 없다.
 *
 * 화면마다 하는 일이 다르다.
 *   작성한 게시글  글 삭제       (되돌릴 수 없음 · 확인창 있음)
 *   좋아요        좋아요 취소   (되돌릴 수 있음 · 확인창 없음)
 */
type SwipeAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: (postId: string) => void;
};

type Props = {
  posts: MyPostListItem[];
  onPressPost: (postId: string) => void;
  /** 없으면 밀리지 않는다. */
  swipeAction?: SwipeAction;
};

/**
 * MY 커뮤니티 활동 목록. '작성한 게시글' 과 '좋아요' 가 함께 쓴다.
 *
 * ⚠️ 커뮤니티의 PostCard 를 쓰지 않는다. 그쪽은 본문·작성자·좋아요 수·댓글 수를
 *    전부 요구해서 MY 목록이 필요 없는 집계 쿼리까지 끌고 온다.
 *    여기는 제목·유형·여행지·날짜만 보여주고 자세한 건 상세로 넘긴다.
 *
 * ⚠️ 유형 이름은 POST_TYPE_DISPLAY_LABEL 을 쓴다. status.ts 의 POST_TYPE_LABEL 은
 *    DB 열거값 라벨이라 폐기된 '무료 팁' 이 남아 있다. 커뮤니티 목록·상세와
 *    같은 이름으로 불러야 한 글이 화면마다 다른 이름으로 보이지 않는다.
 *    (components/community/label.ts — 읽기만 하고 고치지 않는다)
 *
 * ⚠️ 홈 카드와 같은 짜임이다. pot-visual 바탕 위에 흰 카드, radius 2xl,
 *    px-3.5 · chevron 14 #C3C9D2. MY-01 과 같은 언어로 보이게만 맞췄고
 *    큰 레이아웃 변경은 하지 않았다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function MyPostList({ posts, onPressPost, swipeAction }: Props) {
  return (
    <FlatList
      className="flex-1 bg-gray-50"
      contentContainerClassName="pb-16 pt-4"
      contentContainerStyle={{ paddingHorizontal: 18 }}
      data={posts}
      keyExtractor={(item) => item.postId}
      ItemSeparatorComponent={() => <View className="h-2.5" />}
      renderItem={({ item }) => {
        const at = item.publishedAt ? formatNotifiedAt(item.publishedAt) : null;

        const row = (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onPressPost(item.postId)}
            // ⚠️ 스와이프가 붙으면 모서리를 둥글게 두지 않는다. 카드가 밀려도
            //    뒤 액션이 둥근 틈으로 비쳐 보인다. 액션이 없을 때만 rounded-2xl.
            className={`flex-row items-center bg-white px-3.5 py-3.5 active:bg-pot-visual ${
              swipeAction ? '' : 'rounded-2xl'
            }`}
            style={{
              borderWidth: 1,
              borderColor: '#E5E8EC',
              shadowColor: '#111827',
              shadowOpacity: 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            <View className="flex-1 pr-2">
              <Text
                numberOfLines={2}
                className="text-pot-ink"
                style={{ fontSize: 13.5, lineHeight: 19 }}
              >
                {item.title}
              </Text>

              {/* 유형 · 여행지 · 날짜. 없는 것은 자리를 만들지 않는다. */}
              <View className="mt-1 flex-row items-center">
                <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
                  {POST_TYPE_DISPLAY_LABEL[item.postType]}
                </Text>
                {item.destination ? (
                  <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
                    {' · '}
                    {item.destination}
                  </Text>
                ) : null}
                {at ? (
                  <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
                    {' · '}
                    {at}
                  </Text>
                ) : null}
              </View>
            </View>

            <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
          </Pressable>
        );

        if (!swipeAction) return row;

        return (
          // 스와이프로 감싸면 그 안에서 모서리를 자른다. 카드 자체의 radius 를
          // 없애는 대신 바깥에서 잘라야 밀 때 액션이 각지게 붙는다.
          <View className="overflow-hidden rounded-2xl">
            <SwipeToAction
              label={swipeAction.label}
              accessibilityLabel={`${item.title} ${swipeAction.label}`}
              icon={swipeAction.icon}
              color={swipeAction.color}
              onPress={() => swipeAction.onPress(item.postId)}
            >
              {row}
            </SwipeToAction>
          </View>
        );
      }}
    />
  );
}
