// 공통 바텀시트.
//
// 계획 추가 · 지출 직접 입력 · 설정 예산 수정이 같은 껍데기를 쓴다.
// 별도 라우트를 만들지 않고 화면 내부 상태로 처리한다. (docs/04_v3 §6)
//
// ⚠️ 키보드가 올라올 때 입력칸이 가리지 않도록 KeyboardAvoidingView 를 쓴다.
//    금액·날짜를 넣는 시트라 입력칸이 아래쪽에 몰려 있다.
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** 하단 고정 영역. 보통 취소 / 확인 버튼 */
  footer?: ReactNode;
  /**
   * 시트가 완전히 내려간 뒤(iOS 만). 시트를 닫고 곧바로 사진 선택기처럼
   * 다른 네이티브 화면을 띄워야 할 때 쓴다. 닫히는 중에 띄우면 iOS 가 무시한다.
   */
  onDismiss?: () => void;
};

export function BottomSheet({
  visible,
  title,
  description,
  onClose,
  children,
  footer,
  onDismiss,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(17,24,39,0.38)" }}
        />

        <View
          style={{
            maxHeight: "86%",
            backgroundColor: "#fff",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingBottom: 24,
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
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
