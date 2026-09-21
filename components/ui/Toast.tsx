// ============================================================================
// 화면 아래에 잠깐 떴다 사라지는 알림
//
// ⚠️ 왜 만들었나 (2026-09-21 2차 테스트)
//    거래 상세의 안내가 본문 한가운데 회색 글씨로 적혀 있었고 사라지지도
//    않았다. "세부 계획이 없다" 같은 말은 **지금 누른 것에 대한 대답**이라
//    본문에 눌어붙어 있으면 안 되고, 눈에 들어와야 한다.
//
// ⚠️ Alert 를 쓰지 않는다. 확인 버튼을 누르게 할 일이 아니다. 사용자는
//    읽고 계속 하던 일을 하면 된다.
//
// ⚠️ 스스로 사라진다. 닫기 버튼을 두지 않는다.
//
// 쓰는 법
//   const toast = useToast();
//   toast.show('세부 계획이 없어요');
//   ...
//   <Toast state={toast.state} />
// ============================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

const DEFAULT_MS = 2200;

export type ToastState = {
  message: string | null;
  /** 같은 문구를 다시 띄워도 애니메이션이 다시 돌게 하는 값 */
  nonce: number;
};

export function useToast() {
  const [state, setState] = useState<ToastState>({ message: null, nonce: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, ms: number = DEFAULT_MS) => {
    if (timer.current) clearTimeout(timer.current);
    setState((prev) => ({ message, nonce: prev.nonce + 1 }));
    timer.current = setTimeout(
      () => setState((prev) => ({ ...prev, message: null })),
      ms,
    );
  }, []);

  // 화면을 떠날 때 타이머를 남기지 않는다
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { state, show };
}

export function Toast({ state }: { state: ToastState }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: state.message ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [opacity, state.message, state.nonce]);

  // 사라진 뒤에는 터치를 가로채지 않는다
  if (!state.message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 42,
        opacity,
        alignItems: "center",
      }}
    >
      <View
        style={{
          maxWidth: "100%",
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: 999,
          backgroundColor: "rgba(20, 27, 40, 0.92)",
        }}
      >
        <Text style={{ fontSize: 12, lineHeight: 17, color: "#fff" }}>
          {state.message}
        </Text>
      </View>
    </Animated.View>
  );
}
