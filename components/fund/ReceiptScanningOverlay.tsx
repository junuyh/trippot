// 영수증을 읽는 동안 덮는 화면. 10초 안팎 걸리므로 무엇을 하는지 말해 준다.
// ⚠️ 취소 버튼을 두지 않는다. 취소해도 요청은 이미 나가 있고, 결과가 오면 폼만 안 열면 된다.
import { ActivityIndicator, Modal, Text, View } from "react-native";

type Props = { visible: boolean };

export function ReceiptScanningOverlay({ visible }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(17,24,39,0.45)",
        }}
      >
        <View
          style={{
            width: 220,
            alignItems: "center",
            gap: 12,
            borderRadius: 18,
            backgroundColor: "#fff",
            paddingHorizontal: 20,
            paddingVertical: 24,
          }}
        >
          <ActivityIndicator size="large" color="#111827" />
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>영수증을 읽는 중</Text>
          <Text style={{ fontSize: 11, lineHeight: 16, color: "#7c8695", textAlign: "center" }}>
            가맹점·금액·날짜를 찾고 있어요.{"\n"}10초 정도 걸려요.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
