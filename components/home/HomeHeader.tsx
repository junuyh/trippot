// HOME-01 상단바.
//
// 탭 기본 헤더를 끄고(app/(tabs)/_layout.tsx) 직접 그린다.
// 기본 헤더는 제목이 가운데로 가서 로고를 왼쪽에 둘 수 없다.
//
// ⚠️ 지금은 워드마크다. assets/icon.png 는 Expo 기본 플레이스홀더(회색 동심원)라
//    로고로 쓸 수 없다. 로고 이미지가 나오면 이 파일의 마크만 <Image> 로 바꾼다.
//
// ⚠️ 상단바에는 아이콘을 두지 않는다. 마이페이지는 하단 탭으로 가고,
//    알림은 갈 화면이 아직 없다. (docs/04_화면목록_v3.md 에 알림 화면 없음)
//
// ⚠️ 2026-09-03 '여행 만들기' 버튼을 뺐다.
//    인사말과 같은 줄에 끼어 있어서 인사말이 폭을 다 먹고 남은 자리에 밀려 들어갔다.
//    작고 답답해 보여 누르기 싫다는 평을 받았다.
//    새 여행 만들기는 홈 맨 아래 CreateTripCard 가 맡는다. (docs/09_IA_v2.md §1-4)
//    여행이 하나도 없을 때는 OngoingTripCarousel 의 빈 상태가 같은 곳으로 보낸다.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** 인사에 쓸 이름. 없으면 이름 없이 인사한다. */
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 없으면 다른 문구를 쓴다. */
  daysToNextTrip: number | null;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

export function HomeHeader({ userName, daysToNextTrip }: Props) {
  const insets = useSafeAreaInsets();
  const greeting = userName ? `안녕하세요, ${userName}님 👋` : '안녕하세요 👋';

  return (
    <View className="bg-pot-visual px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center">
        <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-pot-ink">
          <Ionicons name="airplane" size={16} color="#FFFFFF" />
        </View>
        <Text
          className="ml-2.5 flex-1 font-black text-pot-ink"
          style={{ fontSize: 18, letterSpacing: -0.5 }}
        >
          TripPot
        </Text>
      </View>

      {/* 버튼이 빠져서 인사말이 한 줄을 다 쓴다. 글자를 키우고 여백을 늘렸다. */}
      <View className="mt-4">
        <Text
          className="font-black text-pot-ink"
          style={{ fontSize: 19, lineHeight: 25, letterSpacing: -0.6 }}
        >
          {greeting}
        </Text>
        <Text className="mt-1 text-pot-mute" style={{ fontSize: 12.5, ...NUM }}>
          {daysToNextTrip === null
            ? '새 여행을 계획해보세요.'
            : daysToNextTrip === 0
              ? '오늘 여행을 떠나요!'
              : `다음 여행까지 ${daysToNextTrip}일 남았어요!`}
        </Text>
      </View>
    </View>
  );
}
