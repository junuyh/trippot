// 헤더 왼쪽 뒤로 버튼.
//
// ⚠️ 네이티브 Stack 헤더는 **스택에 히스토리가 있을 때만** 뒤로 버튼을 그린다.
//    딥링크로 들어오거나 앱의 첫 화면이 되면 버튼이 사라져 막다른 골목이 된다.
//    (알림·공유 링크로 여행 상세에 바로 들어오는 경우가 그렇다)
//
//    그래서 항상 그리고, 돌아갈 곳이 없으면 홈으로 보낸다.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

type Props = {
  /** 돌아갈 히스토리가 없을 때 갈 곳. 기본은 홈 */
  fallbackHref?: string;
};

export function HeaderBackButton({ fallbackHref = '/' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      hitSlop={8}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        // 히스토리가 없으면 되돌아갈 화면이 없다. 홈으로 보낸다.
        router.replace(fallbackHref as never);
      }}
      className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
    >
      <Ionicons name="chevron-back" size={24} color="#111827" />
    </Pressable>
  );
}
