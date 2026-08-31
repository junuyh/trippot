// HOME-01 상단바.
//
// 탭 기본 헤더를 끄고(app/(tabs)/_layout.tsx) 직접 그린다.
// 기본 헤더는 제목이 가운데로 가서 로고를 왼쪽에 둘 수 없다.
//
// ⚠️ 지금은 워드마크다. assets/icon.png 는 Expo 기본 플레이스홀더(회색 동심원)라
//    로고로 쓸 수 없다. 로고 이미지가 나오면 이 파일의 마크만 <Image> 로 바꾼다.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HomeHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-pot-visual px-5 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-row items-center">
        <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-pot-ink">
          <Ionicons name="airplane" size={17} color="#FFFFFF" />
        </View>
        <Text
          className="ml-2.5 font-bold text-pot-ink"
          style={{ fontSize: 21, letterSpacing: -0.5 }}
        >
          TripPot
        </Text>
      </View>
    </View>
  );
}
