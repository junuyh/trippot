import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

/**
 * MY-01 헤더 오른쪽 알림 버튼.
 *
 * 모양은 components/ui/HeaderBackButton 과 맞춘다.
 * (같은 헤더 줄에 놓이는 아이콘 버튼이라 크기·색·터치 피드백을 다르게 두지 않는다)
 *
 * ⚠️ 이 버튼은 "받은 알림 메시지 목록" 으로 가는 입구다.
 *    설정 > 알림(알림을 켜고 끄는 화면)과 역할이 다르다. 같은 곳으로 보내지 않는다.
 */
type Props = {
  onPress: () => void;
};

export function NotificationBellButton({ onPress }: Props) {
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
    </Pressable>
  );
}
