// 하단 탭바 — 직접 그린다.
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
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAR_HEIGHT = 54;
const BAR_SIDE = 34;
/** 안전영역이 없는 기기에서 바닥과 띄우는 최소 간격. */
const BAR_BOTTOM_MIN = 14;
/** 아이콘 원형 버튼 지름. */
const DOT_SIZE = 38;
const ICON_SIZE = 19;

const BAR_BG = '#1C2129';
const DOT_ACTIVE = '#4A5361';
const ICON_ACTIVE = '#FFFFFF';
const ICON_INACTIVE = '#98A2B3';

/** 라우트 이름 → 아이콘. 여기 없는 라우트는 탭바에 그리지 않는다. */
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  groups: 'people',
  community: 'chatbubble',
  me: 'person',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: BAR_SIDE,
        right: BAR_SIDE,
        bottom: Math.max(insets.bottom, BAR_BOTTOM_MIN),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: BAR_BG,
          alignItems: 'center',
          // 떠 있는 만큼 그림자를 준다. 없으면 배경에 눌어붙어 보인다.
          shadowColor: '#0B0F16',
          shadowOpacity: 0.3,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
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
            if (!focused && !event.defaultPrevented) {
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
              <View
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: DOT_SIZE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? DOT_ACTIVE : 'transparent',
                }}
              >
                <Ionicons
                  name={icon}
                  size={ICON_SIZE}
                  color={focused ? ICON_ACTIVE : ICON_INACTIVE}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
