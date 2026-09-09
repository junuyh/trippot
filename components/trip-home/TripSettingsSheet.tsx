// ============================================================================
// 여행 설정 사이드 시트 (TRIP-HOME-01/02 · 2026-09-09)
//
// 헤더 오른쪽 톱니바퀴를 누르면 **오른쪽에서** 밀려 나온다. 바텀시트가 아니라
// 사이드 시트인 이유: 여기 있는 건 여행 홈의 내용이 아니라 여행 자체를 다루는
// 메뉴(정보 수정 · 나가기 · 취소)라, 화면 내용 위에 얹히는 바텀시트보다
// 옆에서 나오는 서랍이 "설정" 으로 읽힌다.
//
//   여행 정보 수정   기존 /trips/:tripId/edit
//   여행 나가기      이 여행과 멤버 목록에서 빠진다        [팀원 개발 예정]
//   여행 취소하기    모임원 전원 동의 → 취소. 동의 완료 시점부터 72시간 안에
//                    되돌릴 수 있다                       [팀원 개발 예정]
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 눌렀을 때 무엇을
//    할지는 전부 화면 파일이 넘긴다. (CLAUDE.md 9장)
// ⚠️ 나가기·취소의 실제 동작은 다른 팀원이 만든다. 여기서는 버튼과 설명만 둔다.
//    화면 파일의 onLeave / onCancel 이 그 자리다.
// ⚠️ 나가기는 모임 여행에서만 뜬다. 혼자 가는 여행에서 '나가기' 는 곧 삭제라
//    다른 이야기다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PANEL_W = Math.min(300, Math.round(Dimensions.get("window").width * 0.78));
const INK = "#111827";
const MUTED = "#8b94a2";
const DANGER = "#d1373f";
const HAIR = "#eef0f3";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 헤더에 띄우는 여행 이름 */
  destination: string;
  /** 모임 여행이면 모임 이름, 아니면 null. null 이면 '나가기' 를 숨긴다 */
  groupName: string | null;
  onEdit: () => void;
  onLeave: () => void;
  onCancel: () => void;
};

function Item({
  icon,
  label,
  description,
  color = INK,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center active:bg-gray-50"
      style={{ gap: 12, paddingHorizontal: 18, paddingVertical: 14 }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color === DANGER ? "#fff2f2" : "#f3f5f7",
        }}
      >
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color }}>{label}</Text>
        <Text style={{ marginTop: 3, fontSize: 11, lineHeight: 15, color: MUTED }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color="#c3c9d1" />
    </Pressable>
  );
}

export function TripSettingsSheet({
  visible,
  onClose,
  destination,
  groupName,
  onEdit,
  onLeave,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  // 오른쪽 밖(PANEL_W)에서 0 으로 밀려 들어온다
  const slide = useRef(new Animated.Value(PANEL_W)).current;
  useEffect(() => {
    if (!visible) {
      slide.setValue(PANEL_W);
      return;
    }
    Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [slide, visible]);

  /** 항목을 누르면 먼저 닫고 화면이 다음 일을 한다 */
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(17,24,39,0.38)" }}
        />
        <Animated.View
          style={{
            width: PANEL_W,
            backgroundColor: "#fff",
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX: slide }],
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: -6, height: 0 },
            elevation: 12,
          }}
        >
          {/* 머리 */}
          <View
            className="flex-row items-center justify-between"
            style={{ paddingLeft: 18, paddingRight: 10, paddingBottom: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.2, color: "#a8afb9" }}>
                TRIP SETTINGS
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 17, fontWeight: "800", color: INK }}>
                {destination}
              </Text>
              {groupName ? (
                <Text style={{ marginTop: 2, fontSize: 11, color: MUTED }}>{groupName}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              hitSlop={8}
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
            >
              <Ionicons name="close" size={20} color={INK} />
            </Pressable>
          </View>

          <View style={{ height: 1, backgroundColor: HAIR }} />

          <Item
            icon="create-outline"
            label="여행 정보 수정"
            description="일정 · 인원 · 모임을 고쳐요"
            onPress={run(onEdit)}
          />

          <View style={{ height: 1, backgroundColor: HAIR, marginVertical: 6 }} />

          {groupName ? (
            <Item
              icon="exit-outline"
              label="여행 나가기"
              description="이 여행과 멤버 목록에서 빠져요"
              onPress={run(onLeave)}
            />
          ) : null}
          <Item
            icon="close-circle-outline"
            label="여행 취소하기"
            description="함께 가는 사람 모두가 동의하면 취소돼요. 동의가 끝난 뒤 72시간 안에는 되돌릴 수 있어요."
            color={DANGER}
            onPress={run(onCancel)}
          />

          <View style={{ flex: 1 }} />
          <Text style={{ paddingHorizontal: 18, fontSize: 10, color: "#b4bac3" }}>
            나가기와 취소는 되돌리기 어려운 일이라 한 번 더 물어봐요.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}
