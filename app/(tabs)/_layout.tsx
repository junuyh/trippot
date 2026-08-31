import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

/**
 * 하단 탭 4개. (tabs) 는 route group 이라 URL 에 나타나지 않는다.
 *   app/(tabs)/index.tsx     → /
 *   app/(tabs)/groups.tsx    → /groups
 *   app/(tabs)/community.tsx → /community
 *   app/(tabs)/me.tsx        → /me
 *
 * 상세 화면은 (tabs) 밖에 있어 탭 위로 Stack push 된다. (탭바 숨김 + 뒤로가기)
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          // 홈은 티켓 카드가 화면을 끌고 가는 구조라 제목 줄을 두지 않는다.
          // title 은 남겨 둔다 — 하단 탭 라벨이 이 값을 쓴다.
          // ⚠️ 헤더를 끄면 내용이 상태바 밑으로 들어간다. HomeView 가 안전영역을 준다.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: '모임',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '마이페이지',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
