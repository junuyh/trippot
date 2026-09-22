// 하단 탭바 — 직접 그린다. (Threads 앱과 같은 납작한 바)
//
// ⚠️ react-navigation 기본 탭바를 쓰지 않는 이유:
//    아이템에 justifyContent: 'flex-start' 와 라벨 자리가 내부 스타일로 박혀 있어
//    바깥에서 tabBarItemStyle / tabBarIconStyle 로 아무리 정렬을 줘도 이기지 못한다.
//    아이콘이 알약 밖으로 밀리거나 위쪽에 붙는 문제가 반복됐다.
//    tabBar prop 으로 통째로 대체하면 레이아웃을 전부 우리가 잡는다.
//
// ⚠️ 대신 라이브러리가 해주던 것을 직접 해야 한다.
//    · 안전영역(홈 인디케이터) 아래 여백
//    · tabPress 이벤트와 기본 동작(preventDefault) 존중
//    · 접근성 라벨·선택 상태
//
// ⚠️ position: 'absolute' 를 유지한다. 바를 화면 흐름 안에 넣으면 모든 화면의
//    본문 높이가 줄어, 이미 pb-24~28 을 넣어 둔 화면들이 아래쪽만 비어 보인다.
//    지금처럼 본문 위에 떠 있으면 각 화면의 바닥 여백이 그대로 맞는다.
//
// 파일 이름은 그대로 둔다. 팀원 브랜치에서 이 경로를 import 하고 있다.
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND } from '@/lib/constants/brandColor';

/** 아이콘이 놓이는 줄 높이. 안전영역은 이 아래에 더 붙는다. */
const BAR_HEIGHT = 50;
/** 안전영역이 없는 기기에서 바닥과 띄우는 최소 간격. */
const BAR_BOTTOM_MIN = 8;
const ICON_SIZE = 25;

const BAR_BG = '#FFFFFF';
/** 본문과 바를 가르는 실선. 진하면 바가 무거워 보인다. */
const BAR_LINE = '#EEF0F3';
const ICON_ACTIVE = BRAND.primary;
const ICON_INACTIVE = '#B6BCC6';

/**
 * 라우트 이름 → 아이콘. 여기 없는 라우트는 탭바에 그리지 않는다.
 *
 * 선택된 탭만 꽉 찬 아이콘을 쓴다. Threads 와 같은 방식이라
 * 라벨 없이도 지금 어느 탭인지 알 수 있다.
 */
const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'home', off: 'home-outline' },
  groups: { on: 'people', off: 'people-outline' },
  community: { on: 'chatbubble', off: 'chatbubble-outline' },
  me: { on: 'person', off: 'person-outline' },
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, BAR_BOTTOM_MIN),
        backgroundColor: BAR_BG,
        borderTopWidth: 1,
        borderTopColor: BAR_LINE,
      }}
    >
      <View style={{ flexDirection: 'row', height: BAR_HEIGHT, alignItems: 'center' }}>
        {state.routes.map((route, index) => {
          const icon = ICONS[route.name];
          if (!icon) return null;

          const { options } = descriptors[route.key];
          const focused = state.index === index;

          function handlePress() {
            // 기본 동작을 막을 수 있게 이벤트를 먼저 보낸다. (라이브러리와 동일)
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) return;
            if (route.name === 'groups') {
              /*
                하단 [모임] 아이콘을 **직접** 누르면 상단 탭을 [여행]으로 되돌린다 — 이미 그 탭에 있어 [모임]을
                보고 있어도 다시 누르면 [여행]. (2026-09-21 확정 정책)
                ⚠️ reset 은 도장이다. 같은 tab=trips 가 연달아 오면 화면이 변화를 못 알아채서 매번 다른 값을 붙인다.
                   상세에서 돌아오기 · 포커스 · 복원은 이 경로를 타지 않으므로 보던 탭이 유지된다.
                   (app/(tabs)/groups.tsx 의 useEffect 가 tab · reset 을 본다)
              */
              // ⚠️ BottomTabBarProps 의 navigation 은 params 타입을 모른다(never). 객체 형태로 넘긴다.
              navigation.navigate({
                name: route.name,
                params: { tab: 'trips', reset: String(Date.now()) },
              } as never);
              return;
            }
            if (!focused) {
              navigation.navigate(route.name);
            }
          }

          function handleLongPress() {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              // 라벨을 그리지 않으므로 화면 제목을 읽어 준다.
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
              onPress={handlePress}
              onLongPress={handleLongPress}
              style={{
                flex: 1,
                height: BAR_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={focused ? icon.on : icon.off}
                size={ICON_SIZE}
                color={focused ? ICON_ACTIVE : ICON_INACTIVE}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
