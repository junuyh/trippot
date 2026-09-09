// ============================================================================
// 끌어서 옮기고 두 손가락으로 키우는 스티커 (여행 기록 스토리 이미지)
//
// 인스타그램 스토리처럼 도시명·지도·멤버 이름을 사용자가 원하는 자리에 놓게 한다.
// 자동 배치는 어디까지나 시작값이고, 사진마다 잘 보이는 자리가 다르다.
//
//   한 손가락 끌기   위치
//   두 손가락 핀치   크기 (scale). 부모가 값을 들고 있어서 버튼으로도 바꿀 수 있다
//   톡 치기          선택 (onTap). 부모가 글꼴·크기 패널을 그 텍스트에 맞춘다
//
// ⚠️ react-native-reanimated 를 쓰지 않는다. Expo Go 에서 reanimated 초기화가
//    "Exception in HostFunction" 으로 터져 화면 모듈 전체가 못 뜬다(2026-09-08).
//    제스처는 gesture-handler 의 JS 콜백(runOnJS)으로 받고, 값은 RN 기본
//    Animated.Value 에 넣는다. 스티커 세 개 움직이는 데는 이걸로 충분하다.
//
// ⚠️ 위치·크기는 저장하지 않는다. 캡처 한 장에만 쓰는 값이라 화면 상태로 충분하다.
//
// ⚠️ 드래그 중에는 부모 ScrollView 가 스크롤하면 안 된다. 손가락이 위아래로
//    움직이면 시트가 따라 움직여 스티커를 놓칠 수 있다. onActiveChange 로
//    부모에게 알려 scrollEnabled 를 끄게 한다.
//
// ⚠️ 선택 테두리(selected)는 캡처 전에 반드시 꺼야 한다. 이미지에 점선이 남는다.
// ============================================================================
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export const STICKER_MIN_SCALE = 0.5;
export const STICKER_MAX_SCALE = 2.5;

export function clampStickerScale(value: number): number {
  return Math.min(STICKER_MAX_SCALE, Math.max(STICKER_MIN_SCALE, value));
}

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  /** 크기. 부모가 들고 있다. 핀치하면 onScaleChange 로 돌려준다 */
  scale?: number;
  onScaleChange?: (scale: number) => void;
  /** 톡 쳤을 때. 선택용 */
  onTap?: () => void;
  /** 선택된 상태. 점선 테두리를 그린다 */
  selected?: boolean;
  /** 손가락이 닿아 있는 동안 true */
  onActiveChange?: (active: boolean) => void;
};

export function DraggableSticker({
  children,
  style,
  scale = 1,
  onScaleChange,
  onTap,
  selected = false,
  onActiveChange,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(scale)).current;
  // 제스처 시작 시점의 값. 이동량은 여기에 더한다
  const start = useRef({ x: 0, y: 0, scale: 1 });
  // Animated.Value 는 값을 바로 읽을 수 없어서 마지막 값을 따로 들고 있는다
  const current = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(scale);

  // 부모가 버튼으로 크기를 바꾸면 따라간다
  useEffect(() => {
    scaleRef.current = scale;
    scaleAnim.setValue(scale);
  }, [scale, scaleAnim]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(2)
      .runOnJS(true)
      .onBegin(() => {
        start.current.x = current.current.x;
        start.current.y = current.current.y;
        onActiveChange?.(true);
      })
      .onUpdate((event) => {
        current.current.x = start.current.x + event.translationX;
        current.current.y = start.current.y + event.translationY;
        translateX.setValue(current.current.x);
        translateY.setValue(current.current.y);
      })
      .onFinalize(() => {
        onActiveChange?.(false);
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        start.current.scale = scaleRef.current;
      })
      .onUpdate((event) => {
        const next = clampStickerScale(start.current.scale * event.scale);
        scaleRef.current = next;
        scaleAnim.setValue(next);
        onScaleChange?.(next);
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        onTap?.();
      });

    // 움직이면 끌기·핀치, 안 움직이고 떼면 탭
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [onActiveChange, onScaleChange, onTap, scaleAnim, translateX, translateY]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          style,
          {
            transform: [{ translateX }, { translateY }, { scale: scaleAnim }],
            // 선택 테두리. 레이아웃을 밀지 않도록 여백만큼 음수 마진을 준다
            padding: 4,
            margin: -4,
            borderWidth: 1,
            borderRadius: 6,
            borderStyle: 'dashed',
            borderColor: selected ? 'rgba(255,255,255,0.85)' : 'transparent',
          },
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
