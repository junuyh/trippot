// 공통 바텀시트.
//
// 계획 추가 · 지출 직접 입력 · 설정 예산 수정이 같은 껍데기를 쓴다.
// 별도 라우트를 만들지 않고 화면 내부 상태로 처리한다. (docs/04_v3 §6)
//
// ⚠️ 키보드가 올라올 때 입력칸이 가리지 않도록 KeyboardAvoidingView 를 쓴다.
//    금액·날짜를 넣는 시트라 입력칸이 아래쪽에 몰려 있다.
//
// ⚠️ Modal 의 animationType="slide" 를 쓰지 않는다. 그건 **모달 안의 모든 것**을
//    함께 밀어 올려서, 뒤를 덮는 어두운 배경까지 아래에서 위로 따라 올라온다.
//    배경은 제자리에서 나타나고 시트만 올라와야 한다. 그래서 배경은 opacity 로,
//    시트는 translateY 로 따로 움직인다. (2026-09-09)
//    Animated 는 react-native 내장이라 새 라이브러리가 아니다.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** 시트가 아래에서 올라오는 거리. 화면 높이면 어떤 시트든 완전히 밖에서 시작한다. */
const TRAVEL = Dimensions.get("window").height;

const OPEN_MS = 220;
const CLOSE_MS = 180;

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** 하단 고정 영역. 보통 취소 / 확인 버튼 */
  footer?: ReactNode;
  /**
   * 시트의 최소 높이. `'46%'` 처럼 화면 비율로 준다.
   *
   * 내용이 적어도 시트가 납작하게 눌리지 않게 할 때 쓴다.
   * **넘기지 않으면 지금까지와 똑같이 내용만큼만 차지한다.** 기존 사용처의
   * 높이를 바꾸지 않으려고 optional 로 둔다.
   */
  minHeight?: number | string;
  /**
   * 제목 정렬. 기본은 지금까지와 같은 왼쪽이다.
   *
   * `'center'` 는 제목 아래에 가운데로 놓인 내용이 오는 시트에서만 쓴다.
   * **기본값을 바꾸지 않는다** — 기존 시트들의 정렬이 달라지면 안 된다.
   */
  titleAlign?: 'left' | 'center';
};

export function BottomSheet({
  visible,
  title,
  description,
  onClose,
  children,
  footer,
  minHeight,
  titleAlign = 'left',
}: Props) {
  /**
   * 닫는 동작이 끝날 때까지 Modal 을 살려 둔다.
   *
   * visible 이 false 가 되는 순간 Modal 을 내려 버리면 내려가는 모습이 보이지
   * 않고 그냥 사라진다.
   */
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRAVEL, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      // ⚠️ none 이다. 움직임은 아래에서 직접 만든다. slide 로 두면 배경까지 따라 올라온다.
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/*
          어두운 배경. 화면 전체에 고정이고 **자리를 옮기지 않는다.**
          나타나고 사라지는 것만 opacity 로 표현한다.
        */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(17,24,39,0.38)", opacity: progress },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/*
          ⚠️ pointerEvents="box-none" 이라 시트 바깥을 누르면 위 배경까지 그대로
             전달된다. 바깥을 눌러 닫는 동작이 그대로 유지된다.
        */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{
              maxHeight: "86%",
              ...(minHeight === undefined ? null : { minHeight: minHeight as number }),
              backgroundColor: "#fff",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingBottom: 24,
              transform: [{ translateY }],
            }}
          >
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 5,
                backgroundColor: "#d9dde2",
                alignSelf: "center",
                marginTop: 9,
                marginBottom: 14,
              }}
            />

            <View
              className="flex-row items-start"
              style={{ paddingHorizontal: 18 }}
            >
              {/* 가운데 정렬일 때 오른쪽 닫기 버튼(30) 만큼 왼쪽을 비워
                  제목이 화면 정중앙에 오게 한다. */}
              {titleAlign === "center" ? <View style={{ width: 30 }} /> : null}

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: "#111827",
                    textAlign: titleAlign,
                  }}
                >
                  {title}
                </Text>
                {description ? (
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      lineHeight: 16,
                      color: "#858e9c",
                      textAlign: titleAlign,
                    }}
                  >
                    {description}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="닫기"
                onPress={onClose}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#f5f6f8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={17} color="#66707e" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 4,
                paddingBottom: 8,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>

            {footer ? (
              <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
