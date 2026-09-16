import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  title: string;
  body: string | null;
  /** [확인] — 알림 상세로. 여기서 읽음이 기록된다. */
  onConfirm: () => void;
  /** 닫기(X) 또는 자동 사라짐. 읽음이 아니다. */
  onDismiss: () => void;
};

/**
 * In-app Banner — 앱을 쓰는 중에 새 알림이 오면 상단에 잠깐 뜬다. (docs/14 §8)
 *
 * 화면 위에 절대 위치로 겹쳐 그린다. 아래 화면의 터치는 배너 영역 밖에서 그대로 통한다.
 * ⚠️ 이 컴포넌트는 "보였다" 를 어디에도 기록하지 않는다. 읽음은 [확인] 을 눌러 상세로 갔을 때다.
 * ⚠️ supabase · track() 을 부르지 않는다. 언제 띄울지는 lib/notifications/NotificationBannerObserver 가 정한다.
 */
export function NotificationBanner({ title, body, onConfirm, onDismiss }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 100 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`새 알림 ${title}`}
        onPress={onConfirm}
        className="flex-row items-start rounded-2xl bg-white px-4 py-3.5 active:opacity-90"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-pot-visual">
          <Ionicons name="notifications" size={16} color="#3B2F8F" />
        </View>

        <View className="flex-1">
          <Text
            className="text-pot-ink"
            numberOfLines={1}
            style={{ fontSize: 14.5, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2 }}
          >
            {title}
          </Text>
          {body ? (
            <Text
              className="mt-0.5 text-pot-mute"
              numberOfLines={2}
              style={{ fontSize: 13, lineHeight: 18 }}
            >
              {body}
            </Text>
          ) : null}
          <Text className="mt-1.5 text-pot-ink" style={{ fontSize: 12.5, fontWeight: '700' }}>
            확인
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="알림 배너 닫기"
          hitSlop={10}
          onPress={onDismiss}
          className="ml-2 mt-0.5"
        >
          <Ionicons name="close" size={18} color="#9AA0AE" />
        </Pressable>
      </Pressable>
    </View>
  );
}
