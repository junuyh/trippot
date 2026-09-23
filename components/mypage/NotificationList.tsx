import { useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Ionicons } from '@expo/vector-icons';

import { formatNotifiedAtWithTime } from './format';
import type { NotificationListItem } from './types';

type Props = {
  /** 이미 최신순으로 정렬돼 들어온다. 여기서 다시 정렬하지 않는다. */
  notifications: NotificationListItem[];
  onPressNotification: (notification: NotificationListItem) => void;
  onDeleteNotification: (notification: NotificationListItem) => void;
  /** 다음 페이지가 있는가. 있으면 맨 아래 [더 보기]. (docs/14 §9 · 30건 커서) */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

/**
 * 받은 알림 목록.
 *
 * ⚠️ 누르면 상세(/me/notifications/:id)로 간다. 읽음 처리는 상세가 한다. (2026-09-16)
 * ⚠️ 왼쪽으로 밀면 삭제가 나온다. Swipeable 패턴은 계획 카드·거래 목록이
 *    쓰는 것과 같다. (components/budget/PlanItemCard) 새 라이브러리를 넣지 않는다.
 *    확인 모달·되돌리기는 두지 않는다. MVP 범위가 아니다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 * ⚠️ DB 알림과 기기 보관 알림을 같은 줄 모양으로 그린다. 출처 배지는 없다. (2026-09-14)
 */
export function NotificationList({
  notifications,
  onPressNotification,
  onDeleteNotification,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  // 삭제를 누른 뒤 열린 스와이프를 닫는다. 열린 채로 두면 다음 줄이 밀려 보인다.
  const swipeRefs = useRef(new Map<string, SwipeableMethods | null>());

  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-16"
      data={notifications}
      keyExtractor={(item) => `${item.source}:${item.id}`}
      ListFooterComponent={
        hasMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="알림 더 보기"
            disabled={loadingMore}
            onPress={onLoadMore}
            className="items-center py-5 active:opacity-60"
          >
            {loadingMore ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-pot-mute" style={{ fontSize: 14, fontWeight: '600' }}>
                더 보기
              </Text>
            )}
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => {
        const unread = item.readAt === null;
        const at = formatNotifiedAtWithTime(item.createdAt);

        return (
          <Swipeable
            ref={(node) => {
              if (node) swipeRefs.current.set(item.id, node);
              else swipeRefs.current.delete(item.id);
            }}
            overshootRight={false}
            renderRightActions={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 삭제`}
                onPress={() => {
                  swipeRefs.current.get(item.id)?.close();
                  onDeleteNotification(item);
                }}
                style={{
                  width: 68,
                  backgroundColor: '#F0424E',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={{ marginTop: 3, fontSize: 11, fontWeight: '800', color: '#fff' }}>
                  삭제
                </Text>
              </Pressable>
            )}
          >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onPressNotification(item)}
            className="bg-white active:bg-pot-visual"
          >
            <View className="flex-row border-b border-pot-line py-4">
              {/*
                안 읽은 알림만 왼쪽에 점을 찍는다. 읽은 뒤에도 자리는 남겨
                글자 시작점이 흔들리지 않게 한다.
              */}
              <View className="w-4 pt-1.5">
                {unread ? <View className="h-2 w-2 rounded-full bg-brand" /> : null}
              </View>

              <View className="flex-1">
                <View className="flex-row items-start">
                  <Text
                    className={`flex-1 pr-3 text-base leading-6 ${
                      unread ? 'font-semibold text-pot-ink' : 'text-pot-mute'
                    }`}
                  >
                    {item.title}
                  </Text>
                  {/* 오른쪽 여백 14pt — 왼쪽으로 밀면 이 글자 바로 옆에 빨간 삭제 칸이 붙는다. (2026-09-20) */}
                  {at ? <Text className="pr-3.5 pt-0.5 text-xs text-pot-faint">{at}</Text> : null}
                </View>

                {item.body ? (
                  <Text className="mt-1 text-sm leading-5 text-pot-mute">{item.body}</Text>
                ) : null}

                {/* 보조 문맥 — 지출 리마인드의 '모임명 · 기간'. 긴 모임명은 한 줄에서 자른다. (2026-09-21) */}
                {item.context ? (
                  <Text numberOfLines={1} className="mt-1 pr-3.5 text-xs text-pot-faint">
                    {item.context}
                  </Text>
                ) : null}
              </View>
            </View>
          </Pressable>
          </Swipeable>
        );
      }}
    />
  );
}
