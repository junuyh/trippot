import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

type Props = {
  /** 열려 있으면 대상 모임명, 닫혀 있으면 null. */
  groupName: string | null;
  /** 대표 이미지 유무에 따라 '추가' / '변경' 으로 문구가 바뀐다. */
  hasImage: boolean;
  onClose: () => void;
  onPressRename: () => void;
  onPressSetImage: () => void;
  onPressManageMembers: () => void;
};

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

/**
 * 모임 관리 메뉴. 카드의 More 버튼으로만 열린다.
 *
 * 프로젝트에 BottomSheet / ActionSheet 공통 컴포넌트가 없어서
 * react-native 기본 Modal 로 최소 구현했다. 새 라이브러리를 추가하지 않는다.
 * 공통으로 쓸 일이 생기면 components/ui/ 로 올릴지 사람에게 확인한다.
 *
 * ⚠️ 인원 수를 직접 고치는 항목을 두지 않는다. 인원은 모임원 데이터에서 계산되는
 *    값이라 '모임원 관리' 로만 바뀐다.
 */
export function GroupMoreMenu({
  groupName,
  hasImage,
  onClose,
  onPressRename,
  onPressSetImage,
  onPressManageMembers,
}: Props) {
  const items: MenuItem[] = [
    { label: '모임 이름 수정', icon: 'pencil', onPress: onPressRename },
    {
      label: hasImage ? '대표 이미지 변경' : '대표 이미지 추가',
      icon: 'image-outline',
      onPress: onPressSetImage,
    },
    { label: '모임원 관리', icon: 'people-outline', onPress: onPressManageMembers },
  ];

  return (
    <Modal
      visible={groupName !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* 바깥을 누르면 닫힌다. */}
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        {/* 시트 안쪽 터치가 바깥으로 새지 않게 Pressable 로 한 번 막는다. */}
        <Pressable className="rounded-t-2xl bg-white px-5 pb-9 pt-5" onPress={() => {}}>
          <Text className="text-sm font-medium text-gray-500" numberOfLines={1}>
            {groupName}
          </Text>

          <View className="mt-3">
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={item.onPress}
                className="flex-row items-center py-4 active:bg-gray-50"
              >
                <Ionicons name={item.icon} size={20} color="#6b7280" />
                <Text className="ml-3 text-base text-gray-900">{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            className="mt-2 items-center rounded-xl bg-gray-100 py-3.5 active:bg-gray-200"
          >
            <Text className="text-base font-medium text-gray-900">닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
