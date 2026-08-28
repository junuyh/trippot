import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

type Props = {
  onPress: () => void;
};

/**
 * 여행 생성 1단계(TRIP-01) 헤더 왼쪽 뒤로가기 버튼.
 *
 * TRIP-01 은 /trips/new 중첩 Stack 의 첫 화면이라 Stack 이 back 버튼을 그려 주지
 * 않는다. TRIP-02·03 은 앞 화면이 쌓여 있어 자동으로 생기지만 TRIP-01 만 없어서,
 * 잘못 들어온 사용자에게 화면상 나갈 길이 없다. 그래서 이 화면에만 직접 붙인다.
 *
 * 이동 경로 판단은 화면 파일이 한다. 여기서는 router 를 부르지 않는다.
 * (CLAUDE.md 9장 — UI 컴포넌트는 supabase / track() / 라우팅을 직접 다루지 않는다)
 */
export function HeaderBackButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      onPress={onPress}
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-gray-100"
    >
      <Ionicons name="chevron-back" size={24} color="#111827" />
    </Pressable>
  );
}
