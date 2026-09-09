// 여행 홈 헤더 왼쪽 '앱 홈' 버튼.
//
// ⚠️ 여행 홈에서 '<' 는 어디로 가는지 알 수 없었다. 딥링크로 들어오면 아예 없고,
//    홈 탭에서 들어오면 홈으로, 모임에서 들어오면 모임으로 갔다. 여행 홈의
//    한 단계 위는 언제나 앱 홈(탭)이므로 집 모양 버튼으로 바꿔 항상 거기로 간다.
//
// ⚠️ 여행 안쪽 화면(예산·자금·정산)의 오른쪽 버튼은 TripHomeButton(비행기)이다.
//    집 = 앱 홈, 비행기 = 여행 홈. 두 그림을 섞어 쓰지 않는다.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable } from "react-native";

export function AppHomeButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="홈으로"
      hitSlop={8}
      onPress={() => {
        const href = "/" as never;
        if (router.canDismiss()) {
          router.dismissTo(href);
          return;
        }
        router.replace(href);
      }}
      className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
    >
      <Ionicons name="home-outline" size={20} color="#111827" />
    </Pressable>
  );
}
