import { FlatList, Pressable, Text, View } from 'react-native';

import { POST_TYPE_DISPLAY_LABEL } from '@/components/community/label';
import type { MyPostListItem } from '@/lib/supabase/queries/community';

import { formatNotifiedAt } from './format';

type Props = {
  posts: MyPostListItem[];
  onPressPost: (postId: string) => void;
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
 * ⚠️ MY 전체 디자인 적용 전이라 기존 토큰만으로 최소 UI 만 만든다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function MyPostList({ posts, onPressPost }: Props) {
  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-16"
      data={posts}
      keyExtractor={(item) => item.postId}
      renderItem={({ item }) => {
        const at = item.publishedAt ? formatNotifiedAt(item.publishedAt) : null;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onPressPost(item.postId)}
            className="active:bg-pot-visual"
          >
            <View className="border-b border-pot-line py-4">
              <Text numberOfLines={2} className="text-base leading-6 text-pot-ink">
                {item.title}
              </Text>

              {/* 유형 · 여행지 · 날짜. 없는 것은 자리를 만들지 않는다. */}
              <View className="mt-1.5 flex-row items-center">
                <Text className="text-xs text-pot-faint">
                  {POST_TYPE_DISPLAY_LABEL[item.postType]}
                </Text>
                {item.destination ? (
                  <Text className="text-xs text-pot-faint"> · {item.destination}</Text>
                ) : null}
                {at ? <Text className="text-xs text-pot-faint"> · {at}</Text> : null}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
