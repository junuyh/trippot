import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { NotificationBellButton } from '@/components/mypage';

/**
 * 하단 탭 4개. (tabs) 는 route group 이라 URL 에 나타나지 않는다.
 *   app/(tabs)/index.tsx     → /
 *   app/(tabs)/groups.tsx    → /groups
 *   app/(tabs)/community.tsx → /community
 *   app/(tabs)/me.tsx        → /me
 *
 * 상세 화면은 (tabs) 밖에 있어 탭 위로 Stack push 된다. (탭바 숨김 + 뒤로가기)
 *
 * ── 탭바 모양 ──────────────────────────────────────────────────────────────
 * 바닥에 붙는 납작한 바다. 배경·테두리·그림자를 거의 두지 않고 아이콘만 남긴다.
 * 선택된 탭은 아이콘을 검게 채우고, 나머지는 회색 외곽선이다.
 * 알약이나 원형 강조는 쓰지 않는다.
 *
 * ⚠️ 탭바는 4개 탭이 하나를 공유한다. 홈만 다르게 할 수 없다.
 *    모임·마이페이지 담당자도 이 모양을 함께 쓴다.
 *
 * ⚠️ 라벨을 껐지만 title 은 남긴다. 화면 제목이자 스크린 리더가 읽는 이름이다.
 *    지우면 탭을 소리로 구분할 수 없다.
 *
 * ⚠️ 크기 지정은 tabBarStyle.height 하나만 쓴다.
 *    tabBarItemStyle.height 나 tabBarIconStyle 크기를 함께 잡으면
 *    웹에서 아이콘이 바 바깥으로 밀려난다. 아이템은 정렬만 지정한다.
 */
/** 탭바 높이. 기본 49 보다 키워 아이콘 위아래 여백을 준다. */
const BAR_HEIGHT = 68;
const ICON_SIZE = 26;
/** 탭 아이템의 세로 여백(라이브러리 tabVerticalUiKit 의 padding: 5). */
const ITEM_PADDING = 5;

/**
 * 아이콘을 아이템 높이만큼 채워 세로 가운데에 놓는다.
 *
 * ⚠️ tabBarItemStyle 로는 안 된다. 라이브러리가 아이템에
 *    justifyContent: 'flex-start' 를 직접 넣어 아이콘을 위로 붙이는데,
 *    우리 스타일은 바깥 래퍼에 붙어서 그걸 이기지 못한다.
 *    그래서 아이콘 쪽에서 높이를 채워 가운데를 잡는다.
 */
function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  return (
    <View
      style={{
        // 높이를 계산하지 않고 아이템이 주는 세로 공간을 전부 채운다.
        // 라벨 자리가 남아 있어도 그만큼 같이 늘어나므로 아이콘이 항상 가운데다.
        flex: 1,
        // 아이템에 라벨 자리가 남아 아이콘을 위로 밀 때가 있다. 최소 높이로 눌러 준다.
        minHeight: BAR_HEIGHT - ITEM_PADDING * 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Ionicons
        name={(focused ? name : `${name}-outline`) as keyof typeof Ionicons.glyphMap}
        size={ICON_SIZE}
        color={color}
      />
    </View>
  );
}
const ACTIVE = '#111827';
const INACTIVE = '#9AA3AE';

/**
 * 헤더 알림 아이콘(MY-01)을 눌렀을 때.
 *
 * ⚠️ TODO: 갈 화면이 아직 없다. 프로젝트 전체에 알림 목록 화면·route·query·테이블이
 *    하나도 없어서 임의 route 를 만들지 않았다. 목적지가 확정되면 여기만 채운다.
 *    (설정 > 알림 = 수신 여부 설정, 이 버튼 = 받은 알림 목록. 서로 다른 화면이다)
 */
function handlePressNotifications() {}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        // showLabel 만으로는 빈 라벨 자리가 남아 아이콘이 위로 밀린다.
        // 라벨 자체를 그리지 않게 해서 자리를 없앤다.
        tabBarLabel: () => null,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          // 선을 긋지 않는다. 바가 화면에서 도드라지지 않게 둔다.
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          // 기본 높이(49)는 아이콘이 위쪽 가장자리에 붙는다.
          // 높이만 키우면 아이콘이 가운데로 다시 잡혀 위아래 여백이 함께 늘어난다.
          // ⚠️ tabBarItemStyle / tabBarIconStyle 높이는 건드리지 않는다. 웹에서 밀려난다.
          height: BAR_HEIGHT,
          // ⚠️ react-navigation 은 안전영역(홈 인디케이터 자리)을 바 안쪽 아래 여백으로
          //    더한다. 지정한 높이에 그게 얹히면서 아이콘이 위로 붙어 보인다.
          //    여백을 0 으로 눌러 바 전체를 아이콘 영역으로 쓴다.
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          // 홈은 티켓 카드가 화면을 끌고 가는 구조라 제목 줄을 두지 않는다.
          // ⚠️ 헤더를 끄면 내용이 상태바 밑으로 들어간다. HomeView 가 안전영역을 준다.
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: '모임',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="people" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          // 본문의 "커뮤니티" 제목이 화면 제목 역할을 한다. 줄을 두 번 쓰지 않는다.
          // ⚠️ 헤더를 끄면 내용이 상태바 밑으로 들어간다. PostListView 가 안전영역을 준다.
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="chatbubble" focused={focused} color={color} />
          ),
        }}
      />
      {/*
        ⚠️ 아래 헤더 설정은 마이페이지 탭에만 적용된다. 다른 탭 세 개는 건드리지 않는다.
           (홈·커뮤니티는 headerShown: false, 모임은 기본 헤더 그대로)
      */}
      <Tabs.Screen
        name="me"
        options={{
          title: '마이페이지',
          // ⚠️ react-navigation 의 headerTitleAlign 기본값은 iOS 만 'center' 이고
          //    Android·Web 은 'left' 다. 그래서 시뮬레이터에서는 가운데였는데
          //    웹에서만 제목이 왼쪽에 붙었다. 플랫폼과 무관하게 중앙으로 고정한다.
          //
          //    'center' 를 주면 헤더의 좌/우 컨테이너가 같은 비율로 늘어나므로,
          //    오른쪽에 알림 아이콘이 있어도 제목은 화면 기준 중앙을 유지한다.
          headerTitleAlign: 'center',
          // 디자인 문서에 헤더 전용 font 값이 없다. 정책("중앙 · Bold 계열")만 따르고
          // 크기는 화면 안 섹션 제목(18)과 같은 단을 쓴다. 색은 pot.ink 다.
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: ACTIVE },
          headerRight: () => <NotificationBellButton onPress={handlePressNotifications} />,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="person" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
