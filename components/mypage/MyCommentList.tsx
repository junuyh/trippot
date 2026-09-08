import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, Text, View } from 'react-native';

import type { MyCommentListItem } from '@/lib/supabase/queries/community';

import { SwipeToAction } from './SwipeToAction';
import { formatNotifiedAt } from './format';

type Props = {
  comments: MyCommentListItem[];
  /** 누르면 댓글이 달린 글로 간다. 댓글 상세 화면은 만들지 않는다. */
  onPressComment: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
};

/**
 * MY '작성한 댓글' 목록.
 *
 * ⚠️ 커뮤니티 상세의 댓글 UI(components/community)를 쓰지 않는다. 그쪽은
 *    한 글 안의 대화라 작성자 사진·이름을 보여주는데, 여기는 전부 내 댓글이라
 *    같은 이름이 반복될 뿐이다. 대신 **어느 글에 단 댓글인지**를 보여준다.
 *
 * ⚠️ MyPostList 와 같은 짜임이다. pot-visual 바탕 위 흰 카드, radius 2xl,
 *    px-3.5, chevron 14 #C3C9D2. 세 목록이 같은 화면처럼 읽혀야 한다.
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function MyCommentList({ comments, onPressComment, onDeleteComment }: Props) {
  return (
    <FlatList
      className="flex-1 bg-pot-visual"
      contentContainerClassName="px-4 pb-16 pt-4"
      data={comments}
      keyExtractor={(item) => item.commentId}
      ItemSeparatorComponent={() => <View className="h-2.5" />}
      renderItem={({ item }) => {
        const at = formatNotifiedAt(item.createdAt);

        return (
          <View className="overflow-hidden rounded-2xl">
            <SwipeToAction
              label="삭제"
              accessibilityLabel={`${item.postTitle} 에 쓴 댓글 삭제`}
              icon="trash-outline"
              color="#F0424E"
              onPress={() => onDeleteComment(item.commentId)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.content}
                onPress={() => onPressComment(item.postId)}
                className="flex-row items-center bg-white px-3.5 py-3.5 active:opacity-90"
                style={{
                  shadowColor: '#111827',
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}
              >
                <View className="flex-1 pr-2">
                  {/* 내가 쓴 내용이 먼저다. 어느 글이었는지는 그다음. */}
                  <Text
                    numberOfLines={2}
                    className="text-pot-ink"
                    style={{ fontSize: 13.5, lineHeight: 19 }}
                  >
                    {item.content}
                  </Text>

                  <View className="mt-1 flex-row items-center">
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-pot-faint"
                      style={{ fontSize: 10.5 }}
                    >
                      {item.postTitle}
                    </Text>
                    {at ? (
                      <Text className="pl-1 text-pot-faint" style={{ fontSize: 10.5 }}>
                        {' · '}
                        {at}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
              </Pressable>
            </SwipeToAction>
          </View>
        );
      }}
    />
  );
}
