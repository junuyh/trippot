// 여행 홈 헤더 오른쪽 '여행 설정' 버튼. 누르면 오른쪽 사이드 시트가 열린다.
//
// ⚠️ 여행 홈에만 둔다. 다른 화면에서 여행 설정에 닿고 싶으면 여행 홈으로
//    돌아오는 TripHomeButton 이 이미 있다. 두 버튼을 한 헤더에 같이 두지 않는다.
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

type Props = {
  onPress: () => void;
};

export function TripSettingsButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="여행 설정"
      hitSlop={8}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
    >
      <Ionicons name="settings-outline" size={20} color="#111827" />
    </Pressable>
  );
}
