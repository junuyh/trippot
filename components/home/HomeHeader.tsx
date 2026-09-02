// HOME-01 상단바.
//
// 탭 기본 헤더를 끄고(app/(tabs)/_layout.tsx) 직접 그린다.
// 기본 헤더는 제목이 가운데로 가서 로고를 왼쪽에 둘 수 없다.
//
// ⚠️ 지금은 워드마크다. assets/icon.png 는 Expo 기본 플레이스홀더(회색 동심원)라
//    로고로 쓸 수 없다. 로고 이미지가 나오면 이 파일의 마크만 <Image> 로 바꾼다.
//
// ⚠️ 알림 아이콘은 그림만 있고 눌리지 않는다.
//    docs/04_화면목록_v3.md 에 알림 화면이 없어서 갈 곳이 없다.
//    화면이 정해지면 onPressNotifications 를 넘겨 Pressable 로 바꾼다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** 인사에 쓸 이름. 없으면 이름 없이 인사한다. */
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 없으면 다른 문구를 쓴다. */
  daysToNextTrip: number | null;
  onPressProfile: () => void;
  onPressCreateTrip: () => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

export function HomeHeader({
  userName,
  daysToNextTrip,
  onPressProfile,
  onPressCreateTrip,
}: Props) {
  const insets = useSafeAreaInsets();
  const greeting = userName ? `안녕하세요, ${userName}님 👋` : '안녕하세요 👋';

  return (
    <View className="bg-pot-visual px-5 pb-4" style={{ paddingTop: insets.top + 14 }}>
      <View className="flex-row items-center">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-pot-ink">
          <Ionicons name="airplane" size={18} color="#FFFFFF" />
        </View>
        <Text
          className="ml-2.5 flex-1 font-black text-pot-ink"
          style={{ fontSize: 21, letterSpacing: -0.6 }}
        >
          TripPot
        </Text>

        <View className="mr-2 h-9 w-9 items-center justify-center">
          <Ionicons name="notifications-outline" size={22} color="#111827" />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마이페이지"
          onPress={onPressProfile}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center active:opacity-60"
        >
          <Ionicons name="person-circle-outline" size={26} color="#111827" />
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center">
        <View className="flex-1 pr-3">
          <Text
            className="font-black text-pot-ink"
            style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.6 }}
          >
            {greeting}
          </Text>
          <Text className="mt-1 text-pot-mute" style={{ fontSize: 13, ...NUM }}>
            {daysToNextTrip === null
              ? '새 여행을 계획해보세요.'
              : daysToNextTrip === 0
                ? '오늘 여행을 떠나요!'
                : `다음 여행까지 ${daysToNextTrip}일 남았어요!`}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 여행 만들기"
          onPress={onPressCreateTrip}
          className="flex-row items-center rounded-full bg-pot-ink px-4 py-3 active:opacity-80"
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text className="ml-1 font-bold text-white" style={{ fontSize: 13 }}>
            여행 만들기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
