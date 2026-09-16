import { Pressable, ScrollView, Text } from 'react-native';

import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '@/lib/notifications/notificationCategory';

type Props = {
  selected: NotificationCategory;
  onSelect: (category: NotificationCategory) => void;
};

/**
 * 알림센터 상단 필터 칩 — [전체] [초대·참여] [멤버·권한] [여행 취소]. (docs/14 §3)
 *
 * ⚠️ 칩을 누르면 화면 파일이 **서버에 다시 묻는다.** 여기서 목록을 거르지 않는다.
 * ⚠️ 카테고리 목록은 lib/notifications/notificationCategory 하나다. 여기 라벨을 따로 적지 않는다.
 */
export function NotificationFilterChips({ selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-none border-b border-pot-line bg-white"
      contentContainerClassName="gap-2 px-5 py-3"
    >
      {NOTIFICATION_CATEGORIES.map((category) => {
        const active = category.key === selected;
        return (
          <Pressable
            key={category.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${category.label} 알림`}
            onPress={() => onSelect(category.key)}
            className={`rounded-full px-3.5 py-1.5 ${active ? 'bg-pot-ink' : 'bg-pot-visual'}`}
          >
            <Text
              className={active ? 'text-white' : 'text-pot-mute'}
              style={{ fontSize: 13, fontWeight: active ? '700' : '500' }}
            >
              {category.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
