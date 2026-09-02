// TRIP-01 신규 모임 입력. 모임명 + 동행자 이름.
//
// ⚠️ 동행자는 groups/group_members 가 아니라 trip_members.display_name 으로 저장한다.
//    group_members.user_id 가 NOT NULL + users FK 라 아직 가입하지 않은 사람을
//    모임 멤버로 넣을 수 없다. 모임에는 본인만 OWNER 로 들어간다.
//    (docs/README.md §5 #15)
//
//    초대 코드로 동행자를 실제 사용자와 잇는 기능은 2026-08-29 별도 작업이다.
//    여기서는 이름만 받는다. 초대 UI 를 만들지 않는다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Input } from '@/components/ui';

type Props = {
  groupName: string;
  onChangeGroupName: (value: string) => void;
  /** 모임명 검증 실패 메시지. null 이면 정상 */
  groupNameError: string | null;
  /** 입력칸을 벗어날 때 검증한다. '다음' 이 disabled 라 눌러서는 띄울 수 없다 */
  onBlurGroupName: () => void;

  companionNames: string[];
  onChangeCompanionName: (index: number, value: string) => void;
  onAddCompanion: () => void;
  onRemoveCompanion: (index: number) => void;

  disabled?: boolean;
};

export function NewGroupForm({
  groupName,
  onChangeGroupName,
  groupNameError,
  onBlurGroupName,
  companionNames,
  onChangeCompanionName,
  onAddCompanion,
  onRemoveCompanion,
  disabled = false,
}: Props) {
  return (
    <View className="gap-4">
      <Input
        label="모임 이름"
        required
        value={groupName}
        onChangeText={onChangeGroupName}
        onBlur={onBlurGroupName}
        placeholder="예) 대학동기, 등산모임"
        error={groupNameError}
        editable={!disabled}
        maxLength={20}
        returnKeyType="done"
      />

      <View className="gap-2">
        <View className="flex-row items-baseline">
          <Text className="text-[13px] font-bold text-gray-900">함께 가는 사람</Text>
          <Text className="ml-auto text-[11px] text-gray-400">지금 안 넣어도 괜찮아요</Text>
        </View>

        {/*
          본인은 지울 수 없는 고정 행이다.
          입력칸으로 두면 이름을 비우거나 다른 사람으로 바꿀 수 있게 되는데,
          trip_members 의 OWNER 는 로그인한 사용자로 고정이라 화면과 저장값이 어긋난다.
        */}
        <View className="h-12 flex-row items-center gap-2 rounded-xl bg-gray-100 px-3.5">
          <Ionicons name="person" size={15} color="#6b7280" />
          <Text className="text-sm font-bold text-gray-700">나</Text>
        </View>

        {companionNames.map((name, index) => (
          <View key={index} className="flex-row items-center gap-2">
            <View className="flex-1">
              <Input
                value={name}
                onChangeText={(value) => onChangeCompanionName(index, value)}
                placeholder="이름"
                editable={!disabled}
                maxLength={20}
                accessibilityLabel={`동행자 ${index + 1} 이름`}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`동행자 ${index + 1} 삭제`}
              disabled={disabled}
              onPress={() => onRemoveCompanion(index)}
              className="h-12 w-11 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 active:bg-gray-200"
            >
              <Ionicons name="close" size={16} color="#96a0ae" />
            </Pressable>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="동행자 추가"
          disabled={disabled}
          onPress={onAddCompanion}
          className={`h-12 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 active:bg-gray-50 ${
            disabled ? 'opacity-40' : ''
          }`}
        >
          <Ionicons name="add" size={17} color="#5c6675" />
          <Text className="text-[13px] font-bold text-gray-600">동행자 추가</Text>
        </Pressable>

        <Text className="text-[11px] leading-5 text-gray-400">
          이름만 적어두면 돼요. 초대는 나중에 할 수 있어요.
        </Text>
      </View>
    </View>
  );
}
