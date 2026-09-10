// HOME-01 상단바.
//
// 탭 기본 헤더를 끄고(app/(tabs)/_layout.tsx) 직접 그린다.
// 기본 헤더는 제목이 가운데로 가서 로고를 왼쪽에 둘 수 없다.
//
// ⚠️ 2026-09-04 마크를 실제 로고(assets/logo.png)로 바꿨다.
//    그전에는 assets/icon.png 가 Expo 기본 플레이스홀더(회색 동심원)라 쓸 수 없어서
//    pot-ink 사각형 안에 Ionicons 비행기를 임시로 넣어 뒀었다.
//
// ⚠️ **어두운 사각형 배경을 같이 뺐다.** 로고가 파란 TP 모노그램 + 검은 비행기라
//    남색(pot-ink) 위에 얹으면 둘 다 묻혀서 안 보인다. 흰 바탕에 마크만 놓는다.
//    배경을 되살리려면 로고의 흰색 반전본이 먼저 필요하다.
//
// ⚠️ 로고는 가로가 더 길다(1236:1007 ≈ 1.23:1). 정사각으로 두면 눌려 보이므로
//    높이를 글자에 맞추고 너비를 비율로 준다. 원본 여백은 잘라내고 넣었다.
//
// ⚠️ 상단바에는 아이콘을 두지 않는다. 마이페이지는 하단 탭으로 가고,
//    알림은 갈 화면이 아직 없다. (docs/04_화면목록_v3.md 에 알림 화면 없음)
//
// ⚠️ 2026-09-03 '여행 만들기' 버튼을 뺐다.
//    인사말과 같은 줄에 끼어 있어서 인사말이 폭을 다 먹고 남은 자리에 밀려 들어갔다.
//    작고 답답해 보여 누르기 싫다는 평을 받았다.
//    새 여행 만들기는 홈 맨 아래 CreateTripCard 가 맡는다. (docs/09_IA_v2.md §1-4)
//    여행이 하나도 없을 때는 OngoingTripCarousel 의 빈 상태가 같은 곳으로 보낸다.
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** 인사에 쓸 이름. 없으면 이름 없이 인사한다. */
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 없으면 다른 문구를 쓴다. */
  daysToNextTrip: number | null;
};

export function HomeHeader({ userName, daysToNextTrip }: Props) {
  const insets = useSafeAreaInsets();
  const greeting = userName ? `안녕하세요, ${userName}님 👋` : '안녕하세요 👋';

  return (
    <View className="bg-white px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center">
        <Image
          source={require('@/assets/logo.png')}
          style={{ width: 34, height: 28 }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="TripPot"
        />
        <Text
          className="ml-2 flex-1 text-pot-ink"
          style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.4 }}
        >
          TripPot
        </Text>
      </View>

      {/* 버튼이 빠져서 인사말이 한 줄을 다 쓴다. 글자를 키우고 여백을 늘렸다.
          로고 줄과 붙어 보인다는 평을 받아 한 번 더 띄웠다. (2026-09-07) */}
      <View className="mt-6">
        <Text
          className="text-pot-ink"
          style={{ fontSize: 19, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4 }}
        >
          {greeting}
        </Text>
        {/* 시안 문구. 남은 일수는 카드의 D-Day 가 이미 보여주므로 여기서 반복하지 않는다. */}
        <Text className="mt-1 text-pot-mute" style={{ fontSize: 12.5 }}>
          {daysToNextTrip === null ? '멋진 여행을 준비해보세요.' : '떠날 여행을 준비해보세요.'}
        </Text>
      </View>
    </View>
  );
}
