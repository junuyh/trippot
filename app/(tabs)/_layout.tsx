import { Tabs } from 'expo-router';

import { NotificationBellButton } from '@/components/mypage';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';

/**
 * 하단 탭 4개. (tabs) 는 route group 이라 URL 에 나타나지 않는다.
 *   app/(tabs)/index.tsx     → /
 *   app/(tabs)/groups.tsx    → /groups
 *   app/(tabs)/community.tsx → /community
 *   app/(tabs)/me.tsx        → /me
 *
 * 상세 화면은 (tabs) 밖에 있어 탭 위로 Stack push 된다. (탭바 숨김 + 뒤로가기)
 *
 * ⚠️ 탭바는 components/navigation/FloatingTabBar 에서 직접 그린다.
 *    기본 탭바는 아이템 정렬이 내부 스타일로 박혀 있어 아이콘이 알약 밖으로
 *    밀리는 문제를 밖에서 고칠 수 없었다. 자세한 이유는 그 파일 주석에 있다.
 *
 * ⚠️ 탭바는 4개 탭이 하나를 공유한다. 홈만 다르게 할 수 없다.
 *    모임·마이페이지 담당자도 이 모양을 함께 쓴다.
 *
 * ⚠️ 바가 떠 있어 화면 아래쪽 내용을 가린다.
 *    각 탭의 스크롤 컨테이너가 pb-28 이상으로 여백을 준다.
 *
 * title 은 남긴다. 화면 제목이자 탭바가 읽는 접근성 이름이다.
 */

/**
 * 헤더 제목 색. tailwind.config.js 의 `pot.ink` 와 같은 값이다.
 *
 * headerTitleStyle 은 style 객체만 받아 className 을 쓸 수 없다.
 * 토큰을 새로 만들지 않고 기존 값을 그대로 적는다.
 */
const HEADER_INK = '#111827';

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
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          // 홈은 티켓 카드가 화면을 끌고 가는 구조라 제목 줄을 두지 않는다.
          headerShown: false,
        }}
      />
      <Tabs.Screen name="groups" options={{ title: '모임' }} />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          // 본문의 "커뮤니티" 제목이 화면 제목 역할을 한다.
          headerShown: false,
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
          // 크기는 화면 안 섹션 제목(18)과 같은 단을 쓴다.
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: HEADER_INK },
          headerRight: () => <NotificationBellButton onPress={handlePressNotifications} />,
        }}
      />
    </Tabs>
  );
}
