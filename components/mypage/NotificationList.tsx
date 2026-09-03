import { FlatList, Pressable, Text, View } from 'react-native';

import type { Notification } from '@/lib/supabase/queries/notifications';

import { formatNotifiedAt } from './format';

type Props = {
  /** 이미 created_at DESC 로 정렬돼 들어온다. 여기서 다시 정렬하지 않는다. */
  notifications: Notification[];
  onPressNotification: (notification: Notification) => void;
};

/**
 * 받은 알림 목록.
 *
 * ⚠️ 누르면 읽음 처리만 한다. 여행 상세로 보내지 않는다. (이번 범위 밖)
 * ⚠️ 삭제·스와이프를 두지 않는다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function NotificationList({ notifications, onPressNotification }: Props) {
  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-16"
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const unread = item.read_at === null;
        const at = formatNotifiedAt(item.created_at);

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onPressNotification(item)}
            className="active:bg-pot-visual"
          >
            <View className="flex-row border-b border-pot-line py-4">
              {/*
                안 읽은 알림만 왼쪽에 점을 찍는다. 읽은 뒤에도 자리는 남겨
                글자 시작점이 흔들리지 않게 한다.
              */}
              <View className="w-4 pt-1.5">
                {unread ? <View className="h-2 w-2 rounded-full bg-red-500" /> : null}
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
                  {at ? <Text className="pt-0.5 text-xs text-pot-faint">{at}</Text> : null}
                </View>

                {item.body ? (
                  <Text className="mt-1 text-sm leading-5 text-pot-mute">{item.body}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
