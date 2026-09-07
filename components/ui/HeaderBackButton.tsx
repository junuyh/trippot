// 헤더 왼쪽 뒤로 버튼.
//
// ⚠️ 네이티브 Stack 헤더는 **스택에 히스토리가 있을 때만** 뒤로 버튼을 그린다.
//    딥링크로 들어오거나 앱의 첫 화면이 되면 버튼이 사라져 막다른 골목이 된다.
//    그래서 항상 그린다.
//
// ============================================================================
// 뒤로가기는 '방문 기록' 이 아니라 '한 단계 위' 로 간다
// ============================================================================
//
//   parentHref 를 넘기면 그 화면으로 간다. 어떻게 들어왔든 결과가 같다.
//
//     예산 전체 → 카테고리 상세 → 뒤로 → 예산 전체
//     정산     → 카테고리 상세 → 뒤로 → 예산 전체   ← 같다
//
//   ⚠️ **router.back() 을 쓰지 않는다.** back 은 직전에 본 화면으로 간다.
//      여행 안에서는 같은 화면을 여러 경로로 들어가기 때문에, 스택에 같은
//      화면이 여러 벌 쌓이고 뒤로가기를 누를수록 옛 사본이 다시 나온다.
//      ("보험에서 뒤로 → 카테고리 → 또 보험" 이 그렇게 생긴다)
//
//   ⚠️ dismissTo 는 그 화면까지 스택을 **걷어낸다.** 스택에 없으면 현재 화면을
//      그것으로 **교체한다.** 어느 쪽이든 사본이 쌓이지 않고 깊이가 줄어든다.
//      그래서 push 로 들어간 화면이든 딥링크로 들어온 화면이든 결과가 같다.
//
//   parentHref 를 안 넘기면 예전처럼 직전 화면으로 간다. 부모가 진입점에 따라
//   달라지는 화면(여행자보험)은 호출부가 그때그때 계산해서 넘긴다.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

type Props = {
  /**
   * 한 단계 위 화면. 넘기면 히스토리와 무관하게 항상 여기로 간다.
   */
  parentHref?: string;
  /** parentHref 가 없을 때, 돌아갈 히스토리도 없으면 갈 곳 */
  fallbackHref?: string;
};

export function HeaderBackButton({ parentHref, fallbackHref = '/' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      hitSlop={8}
      onPress={() => {
        if (parentHref) {
          router.dismissTo(parentHref as never);
          return;
        }
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
