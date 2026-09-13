// 1-4. 새 여행 만들기 — 화면에 떠 있는 버튼(FAB). (docs/09_IA_v2.md §1-4)
//
// 2026-09-09 카드에서 FAB 으로 바꿨다. (CreateTripCard 는 남겨 두었다)
//
//   맨 위일 때                        내려갔을 때
//   ┌──────────────────────┐          ┌────┐
//   │  +  새 여행 만들기    │   →      │ +  │
//   └──────────────────────┘          └────┘
//
// 왜 이렇게 하는가
//   · 카드는 스크롤을 따라 화면 밖으로 사라진다. 지난 여행을 훑고 있는
//     사람이 "그럼 새로 만들자" 고 마음먹은 순간 버튼이 화면에 없다.
//     FAB 은 어디까지 내려가도 남아 있다.
//   · 처음 보는 화면에서는 글자가 있어야 이게 무슨 버튼인지 알 수 있고,
//     한 번 읽은 뒤에는 아이콘만으로 충분하다. 그래서 접었다 편다.
//     내용을 읽는 동안 버튼이 본문을 덜 가린다.
//
// ⚠️ 색은 짙은 보라(HOME_FAB, #4941B8) 하나다. palette.ts 에 이 버튼 전용으로 두었고,
//    새로 만들지 않았다. 국가 색(countryTheme)은 여행을 구분하는 자리에만 쓴다.
//
// ⚠️ 하단 탭바(FloatingTabBar) 가 화면 위에 떠 있어서, 그 높이만큼 띄운다.
//    탭바는 아이콘 줄 50 + 안전영역이다. 그 값이 바뀌면 여기도 같이 봐야 한다.
//
// ⚠️ 접었다 펼 때 폭이 변한다. 글자 폭은 폰트에 따라 달라지므로 숫자를 박지 않고
//    보이지 않는 글자를 한 번 그려서 실제 폭을 잰다.
//
// 데이터·동작은 props 로만 받는다. supabase / track() 을 직접 부르지 않는다.
// (CLAUDE.md 9장)
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HOME_FAB } from './palette';

type Props = {
  /** true 면 글자까지 있는 알약, false 면 아이콘만 있는 동그라미. */
  expanded: boolean;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LABEL = '새 여행 만들기';
/** 접었을 때 지름. 편 뒤에도 높이는 그대로다. */
const SIZE = 46;
const ICON = 21;
/** 아이콘 왼쪽 여백. (SIZE - ICON) / 2 라 접으면 정확히 가운데가 된다. */
const PAD = (SIZE - ICON) / 2;
/** 아이콘과 글자 사이. */
const GAP = 6;
/** 글자 오른쪽 여백을 왼쪽보다 조금 넉넉하게 준다. */
const PAD_RIGHT_EXTRA = 4;

/** 탭바 아이콘 줄 높이. FloatingTabBar 의 BAR_HEIGHT 와 같은 값이다. */
const TAB_BAR_HEIGHT = 50;
/** 탭바 위로 띄우는 간격. */
const LIFT = 14;

export function CreateTripFab({ expanded, onPress }: Props) {
  const insets = useSafeAreaInsets();

  /** 0 = 접힘, 1 = 펼침. 폭·투명도를 같이 움직이므로 네이티브 드라이버를 못 쓴다. */
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  /** 실제로 잰 글자 폭. 재기 전에는 0 이라 접힌 모양으로 그려진다. */
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, expanded]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SIZE, SIZE + GAP + labelWidth + PAD_RIGHT_EXTRA],
  });
  const labelBoxWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, GAP + labelWidth],
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT + LIFT,
      }}
    >
      {/* 글자 폭 재기용. 보이지 않고 누를 수도 없다. */}
      <Text
        pointerEvents="none"
        numberOfLines={1}
        onLayout={(e) => setLabelWidth(Math.ceil(e.nativeEvent.layout.width))}
        style={{
          position: 'absolute',
          opacity: 0,
          fontSize: 13,
          fontWeight: '800',
          letterSpacing: -0.4,
        }}
      >
        {LABEL}
      </Text>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={LABEL}
        onPress={onPress}
        style={{
          width,
          height: SIZE,
          borderRadius: SIZE / 2,
          paddingLeft: PAD,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          backgroundColor: HOME_FAB,
          shadowColor: HOME_FAB,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={ICON} color="#FFFFFF" />

        {/* 접힐 때 글자가 잘려 나가도록 폭을 0 까지 줄인다. */}
        <Animated.View style={{ width: labelBoxWidth, opacity: anim, overflow: 'hidden' }}>
          <Text
            numberOfLines={1}
            style={{
              width: labelWidth,
              marginLeft: GAP,
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: -0.4,
              color: '#FFFFFF',
            }}
          >
            {LABEL}
          </Text>
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
}
