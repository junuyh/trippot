// ============================================================================
// 지출 기록 방법 고르기 (FUND-01 '지출' 버튼)
//
//   📷 영수증 촬영         카메라로 찍어 읽는다
//   🖼 앨범에서 영수증     이미 찍어 둔 사진
//   ✏️ 직접 입력           지금까지의 폼
//
// ⚠️ 영수증으로 읽어도 저장은 사용자가 폼에서 확인하고 누른다. 여기서는
//    방법만 고른다. supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui";
import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: CountryTheme;
  onCamera: () => void;
  onLibrary: () => void;
  onManual: () => void;
  /** 시트가 완전히 내려간 뒤. 화면이 이때 사진 선택기를 연다 */
  onDismiss?: () => void;
};

function Row({
  icon,
  label,
  description,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center active:bg-gray-50"
      style={{
        gap: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 14,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f3f5f7",
        }}
      >
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}>{label}</Text>
        <Text style={{ marginTop: 3, fontSize: 11, color: "#858e9c" }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color="#c2c8d0" />
    </Pressable>
  );
}

export function ReceiptSourceSheet({ visible, onClose, theme, onCamera, onLibrary, onManual, onDismiss }: Props) {
  return (
    <BottomSheet
      visible={visible}
      title="지출 기록"
      description="영수증을 찍으면 가맹점·금액·날짜를 읽어서 채워 드려요. 확인만 하고 기록하면 돼요."
      onClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={{ gap: 9, paddingTop: 12, paddingBottom: 4 }}>
        <Row
          icon="camera-outline"
          label="영수증 촬영"
          description="지금 받은 영수증을 바로 찍어요"
          accent={theme.primary}
          onPress={onCamera}
        />
        <Row
          icon="images-outline"
          label="앨범에서 영수증 고르기"
          description="찍어 둔 영수증 사진을 골라요"
          accent={theme.primary}
          onPress={onLibrary}
        />
        <Row
          icon="create-outline"
          label="직접 입력"
          description="거래명과 금액을 손으로 적어요"
          accent="#5d6674"
          onPress={onManual}
        />
      </View>
    </BottomSheet>
  );
}
