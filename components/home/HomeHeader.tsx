// HOME-01 상단바. 로고와 서비스 이름만 있다. (2026-09-10 인사말 제거)
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
//    (그 인사말도 2026-09-10 에 없앴다)
//    작고 답답해 보여 누르기 싫다는 평을 받았다.
//    새 여행 만들기는 홈 맨 아래 CreateTripCard 가 맡는다. (docs/09_IA_v2.md §1-4)
//    여행이 하나도 없을 때는 OngoingTripCarousel 의 빈 상태가 같은 곳으로 보낸다.
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /**
   * 인사에 쓸 이름.
   *
   * ⚠️ 2026-09-10 인사말을 빼면서 지금은 쓰지 않는다. props 는 남겨 둔다 —
   *    두 홈 화면이 이미 넘기고 있고, 인사말이 돌아올 수 있다.
   */
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 위와 같은 이유로 지금은 쓰지 않는다. */
  daysToNextTrip: number | null;
};

export function HomeHeader({ userName: _userName, daysToNextTrip: _daysToNextTrip }: Props) {
  const insets = useSafeAreaInsets();

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

      {/*
        ⚠️ 2026-09-10 인사말('안녕하세요, ○○님 👋' + '멋진 여행을 준비해보세요.')을
           통째로 뺐다. 기존 유저 홈과 신규 유저 홈 모두에서 사라진다.

           두 줄이 화면 위쪽을 차지하는 데 비해 하는 일이 없었다. 이름을 불러 주는
           것 말고는 아무 정보도 주지 않고, 그 아래 '준비 중인 여행'·'추천 여행지'
           카드가 첫 화면에서 그만큼 밀려 내려갔다. 홈은 내 여행이 놓인 선반이라
           선반이 먼저 보여야 한다.

           되살리려면 이 자리에 다시 넣으면 된다. props(userName·daysToNextTrip)는
           그대로 받고 있다.
      */}
    </View>
  );
}
