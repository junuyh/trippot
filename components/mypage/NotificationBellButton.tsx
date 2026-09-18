import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useHasUnreadNotifications } from '@/lib/notifications/unreadNotifications';

/**
 * MY-01 헤더 오른쪽 알림 버튼.
 *
 * 모양은 components/ui/HeaderBackButton 과 맞춘다.
 * (같은 헤더 줄에 놓이는 아이콘 버튼이라 크기·색·터치 피드백을 다르게 두지 않는다)
 *
 * ⚠️ 이 버튼은 "받은 알림 메시지 목록" 으로 가는 입구다.
 *    설정 > 알림(알림을 켜고 끄는 화면)과 역할이 다르다. 같은 곳으로 보내지 않는다.
 * 안 읽은 알림이 있으면 오른쪽 위에 작은 점. (2026-09-18 · lib/notifications/unreadNotifications)
 * 점의 판단은 lib 훅이 한다 — 이 컴포넌트는 supabase 를 직접 부르지 않는다.
 */
type Props = {
  onPress: () => void;
};

export function NotificationBellButton({ onPress }: Props) {
  const hasUnread = useHasUnreadNotifications();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="알림"
      hitSlop={8}
      onPress={onPress}
      // 헤더 오른쪽 끝에 붙지 않게 여백을 준다.
      // ⚠️ 이 여백은 제목 중앙 정렬에 영향을 주지 않는다.
      //    헤더의 좌/우 컨테이너가 같은 비율로 늘어나기 때문이다.
      className="mr-2 h-9 w-9 items-center justify-center rounded-full active:bg-pot-visual"
    >
      <Ionicons name="notifications-outline" size={24} color="#111827" />
      {hasUnread ? <UnreadDot /> : null}
    </Pressable>
  );
}

/**
 * 안 읽음 점 — 브랜드색, 흰 테두리로 아이콘 선과 분리. 홈 헤더(HomeHeader)와 같은 모양.
 * 위치는 종의 **왼쪽 위 바깥**(2026-09-18 확정). 36×36 상자 안에서 아이콘(24)은 6..30 에 놓이므로
 * (1, 1) 에 두면 종 윤곽을 가리지 않으면서 붙어 보인다. 오른쪽 위에 두었을 때는 윤곽을 덮었다.
 */
export function UnreadDot() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 1,
        left: 1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#64139E',
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }}
    />
  );
}
