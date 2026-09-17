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
// ⚠️ 2026-09-15 오른쪽에 알림 버튼을 달았다. 받은 알림 목록(/me/notifications)으로 간다.
//    전에는 갈 화면이 없어 비워 뒀는데, 마이페이지 헤더 🔔 가 쓰는 알림함이 생겼다.
//    마이페이지 아이콘은 여전히 두지 않는다. 하단 탭으로 간다.
//
// ⚠️ 모양은 components/mypage/NotificationBellButton 과 같다(크기·색·눌림).
//    그 컴포넌트를 그대로 쓰지 않은 것은 기본 헤더용 오른쪽 여백(mr-2)이 붙어 있어서다.
//    이 상단바는 px-4 로 이미 여백이 있어 벨만 안쪽으로 밀려 로고와 좌우가 어긋난다.
//    다른 담당자 파일이라 여백을 고치지 않았다. (CLAUDE.md 13장)
//
// ⚠️ 2026-09-03 '여행 만들기' 버튼을 뺐다.
//    인사말과 같은 줄에 끼어 있어서 인사말이 폭을 다 먹고 남은 자리에 밀려 들어갔다.
//    (그 인사말도 2026-09-10 에 없앴다)
//    작고 답답해 보여 누르기 싫다는 평을 받았다.
//    새 여행 만들기는 홈 맨 아래 CreateTripCard 가 맡는다. (docs/09_IA_v2.md §1-4)
//    여행이 하나도 없을 때는 OngoingTripCarousel 의 빈 상태가 같은 곳으로 보낸다.
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
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
  /** 알림 버튼을 눌렀을 때. 받은 알림 목록으로 보낸다. */
  onPressNotifications: () => void;
  /**
   * [개발용] 로고를 길게 눌렀을 때. 화면 파일이 신규 사용자 홈 미리보기를 켜고 끈다.
   * (2026-09-17) 넘기지 않으면 로고는 눌리지 않는다. 배포 빌드에서는 화면 파일이 넘기지 않는다.
   */
  onLongPressLogo?: () => void;
};

export function HomeHeader({
  userName: _userName,
  daysToNextTrip: _daysToNextTrip,
  onPressNotifications,
  onLongPressLogo,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-white px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center">
        {/*
          ⚠️ [개발용] 로고 + 이름 전체를 길게 누르면 신규 사용자 홈 미리보기를 켜고 끈다.
             짧게 누르면 아무 일도 없다 — 사용자에게는 여전히 그냥 로고다.
             onLongPressLogo 가 없으면 disabled 라 눌리지 않는다.
             (글자색 text-brand 는 한나 브랜드 컬러 작업 그대로다)
        */}
        <Pressable
          className="flex-1 flex-row items-center"
          disabled={!onLongPressLogo}
          onLongPress={onLongPressLogo}
          delayLongPress={600}
          accessible={false}
        >
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 34, height: 28 }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="TripPot"
          />
          <Text
            className="ml-2 flex-1 text-brand"
            style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.4 }}
          >
            TripPot
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="알림"
          hitSlop={8}
          onPress={onPressNotifications}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-pot-visual"
        >
          <Ionicons name="notifications-outline" size={24} color="#111827" />
        </Pressable>
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
