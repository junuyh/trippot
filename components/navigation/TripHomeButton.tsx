// 헤더 오른쪽 '여행 홈' 버튼.
//
// ⚠️ 여행 홈에서 두 단계 이상 들어간 화면(예산 전체 → 카테고리 상세,
//    여행자금 → 전체 지출내역 → 거래 상세)에서 밖으로 나오려면 뒤로가기를
//    여러 번 눌러야 했다. 사용자가 다음에 할 일은 대개 '이 여행의 다른 것' 이라
//    돌아갈 곳은 여행 홈이다. 한 번에 가게 한다.
//
// ⚠️ push 가 아니라 **dismissTo/replace** 로 간다. push 로 쌓으면 여행 홈이
//    스택에 두 번 들어가, 거기서 뒤로가기를 누르면 방금 나온 화면으로
//    되돌아간다.
//
// ⚠️ 탭 홈(/)이 아니라 **여행 홈**으로 간다. 여행 안에서 길을 잃었을 때
//    앱 첫 화면까지 밀어내면 하던 일이 통째로 끊긴다.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable } from "react-native";

type Props = {
  tripId: string;
};

export function TripHomeButton({ tripId }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="여행 홈으로"
      hitSlop={8}
      onPress={() => {
        const href = `/trips/${tripId}` as never;
        // 스택에 이미 여행 홈이 있으면 거기까지 걷어낸다
        if (router.canDismiss()) {
          router.dismissTo(href);
          return;
        }
        router.replace(href);
      }}
      className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
    >
      <Ionicons name="home-outline" size={19} color="#111827" />
    </Pressable>
  );
}
