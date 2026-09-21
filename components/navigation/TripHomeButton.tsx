// 헤더 오른쪽 '여행 홈' 버튼. 그림은 **비행기**다.
//
// ⚠️ 2026-09-09 · 집 모양에서 비행기로 바꿨다. 집은 앱 홈으로 읽히는데 실제로는
//    여행 홈으로 가서 어색했다. 앱 홈은 여행 홈 헤더 왼쪽의 AppHomeButton(집)이
//    맡는다. 집 = 앱 홈, 비행기 = 여행 홈.
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
//
// ⚠️ 2026-09-21 테스트 · 그림 하나만 두니 **버튼인 줄 몰랐다.** 테두리를 두르고
//    '여행 홈' 이라고 적는다. 헤더 아이콘은 눌러 보기 전에는 장식과 구분되지
//    않는다. 이 버튼은 여행 안에서 길을 잃었을 때의 유일한 탈출구라 놓치면 안 된다.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";

type Props = {
  tripId: string;
  /**
   * 끝난 여행이면 true. 비행기 대신 **영수증**을 그린다.
   * 이미 다녀온 여행에서 비행기는 "또 간다" 로 읽힌다. 돌아갈 곳은 결산이 끝난
   * 여행 홈이라 영수증이 맞다. (2026-09-09)
   */
  ended?: boolean;
};

export function TripHomeButton({ tripId, ended = false }: Props) {
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
      className="h-8 flex-row items-center justify-center rounded-full active:bg-gray-100"
      style={{
        gap: 4,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: "#dfe3e8",
      }}
    >
      <Ionicons name={ended ? "receipt-outline" : "airplane-outline"} size={15} color="#111827" />
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#111827" }}>
        여행 홈
      </Text>
    </Pressable>
  );
}
